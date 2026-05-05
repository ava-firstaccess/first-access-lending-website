ALTER TABLE loan_officer_avm_orders
  ADD COLUMN IF NOT EXISTS run_source TEXT NOT NULL DEFAULT 'cascade';

ALTER TABLE loan_officer_avm_orders
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_run_source_check;

ALTER TABLE loan_officer_avm_orders
  ADD CONSTRAINT loan_officer_avm_orders_run_source_check
  CHECK (run_source IN ('cascade', 'manual'));

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_run_source_created_at
  ON loan_officer_avm_orders (run_source, created_at DESC);

COMMENT ON COLUMN loan_officer_avm_orders.run_source IS 'Whether this LO AVM vendor order was placed by the normal cascade flow or by a manual provider override.';
