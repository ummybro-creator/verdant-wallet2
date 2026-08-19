-- Migration to add custom_register RPC to bypass Supabase GoTrue email rate limits
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.custom_register(
  p_phone text,
  p_password text,
  p_withdraw_password text,
  p_referral text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email text;
  v_uid uuid;
BEGIN
  -- Replicate the frontend's phoneToEmail behavior if needed
  v_email := p_phone;
  IF NOT v_email LIKE '%@%' THEN
    v_email := p_phone || '@velvato.app';
  END IF;
  
  -- Check if user exists
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = v_email) THEN
    RAISE EXCEPTION 'This mobile number is already registered';
  END IF;

  v_uid := gen_random_uuid();
  
  -- Insert directly into auth.users (bypasses GoTrue limits completely)
  INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_user_meta_data, raw_app_meta_data, created_at, updated_at
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_uid,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    jsonb_build_object('phone', p_phone, 'referral', p_referral, 'withdraw_password', p_withdraw_password),
    '{"provider":"email","providers":["email"]}',
    now(),
    now()
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

END; $$;

REVOKE EXECUTE ON FUNCTION public.custom_register(text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.custom_register(text, text, text, text) TO anon, authenticated;
