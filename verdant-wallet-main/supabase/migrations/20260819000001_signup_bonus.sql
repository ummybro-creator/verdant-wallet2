-- Update the app_settings default values for new rows and update existing row
ALTER TABLE public.app_settings 
  ALTER COLUMN level1_rate SET DEFAULT 25,
  ALTER COLUMN level2_rate SET DEFAULT 3,
  ALTER COLUMN level3_rate SET DEFAULT 2;

UPDATE public.app_settings 
SET level1_rate = 25, level2_rate = 3, level3_rate = 2 
WHERE id = true;

-- Update the handle_new_user trigger to include signup bonus
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text;
  v_ref uuid;
BEGIN
  v_phone := COALESCE(NEW.raw_user_meta_data->>'phone', split_part(NEW.email,'@',1));
  SELECT id INTO v_ref FROM public.profiles WHERE invite_code = upper(COALESCE(NEW.raw_user_meta_data->>'referral',''));
  
  INSERT INTO public.profiles (id, phone, user_code, invite_code, referred_by, withdraw_password, balance, total_income)
  VALUES (
    NEW.id,
    v_phone,
    lpad((floor(random()*90000)+10000)::text, 5, '0'),
    upper(substr(md5(NEW.id::text), 1, 6)),
    v_ref,
    NEW.raw_user_meta_data->>'withdraw_password',
    20.00,
    20.00
  );
  
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (NEW.id, 'income', 20.00, 'success', 'Signup Bonus');

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END; $$;
