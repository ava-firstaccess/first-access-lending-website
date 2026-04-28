-- Clear Capital operational run log for property analytics / ClearAVM cascade
CREATE TABLE IF NOT EXISTS clearcapital_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
  application_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  provider TEXT NOT NULL DEFAULT 'clearcapital',
  product TEXT NOT NULL DEFAULT 'property_analytics',
  endpoint_host TEXT NOT NULL,
  status_code INTEGER,
  status TEXT,
  tracking_ids TEXT,
  response_bytes INTEGER DEFAULT 0,
  error_category TEXT,
  success BOOLEAN DEFAULT FALSE,
  confidence_score TEXT,
  confidence_score_alt TEXT,
  estimated_error NUMERIC,
  forecast_std_dev NUMERIC,
  market_value BIGINT,
  high_value BIGINT,
  low_value BIGINT,
  effective_date DATE,
  vendor_run_date DATE,
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_clearcapital_runs_created_at ON clearcapital_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_runs_application_id ON clearcapital_runs (application_id);
CREATE INDEX IF NOT EXISTS idx_clearcapital_runs_status ON clearcapital_runs (status);
CREATE INDEX IF NOT EXISTS idx_clearcapital_runs_vendor_run_date ON clearcapital_runs (vendor_run_date DESC);

ALTER TABLE clearcapital_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on clearcapital_runs" ON clearcapital_runs;
CREATE POLICY "Service role full access on clearcapital_runs"
  ON clearcapital_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-clearcapital-runs') THEN
    PERFORM cron.schedule(
      'cleanup-old-clearcapital-runs',
      '45 2 * * *',
      $$DELETE FROM clearcapital_runs WHERE created_at < NOW() - INTERVAL '30 days'$$
    );
  END IF;
END
$$;
