-- Reconcile Loan Officer AVM schema to the current orders-only model.
-- Safe to run manually in Supabase SQL Editor.
-- Purpose:
--   1. Ensure loan_officer_avm_orders exists with the columns the live /api/lo-avm/order route expects.
--   2. Add HouseCanary billing-cycle allocation fields.
--   3. Add investor/FSD-threshold tracking fields.
--   4. Remove the old transitional pulls linkage if it still exists.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS loan_officer_avm_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_run_id UUID NOT NULL DEFAULT gen_random_uuid(),
  pull_run_id UUID,
  address_id TEXT,
  loan_officer_prefix TEXT NOT NULL,
  loan_officer_email TEXT NOT NULL,
  loan_number TEXT,
  investor TEXT,
  engine TEXT,
  program TEXT,
  product TEXT,
  provider TEXT NOT NULL,
  provider_product TEXT,
  external_order_id TEXT,
  external_item_id TEXT,
  external_tracking_id TEXT,
  order_status TEXT NOT NULL DEFAULT 'draft',
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zipcode TEXT,
  ordered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  request_payload JSONB,
  response_payload JSONB,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS loan_officer_avm_orders
  ADD COLUMN IF NOT EXISTS order_run_id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS address_id TEXT,
  ADD COLUMN IF NOT EXISTS loan_officer_prefix TEXT,
  ADD COLUMN IF NOT EXISTS loan_officer_email TEXT,
  ADD COLUMN IF NOT EXISTS loan_number TEXT,
  ADD COLUMN IF NOT EXISTS investor TEXT,
  ADD COLUMN IF NOT EXISTS engine TEXT,
  ADD COLUMN IF NOT EXISTS program TEXT,
  ADD COLUMN IF NOT EXISTS product TEXT,
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS provider_product TEXT,
  ADD COLUMN IF NOT EXISTS external_order_id TEXT,
  ADD COLUMN IF NOT EXISTS external_item_id TEXT,
  ADD COLUMN IF NOT EXISTS external_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS order_status TEXT DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zipcode TEXT,
  ADD COLUMN IF NOT EXISTS ordered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS request_payload JSONB,
  ADD COLUMN IF NOT EXISTS response_payload JSONB,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS housecanary_billing_cycle_start DATE,
  ADD COLUMN IF NOT EXISTS housecanary_billing_cycle_end DATE,
  ADD COLUMN IF NOT EXISTS housecanary_order_product TEXT,
  ADD COLUMN IF NOT EXISTS housecanary_product_sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS housecanary_overall_sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS housecanary_free_tier_applied BOOLEAN,
  ADD COLUMN IF NOT EXISTS requested_max_fsd NUMERIC(8,4),
  ADD COLUMN IF NOT EXISTS fsd_threshold_status TEXT,
  ADD COLUMN IF NOT EXISTS fsd_threshold_passed BOOLEAN;

ALTER TABLE IF EXISTS loan_officer_avm_orders
  ALTER COLUMN order_run_id SET DEFAULT gen_random_uuid(),
  ALTER COLUMN created_at SET DEFAULT NOW(),
  ALTER COLUMN updated_at SET DEFAULT NOW();

UPDATE loan_officer_avm_orders
SET
  loan_officer_prefix = COALESCE(loan_officer_prefix, 'unknown'),
  loan_officer_email = COALESCE(loan_officer_email, 'unknown@example.com'),
  provider = COALESCE(provider, 'unknown'),
  order_status = COALESCE(order_status, 'draft'),
  address = COALESCE(address, 'unknown')
WHERE
  loan_officer_prefix IS NULL
  OR loan_officer_email IS NULL
  OR provider IS NULL
  OR order_status IS NULL
  OR address IS NULL;

ALTER TABLE IF EXISTS loan_officer_avm_orders
  ALTER COLUMN loan_officer_prefix SET NOT NULL,
  ALTER COLUMN loan_officer_email SET NOT NULL,
  ALTER COLUMN provider SET NOT NULL,
  ALTER COLUMN order_status SET NOT NULL,
  ALTER COLUMN address SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN updated_at SET NOT NULL;

ALTER TABLE IF EXISTS loan_officer_avm_orders
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_status_check,
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_email_format,
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_state_format,
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_pull_run_fk,
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_housecanary_product_check,
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_fsd_threshold_status_check;

ALTER TABLE IF EXISTS loan_officer_avm_orders
  ADD CONSTRAINT loan_officer_avm_orders_status_check
    CHECK (order_status IN ('draft', 'queued', 'submitted', 'processing', 'completed', 'failed', 'cancelled', 'manual_review')),
  ADD CONSTRAINT loan_officer_avm_orders_email_format
    CHECK (loan_officer_email = lower(loan_officer_email)),
  ADD CONSTRAINT loan_officer_avm_orders_state_format
    CHECK (state IS NULL OR length(state) <= 2),
  ADD CONSTRAINT loan_officer_avm_orders_housecanary_product_check
    CHECK (
      housecanary_order_product IS NULL
      OR housecanary_order_product IN ('property_explorer', 'agile_insights')
    ),
  ADD CONSTRAINT loan_officer_avm_orders_fsd_threshold_status_check
    CHECK (
      fsd_threshold_status IS NULL
      OR fsd_threshold_status IN ('pending', 'passed', 'failed')
    );

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_run_id_unique
  ON loan_officer_avm_orders (order_run_id);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_loan_number_created_at
  ON loan_officer_avm_orders (loan_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_provider_created_at
  ON loan_officer_avm_orders (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_officer_created_at
  ON loan_officer_avm_orders (loan_officer_prefix, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_external_order_id
  ON loan_officer_avm_orders (external_order_id);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_hc_cycle_product
  ON loan_officer_avm_orders (housecanary_billing_cycle_start, housecanary_order_product, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_investor_threshold_created_at
  ON loan_officer_avm_orders (investor, requested_max_fsd, created_at DESC);

ALTER TABLE IF EXISTS loan_officer_avm_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on loan_officer_avm_orders" ON loan_officer_avm_orders;
CREATE POLICY "Service role full access on loan_officer_avm_orders"
  ON loan_officer_avm_orders FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_loan_officer_avm_orders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_officer_avm_orders_updated_at ON loan_officer_avm_orders;
CREATE TRIGGER trg_loan_officer_avm_orders_updated_at
BEFORE UPDATE ON loan_officer_avm_orders
FOR EACH ROW
EXECUTE FUNCTION set_loan_officer_avm_orders_updated_at();

ALTER TABLE IF EXISTS loan_officer_avm_orders
  DROP COLUMN IF EXISTS pull_run_id;

DROP INDEX IF EXISTS idx_loan_officer_avm_orders_pull_run_created_at;
DROP TABLE IF EXISTS loan_officer_avm_pulls;

COMMENT ON TABLE loan_officer_avm_orders IS 'Orders-only log for actual outbound LO AVM vendor requests. Use this table for who ordered, vendor, address, loan number, request/response payloads, billing-cycle allocation, and 90-day reuse checks.';
COMMENT ON COLUMN loan_officer_avm_orders.loan_number IS 'User-entered loan number used to correlate actual vendor orders to the loan file.';
COMMENT ON COLUMN loan_officer_avm_orders.provider IS 'External provider receiving the outbound order, for example housecanary or clearcapital.';
COMMENT ON COLUMN loan_officer_avm_orders.provider_product IS 'Specific product ordered from the provider, for example agile_insights, pexp_static_link, or clearavm.';
COMMENT ON COLUMN loan_officer_avm_orders.external_order_id IS 'Provider-side order identifier such as HouseCanary order ID.';
COMMENT ON COLUMN loan_officer_avm_orders.external_item_id IS 'Provider-side item identifier such as HouseCanary order item ID.';
COMMENT ON COLUMN loan_officer_avm_orders.external_tracking_id IS 'Provider-side tracking identifier such as Clear Capital trackingIds[0].';
COMMENT ON COLUMN loan_officer_avm_orders.request_payload IS 'Serialized outbound vendor request body/params for actual ordered requests only.';
COMMENT ON COLUMN loan_officer_avm_orders.response_payload IS 'Serialized provider response payload or normalized response snapshot for actual ordered requests only.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_billing_cycle_start IS 'Inclusive billing-cycle start date used for HouseCanary monthly free-tier allocation.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_billing_cycle_end IS 'Inclusive billing-cycle end date used for HouseCanary monthly free-tier allocation.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_order_product IS 'Chosen HouseCanary order product for this cycle allocation: property_explorer first, agile_insights after the first 40 property explorers.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_product_sequence_number IS '1-based sequence within the selected HouseCanary product bucket for the billing cycle.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_overall_sequence_number IS '1-based sequence across all HouseCanary LO AVM orders in the billing cycle.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_free_tier_applied IS 'True when the selected HouseCanary order still falls inside that product''s free monthly allocation.';
COMMENT ON COLUMN loan_officer_avm_orders.requested_max_fsd IS 'Investor-specific FSD threshold that was in force when this AVM order attempt was made.';
COMMENT ON COLUMN loan_officer_avm_orders.fsd_threshold_status IS 'Whether the order passed, failed, or is still pending against the requested_max_fsd threshold.';
COMMENT ON COLUMN loan_officer_avm_orders.fsd_threshold_passed IS 'Boolean mirror of the threshold result when known; null while pending.';
COMMENT ON COLUMN loan_officer_avm_orders.investor IS 'Target investor for this LO AVM order attempt.';
