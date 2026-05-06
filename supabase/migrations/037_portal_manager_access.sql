ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS portal_users_role_check;
ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_role_check CHECK (role IN ('loan_officer', 'loan_processor', 'manager'));

ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS portal_users_position_check;
ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_position_check CHECK (position IN ('loan_officer', 'loan_processor', 'manager'));

CREATE INDEX IF NOT EXISTS idx_portal_users_position_role_active_prefix
  ON public.portal_users (position, role, active, prefix);

COMMENT ON COLUMN public.portal_users.role IS 'Portal role. loan_officer, loan_processor, and manager are supported.';
COMMENT ON COLUMN public.portal_users.position IS 'Business position used by the portal dashboard and access gates. manager can access both LO and LP hosts.';
