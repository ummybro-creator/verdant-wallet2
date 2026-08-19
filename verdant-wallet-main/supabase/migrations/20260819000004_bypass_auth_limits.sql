-- Migration to add custom_register RPC to bypass Supabase GoTrue email rate limits
-- IMPORTANT: Token fields must be empty strings NOT null, or GoTrue's signInWithPassword fails

DROP FUNCTION IF EXISTS public.custom_register(text, text, text, text);

CREATE FUNCTION public.custom_register(
  p_phone text,
  p_password text,
  p_withdraw_password text,
  p_referral text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  -- Match the frontend's phoneToEmail format
  v_email := p_phone;
  IF NOT v_email LIKE '%@%' THEN
    v_email := p_phone || '@coolio.app';
  END IF;

  -- Check if user exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'This mobile number is already registered';
  END IF;

  v_uid := gen_random_uuid();

  -- Insert directly into auth.users (bypasses GoTrue limits completely)
  -- Token fields MUST be empty strings (not null) or GoTrue login will fail
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at,
    is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf', 10)),
    now(),
    jsonb_build_object('phone', p_phone, 'referral', p_referral, 'withdraw_password', p_withdraw_password),
    '{"provider":"email","providers":["email"]}',
    now(),
    now(),
    false,
    false,
    '',
    '',
    '',
    ''
  );

  -- Insert into auth.identities so they can use signInWithPassword normally
  INSERT INTO auth.identities (
    id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
  ) VALUES (
    gen_random_uuid(),
    v_uid::text,
    v_uid,
    jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email',
    now(),
    now(),
    now()
  );

  -- Return the exact email stored so frontend can use it for signInWithPassword
  RETURN v_email;
END; $$;

REVOKE EXECUTE ON FUNCTION public.custom_register(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_register(text, text, text, text) TO anon, authenticated;

-- Fix any existing users that were registered with null token fields
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change = COALESCE(email_change, '')
WHERE confirmation_token IS NULL OR recovery_token IS NULL
   OR email_change_token_new IS NULL OR email_change IS NULL;
