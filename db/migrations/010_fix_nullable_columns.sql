-- Make report_id nullable (tasks can be created without a linked report)
ALTER TABLE tasks ALTER COLUMN report_id DROP NOT NULL;

-- Add is_incomplete_score if missing
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_incomplete_score BOOLEAN DEFAULT FALSE;
