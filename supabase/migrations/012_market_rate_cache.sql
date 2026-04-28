CREATE TABLE IF NOT EXISTS market_rate_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL,
  cache_date DATE NOT NULL,
  value_numeric NUMERIC,
  source_url TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (cache_key, cache_date)
);

CREATE INDEX IF NOT EXISTS idx_market_rate_cache_key_date
  ON market_rate_cache (cache_key, cache_date DESC);

ALTER TABLE market_rate_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on market_rate_cache" ON market_rate_cache;
CREATE POLICY "Service role full access on market_rate_cache"
  ON market_rate_cache FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
