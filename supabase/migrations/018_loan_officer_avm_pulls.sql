CREATE TABLE IF NOT EXISTS loan_officer_avm_pulls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  address_id TEXT,
  loan_officer_prefix TEXT NOT NULL,
  loan_officer_email TEXT NOT NULL,
  investor TEXT,
  engine TEXT,
  program TEXT,
  product TEXT,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zipcode TEXT,
  desired_loan_amount NUMERIC(14,2),
  max_available NUMERIC(14,2),
  combined_cltv NUMERIC(8,3),
  winner_provider TEXT,
  winner_fsd NUMERIC(6,3),
  winner_value NUMERIC(14,2),
  winner_pulled_at TIMESTAMPTZ,
  clear_capital_value NUMERIC(14,2),
  clear_capital_fsd NUMERIC(6,3),
  clear_capital_pulled_at TIMESTAMPTZ,
  veros_value NUMERIC(14,2),
  veros_fsd NUMERIC(6,3),
  veros_pulled_at TIMESTAMPTZ,
  ca_value_value NUMERIC(14,2),
  ca_value_fsd NUMERIC(6,3),
  ca_value_pulled_at TIMESTAMPTZ,
  black_knight_valusure_value NUMERIC(14,2),
  black_knight_valusure_fsd NUMERIC(6,3),
  black_knight_valusure_pulled_at TIMESTAMPTZ,
  corelogic_value NUMERIC(14,2),
  corelogic_fsd NUMERIC(6,3),
  corelogic_pulled_at TIMESTAMPTZ,
  housecanary_value NUMERIC(14,2),
  housecanary_fsd NUMERIC(6,3),
  housecanary_pulled_at TIMESTAMPTZ,
  red_bell_value NUMERIC(14,2),
  red_bell_fsd NUMERIC(6,3),
  red_bell_pulled_at TIMESTAMPTZ,
  home_genius_value NUMERIC(14,2),
  home_genius_fsd NUMERIC(6,3),
  home_genius_pulled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft',
  request_payload JSONB,
  response_payload JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loan_officer_avm_pulls_status_check CHECK (status IN ('draft', 'started', 'cache_hit', 'completed', 'failed', 'manual_review')),
  CONSTRAINT loan_officer_avm_pulls_email_format CHECK (loan_officer_email = lower(loan_officer_email)),
  CONSTRAINT loan_officer_avm_pulls_state_format CHECK (state IS NULL OR length(state) <= 2)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_avm_pulls_run_id_unique
  ON loan_officer_avm_pulls (run_id);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_pulls_address_id_created_at
  ON loan_officer_avm_pulls (address_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_pulls_officer_created_at
  ON loan_officer_avm_pulls (loan_officer_prefix, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_pulls_status_created_at
  ON loan_officer_avm_pulls (status, created_at DESC);

ALTER TABLE loan_officer_avm_pulls ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_pulls" ON loan_officer_avm_pulls;
CREATE POLICY "Service role full access on loan_officer_avm_pulls"
  ON loan_officer_avm_pulls FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_loan_officer_avm_pulls_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_officer_avm_pulls_updated_at ON loan_officer_avm_pulls;
CREATE TRIGGER trg_loan_officer_avm_pulls_updated_at
BEFORE UPDATE ON loan_officer_avm_pulls
FOR EACH ROW
EXECUTE FUNCTION set_loan_officer_avm_pulls_updated_at();

COMMENT ON TABLE loan_officer_avm_pulls IS 'Dedicated log table for loan officer initiated AVM pulls, 30-day cache reuse, provider results, and winning AVM outcome.';
COMMENT ON COLUMN loan_officer_avm_pulls.address_id IS 'Stable normalized address identifier used to group repeat AVM pulls and cache reuse.';
COMMENT ON COLUMN loan_officer_avm_pulls.winner_provider IS 'Winning AVM provider chosen after cache lookup or cascade completion.';
COMMENT ON COLUMN loan_officer_avm_pulls.winner_fsd IS 'FSD for the chosen winning AVM provider.';
COMMENT ON COLUMN loan_officer_avm_pulls.winner_pulled_at IS 'Timestamp of the chosen winning AVM result, including reused cache hits.';
COMMENT ON COLUMN loan_officer_avm_pulls.request_payload IS 'Serialized LO AVM request context, including pricing handoff details and investor selection.';
COMMENT ON COLUMN loan_officer_avm_pulls.response_payload IS 'Serialized provider result or aggregated AVM response payload.';
