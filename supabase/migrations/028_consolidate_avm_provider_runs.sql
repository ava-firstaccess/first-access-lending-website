CREATE TABLE IF NOT EXISTS avm_provider_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL UNIQUE,
  application_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  provider TEXT NOT NULL,
  product TEXT,
  address TEXT,
  zipcode TEXT,
  city TEXT,
  state TEXT,
  endpoint_host TEXT,
  endpoint_path TEXT,
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
  estimate_value BIGINT,
  market_value BIGINT,
  high_value BIGINT,
  low_value BIGINT,
  effective_date DATE,
  vendor_run_date DATE,
  fsd NUMERIC,
  notes TEXT,
  archived_at TIMESTAMPTZ,
  archive_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_created_at
  ON avm_provider_runs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_application_id
  ON avm_provider_runs (application_id);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_provider_created_at
  ON avm_provider_runs (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_status
  ON avm_provider_runs (status);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_product
  ON avm_provider_runs (product);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_vendor_run_date
  ON avm_provider_runs (vendor_run_date DESC);

CREATE INDEX IF NOT EXISTS idx_avm_provider_runs_archived_at
  ON avm_provider_runs (archived_at, created_at DESC);

ALTER TABLE avm_provider_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on avm_provider_runs" ON avm_provider_runs;
CREATE POLICY "Service role full access on avm_provider_runs"
  ON avm_provider_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

COMMENT ON TABLE avm_provider_runs IS 'Unified operational run log for external AVM provider calls such as Clear Capital, HouseCanary, and future Veros requests.';
COMMENT ON COLUMN avm_provider_runs.archived_at IS 'Timestamp when this provider run row was successfully exported to long-term Azure Blob archive.';
COMMENT ON COLUMN avm_provider_runs.archive_path IS 'Azure Blob path where this provider run row was exported before hot-storage purge.';
COMMENT ON COLUMN avm_provider_runs.provider IS 'External AVM provider, for example clearcapital, housecanary, or veros.';
COMMENT ON COLUMN avm_provider_runs.product IS 'Provider-specific product or endpoint grouping, for example property_analytics or property_value.';

INSERT INTO avm_provider_runs (
  run_id,
  application_id,
  created_at,
  provider,
  product,
  address,
  zipcode,
  city,
  state,
  endpoint_host,
  endpoint_path,
  status_code,
  status,
  tracking_ids,
  response_bytes,
  error_category,
  success,
  confidence_score,
  confidence_score_alt,
  estimated_error,
  forecast_std_dev,
  estimate_value,
  market_value,
  high_value,
  low_value,
  effective_date,
  vendor_run_date,
  fsd,
  notes
)
SELECT
  c.run_id,
  c.application_id,
  c.created_at,
  COALESCE(NULLIF(c.provider, ''), 'clearcapital'),
  COALESCE(NULLIF(c.product, ''), 'property_analytics'),
  c.address,
  c.zipcode,
  c.city,
  c.state,
  c.endpoint_host,
  NULL,
  c.status_code,
  c.status,
  c.tracking_ids,
  c.response_bytes,
  c.error_category,
  c.success,
  c.confidence_score,
  c.confidence_score_alt,
  c.estimated_error,
  c.forecast_std_dev,
  NULL,
  c.market_value,
  c.high_value,
  c.low_value,
  c.effective_date,
  c.vendor_run_date,
  NULL,
  c.notes
FROM clearcapital_runs c
ON CONFLICT (run_id) DO NOTHING;

INSERT INTO avm_provider_runs (
  run_id,
  application_id,
  created_at,
  provider,
  product,
  address,
  zipcode,
  city,
  state,
  endpoint_host,
  endpoint_path,
  status_code,
  status,
  tracking_ids,
  response_bytes,
  error_category,
  success,
  estimate_value,
  market_value,
  high_value,
  low_value,
  fsd,
  notes
)
SELECT
  h.run_id,
  h.application_id,
  h.created_at,
  COALESCE(NULLIF(h.provider, ''), 'housecanary'),
  h.product,
  h.address,
  h.zipcode,
  h.city,
  h.state,
  NULL,
  h.endpoint_path,
  h.status_code,
  h.status,
  NULL,
  h.response_bytes,
  h.error_category,
  h.success,
  h.estimate_value,
  h.market_value,
  h.high_value,
  h.low_value,
  h.fsd,
  h.notes
FROM housecanary_runs h
ON CONFLICT (run_id) DO NOTHING;
