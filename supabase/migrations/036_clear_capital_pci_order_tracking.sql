CREATE TABLE IF NOT EXISTS public.clear_capital_pci_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL UNIQUE,
  reference_identifier TEXT,
  tenant_id TEXT,
  product_code TEXT,
  status TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  ordered_by_email TEXT,
  ordered_by_name TEXT,
  ordered_by_prefix TEXT,
  hold_reason TEXT,
  last_message TEXT,
  last_message_urgent BOOLEAN NOT NULL DEFAULT FALSE,
  inspection_date TIMESTAMPTZ,
  estimated_completion_date TIMESTAMPTZ,
  fee_amount NUMERIC(12,2),
  export_url TEXT,
  deliverables JSONB,
  last_event_type TEXT,
  last_event_at TIMESTAMPTZ,
  latest_event_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_orders_status ON public.clear_capital_pci_orders(status);
CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_orders_updated_at ON public.clear_capital_pci_orders(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_orders_reference_identifier ON public.clear_capital_pci_orders(reference_identifier);

CREATE TABLE IF NOT EXISTS public.clear_capital_pci_order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  event_type TEXT NOT NULL,
  event_timestamp TIMESTAMPTZ,
  dedupe_key TEXT NOT NULL UNIQUE,
  sns_message_id TEXT,
  sns_type TEXT,
  payload JSONB NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_order_events_order_id ON public.clear_capital_pci_order_events(order_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_order_events_event_type ON public.clear_capital_pci_order_events(event_type, received_at DESC);
