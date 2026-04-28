-- Extend tasks table with new workflow columns
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS submitted_by_user_id VARCHAR(20),
  ADD COLUMN IF NOT EXISTS contact_number       VARCHAR(30),
  ADD COLUMN IF NOT EXISTS image_url            TEXT,
  ADD COLUMN IF NOT EXISTS city                 VARCHAR(100),
  ADD COLUMN IF NOT EXISTS assigned_ngo_id      VARCHAR(20),
  ADD COLUMN IF NOT EXISTS ngo_sent_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ngo_accepted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS urgency_score        DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS is_emergency         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_duplicate         BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicate_of         VARCHAR(20),
  ADD COLUMN IF NOT EXISTS description          TEXT;

-- Extend status CHECK to include new statuses
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check
  CHECK (status IN ('pending','sent_to_ngo','accepted_by_ngo','volunteers_assigned','in_progress','completed','cancelled'));

-- Extend reports table with people_affected if missing
ALTER TABLE reports ADD COLUMN IF NOT EXISTS people_affected INTEGER;
