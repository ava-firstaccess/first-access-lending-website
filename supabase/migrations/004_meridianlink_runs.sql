-- MeridianLink production-test run log
CREATE TABLE IF NOT EXISTS meridianlink_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
  application_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  mode TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'meridianlink',
  request_type TEXT NOT NULL,
  endpoint_host TEXT NOT NULL,
  status_code INTEGER,
  status TEXT,
  vendor_order_identifier TEXT,
  has_vendor_order_identifier BOOLEAN DEFAULT FALSE,
  response_bytes INTEGER DEFAULT 0,
  error_category TEXT,
  borrower_file_number TEXT,
  approved_borrower_file_number TEXT,
  success BOOLEAN DEFAULT FALSE,
  notes TEXT
);

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
