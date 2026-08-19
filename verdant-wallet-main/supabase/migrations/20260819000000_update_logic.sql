-- 1. Helper function for referral commissions
CREATE OR REPLACE FUNCTION public.process_referral_commissions(_user_id uuid, _amount numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_ref1 uuid;
  v_ref2 uuid;
  v_ref3 uuid;
  v_c1 numeric;
  v_c2 numeric;
  v_c3 numeric;
BEGIN
  SELECT referred_by INTO v_ref1 FROM public.profiles WHERE id = _user_id;
  IF v_ref1 IS NOT NULL THEN
      v_c1 := round(_amount * 0.25, 2);
      UPDATE public.profiles SET balance = balance + v_c1, total_income = total_income + v_c1 WHERE id = v_ref1;
      INSERT INTO public.transactions (user_id, type, amount, status, note) VALUES (v_ref1, 'referral', v_c1, 'success', 'Level 1 commission from recharge');

      SELECT referred_by INTO v_ref2 FROM public.profiles WHERE id = v_ref1;
      IF v_ref2 IS NOT NULL THEN
          v_c2 := round(_amount * 0.03, 2);
          UPDATE public.profiles SET balance = balance + v_c2, total_income = total_income + v_c2 WHERE id = v_ref2;
          INSERT INTO public.transactions (user_id, type, amount, status, note) VALUES (v_ref2, 'referral', v_c2, 'success', 'Level 2 commission from recharge');

          SELECT referred_by INTO v_ref3 FROM public.profiles WHERE id = v_ref2;
          IF v_ref3 IS NOT NULL THEN
              v_c3 := round(_amount * 0.02, 2);
              UPDATE public.profiles SET balance = balance + v_c3, total_income = total_income + v_c3 WHERE id = v_ref3;
              INSERT INTO public.transactions (user_id, type, amount, status, note) VALUES (v_ref3, 'referral', v_c3, 'success', 'Level 3 commission from recharge');
          END IF;
      END IF;
  END IF;
END; $$;

-- 2. admin_credit_wallet for WatchPay webhook
CREATE OR REPLACE FUNCTION public.admin_credit_wallet(p_user_id uuid, p_amount numeric, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() != 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;

  UPDATE public.profiles SET balance = balance + p_amount,
      deposit_balance = deposit_balance + p_amount,
      total_recharge = total_recharge + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (p_user_id, 'recharge', p_amount, 'success', p_note);

  -- The WatchPay edge function inserts the deposit record if this fails, 
  -- but since we handle it here we don't need it to. Wait, watchpay-callback 
  -- actually inserts the deposit record as a fallback ONLY if this fails. 
  -- Wait, if this succeeds, watchpay-callback DOES NOT insert the deposit!
  -- So we MUST insert the deposit record here!
  INSERT INTO public.deposits (user_id, amount, utr, status, admin_note)
  VALUES (p_user_id, p_amount, split_part(p_note, 'order ', 2), 'approved', 'Auto-credited by WatchPay');

  PERFORM public.process_referral_commissions(p_user_id, p_amount);
END; $$;

REVOKE EXECUTE ON FUNCTION public.admin_credit_wallet(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_credit_wallet(uuid, numeric, text) TO authenticated, service_role;

-- 3. Update admin_review_deposit to include referral commissions
CREATE OR REPLACE FUNCTION public.admin_review_deposit(_id uuid, _approve boolean, _note text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d public.deposits%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_d FROM public.deposits WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR v_d.status <> 'pending' THEN RAISE EXCEPTION 'Deposit not pending'; END IF;
  UPDATE public.deposits SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    admin_note = _note, reviewed_at = now() WHERE id = _id;
  IF _approve THEN
    UPDATE public.profiles SET balance = balance + v_d.amount,
      deposit_balance = deposit_balance + v_d.amount,
      total_recharge = total_recharge + v_d.amount WHERE id = v_d.user_id;
    INSERT INTO public.transactions (user_id, type, amount, status, note)
    VALUES (v_d.user_id, 'recharge', v_d.amount, 'success', 'Recharge approved · UTR ' || COALESCE(v_d.utr,''));
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_d.user_id, 'Recharge approved', 'Your recharge has been credited to your wallet.');
    
    PERFORM public.process_referral_commissions(v_d.user_id, v_d.amount);
  ELSE
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_d.user_id, 'Recharge rejected', COALESCE(_note, 'Your recharge request was rejected.'));
  END IF;
END; $$;

-- 4. Update buy_plan to REMOVE old referral commissions
CREATE OR REPLACE FUNCTION public.buy_plan(_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_bal numeric;
  v_dep numeric;
  v_purchase uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
  
  SELECT balance, deposit_balance INTO v_bal, v_dep FROM public.profiles WHERE id = v_uid FOR UPDATE;
  
  IF v_dep < v_plan.price THEN
    RAISE EXCEPTION 'Plans can only be purchased with recharged funds. Please recharge to continue.';
  END IF;
  IF v_bal < v_plan.price THEN RAISE EXCEPTION 'Insufficient total balance'; END IF;

  UPDATE public.profiles SET balance = balance - v_plan.price,
    deposit_balance = deposit_balance - v_plan.price,
    vip = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;
  
  INSERT INTO public.purchases (user_id, plan_id, amount, daily, days, ends_at)
  VALUES (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days, now() + (v_plan.days || ' days')::interval)
  RETURNING id INTO v_purchase;
  
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  -- Old referral logic removed here

  RETURN v_purchase;
END; $$;

-- 5. Update request_withdrawal for VIP requirement based on attempts
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

  -- Count past withdrawals
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
      RAISE EXCEPTION 'Withdrawal attempt % requires an active VIP plan of at least ₹%.', (v_withdraw_count + 1), v_required_vip;
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
