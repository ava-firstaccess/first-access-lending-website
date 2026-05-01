ALTER TABLE IF EXISTS loan_officer_avm_orders
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_pull_run_fk;

DROP INDEX IF EXISTS idx_loan_officer_avm_orders_pull_run_created_at;

ALTER TABLE IF EXISTS loan_officer_avm_orders
  DROP COLUMN IF EXISTS pull_run_id;

DROP TABLE IF EXISTS loan_officer_avm_pulls;

COMMENT ON TABLE loan_officer_avm_orders IS 'Orders-only log for actual outbound LO AVM vendor requests. Use this table for who ordered, vendor, address, loan number, request/response payloads, billing-cycle allocation, and 30-day reuse checks.';
COMMENT ON COLUMN loan_officer_avm_orders.loan_number IS 'User-entered loan number used to correlate actual vendor orders to the loan file.';
COMMENT ON COLUMN loan_officer_avm_orders.request_payload IS 'Serialized outbound vendor request body/params for actual ordered requests only.';
COMMENT ON COLUMN loan_officer_avm_orders.response_payload IS 'Serialized provider response payload or normalized response snapshot for actual ordered requests only.';
