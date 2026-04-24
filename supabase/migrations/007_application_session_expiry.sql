-- Add short-lived server-side session expiry to application sessions.
ALTER TABLE IF EXISTS applications
  ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_session_expires_at ON applications (session_expires_at)
  WHERE session_token IS NOT NULL;

-- Expire any existing long-lived sessions immediately so future access requires OTP again.
UPDATE applications
SET session_token = NULL,
    session_expires_at = NULL,
    updated_at = NOW()
WHERE session_token IS NOT NULL;
