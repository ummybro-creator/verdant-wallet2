ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS deposit_balance numeric NOT NULL DEFAULT 0;

UPDATE public.profiles p SET deposit_balance = GREATEST(
  LEAST(p.balance, p.total_recharge - COALESCE((SELECT sum(amount) FROM public.purchases pu WHERE pu.user_id = p.id), 0)), 0);

CREATE TABLE IF NOT EXISTS public.payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount numeric NOT NULL,
  upi_id text,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '9 minutes',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.payment_requests TO authenticated;
GRANT ALL ON public.payment_requests TO service_role;
ALTER TABLE public.payment_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own payment requests" ON public.payment_requests
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own payment requests" ON public.payment_requests
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update payment requests" ON public.payment_requests
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER update_payment_requests_updated_at BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS payment_requests_status_idx ON public.payment_requests (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.notify_admins_payment_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_phone text;
BEGIN
  SELECT phone INTO v_phone FROM public.profiles WHERE id = NEW.user_id;
  INSERT INTO public.notifications (user_id, title, body)
  SELECT ur.user_id, 'New payment request',
         'User ' || COALESCE(v_phone,'') || ' started a payment of ' || NEW.amount::text
  FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS payment_request_notify ON public.payment_requests;
CREATE TRIGGER payment_request_notify AFTER INSERT ON public.payment_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_payment_request();

CREATE OR REPLACE FUNCTION public.create_payment_request(_amount numeric)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid(); v_id uuid; v_upi text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _amount <= 0 THEN RAISE EXCEPTION 'Invalid amount'; END IF;
  UPDATE public.payment_requests SET status = 'expired'
    WHERE user_id = v_uid AND status = 'pending' AND expires_at < now();
  SELECT upi_id INTO v_upi FROM public.app_settings WHERE id;
  INSERT INTO public.payment_requests (user_id, amount, upi_id)
  VALUES (v_uid, _amount, v_upi) RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

REVOKE EXECUTE ON FUNCTION public.create_payment_request(numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_payment_request(numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.buy_plan(_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_bal numeric;
  v_dep numeric;
  v_purchase uuid;
  v_ref uuid;
  v_rate numeric;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
  SELECT balance, deposit_balance, referred_by INTO v_bal, v_dep, v_ref FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_dep < v_plan.price THEN
    RAISE EXCEPTION 'Plans can only be purchased with recharged funds. Please recharge to continue.';
  END IF;
  IF v_bal < v_plan.price THEN RAISE EXCEPTION 'Insufficient balance'; END IF;

  UPDATE public.profiles SET balance = balance - v_plan.price,
    deposit_balance = deposit_balance - v_plan.price,
    vip = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;
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

CREATE OR REPLACE FUNCTION public.request_withdrawal(_amount numeric, _password text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_p public.profiles%ROWTYPE;
  v_s public.app_settings%ROWTYPE;
  v_tax numeric;
  v_id uuid;
  v_vip boolean;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_s FROM public.app_settings WHERE id;
  SELECT * INTO v_p FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF _amount < v_s.min_withdraw THEN RAISE EXCEPTION 'Minimum withdrawal is %', v_s.min_withdraw; END IF;
  SELECT EXISTS (
    SELECT 1 FROM public.purchases pu JOIN public.plans pl ON pl.id = pu.plan_id
    WHERE pu.user_id = v_uid AND pl.kind = 'vip' AND pu.status = 'active'
  ) INTO v_vip;
  IF NOT v_vip THEN RAISE EXCEPTION 'VIP plan must be activated to withdraw.'; END IF;
  IF v_p.withdraw_password IS NULL OR v_p.withdraw_password <> _password THEN RAISE EXCEPTION 'Incorrect withdrawal password'; END IF;
  IF v_p.balance < _amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
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
    VALUES (v_d.user_id, 'recharge', v_d.amount, 'success', 'Recharge approved · UTR ' || v_d.utr);
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_d.user_id, 'Recharge approved', 'Your recharge has been credited to your wallet.');
  ELSE
    INSERT INTO public.notifications (user_id, title, body)
    VALUES (v_d.user_id, 'Recharge rejected', COALESCE(_note, 'Your recharge request was rejected.'));
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.admin_adjust_balance(_user_id uuid, _amount numeric, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  UPDATE public.profiles SET balance = balance + _amount,
    deposit_balance = GREATEST(LEAST(deposit_balance + _amount, balance + _amount), 0)
  WHERE id = _user_id;
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (_user_id, CASE WHEN _amount >= 0 THEN 'income' ELSE 'withdraw' END, abs(_amount), 'success', COALESCE(_note,'Admin adjustment'));
END; $$;

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
    'invested', (SELECT COALESCE(sum(amount),0) FROM public.purchases),
    'payment_requests_pending', (SELECT count(*) FROM public.payment_requests WHERE status='pending' AND expires_at > now())
  ) INTO v;
  RETURN v;
END; $$;

REVOKE EXECUTE ON FUNCTION public.buy_plan(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.buy_plan(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(numeric, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_review_deposit(uuid, boolean, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_adjust_balance(uuid, numeric, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_stats() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_admins_payment_request() FROM PUBLIC;