DO $$
BEGIN
  IF to_regclass('public.portal_users') IS NULL AND to_regclass('public.loan_officer_portal_users') IS NOT NULL THEN
    ALTER TABLE public.loan_officer_portal_users RENAME TO portal_users;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prefix TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'loan_officer',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'loan_officer';

ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE public.portal_users
SET role = 'loan_officer'
WHERE role IS NULL OR btrim(role) = '';

ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS loan_officer_portal_users_prefix_format;
ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS loan_officer_portal_users_email_format;
ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS portal_users_prefix_format;
ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS portal_users_email_format;
ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS portal_users_role_check;

ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_prefix_format CHECK (prefix = lower(prefix));
ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_email_format CHECK (email = lower(email));
ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_role_check CHECK (role IN ('loan_officer', 'loan_processor'));

ALTER INDEX IF EXISTS idx_loan_officer_portal_users_prefix_unique RENAME TO idx_portal_users_prefix_unique;
ALTER INDEX IF EXISTS idx_loan_officer_portal_users_email_unique RENAME TO idx_portal_users_email_unique;
ALTER INDEX IF EXISTS idx_loan_officer_portal_users_active_prefix RENAME TO idx_portal_users_active_prefix;
ALTER INDEX IF EXISTS idx_loan_officer_portal_users_active_email RENAME TO idx_portal_users_active_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_prefix_unique
  ON public.portal_users (prefix);
CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_users_email_unique
  ON public.portal_users (email);
CREATE INDEX IF NOT EXISTS idx_portal_users_active_prefix
  ON public.portal_users (active, prefix);
CREATE INDEX IF NOT EXISTS idx_portal_users_active_email
  ON public.portal_users (active, email);
CREATE INDEX IF NOT EXISTS idx_portal_users_role_active_prefix
  ON public.portal_users (role, active, prefix);

ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on loan_officer_portal_users" ON public.portal_users;
DROP POLICY IF EXISTS "Service role full access on portal_users" ON public.portal_users;
CREATE POLICY "Service role full access on portal_users"
  ON public.portal_users FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE OR REPLACE FUNCTION public.set_portal_users_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_officer_portal_users_updated_at ON public.portal_users;
DROP TRIGGER IF EXISTS trg_portal_users_updated_at ON public.portal_users;
CREATE TRIGGER trg_portal_users_updated_at
BEFORE UPDATE ON public.portal_users
FOR EACH ROW
EXECUTE FUNCTION public.set_portal_users_updated_at();

COMMENT ON TABLE public.portal_users IS 'Allowlisted internal portal users for the LO and LP portals.';
COMMENT ON COLUMN public.portal_users.prefix IS 'Lowercase email prefix used to log in, for example sholt.';
COMMENT ON COLUMN public.portal_users.email IS 'Full work email address for the internal portal user.';
COMMENT ON COLUMN public.portal_users.phone IS 'Stored contact number for the portal user. Email is used for portal OTP delivery.';
COMMENT ON COLUMN public.portal_users.role IS 'Portal role. loan_officer and loan_processor are currently supported.';
COMMENT ON COLUMN public.portal_users.active IS 'Only active rows are allowed to log in.';

ALTER TABLE public.trusted_devices DROP CONSTRAINT IF EXISTS trusted_devices_user_type_check;
ALTER TABLE public.trusted_devices
  ADD CONSTRAINT trusted_devices_user_type_check CHECK (user_type IN ('loan_officer', 'portal_user', 'consumer'));

COMMENT ON TABLE public.trusted_devices IS 'Hashed remembered-browser tokens for portal users and future consumer 2FA flows.';
COMMENT ON COLUMN public.trusted_devices.user_type IS 'User namespace, for example portal_user, legacy loan_officer, or consumer.';
COMMENT ON COLUMN public.trusted_devices.user_key IS 'Stable identifier inside the namespace, such as portal prefix or consumer application/user id.';
