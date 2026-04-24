-- Durable auth rate limiting for OTP send/verify across all app instances.

CREATE TABLE IF NOT EXISTS auth_rate_limits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scope TEXT NOT NULL,
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(scope, key, window_start)
);

CREATE INDEX IF NOT EXISTS idx_auth_rate_limits_lookup
  ON auth_rate_limits (scope, key, window_start DESC);

ALTER TABLE auth_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on auth_rate_limits" ON auth_rate_limits;
CREATE POLICY "Service role full access on auth_rate_limits"
  ON auth_rate_limits FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION consume_auth_rate_limit(
  p_scope TEXT,
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE(allowed BOOLEAN, remaining INTEGER, retry_after_seconds INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_window_start TIMESTAMPTZ;
  v_count INTEGER;
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'Invalid rate limit parameters';
  END IF;

  v_window_start := to_timestamp(floor(extract(epoch from v_now) / p_window_seconds) * p_window_seconds);

  INSERT INTO auth_rate_limits(scope, key, window_start, count, created_at, updated_at)
  VALUES (p_scope, p_key, v_window_start, 1, v_now, v_now)
  ON CONFLICT (scope, key, window_start)
  DO UPDATE SET
    count = auth_rate_limits.count + 1,
    updated_at = v_now
  RETURNING auth_rate_limits.count INTO v_count;

  RETURN QUERY
  SELECT
    v_count <= p_limit AS allowed,
    GREATEST(p_limit - v_count, 0) AS remaining,
    GREATEST((extract(epoch from (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::INTEGER, 0) AS retry_after_seconds;
END;
$$;

-- Best-effort cleanup for stale limiter buckets.
DELETE FROM auth_rate_limits WHERE updated_at < NOW() - INTERVAL '7 days';
