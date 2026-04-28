# Implementation Plan: Smart Resource Allocation — Volunteer Coordination Platform (Extension)

## Overview

This plan extends the existing platform with authentication, role-based access, task creation UI, duplicate detection, NGO discovery and claim flow, enhanced task status tracking, volunteer and NGO dashboards, feedback loop, and emergency mode. The existing AI microservice (NLP, priority, matching, geo) and base backend/frontend scaffolding are already complete — do not rebuild them.

---

## Tasks

- [x] 1. Database migrations for new tables and columns
  - [x] 1.1 Add `users` and `ngos` tables
    - Create `db/migrations/006_create_users.sql` — `users` table with `user_id`, `email`, `password_hash`, `role` (`public_user | ngo_admin | volunteer`), `ngo_id` (nullable FK), `created_at`
    - Create `db/migrations/007_create_ngos.sql` — `ngos` table with `ngo_id`, `name`, `email`, `latitude`, `longitude`, `skill_tags TEXT[]`, `created_at`
    - _Requirements: Auth 1.1, 1.2, 1.3_

  - [x] 1.2 Extend existing tables for new workflow
    - Create `db/migrations/008_extend_tasks.sql`:
      - Add `status` values: extend CHECK to `('pending','sent_to_ngo','accepted_by_ngo','volunteers_assigned','in_progress','completed')`
      - Add columns: `submitted_by_user_id VARCHAR(20)`, `contact_number VARCHAR(30)`, `image_url TEXT`, `city VARCHAR(100)`, `assigned_ngo_id VARCHAR(20)`, `ngo_sent_at TIMESTAMPTZ`, `ngo_accepted_at TIMESTAMPTZ`, `urgency_score DOUBLE PRECISION`, `is_emergency BOOLEAN DEFAULT FALSE`, `is_duplicate BOOLEAN DEFAULT FALSE`, `duplicate_of VARCHAR(20)`
    - Create `db/migrations/009_create_ngo_claims.sql` — `ngo_claims` table: `claim_id`, `task_id`, `ngo_id`, `status` (`pending | accepted | rejected | timed_out`), `sent_at`, `responded_at`
    - _Requirements: Task Status 8.1, NGO Claim 6.1, Emergency 12.1_

- [ ] 2. Checkpoint — Run all migrations
  - Run `bash db/migrate.sh` and confirm all 9 migration files apply cleanly
  - Ask the user if questions arise before proceeding.

- [x] 3. JWT Authentication & Role-Based Access
  - [x] 3.1 Install auth dependencies and create middleware
    - Add `jsonwebtoken`, `bcrypt`, `@types/jsonwebtoken`, `@types/bcrypt` to `backend/package.json`
    - Create `backend/src/middleware/auth.ts` — `authenticate` middleware: extract Bearer token from `Authorization` header, verify with `JWT_SECRET`, attach `req.user = { userId, role, ngoId }` to request; return 401 if missing/invalid
    - Create `backend/src/middleware/requireRole.ts` — `requireRole(...roles)` middleware factory: return 403 if `req.user.role` not in allowed roles
    - _Requirements: Auth 1.1_

  - [x] 3.2 Implement auth endpoints
    - Create `backend/src/routes/auth.ts`
    - `POST /api/auth/signup` — accept `{ email, password, role, ngo_id? }`; hash password with `bcrypt` (rounds=10); insert to `users`; return 201 `{ user_id }`
    - `POST /api/auth/login` — look up user by email; compare password hash; sign JWT with `{ userId, role, ngoId }`, expiry 24h; return 200 `{ token, role }`
    - `POST /api/auth/ngo/create-volunteer` — `requireRole('ngo_admin')`; create a `volunteer` role user linked to the NGO admin's `ngo_id`; also insert a row into `volunteers` table; return 201 `{ user_id, volunteer_id }`
    - Mount router in `backend/src/index.ts` at `/api/auth`
    - _Requirements: Auth 1.2, 1.3_

  - [ ]* 3.3 Write unit tests for auth middleware
    - Create `backend/src/tests/auth.test.ts`
    - Test valid JWT is accepted, expired JWT returns 401, missing token returns 401
    - Test `requireRole` allows correct role, blocks incorrect role with 403
    - _Requirements: Auth 1.1_

- [ ] 4. Task Creation with AI Pipeline
  - [ ] 4.1 Update task creation endpoint for public user submissions
    - Modify `backend/src/routes/reports.ts` (or create `backend/src/routes/tasks.create.ts`):
    - `POST /api/tasks/submit` — `authenticate` middleware (role: `public_user`); accept `{ description, city, latitude, longitude, contact_number, image? }`; validate required fields; upload image to local storage if present; call `POST /ai/process` (NLP) → `POST /ai/priority` (priority score); store task with `status = 'pending'`, `submitted_by_user_id`, `urgency_score`, `contact_number`, `image_url`; return 201 `{ task_id }`
    - _Requirements: Task Creation 2.1, Priority 4.1_

  - [ ] 4.2 Integrate duplicate detection before task creation
    - Create `backend/src/services/duplicateDetection.ts`
    - Implement `checkDuplicate(taskId, latitude, longitude, embeddingVector)`: query existing tasks within 5km radius using Haversine bounding box pre-filter; for each candidate call `POST /ai/nlp/similarity` (or compute cosine similarity inline using stored embeddings); if any candidate has similarity > 0.85, return `{ isDuplicate: true, duplicateOf: task_id }`
    - Add `POST /ai/nlp/similarity` endpoint to AI service: `ai-service/nlp/router.py` — accept `{ text_a, text_b }`, return `{ similarity: float }` using TF-IDF cosine similarity (no model needed)
    - In task submission flow: run duplicate check after NLP; if duplicate found, set `is_duplicate = true`, `duplicate_of`, still create task but flag it; return 201 with `{ task_id, is_duplicate, duplicate_of? }`
    - _Requirements: Duplicate Detection 3.1, 3.2, 3.3_

  - [ ] 4.3 Emergency mode — skip NGO flow for high urgency
    - In task submission flow, after priority scoring: if `urgency_score > 0.9`, set `is_emergency = true`, skip NGO discovery, call `POST /ai/match` directly, set status to `volunteers_assigned`, notify volunteers immediately
    - _Requirements: Emergency 12.1_

- [ ] 5. Checkpoint — Task submission pipeline
  - Submit a test task via `POST /api/tasks/submit` and verify NLP, priority, duplicate check, and emergency logic all run correctly
  - Ask the user if questions arise before proceeding.

- [ ] 6. NGO Discovery and Claim Flow
  - [ ] 6.1 Implement NGO discovery service
    - Create `backend/src/services/ngoDiscovery.ts`
    - Implement `findTopNGOs(latitude, longitude, requiredSkills, limit=3)`: query `ngos` table; compute Haversine distance for each NGO; filter NGOs whose `skill_tags` overlap with `requiredSkills`; sort by distance ascending; return top 3
    - _Requirements: NGO Discovery 5.1_

  - [ ] 6.2 Implement NGO claim endpoints
    - Create `backend/src/routes/ngoClaims.ts`
    - `POST /api/tasks/:id/send-to-ngos` — internal/job use; call `findTopNGOs`; insert 3 rows into `ngo_claims` with `status = 'pending'`; update task `status = 'sent_to_ngo'`, set `ngo_sent_at`; send notification to each NGO admin
    - `POST /api/ngo-claims/:claimId/respond` — `requireRole('ngo_admin')`; accept `{ response: 'accepted' | 'rejected' }`; if `accepted`: check no other claim for same task is already `accepted` (first-accept-wins); update claim `status`, set `responded_at`; update task `status = 'accepted_by_ngo'`, `assigned_ngo_id`, `ngo_accepted_at`; reject all other pending claims for that task; trigger volunteer matching; if `rejected`: update claim status only
    - `GET /api/ngo-claims?ngo_id=` — `requireRole('ngo_admin')`; return all claims for the NGO with task details
    - Mount router in `backend/src/index.ts`
    - _Requirements: NGO Claim 6.1, 6.2, 6.3_

  - [ ] 6.3 Auto-assign timeout job
    - Create `backend/src/jobs/ngoTimeout.ts`
    - `node-cron` job every 5 minutes: query tasks with `status = 'sent_to_ngo'` and `ngo_sent_at < NOW() - INTERVAL '30 minutes'`; for each, mark all pending claims as `timed_out`; call `POST /ai/match` directly; set task `status = 'volunteers_assigned'`; notify volunteers
    - Register job in `backend/src/index.ts`
    - _Requirements: NGO Claim 6.4_

- [ ] 7. Volunteer Matching Integration (post-NGO accept)
  - [ ] 7.1 Wire volunteer matching after NGO acceptance
    - Create `backend/src/services/volunteerAssignment.ts`
    - Implement `assignVolunteers(taskId)`: call `POST /ai/match` with task details; update task `assigned_volunteer_ids`, set `status = 'volunteers_assigned'`; call `sendNotification` for each matched volunteer; insert rows into `notifications` table
    - Call `assignVolunteers` from both the NGO accept handler (task 6.2) and the timeout job (task 6.3)
    - _Requirements: Volunteer Matching 7.1_

- [ ] 8. Task Status Tracking
  - [ ] 8.1 Enforce 6-status state machine in Task Manager
    - Update `backend/src/routes/tasks.ts` — `PUT /api/tasks/:id/status`:
      - Validate transitions: `pending → sent_to_ngo`, `sent_to_ngo → accepted_by_ngo`, `accepted_by_ngo → volunteers_assigned`, `volunteers_assigned → in_progress`, `in_progress → completed`
      - Return 400 with `{ error: 'invalid_transition', from, to }` for illegal transitions
      - Set `accepted_at` when transitioning to `in_progress`, `completed_at` when transitioning to `completed`
    - Update `GET /api/tasks` to support filtering by all 6 statuses
    - _Requirements: Task Status 8.1, 8.2_

  - [ ]* 8.2 Write property tests for 6-status state machine
    - Add to `backend/src/tests/tasks.property.test.ts`
    - **Property: Task Status Machine Invariant (extended)** — generate random status transition sequences; assert only valid transitions are accepted (200) and invalid ones return 400
    - **Validates: Requirements Task Status 8.1**

- [ ] 9. Volunteer Dashboard
  - [ ] 9.1 Create volunteer dashboard API endpoints
    - Add to `backend/src/routes/tasks.ts`:
      - `GET /api/volunteer/tasks` — `requireRole('volunteer')`; return tasks where `req.user.volunteerId` is in `assigned_volunteer_ids` and status is `volunteers_assigned` or `in_progress`; include task details, coordinates, contact_number
    - Add `GET /api/volunteer/tasks/map` — same as above but return minimal `{ task_id, latitude, longitude, status, priority_score }` for map rendering
    - _Requirements: Volunteer Dashboard 9.1, 9.2_

  - [ ] 9.2 Build Volunteer Dashboard frontend page
    - Create `frontend/src/app/volunteer/dashboard/page.tsx` — protected route (redirect to login if no token)
    - Create `frontend/src/components/VolunteerTaskList.tsx` — list of assigned tasks with status badge, priority score, city; Accept / Reject buttons calling `PUT /api/tasks/:id/status`; "Mark Complete" button for `in_progress` tasks
    - Create `frontend/src/components/VolunteerMapView.tsx` — `react-leaflet` map showing assigned task pins; click pin to see task details and contact number
    - Reuse existing `FeedbackForm.tsx` — shown after marking complete
    - _Requirements: Volunteer Dashboard 9.1, 9.2, 9.3, 9.4_

- [ ] 10. NGO Dashboard
  - [ ] 10.1 Create NGO dashboard API endpoints
    - Create `backend/src/routes/ngoDashboard.ts`
    - `GET /api/ngo/tasks/incoming` — `requireRole('ngo_admin')`; return tasks with `status = 'sent_to_ngo'` where NGO has a pending claim; include task details, urgency, location
    - `GET /api/ngo/tasks/accepted` — return tasks where `assigned_ngo_id = req.user.ngoId` and status in `['accepted_by_ngo','volunteers_assigned','in_progress','completed']`
    - `GET /api/ngo/volunteers` — return volunteers linked to this NGO (`ngo_id` on user record)
    - `GET /api/ngo/analytics` — return: total tasks accepted, tasks by status counts, average completion time, volunteer performance summary (tasks completed, avg rating)
    - Mount router in `backend/src/index.ts`
    - _Requirements: NGO Dashboard 10.1, 10.2, 10.3, 10.4_

  - [ ] 10.2 Build NGO Dashboard frontend page
    - Create `frontend/src/app/ngo/dashboard/page.tsx` — protected route for `ngo_admin` role
    - Create `frontend/src/components/NGOIncomingTasks.tsx` — list of incoming tasks with Accept / Reject buttons; calls `POST /api/ngo-claims/:claimId/respond`
    - Create `frontend/src/components/NGOAcceptedTasks.tsx` — table of accepted tasks with status, assigned volunteers, last updated
    - Create `frontend/src/components/NGOAnalytics.tsx` — stat cards (total accepted, in-progress, completed) + bar chart of tasks by status using `recharts`
    - _Requirements: NGO Dashboard 10.1, 10.2, 10.3, 10.4_

- [ ] 11. Checkpoint — Dashboards and claim flow
  - Test full NGO claim flow: submit task → NGO receives it → NGO accepts → volunteers assigned → volunteer marks complete
  - Verify volunteer dashboard shows correct tasks and map pins
  - Ask the user if questions arise before proceeding.

- [ ] 12. Feedback Loop — Volunteer Rating Update
  - [ ] 12.1 Wire post-completion feedback to volunteer rating
    - Update `backend/src/routes/feedback.ts` — `POST /api/feedback`:
      - Add `authenticate` middleware; validate `volunteer_id` matches `req.user.volunteerId` or requester is `ngo_admin`
      - After storing feedback, update `volunteers.rating` using weighted rolling average: `new_rating = old_rating * 0.8 + new_score * 0.2`
      - Update task status to `completed` if not already
    - _Requirements: Feedback 11.1, 11.2_

  - [ ]* 12.2 Write unit tests for rating update
    - Add to `backend/src/tests/feedback.property.test.ts`
    - Test that submitting feedback with known scores produces the correct weighted rolling average rating
    - _Requirements: Feedback 11.2_

- [ ] 13. Authentication UI
  - [ ] 13.1 Build login and signup pages
    - Create `frontend/src/app/login/page.tsx` — email/password form; `POST /api/auth/login`; store JWT in `localStorage`; redirect to role-appropriate dashboard (`/volunteer/dashboard` or `/ngo/dashboard` or `/admin`)
    - Create `frontend/src/app/signup/page.tsx` — email/password/role form; `POST /api/auth/signup`; redirect to login on success
    - Create `frontend/src/lib/auth.ts` — helpers: `getToken()`, `getRole()`, `logout()`, `isAuthenticated()`
    - Update `frontend/src/lib/api.ts` — attach `Authorization: Bearer <token>` header to all requests if token present
    - _Requirements: Auth 1.2_

  - [ ] 13.2 Add route guards to dashboard pages
    - Create `frontend/src/components/AuthGuard.tsx` — wrapper component that checks `isAuthenticated()` and `getRole()`; redirects to `/login` if not authenticated; redirects to correct dashboard if wrong role
    - Wrap `frontend/src/app/volunteer/dashboard/page.tsx` and `frontend/src/app/ngo/dashboard/page.tsx` with `AuthGuard`
    - _Requirements: Auth 1.1_

- [ ] 14. Wire NGO creation of volunteers
  - Create `frontend/src/app/ngo/volunteers/page.tsx` — `requireRole('ngo_admin')` page; form to create a new volunteer (name, email, password, skills, location); calls `POST /api/auth/ngo/create-volunteer`; lists existing volunteers linked to this NGO via `GET /api/ngo/volunteers`
  - _Requirements: Auth 1.3_

- [ ] 15. Final checkpoint — full extended system validation
  - Test end-to-end: signup as public user → submit task → duplicate check fires → NGO receives claim → NGO accepts → volunteers assigned → volunteer accepts → marks complete → feedback submitted → rating updated
  - Test emergency path: submit task with urgency > 0.9 → verify NGO flow is skipped → volunteers assigned directly
  - Test auth: verify protected routes return 401 without token and 403 with wrong role
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- The existing AI microservice endpoints (`/ai/process`, `/ai/priority`, `/ai/match`, `/ai/geo/*`) are already implemented — tasks here only call them, never rebuild them
- Task 4.2 adds one new AI endpoint (`/ai/nlp/similarity`) to the existing NLP router — minimal addition
- JWT secret must be added to `.env` as `JWT_SECRET`
- The 6-status state machine (task 8.1) replaces the existing 4-status CHECK constraint via migration 008
- Emergency mode (task 4.3) short-circuits the NGO claim flow entirely — no `ngo_claims` rows are created
- NGO timeout job (task 6.3) runs every 5 minutes and handles the 30-minute auto-assign window
