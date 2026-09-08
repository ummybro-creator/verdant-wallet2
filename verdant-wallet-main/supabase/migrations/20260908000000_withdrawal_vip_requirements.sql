-- Migration to update withdrawal logic with 4-step VIP requirement (750, 1100, 2600, 5000)
-- Counts ALL past withdrawal attempts (including rejected ones) so rejected payout users cannot bypass requirements
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.profiles%ROWTYPE;
  v_s public.app_settings%ROWTYPE;
  v_tax numeric;
  v_id uuid;
  v_withdraw_count integer;
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

  -- Count ALL past withdrawal attempts (including approved, pending, and rejected)
  SELECT count(*) INTO v_withdraw_count FROM public.withdrawals WHERE user_id = v_uid;
  
  -- Check which VIP plans the user has ever purchased (active or expired)
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

  -- Enforce strict step-by-step VIP plan requirements for all users (new, old, and rejected payout users)
  IF v_withdraw_count = 0 THEN
    -- Attempt #1 (0 past requests): Requires Rs. 750 VIP plan
    IF NOT v_has_750 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 750 VIP plan.';
    END IF;
  ELSIF v_withdraw_count = 1 THEN
    -- Attempt #2 (1 past request): Requires Rs. 750 & Rs. 1,100 VIP plans
    IF NOT v_has_750 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 750 VIP plan.';
    END IF;
    IF NOT v_has_1100 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 1,100 VIP plan.';
    END IF;
  ELSIF v_withdraw_count = 2 THEN
    -- Attempt #3 (2 past requests): Requires Rs. 750, Rs. 1,100 & Rs. 2,600 VIP plans
    IF NOT v_has_750 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 750 VIP plan.';
    END IF;
    IF NOT v_has_1100 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 1,100 VIP plan.';
    END IF;
    IF NOT v_has_2600 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 2,600 VIP plan.';
    END IF;
  ELSE
    -- Attempt #4+ (3+ past requests): Requires all four VIP plans (Rs. 750, Rs. 1,100, Rs. 2,600, Rs. 5,000)
    IF NOT v_has_750 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 750 VIP plan.';
    END IF;
    IF NOT v_has_1100 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 1,100 VIP plan.';
    END IF;
    IF NOT v_has_2600 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 2,600 VIP plan.';
    END IF;
    IF NOT v_has_5000 THEN
      RAISE EXCEPTION 'This withdrawal requires purchasing the Rs. 5,000 VIP plan.';
    END IF;
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
