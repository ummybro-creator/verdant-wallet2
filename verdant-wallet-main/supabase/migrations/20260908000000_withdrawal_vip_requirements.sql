-- Migration to require all four VIP plans (750, 1100, 2600, 5000) for all withdrawal requests
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.profiles%ROWTYPE;
  v_s public.app_settings%ROWTYPE;
  v_tax numeric;
  v_id uuid;
  v_has_750 boolean;
  v_has_1100 boolean;
  v_has_2600 boolean;
  v_has_5000 boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_s FROM public.app_settings LIMIT 1;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  
  IF _amount < v_s.min_withdraw THEN RAISE EXCEPTION 'Minimum withdrawal is %', v_s.min_withdraw; END IF;
  IF v_p.withdraw_password IS NULL OR v_p.withdraw_password <> _password THEN RAISE EXCEPTION 'Incorrect withdrawal password'; END IF;
  IF v_p.balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  -- Check whether the user has purchased each of the four required VIP plans (750, 1100, 2600, 5000)
  SELECT EXISTS (
    SELECT 1 FROM public.purchases pu JOIN public.plans pl ON pl.id = pu.plan_id
    WHERE pu.user_id = v_uid AND pl.kind = 'vip' AND pl.price = 750
  ) INTO v_has_750;

  SELECT EXISTS (
    SELECT 1 FROM public.purchases pu JOIN public.plans pl ON pl.id = pu.plan_id
    WHERE pu.user_id = v_uid AND pl.kind = 'vip' AND pl.price = 1100
  ) INTO v_has_1100;

  SELECT EXISTS (
    SELECT 1 FROM public.purchases pu JOIN public.plans pl ON pl.id = pu.plan_id
    WHERE pu.user_id = v_uid AND pl.kind = 'vip' AND pl.price = 2600
  ) INTO v_has_2600;

  SELECT EXISTS (
    SELECT 1 FROM public.purchases pu JOIN public.plans pl ON pl.id = pu.plan_id
    WHERE pu.user_id = v_uid AND pl.kind = 'vip' AND pl.price = 5000
  ) INTO v_has_5000;

  -- Strictly require ALL FOUR VIP plans (750, 1100, 2600, 5000) to have been purchased
  IF NOT v_has_750 THEN
    RAISE EXCEPTION 'Withdrawal requires purchasing the Rs. 750 VIP plan.';
  END IF;
  IF NOT v_has_1100 THEN
    RAISE EXCEPTION 'Withdrawal requires purchasing the Rs. 1,100 VIP plan.';
  END IF;
  IF NOT v_has_2600 THEN
    RAISE EXCEPTION 'Withdrawal requires purchasing the Rs. 2,600 VIP plan.';
  END IF;
  IF NOT v_has_5000 THEN
    RAISE EXCEPTION 'Withdrawal requires purchasing the Rs. 5,000 VIP plan.';
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
