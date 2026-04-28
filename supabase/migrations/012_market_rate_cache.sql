CREATE TABLE IF NOT EXISTS market_rate_cache (
  cache_key TEXT PRIMARY KEY,
  refresh_date DATE,
  expires_at TIMESTAMPTZ,
  value_numeric NUMERIC,
  source_url TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_rate_cache_expires_at
  ON market_rate_cache (expires_at);

ALTER TABLE market_rate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on market_rate_cache" ON market_rate_cache;
CREATE POLICY "Service role full access on market_rate_cache"
  ON market_rate_cache FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
