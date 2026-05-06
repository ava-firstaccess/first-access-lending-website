DO $$
BEGIN
  UPDATE public.portal_users
  SET
    prefix = 'jcindrario',
    email = 'jcindrario@firstaccesslending.com',
    phone = '',
    name = 'Jake Cindrario',
    role = 'loan_processor',
    position = 'loan_processor',
    active = TRUE,
    updated_at = NOW()
  WHERE prefix = 'jcindrario'
     OR lower(email) = 'jcindrario@firstaccesslending.com';

  IF NOT FOUND THEN
    INSERT INTO public.portal_users (
      prefix,
      email,
      phone,
      name,
      role,
      position,
      active
    )
    VALUES (
      'jcindrario',
      'jcindrario@firstaccesslending.com',
      '',
      'Jake Cindrario',
      'loan_processor',
      'loan_processor',
      TRUE
    );
  END IF;
END
$$;
