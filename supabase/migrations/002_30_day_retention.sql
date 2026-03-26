-- Enable pg_cron extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule daily cleanup of applications older than 30 days
SELECT cron.schedule(
  'cleanup-old-applications',
  '0 2 * * *',  -- Daily at 2 AM
  $$DELETE FROM applications WHERE created_at < NOW() - INTERVAL '30 days'$$
);

-- Also clean up old OTP codes (belt and suspenders - they already expire, but clean up DB)
SELECT cron.schedule(
  'cleanup-expired-otps',
  '0 3 * * *',  -- Daily at 3 AM
  $$DELETE FROM otp_codes WHERE created_at < NOW() - INTERVAL '24 hours'$$
);
