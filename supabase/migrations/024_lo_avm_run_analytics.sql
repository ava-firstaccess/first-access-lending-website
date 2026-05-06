CREATE TABLE IF NOT EXISTS loan_officer_avm_run_results (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_run_id UUID,
  loan_officer_prefix TEXT NOT NULL,
  loan_officer_email TEXT NOT NULL,
  loan_number TEXT,
  investor TEXT,
  engine TEXT,
  program TEXT,
  product TEXT,
  address_id TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zipcode TEXT,
  run_source TEXT NOT NULL DEFAULT 'cascade',
  manual_provider_requested TEXT,
  cache_only BOOLEAN NOT NULL DEFAULT FALSE,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  selected_investor_satisfied BOOLEAN,
  selected_investor_in_flight BOOLEAN,
  orders_placed_count INTEGER NOT NULL DEFAULT 0,
  winner_provider TEXT,
  winner_source TEXT,
  winner_provider_product TEXT,
  winner_order_run_id UUID,
  winner_order_status TEXT,
  winner_value NUMERIC,
  winner_fsd NUMERIC,
  latest_ordered_at TIMESTAMPTZ,
  completed_successfully BOOLEAN,
  response_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loan_officer_avm_run_results
  DROP CONSTRAINT IF EXISTS loan_officer_avm_run_results_run_source_check;

ALTER TABLE loan_officer_avm_run_results
  ADD CONSTRAINT loan_officer_avm_run_results_run_source_check
  CHECK (run_source IN ('cascade', 'manual'));

ALTER TABLE loan_officer_avm_run_results
  DROP CONSTRAINT IF EXISTS loan_officer_avm_run_results_winner_source_check;

ALTER TABLE loan_officer_avm_run_results
  ADD CONSTRAINT loan_officer_avm_run_results_winner_source_check
  CHECK (winner_source IS NULL OR winner_source IN ('fresh', 'cache'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_avm_run_results_order_run_id
  ON loan_officer_avm_run_results (order_run_id)
  WHERE order_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_results_created_at
  ON loan_officer_avm_run_results (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_results_officer_created_at
  ON loan_officer_avm_run_results (loan_officer_prefix, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_results_run_source_created_at
  ON loan_officer_avm_run_results (run_source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_results_winner_created_at
  ON loan_officer_avm_run_results (winner_provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_results_investor_created_at
  ON loan_officer_avm_run_results (investor, created_at DESC);

CREATE TABLE IF NOT EXISTS loan_officer_avm_run_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES loan_officer_avm_run_results(run_id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  supported BOOLEAN NOT NULL DEFAULT FALSE,
  max_fsd_allowed NUMERIC,
  source TEXT,
  order_status TEXT,
  order_run_id UUID,
  provider_product TEXT,
  targeted_investor TEXT,
  requested_max_fsd NUMERIC,
  fsd_threshold_status TEXT,
  value NUMERIC,
  fsd NUMERIC,
  is_winner BOOLEAN NOT NULL DEFAULT FALSE,
  has_report_link BOOLEAN NOT NULL DEFAULT FALSE,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE loan_officer_avm_run_providers
  DROP CONSTRAINT IF EXISTS loan_officer_avm_run_providers_source_check;

ALTER TABLE loan_officer_avm_run_providers
  ADD CONSTRAINT loan_officer_avm_run_providers_source_check
  CHECK (source IS NULL OR source IN ('fresh', 'cache'));

ALTER TABLE loan_officer_avm_run_providers
  DROP CONSTRAINT IF EXISTS loan_officer_avm_run_providers_fsd_threshold_status_check;

ALTER TABLE loan_officer_avm_run_providers
  ADD CONSTRAINT loan_officer_avm_run_providers_fsd_threshold_status_check
  CHECK (fsd_threshold_status IS NULL OR fsd_threshold_status IN ('pending', 'passed', 'failed'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_avm_run_providers_run_provider
  ON loan_officer_avm_run_providers (run_id, provider);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_providers_provider_created_at
  ON loan_officer_avm_run_providers (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_run_providers_provider_winner_created_at
  ON loan_officer_avm_run_providers (provider, is_winner, created_at DESC);

ALTER TABLE loan_officer_avm_run_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE loan_officer_avm_run_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_run_results" ON loan_officer_avm_run_results;
CREATE POLICY "Service role full access on loan_officer_avm_run_results"
  ON loan_officer_avm_run_results FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_run_providers" ON loan_officer_avm_run_providers;
CREATE POLICY "Service role full access on loan_officer_avm_run_providers"
  ON loan_officer_avm_run_providers FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_loan_officer_avm_run_results_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_officer_avm_run_results_updated_at ON loan_officer_avm_run_results;
CREATE TRIGGER trg_loan_officer_avm_run_results_updated_at
BEFORE UPDATE ON loan_officer_avm_run_results
FOR EACH ROW
EXECUTE FUNCTION set_loan_officer_avm_run_results_updated_at();

COMMENT ON TABLE loan_officer_avm_run_results IS 'One row per LO AVM user-triggered run, including cache-only responses, cache hits, ordered runs, and final winner analytics.';
COMMENT ON TABLE loan_officer_avm_run_providers IS 'Per-provider snapshot for each LO AVM run, used for provider win rates, support analysis, and user-level reporting.';
COMMENT ON COLUMN loan_officer_avm_run_results.order_run_id IS 'Linked operational order_run_id when the run placed one or more outbound vendor orders.';
COMMENT ON COLUMN loan_officer_avm_run_results.manual_provider_requested IS 'Manual provider the LO explicitly requested, when run_source = manual.';
COMMENT ON COLUMN loan_officer_avm_run_results.cache_only IS 'True when the user pressed Pull Cache and no outbound vendor order was allowed in that request.';
COMMENT ON COLUMN loan_officer_avm_run_results.cache_hit IS 'True when the API returned without placing a new outbound vendor order because cached or in-flight data already satisfied the need.';
COMMENT ON COLUMN loan_officer_avm_run_results.selected_investor_satisfied IS 'Whether a selected-investor-eligible provider row already existed at evaluation time.';
COMMENT ON COLUMN loan_officer_avm_run_results.selected_investor_in_flight IS 'Whether a selected-investor-eligible provider row was already in submitted/processing state at evaluation time.';
COMMENT ON COLUMN loan_officer_avm_run_results.orders_placed_count IS 'Count of outbound vendor orders placed by this user-triggered run.';
COMMENT ON COLUMN loan_officer_avm_run_results.winner_provider IS 'Provider chosen by the current AVM winner-selection logic for this run response.';
COMMENT ON COLUMN loan_officer_avm_run_results.winner_source IS 'Whether the winning row came from a fresh order placed in this response or from cache.';
COMMENT ON COLUMN loan_officer_avm_run_providers.is_winner IS 'True when this provider row was the winner in the run response.';
COMMENT ON COLUMN loan_officer_avm_run_providers.has_report_link IS 'True when the provider row carried a downloadable report link in the run response.';
