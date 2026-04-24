-- Link AVM cache records back to the application UUID created at OTP gate
ALTER TABLE avm_cache
  ADD COLUMN IF NOT EXISTS application_id UUID;

CREATE INDEX IF NOT EXISTS idx_avm_cache_application_id ON avm_cache (application_id);

ALTER TABLE avm_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Service role full access on avm_cache"
  ON avm_cache FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
