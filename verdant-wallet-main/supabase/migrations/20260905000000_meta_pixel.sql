ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS meta_pixel_id text;

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.profiles%ROWTYPE;
  v_s public.app_settings%ROWTYPE;
  v_tax numeric;
  v_id uuid;
  v_withdraw_count integer;
  v_max_vip_price numeric;
  v_required_vip numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_s FROM public.app_settings WHERE id;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  
  IF _amount < v_s.min_withdraw THEN RAISE EXCEPTION 'Minimum withdrawal is %', v_s.min_withdraw; END IF;
  IF v_p.withdraw_password IS NULL OR v_p.withdraw_password <> _password THEN RAISE EXCEPTION 'Incorrect withdrawal password'; END IF;
  IF v_p.balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  SELECT count(*) INTO v_withdraw_count FROM public.withdrawals WHERE user_id = v_uid AND status != 'rejected';
  
  IF v_withdraw_count = 0 THEN
      v_required_vip := 750;
  ELSIF v_withdraw_count = 1 THEN
      v_required_vip := 1100;
  ELSE
      v_required_vip := 2600;
  END IF;
  
  SELECT COALESCE(max(pl.price), 0) INTO v_max_vip_price
  FROM public.purchases pu JOIN public.plans pl ON pl.id = pu.plan_id
  WHERE pu.user_id = v_uid AND pl.kind = 'vip' AND pu.status = 'active';
  
  IF v_max_vip_price < v_required_vip THEN
      RAISE EXCEPTION 'This withdrawal requires an active VIP plan of at least Rs. %.', v_required_vip;
  END IF;

  v_tax := round(_amount * v_s.tax_percent / 100, 2);
  
  UPDATE public.profiles SET balance = balance - _amount,
    deposit_balance = LEAST(deposit_balance, balance - _amount) WHERE id = v_uid;
    
  INSERT INTO public.withdrawals (user_id, amount, tax, net, method, destination)
  VALUES (v_uid, _amount, v_tax, _amount - v_tax, CASE WHEN v_p.upi_id IS NOT NULL THEN 'upi' ELSE 'bank' END,
          COALESCE(v_p.upi_id, v_p.account_number))
  RETURNING id INTO v_id;
  
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'withdraw', _amount, 'pending', 'Withdrawal request');
  
  RETURN v_id;
END; $$;
