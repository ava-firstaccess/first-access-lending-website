-- OTP Codes table
CREATE TABLE IF NOT EXISTS otp_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for lookup by phone + unused
CREATE INDEX idx_otp_phone_unused ON otp_codes (phone, used) WHERE used = FALSE;

-- Auto-cleanup: delete expired codes older than 1 hour
-- (Run as a cron or pg_cron job)

-- Applications table
CREATE TABLE IF NOT EXISTS applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  session_token TEXT,
  status TEXT DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'abandoned')),
  stage TEXT DEFAULT 'stage2',
  form_data JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for session token lookup
CREATE INDEX idx_app_session_token ON applications (session_token) WHERE session_token IS NOT NULL;

-- Index for phone lookup
CREATE INDEX idx_app_phone_status ON applications (phone, status);

-- Row Level Security (RLS)
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (our API routes use service role key)
CREATE POLICY "Service role full access on otp_codes"
  ON otp_codes FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE POLICY "Service role full access on applications"
  ON applications FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
