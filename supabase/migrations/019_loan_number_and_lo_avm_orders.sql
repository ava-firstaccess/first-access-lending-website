ALTER TABLE loan_officer_avm_pulls
  ADD COLUMN IF NOT EXISTS loan_number TEXT,
  ADD COLUMN IF NOT EXISTS clear_capital_tracking_id TEXT,
  ADD COLUMN IF NOT EXISTS housecanary_customer_order_id TEXT,
  ADD COLUMN IF NOT EXISTS housecanary_customer_item_id TEXT;

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_pulls_loan_number_created_at
  ON loan_officer_avm_pulls (loan_number, created_at DESC);

COMMENT ON COLUMN loan_officer_avm_pulls.loan_number IS 'User-entered loan number from the LO AVM workspace, used to correlate AVM pulls and provider orders.';
COMMENT ON COLUMN loan_officer_avm_pulls.clear_capital_tracking_id IS 'Tracking identifier sent to Clear Capital, typically the user-entered loan number when present.';
COMMENT ON COLUMN loan_officer_avm_pulls.housecanary_customer_order_id IS 'HouseCanary customer_order_id used for Agile Insights / Order Manager requests.';
COMMENT ON COLUMN loan_officer_avm_pulls.housecanary_customer_item_id IS 'HouseCanary customer_item_id used for item-level report correlation when applicable.';

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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loan_officer_avm_orders_status_check CHECK (order_status IN ('draft', 'queued', 'submitted', 'processing', 'completed', 'failed', 'cancelled', 'manual_review')),
  CONSTRAINT loan_officer_avm_orders_email_format CHECK (loan_officer_email = lower(loan_officer_email)),
  CONSTRAINT loan_officer_avm_orders_state_format CHECK (state IS NULL OR length(state) <= 2),
  CONSTRAINT loan_officer_avm_orders_pull_run_fk FOREIGN KEY (pull_run_id) REFERENCES loan_officer_avm_pulls (run_id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_run_id_unique
  ON loan_officer_avm_orders (order_run_id);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_pull_run_created_at
  ON loan_officer_avm_orders (pull_run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_loan_number_created_at
  ON loan_officer_avm_orders (loan_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_provider_created_at
  ON loan_officer_avm_orders (provider, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_officer_created_at
  ON loan_officer_avm_orders (loan_officer_prefix, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_loan_officer_avm_orders_external_order_id
  ON loan_officer_avm_orders (external_order_id);

ALTER TABLE loan_officer_avm_orders ENABLE ROW LEVEL SECURITY;

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

COMMENT ON TABLE loan_officer_avm_orders IS 'Outbound LO AVM provider orders and request lifecycle records, including HouseCanary Agile Insights and Clear Capital order/tracking identifiers.';
COMMENT ON COLUMN loan_officer_avm_orders.pull_run_id IS 'Associated loan_officer_avm_pulls.run_id when an outbound order was initiated from a specific LO AVM pull.';
COMMENT ON COLUMN loan_officer_avm_orders.loan_number IS 'User-entered loan number used to correlate provider orders to the loan file.';
COMMENT ON COLUMN loan_officer_avm_orders.provider IS 'External provider receiving the outbound order, for example housecanary or clearcapital.';
COMMENT ON COLUMN loan_officer_avm_orders.provider_product IS 'Specific product ordered from the provider, for example agile_insights, pexp_static_link, or clearavm.';
COMMENT ON COLUMN loan_officer_avm_orders.external_order_id IS 'Provider-side order identifier such as HouseCanary order ID.';
COMMENT ON COLUMN loan_officer_avm_orders.external_item_id IS 'Provider-side item identifier such as HouseCanary order item ID.';
COMMENT ON COLUMN loan_officer_avm_orders.external_tracking_id IS 'Provider-side tracking identifier such as Clear Capital trackingIds[0].';
COMMENT ON COLUMN loan_officer_avm_orders.request_payload IS 'Serialized outbound request body/params sent to the provider.';
COMMENT ON COLUMN loan_officer_avm_orders.response_payload IS 'Serialized provider response payload or normalized response snapshot.';
