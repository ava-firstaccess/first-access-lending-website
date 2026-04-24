-- Retention cleanup for operational tables that are not durable system-of-record data.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-avm-cache') THEN
    PERFORM cron.schedule(
      'cleanup-old-avm-cache',
      '15 2 * * *',
      $$DELETE FROM avm_cache WHERE created_at < NOW() - INTERVAL '30 days'$$
    );
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-old-meridianlink-runs') THEN
    PERFORM cron.schedule(
      'cleanup-old-meridianlink-runs',
      '30 2 * * *',
      $$DELETE FROM meridianlink_runs WHERE created_at < NOW() - INTERVAL '30 days'$$
    );
  END IF;
END
$$;
