-- Store application session tokens hashed at rest.
ALTER TABLE IF EXISTS applications
  ADD COLUMN IF NOT EXISTS session_token_hash TEXT;

CREATE INDEX IF NOT EXISTS idx_app_session_token_hash
  ON applications (session_token_hash)
  WHERE session_token_hash IS NOT NULL;
