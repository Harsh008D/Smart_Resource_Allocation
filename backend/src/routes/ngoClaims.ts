/**
 * NGO Claim Flow
 * POST /api/ngo-claims/:claimId/respond  — NGO accepts or rejects
 * GET  /api/ngo-claims                   — NGO sees their claims
 * GET  /api/ngo/tasks/incoming           — NGO sees pending tasks
 * GET  /api/ngo/tasks/accepted           — NGO sees accepted tasks
 * GET  /api/ngo/analytics                — NGO analytics
 */
import { Router, Request, Response } from "express";
import { pool } from "../db";
import { authenticate, requireRole } from "../middleware/auth";
import { assignVolunteers } from "../services/volunteerAssignment";

export const ngoClaimsRouter = Router();

// ── GET /api/ngo-claims ───────────────────────────────────────────────────────
ngoClaimsRouter.get("/", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const ngoId = req.user!.ngoId;
    const result = await pool.query(
      `SELECT c.*, t.description, t.city, t.urgency_score, t.priority_score,
              t.latitude, t.longitude, t.status as task_status, t.contact_number
       FROM ngo_claims c
       JOIN tasks t ON t.task_id = c.task_id
       WHERE c.ngo_id = $1
       ORDER BY c.sent_at DESC`,
      [ngoId]
    );
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── POST /api/ngo-claims/:claimId/respond ─────────────────────────────────────
ngoClaimsRouter.post("/:claimId/respond", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const { claimId } = req.params;
    const { response } = req.body; // 'accepted' | 'rejected'
    const ngoId = req.user!.ngoId;

    if (!["accepted", "rejected"].includes(response)) {
      return res.status(400).json({ error: "response must be 'accepted' or 'rejected'" });
    }

    // Verify claim belongs to this NGO
    const claimResult = await pool.query(
      "SELECT * FROM ngo_claims WHERE claim_id = $1 AND ngo_id = $2",
      [claimId, ngoId]
    );
    if (claimResult.rows.length === 0) {
      return res.status(404).json({ error: "Claim not found" });
    }
    const claim = claimResult.rows[0];
    if (claim.status !== "pending") {
      return res.status(409).json({ error: `Claim already ${claim.status}` });
    }

    // Check if another NGO already accepted this task
    const alreadyAccepted = await pool.query(
      "SELECT claim_id FROM ngo_claims WHERE task_id = $1 AND status = 'accepted'",
      [claim.task_id]
    );
    if (alreadyAccepted.rows.length > 0 && response === "accepted") {
      return res.status(409).json({ error: "Another NGO already accepted this task" });
    }

    // Update claim
    await pool.query(
      "UPDATE ngo_claims SET status = $1, responded_at = NOW() WHERE claim_id = $2",
      [response, claimId]
    );

    if (response === "accepted") {
      // Reject all other pending claims for this task
      await pool.query(
        "UPDATE ngo_claims SET status = 'rejected', responded_at = NOW() WHERE task_id = $1 AND claim_id != $2 AND status = 'pending'",
        [claim.task_id, claimId]
      );

      // Update task
      await pool.query(
        "UPDATE tasks SET status = 'accepted_by_ngo', assigned_ngo_id = $1, ngo_accepted_at = NOW() WHERE task_id = $2",
        [ngoId, claim.task_id]
      );

      // Trigger volunteer matching
      const assignedVols = await assignVolunteers(claim.task_id);

      return res.json({
        message: "Task accepted",
        task_id: claim.task_id,
        assigned_volunteers: assignedVols,
      });
    }

    return res.json({ message: "Task rejected", task_id: claim.task_id });
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/ngo/tasks/incoming ───────────────────────────────────────────────
ngoClaimsRouter.get("/ngo/tasks/incoming", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const ngoId = req.user!.ngoId;
    const result = await pool.query(
      `SELECT t.*, c.claim_id, c.sent_at as claim_sent_at
       FROM tasks t
       JOIN ngo_claims c ON c.task_id = t.task_id
       WHERE c.ngo_id = $1 AND c.status = 'pending'
       ORDER BY t.priority_score DESC`,
      [ngoId]
    );
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/ngo/tasks/accepted ───────────────────────────────────────────────
ngoClaimsRouter.get("/ngo/tasks/accepted", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const ngoId = req.user!.ngoId;
    const result = await pool.query(
      `SELECT t.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'volunteer_id', v.volunteer_id,
                    'name',         v.name,
                    'skills',       v.skills,
                    'rating',       v.rating,
                    'availability', v.availability,
                    'email',        u.email
                  )
                ) FILTER (WHERE v.volunteer_id IS NOT NULL),
                '[]'
              ) AS volunteer_details
       FROM tasks t
       LEFT JOIN LATERAL unnest(t.assigned_volunteer_ids) AS vid(volunteer_id) ON true
       LEFT JOIN volunteers v ON v.volunteer_id = vid.volunteer_id
       LEFT JOIN users u ON u.volunteer_id = v.volunteer_id
       WHERE t.assigned_ngo_id = $1
       GROUP BY t.task_id
       ORDER BY t.priority_score DESC`,
      [ngoId]
    );
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});

// ── GET /api/ngo/volunteers ───────────────────────────────────────────────────
ngoClaimsRouter.get("/ngo/volunteers", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const ngoId = req.user!.ngoId;
    const result = await pool.query(
      `SELECT v.volunteer_id, v.name, v.skills, v.rating, v.availability, v.latitude, v.longitude,
              u.email,
              COUNT(t.task_id) FILTER (WHERE t.status = 'completed') as tasks_completed,
              COUNT(t.task_id) FILTER (WHERE t.status = 'in_progress') as tasks_active
       FROM volunteers v
       JOIN users u ON u.volunteer_id = v.volunteer_id AND u.ngo_id = $1
       LEFT JOIN tasks t ON v.volunteer_id = ANY(t.assigned_volunteer_ids)
       GROUP BY v.volunteer_id, v.name, v.skills, v.rating, v.availability, v.latitude, v.longitude, u.email
       ORDER BY v.name`,
      [ngoId]
    );
    return res.json(result.rows);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
ngoClaimsRouter.get("/ngo/analytics", authenticate, requireRole("ngo_admin"), async (req: Request, res: Response) => {
  try {
    const ngoId = req.user!.ngoId;
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE assigned_ngo_id = $1) as total_accepted,
         COUNT(*) FILTER (WHERE assigned_ngo_id = $1 AND status = 'in_progress') as in_progress,
         COUNT(*) FILTER (WHERE assigned_ngo_id = $1 AND status = 'completed') as completed,
         COUNT(*) FILTER (WHERE assigned_ngo_id = $1 AND status = 'volunteers_assigned') as volunteers_assigned,
         AVG(EXTRACT(EPOCH FROM (completed_at - ngo_accepted_at))/3600)
           FILTER (WHERE assigned_ngo_id = $1 AND completed_at IS NOT NULL) as avg_completion_hours
       FROM tasks`,
      [ngoId]
    );
    return res.json(result.rows[0]);
  } catch (err: unknown) {
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
});
