CREATE TABLE IF NOT EXISTS loan_officer_portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'loan_officer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT loan_officer_portal_users_prefix_format CHECK (prefix = lower(prefix)),
  CONSTRAINT loan_officer_portal_users_email_format CHECK (email = lower(email))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_portal_users_prefix_unique
  ON loan_officer_portal_users (prefix);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loan_officer_portal_users_email_unique
  ON loan_officer_portal_users (email);

CREATE INDEX IF NOT EXISTS idx_loan_officer_portal_users_active_prefix
  ON loan_officer_portal_users (active, prefix);

CREATE INDEX IF NOT EXISTS idx_loan_officer_portal_users_active_email
  ON loan_officer_portal_users (active, email);

ALTER TABLE loan_officer_portal_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on loan_officer_portal_users" ON loan_officer_portal_users;
CREATE POLICY "Service role full access on loan_officer_portal_users"
  ON loan_officer_portal_users FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION set_loan_officer_portal_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_officer_portal_users_updated_at ON loan_officer_portal_users;
CREATE TRIGGER trg_loan_officer_portal_users_updated_at
BEFORE UPDATE ON loan_officer_portal_users
FOR EACH ROW
EXECUTE FUNCTION set_loan_officer_portal_users_updated_at();

COMMENT ON TABLE loan_officer_portal_users IS 'Allowlisted loan officers for the private LO portal. OTP login resolves prefix or email to one mapped phone number.';
COMMENT ON COLUMN loan_officer_portal_users.prefix IS 'Lowercase email prefix used to log in, for example sholt.';
COMMENT ON COLUMN loan_officer_portal_users.email IS 'Full work email address for the loan officer.';
COMMENT ON COLUMN loan_officer_portal_users.phone IS 'Phone number used for portal OTP delivery.';
COMMENT ON COLUMN loan_officer_portal_users.active IS 'Only active rows are allowed to log in.';
