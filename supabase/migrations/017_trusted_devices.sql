CREATE TABLE IF NOT EXISTS trusted_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type TEXT NOT NULL,
  user_key TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  last_seen_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT trusted_devices_user_type_check CHECK (user_type IN ('loan_officer', 'consumer'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trusted_devices_token_hash_unique
  ON trusted_devices (token_hash);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_user_lookup
  ON trusted_devices (user_type, user_key);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_active_lookup
  ON trusted_devices (user_type, user_key, expires_at)
  WHERE revoked_at IS NULL;

ALTER TABLE trusted_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on trusted_devices" ON trusted_devices;
CREATE POLICY "Service role full access on trusted_devices"
  ON trusted_devices FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_trusted_devices_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trusted_devices_updated_at ON trusted_devices;
CREATE TRIGGER trg_trusted_devices_updated_at
BEFORE UPDATE ON trusted_devices
FOR EACH ROW
EXECUTE FUNCTION set_trusted_devices_updated_at();

COMMENT ON TABLE trusted_devices IS 'Hashed remembered-browser tokens for loan officer and future consumer 2FA flows.';
COMMENT ON COLUMN trusted_devices.user_type IS 'User namespace, for example loan_officer or consumer.';
COMMENT ON COLUMN trusted_devices.user_key IS 'Stable identifier inside the namespace, such as LO prefix or consumer application/user id.';
COMMENT ON COLUMN trusted_devices.token_hash IS 'HMAC hash of the raw remembered-browser token stored in the httpOnly cookie.';
COMMENT ON COLUMN trusted_devices.expires_at IS 'Hard expiry for remembered-browser trust.';
COMMENT ON COLUMN trusted_devices.revoked_at IS 'Set when a remembered browser is explicitly invalidated.';

COMMENT ON TABLE loan_officer_portal_users IS 'Allowlisted loan officers for the private LO portal. OTP login resolves prefix or email to one mapped work email.';
COMMENT ON COLUMN loan_officer_portal_users.phone IS 'Stored contact number for the loan officer. Email is now used for portal OTP delivery.';
