-- Backfill meridianlink_runs columns when the table already existed before 004_meridianlink_runs.sql.
-- CREATE TABLE IF NOT EXISTS does not add new columns to an existing table.

ALTER TABLE IF EXISTS meridianlink_runs
  ADD COLUMN IF NOT EXISTS application_id UUID,
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meridianlink',
  ADD COLUMN IF NOT EXISTS request_type TEXT NOT NULL DEFAULT 'Submit',
  ADD COLUMN IF NOT EXISTS endpoint_host TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS status_code INTEGER,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS vendor_order_identifier TEXT,
  ADD COLUMN IF NOT EXISTS has_vendor_order_identifier BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS response_bytes INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS error_category TEXT,
  ADD COLUMN IF NOT EXISTS borrower_file_number TEXT,
  ADD COLUMN IF NOT EXISTS approved_borrower_file_number TEXT,
  ADD COLUMN IF NOT EXISTS success BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_created_at ON meridianlink_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_application_id ON meridianlink_runs (application_id);
CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_mode ON meridianlink_runs (mode);
CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_status ON meridianlink_runs (status);

ALTER TABLE meridianlink_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on meridianlink_runs" ON meridianlink_runs;
CREATE POLICY "Service role full access on meridianlink_runs"
  ON meridianlink_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
