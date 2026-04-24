-- MeridianLink production-test run log
CREATE TABLE IF NOT EXISTS meridianlink_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
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
  error_message TEXT,
  borrower_first_name TEXT,
  borrower_last_name TEXT,
  borrower_ssn_last4 TEXT,
  approved_borrower_first_name TEXT,
  approved_borrower_last_name TEXT,
  approved_borrower_ssn_last4 TEXT,
  success BOOLEAN DEFAULT FALSE,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_created_at ON meridianlink_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_mode ON meridianlink_runs (mode);
CREATE INDEX IF NOT EXISTS idx_meridianlink_runs_status ON meridianlink_runs (status);

ALTER TABLE meridianlink_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on meridianlink_runs"
  ON meridianlink_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
