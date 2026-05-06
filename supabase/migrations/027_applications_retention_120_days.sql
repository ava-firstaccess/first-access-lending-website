CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  job_id BIGINT;
BEGIN
  FOR job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'cleanup-old-applications'
  LOOP
    PERFORM cron.unschedule(job_id);
  END LOOP;
END $$;

SELECT cron.schedule(
  'cleanup-old-applications',
  '0 2 * * *',
  $$DELETE FROM applications WHERE created_at < NOW() - INTERVAL '120 days'$$
)
WHERE NOT EXISTS (
  SELECT 1
  FROM cron.job
  WHERE jobname = 'cleanup-old-applications'
);
