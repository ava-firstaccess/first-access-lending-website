ALTER TABLE public.portal_users
  ADD COLUMN IF NOT EXISTS position TEXT;

UPDATE public.portal_users
SET position = COALESCE(NULLIF(btrim(position), ''), NULLIF(btrim(role), ''), 'loan_officer')
WHERE position IS NULL OR btrim(position) = '';

ALTER TABLE public.portal_users
  ALTER COLUMN position SET DEFAULT 'loan_officer';

ALTER TABLE public.portal_users
  ALTER COLUMN position SET NOT NULL;

ALTER TABLE public.portal_users DROP CONSTRAINT IF EXISTS portal_users_position_check;
ALTER TABLE public.portal_users
  ADD CONSTRAINT portal_users_position_check CHECK (position IN ('loan_officer', 'loan_processor'));

CREATE INDEX IF NOT EXISTS idx_portal_users_position_active_prefix
  ON public.portal_users (position, active, prefix);

COMMENT ON COLUMN public.portal_users.position IS 'Business position used by the portal dashboard and access gates.';
