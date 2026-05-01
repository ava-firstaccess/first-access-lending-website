ALTER TABLE loan_officer_avm_orders
  ADD COLUMN IF NOT EXISTS housecanary_billing_cycle_start DATE,
  ADD COLUMN IF NOT EXISTS housecanary_billing_cycle_end DATE,
  ADD COLUMN IF NOT EXISTS housecanary_order_product TEXT,
  ADD COLUMN IF NOT EXISTS housecanary_product_sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS housecanary_overall_sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS housecanary_free_tier_applied BOOLEAN;

ALTER TABLE loan_officer_avm_orders
  DROP CONSTRAINT IF EXISTS loan_officer_avm_orders_housecanary_product_check;

ALTER TABLE loan_officer_avm_orders
  ADD CONSTRAINT loan_officer_avm_orders_housecanary_product_check
  CHECK (
    housecanary_order_product IS NULL
    OR housecanary_order_product IN ('property_explorer', 'agile_insights')
  );

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_hc_cycle_product
  ON loan_officer_avm_orders (housecanary_billing_cycle_start, housecanary_order_product, created_at DESC);

COMMENT ON COLUMN loan_officer_avm_orders.housecanary_billing_cycle_start IS 'Inclusive billing-cycle start date used for HouseCanary monthly free-tier allocation.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_billing_cycle_end IS 'Inclusive billing-cycle end date used for HouseCanary monthly free-tier allocation.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_order_product IS 'Chosen HouseCanary order product for this cycle allocation: property_explorer first, agile_insights after the first 40 property explorers.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_product_sequence_number IS '1-based sequence within the selected HouseCanary product bucket for the billing cycle.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_overall_sequence_number IS '1-based sequence across all HouseCanary LO AVM orders in the billing cycle.';
COMMENT ON COLUMN loan_officer_avm_orders.housecanary_free_tier_applied IS 'True when the selected HouseCanary order still falls inside that product\'s free monthly allocation.';
