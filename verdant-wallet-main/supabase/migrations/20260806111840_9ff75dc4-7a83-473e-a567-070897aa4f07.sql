REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_columns() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;

-- buy a plan
CREATE OR REPLACE FUNCTION public.buy_plan(_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_bal numeric;
  v_purchase uuid;
  v_ref uuid;
  v_rate numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
  SELECT balance, referred_by INTO v_bal, v_ref FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_bal < v_plan.price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles SET balance = balance - v_plan.price WHERE id = v_uid;
  INSERT INTO public.purchases (user_id, plan_id, amount, daily, days, ends_at)
  VALUES (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days, now() + (v_plan.days || ' days')::interval)
  RETURNING id INTO v_purchase;
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  IF v_ref IS NOT NULL THEN
    SELECT level1_rate INTO v_rate FROM public.app_settings WHERE id;
    UPDATE public.profiles SET balance = balance + (v_plan.price * v_rate / 100),
      total_income = total_income + (v_plan.price * v_rate / 100) WHERE id = v_ref;
    INSERT INTO public.transactions (user_id, type, amount, status, note)
    VALUES (v_ref, 'referral', v_plan.price * v_rate / 100, 'success', 'Level 1 commission');
  END IF;
  RETURN v_purchase;
END; $$;
REVOKE EXECUTE ON FUNCTION public.buy_plan(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.buy_plan(uuid) TO authenticated;

-- request withdrawal
CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.profiles%ROWTYPE;
  v_s public.app_settings%ROWTYPE;
  v_tax numeric;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_s FROM public.app_settings WHERE id;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF _amount < v_s.min_withdraw THEN RAISE EXCEPTION 'Minimum withdrawal is %', v_s.min_withdraw; END IF;
  IF v_p.withdraw_password IS NULL OR v_p.withdraw_password <> _password THEN RAISE EXCEPTION 'Incorrect withdrawal password'; END IF;
  IF v_p.balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  v_tax := round(_amount * v_s.tax_percent / 100, 2);
  UPDATE public.profiles SET balance = balance - _amount WHERE id = v_uid;
  INSERT INTO public.withdrawals (user_id, amount, tax, net, method, destination)
  VALUES (v_uid, _amount, v_tax, _amount - v_tax, CASE WHEN v_p.upi_id IS NOT NULL THEN 'upi' ELSE 'bank' END,
          COALESCE(v_p.upi_id, v_p.account_number))
  RETURNING id INTO v_id;
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'withdraw', _amount, 'pending', 'Withdrawal request');
  RETURN v_id;
END; $$;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;

-- admin: review deposit
CREATE OR REPLACE FUNCTION public.admin_review_deposit(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_d public.deposits%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_d FROM public.deposits WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR v_d.status <> 'pending' THEN RAISE EXCEPTION 'Deposit not pending'; END IF;
  UPDATE public.deposits SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    admin_note = _note, reviewed_at = now() WHERE id = _id;
  IF _approve THEN
    UPDATE public.profiles SET balance = balance + v_d.amount, total_recharge = total_recharge + v_d.amount WHERE id = v_d.user_id;
    INSERT INTO public.transactions (user_id, type, amount, status, note)
    VALUES (v_d.user_id, 'recharge', v_d.amount, 'success', 'Recharge approved · UTR ' || v_d.utr);
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_d.user_id, 'Recharge approved', 'Your recharge has been credited to your wallet.');
  ELSE
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_d.user_id, 'Recharge rejected', COALESCE(_note, 'Your recharge request was rejected.'));
  END IF;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) TO authenticated;

-- admin: review withdrawal
CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT * INTO v_w FROM public.withdrawals WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR v_w.status <> 'pending' THEN RAISE EXCEPTION 'Withdrawal not pending'; END IF;
  UPDATE public.withdrawals SET status = CASE WHEN _approve THEN 'approved' ELSE 'rejected' END,
    admin_note = _note, reviewed_at = now() WHERE id = _id;
  IF NOT _approve THEN
    UPDATE public.profiles SET balance = balance + v_w.amount WHERE id = v_w.user_id;
  END IF;
  INSERT INTO public.notifications (user_id, title, body)
  VALUES (v_w.user_id, CASE WHEN _approve THEN 'Withdrawal paid' ELSE 'Withdrawal rejected' END,
          COALESCE(_note, CASE WHEN _approve THEN 'Your payout has been sent.' ELSE 'Amount refunded to your wallet.' END));
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_review_withdrawal(uuid, boolean, text) TO authenticated;

-- admin: adjust balance
CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _amount numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET balance = balance + _amount WHERE id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (_user_id, CASE WHEN _amount >= 0 THEN 'income' ELSE 'withdraw' END, abs(_amount), 'success', COALESCE(_note,'Admin adjustment'));
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) TO authenticated;

-- admin stats
CREATE OR REPLACE FUNCTION public.admin_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  SELECT jsonb_build_object(
    'users', (SELECT count(*) FROM public.profiles),
    'users_today', (SELECT count(*) FROM public.profiles WHERE created_at > current_date),
    'balance', (SELECT COALESCE(sum(balance),0) FROM public.profiles),
    'deposits_total', (SELECT COALESCE(sum(amount),0) FROM public.deposits WHERE status='approved'),
    'deposits_pending', (SELECT count(*) FROM public.deposits WHERE status='pending'),
    'withdrawals_total', (SELECT COALESCE(sum(amount),0) FROM public.withdrawals WHERE status='approved'),
    'withdrawals_pending', (SELECT count(*) FROM public.withdrawals WHERE status='pending'),
    'purchases', (SELECT count(*) FROM public.purchases),
    'invested', (SELECT COALESCE(sum(amount),0) FROM public.purchases)
  ) INTO v;
  RETURN v;
END; $$;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM anon;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;

-- team stats for current user
CREATE OR REPLACE FUNCTION public.my_team()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v jsonb; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT jsonb_build_object(
    'size', (SELECT count(*) FROM public.profiles WHERE referred_by = v_uid),
    'recharge', (SELECT COALESCE(sum(p.total_recharge),0) FROM public.profiles p WHERE p.referred_by = v_uid),
    'members', COALESCE((SELECT jsonb_agg(jsonb_build_object('phone', left(phone,3)||'****'||right(phone,3), 'joined', created_at, 'recharge', total_recharge) ORDER BY created_at DESC)
       FROM public.profiles WHERE referred_by = v_uid), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END; $$;
REVOKE EXECUTE ON FUNCTION public.my_team() FROM anon;
GRANT EXECUTE ON FUNCTION public.my_team() TO authenticated;