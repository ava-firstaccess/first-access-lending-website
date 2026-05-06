CREATE TABLE IF NOT EXISTS public.clearcapital_pdf_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT NOT NULL,
  requested_max_fsd NUMERIC(6,4),
  order_id TEXT NOT NULL,
  tracking_id TEXT,
  value NUMERIC(14,2),
  fsd NUMERIC(10,6),
  effective_date TIMESTAMPTZ,
  response_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archive_path TEXT
);

CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_cache_address_key_created_at
  ON public.clearcapital_pdf_cache (address_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_cache_archived_at
  ON public.clearcapital_pdf_cache (archived_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_cache_order_id
  ON public.clearcapital_pdf_cache (order_id);

CREATE TABLE IF NOT EXISTS public.clearcapital_pdf_order_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT NOT NULL,
  ordered_by_email TEXT,
  ordered_by_name TEXT,
  ordered_by_prefix TEXT,
  requested_max_fsd NUMERIC(6,4),
  order_status TEXT NOT NULL,
  order_id TEXT,
  tracking_id TEXT,
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  cache_source_order_id TEXT,
  value NUMERIC(14,2),
  fsd NUMERIC(10,6),
  request_payload JSONB,
  response_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  archive_path TEXT
);

ALTER TABLE public.clearcapital_pdf_order_log
  DROP CONSTRAINT IF EXISTS clearcapital_pdf_order_log_status_check;
ALTER TABLE public.clearcapital_pdf_order_log
  ADD CONSTRAINT clearcapital_pdf_order_log_status_check
  CHECK (order_status IN ('submitted', 'completed', 'failed'));

CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_order_log_address_key_created_at
  ON public.clearcapital_pdf_order_log (address_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_order_log_status_created_at
  ON public.clearcapital_pdf_order_log (order_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_order_log_archived_at
  ON public.clearcapital_pdf_order_log (archived_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_order_log_order_id
  ON public.clearcapital_pdf_order_log (order_id);

CREATE TABLE IF NOT EXISTS public.clearcapital_pdf_analytics_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key TEXT NOT NULL,
  property_address TEXT NOT NULL,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT NOT NULL,
  ordered_by_email TEXT,
  ordered_by_prefix TEXT,
  requested_max_fsd NUMERIC(6,4),
  cache_hit BOOLEAN NOT NULL DEFAULT FALSE,
  source_order_id TEXT,
  result_order_id TEXT,
  winner_value NUMERIC(14,2),
  winner_fsd NUMERIC(10,6),
  completed_successfully BOOLEAN,
  failure_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_analytics_runs_created_at
  ON public.clearcapital_pdf_analytics_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_analytics_runs_cache_hit_created_at
  ON public.clearcapital_pdf_analytics_runs (cache_hit, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clearcapital_pdf_analytics_runs_result_order_id
  ON public.clearcapital_pdf_analytics_runs (result_order_id);

ALTER TABLE IF EXISTS public.clear_capital_pci_orders
  ADD COLUMN IF NOT EXISTS address_key TEXT,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_orders_address_key_created_at
  ON public.clear_capital_pci_orders (address_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_orders_archived_at
  ON public.clear_capital_pci_orders (archived_at, created_at DESC);

ALTER TABLE IF EXISTS public.clear_capital_pci_order_events
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS archive_path TEXT;

CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_order_events_archived_at
  ON public.clear_capital_pci_order_events (archived_at, received_at DESC);

CREATE TABLE IF NOT EXISTS public.clear_capital_pci_analytics_runs (
  run_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT,
  address_key TEXT,
  property_address TEXT,
  property_city TEXT,
  property_state TEXT,
  property_zip TEXT,
  ordered_by_email TEXT,
  ordered_by_prefix TEXT,
  product_code TEXT,
  duplicate_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_reason TEXT,
  latest_status TEXT,
  latest_event_type TEXT,
  completed_successfully BOOLEAN,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clear_capital_pci_analytics_runs_order_id
  ON public.clear_capital_pci_analytics_runs (order_id);
CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_analytics_runs_created_at
  ON public.clear_capital_pci_analytics_runs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_clear_capital_pci_analytics_runs_duplicate_blocked_created_at
  ON public.clear_capital_pci_analytics_runs (duplicate_blocked, created_at DESC);

ALTER TABLE public.clearcapital_pdf_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcapital_pdf_order_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clearcapital_pdf_analytics_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clear_capital_pci_analytics_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on clearcapital_pdf_cache" ON public.clearcapital_pdf_cache;
CREATE POLICY "Service role full access on clearcapital_pdf_cache"
  ON public.clearcapital_pdf_cache FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on clearcapital_pdf_order_log" ON public.clearcapital_pdf_order_log;
CREATE POLICY "Service role full access on clearcapital_pdf_order_log"
  ON public.clearcapital_pdf_order_log FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on clearcapital_pdf_analytics_runs" ON public.clearcapital_pdf_analytics_runs;
CREATE POLICY "Service role full access on clearcapital_pdf_analytics_runs"
  ON public.clearcapital_pdf_analytics_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Service role full access on clear_capital_pci_analytics_runs" ON public.clear_capital_pci_analytics_runs;
CREATE POLICY "Service role full access on clear_capital_pci_analytics_runs"
  ON public.clear_capital_pci_analytics_runs FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_clearcapital_pdf_cache_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clearcapital_pdf_cache_updated_at ON public.clearcapital_pdf_cache;
CREATE TRIGGER trg_clearcapital_pdf_cache_updated_at
BEFORE UPDATE ON public.clearcapital_pdf_cache
FOR EACH ROW
EXECUTE FUNCTION set_clearcapital_pdf_cache_updated_at();

CREATE OR REPLACE FUNCTION set_clearcapital_pdf_order_log_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clearcapital_pdf_order_log_updated_at ON public.clearcapital_pdf_order_log;
CREATE TRIGGER trg_clearcapital_pdf_order_log_updated_at
BEFORE UPDATE ON public.clearcapital_pdf_order_log
FOR EACH ROW
EXECUTE FUNCTION set_clearcapital_pdf_order_log_updated_at();

CREATE OR REPLACE FUNCTION set_clearcapital_pdf_analytics_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clearcapital_pdf_analytics_runs_updated_at ON public.clearcapital_pdf_analytics_runs;
CREATE TRIGGER trg_clearcapital_pdf_analytics_runs_updated_at
BEFORE UPDATE ON public.clearcapital_pdf_analytics_runs
FOR EACH ROW
EXECUTE FUNCTION set_clearcapital_pdf_analytics_runs_updated_at();

CREATE OR REPLACE FUNCTION set_clear_capital_pci_analytics_runs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clear_capital_pci_analytics_runs_updated_at ON public.clear_capital_pci_analytics_runs;
CREATE TRIGGER trg_clear_capital_pci_analytics_runs_updated_at
BEFORE UPDATE ON public.clear_capital_pci_analytics_runs
FOR EACH ROW
EXECUTE FUNCTION set_clear_capital_pci_analytics_runs_updated_at();

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  FOR job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-old-clearcapital-pdf-cache'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-old-clearcapital-pdf-cache',
  '40 2 * * *',
  $$DELETE FROM clearcapital_pdf_cache WHERE created_at < NOW() - INTERVAL '120 days' AND archived_at IS NOT NULL$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-clearcapital-pdf-cache'
);

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  FOR job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-old-clearcapital-pdf-order-log'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-old-clearcapital-pdf-order-log',
  '45 2 * * *',
  $$DELETE FROM clearcapital_pdf_order_log WHERE created_at < NOW() - INTERVAL '120 days' AND archived_at IS NOT NULL$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-clearcapital-pdf-order-log'
);

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  FOR job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-old-clear-capital-pci-orders'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-old-clear-capital-pci-orders',
  '50 2 * * *',
  $$DELETE FROM clear_capital_pci_orders WHERE created_at < NOW() - INTERVAL '120 days' AND archived_at IS NOT NULL$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-clear-capital-pci-orders'
);

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  FOR job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-old-clear-capital-pci-order-events'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-old-clear-capital-pci-order-events',
  '55 2 * * *',
  $$DELETE FROM clear_capital_pci_order_events WHERE received_at < NOW() - INTERVAL '120 days' AND archived_at IS NOT NULL$$
)
WHERE NOT EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-clear-capital-pci-order-events'
);

COMMENT ON TABLE public.clearcapital_pdf_cache IS 'Hot operational cache for Clear Capital PDF AVM results. Do not treat signed PDF URLs as durable; regenerate them from order_id when needed.';
COMMENT ON TABLE public.clearcapital_pdf_order_log IS 'Raw outbound log for Clear Capital PDF order attempts made from the LP portal.';
COMMENT ON TABLE public.clearcapital_pdf_analytics_runs IS 'Durable run-level analytics for Clear Capital PDF requests, including cache hits.';
COMMENT ON TABLE public.clear_capital_pci_analytics_runs IS 'Durable run-level analytics for Clear Capital PCI order attempts, including duplicate-blocked attempts.';
COMMENT ON COLUMN public.clear_capital_pci_orders.address_key IS 'Normalized address key used to detect same-address PCI orders inside the operational 120-day window.';
