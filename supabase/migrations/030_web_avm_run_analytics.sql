CREATE TABLE IF NOT EXISTS web_avm_analytics_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID,
  anonymous_id TEXT,
  quoted_investor TEXT,
  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_zipcode TEXT,
  property_type TEXT,
  max_ltv NUMERIC,
  tier TEXT,
  cascade_decision TEXT,
  winner_provider TEXT,
  winner_value NUMERIC,
  winner_fsd NUMERIC,
  winner_new_max_loan NUMERIC,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  vendor_results_count INTEGER NOT NULL DEFAULT 0,
  completed_successfully BOOLEAN,
  needs_human BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_web_avm_analytics_runs_created_at
  ON web_avm_analytics_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_avm_analytics_runs_application_id
  ON web_avm_analytics_runs (application_id);
CREATE INDEX IF NOT EXISTS idx_web_avm_analytics_runs_anonymous_id
  ON web_avm_analytics_runs (anonymous_id)
  WHERE anonymous_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_web_avm_analytics_runs_winner_created_at
  ON web_avm_analytics_runs (winner_provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_avm_analytics_runs_tier_created_at
  ON web_avm_analytics_runs (tier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_avm_analytics_runs_cache_hit_created_at
  ON web_avm_analytics_runs (cache_hit, created_at DESC);

CREATE TABLE IF NOT EXISTS web_avm_vendor_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES web_avm_analytics_runs(run_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  source TEXT,
  vendor_product TEXT,
  value NUMERIC,
  fsd NUMERIC,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE web_avm_vendor_results
  DROP CONSTRAINT IF EXISTS web_avm_vendor_results_source_check;
ALTER TABLE web_avm_vendor_results
  ADD CONSTRAINT web_avm_vendor_results_source_check
  CHECK (source IS NULL OR source IN ('fresh', 'cache'));

CREATE INDEX IF NOT EXISTS idx_web_avm_vendor_results_provider_created_at
  ON web_avm_vendor_results (provider, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_web_avm_vendor_results_provider_winner_created_at
  ON web_avm_vendor_results (provider, is_winner, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_web_avm_vendor_results_run_provider_source
  ON web_avm_vendor_results (run_id, provider, source);

ALTER TABLE web_avm_analytics_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE web_avm_vendor_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on web_avm_analytics_runs" ON web_avm_analytics_runs;
CREATE POLICY "Service role full access on web_avm_analytics_runs"
  ON web_avm_analytics_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on web_avm_vendor_results" ON web_avm_vendor_results;
CREATE POLICY "Service role full access on web_avm_vendor_results"
  ON web_avm_vendor_results FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_web_avm_analytics_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_web_avm_analytics_runs_updated_at ON web_avm_analytics_runs;
CREATE TRIGGER trg_web_avm_analytics_runs_updated_at
BEFORE UPDATE ON web_avm_analytics_runs
FOR EACH ROW
EXECUTE FUNCTION set_web_avm_analytics_runs_updated_at();

COMMENT ON TABLE web_avm_analytics_runs IS 'Persistent run-level analytics for the public verify-value AVM flow. One row per attempt, including cache hits.';
COMMENT ON TABLE web_avm_vendor_results IS 'Persistent provider-level analytics for the public verify-value AVM flow. One row per provider evidenced in a response.';
COMMENT ON COLUMN web_avm_analytics_runs.cache_hit IS 'True when the verify-value request was satisfied from avm_cache without making a fresh provider call.';
COMMENT ON COLUMN web_avm_analytics_runs.vendor_results_count IS 'Number of provider result rows persisted for this web AVM attempt.';
COMMENT ON COLUMN web_avm_analytics_runs.needs_human IS 'True when the web AVM flow returned a manual-review or needs-human outcome.';
COMMENT ON COLUMN web_avm_vendor_results.source IS 'Whether the provider result came from cache or from a fresh verify-value response.';
