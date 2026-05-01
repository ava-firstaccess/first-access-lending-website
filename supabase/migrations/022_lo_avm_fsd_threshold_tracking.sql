ALTER TABLE loan_officer_avm_orders
  ADD COLUMN IF NOT EXISTS requested_max_fsd NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS fsd_threshold_status TEXT,
  ADD COLUMN IF NOT EXISTS fsd_threshold_passed BOOLEAN;

ALTER TABLE loan_officer_avm_orders
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_fsd_threshold_status_check;

ALTER TABLE loan_officer_avm_orders
  ADD CONSTRAINT loan_officer_avm_orders_fsd_threshold_status_check
  CHECK (
    fsd_threshold_status IS NULL
    OR fsd_threshold_status IN ('pending', 'passed', 'failed')
  );

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_investor_threshold_created_at
  ON loan_officer_avm_orders (investor, requested_max_fsd, created_at DESC);

COMMENT ON COLUMN loan_officer_avm_orders.requested_max_fsd IS 'Investor-specific FSD threshold that was in force when this AVM order attempt was made.';
COMMENT ON COLUMN loan_officer_avm_orders.fsd_threshold_status IS 'Whether the order passed, failed, or is still pending against the requested_max_fsd threshold.';
COMMENT ON COLUMN loan_officer_avm_orders.fsd_threshold_passed IS 'Boolean mirror of the threshold result when known; null while pending.';
COMMENT ON COLUMN loan_officer_avm_orders.investor IS 'Target investor for this LO AVM order attempt.';
