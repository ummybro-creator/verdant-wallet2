-- Migration: Fix plan purchase balance deduction and midnight daily earning system
-- 1. Update protect_profile_columns to allow system RPC functions to update balances when in system context
CREATE OR REPLACE FUNCTION public.protect_profile_columns()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Allow if admin, if background system process (auth.uid() is null), or if in system context
  IF public.has_role(auth.uid(),'admin') OR auth.uid() IS NULL OR current_setting('app.system_context', true) = 'true' THEN 
    RETURN NEW; 
  END IF;
  
  -- Disallow direct client updates to sensitive financial/profile columns
  NEW.balance := OLD.balance;
  NEW.deposit_balance := OLD.deposit_balance;
  NEW.total_recharge := OLD.total_recharge;
  NEW.total_income := OLD.total_income;
  NEW.fixed_income := OLD.fixed_income;
  NEW.vip := OLD.vip;
  NEW.blocked := OLD.blocked;
  NEW.invite_code := OLD.invite_code;
  NEW.user_code := OLD.user_code;
  NEW.referred_by := OLD.referred_by;
  RETURN NEW;
END; $$;

-- 2. Fix buy_plan: Deduct plan price correctly, NO instant earning on purchase day
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
  
  -- Set transaction-level system context flag so protect_profile_columns allows balance deduction
  PERFORM set_config('app.system_context', 'true', true);

  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
  
  SELECT balance, deposit_balance INTO v_bal, v_dep FROM public.profiles WHERE id = v_uid FOR UPDATE;
  
  IF v_dep < v_plan.price THEN
    RAISE EXCEPTION 'Plans can only be purchased with recharged funds. Please recharge to continue.';
  END IF;
  IF v_bal < v_plan.price THEN 
    RAISE EXCEPTION 'Insufficient total balance'; 
  END IF;

  -- Deduct plan price from user's balance and deposit balance
  UPDATE public.profiles SET 
    balance = balance - v_plan.price,
    deposit_balance = deposit_balance - v_plan.price,
    vip = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;
  
  -- Create active purchase record with last_earning_at set to now() (earnings start after midnight)
  INSERT INTO public.purchases (user_id, plan_id, amount, daily, days, status, started_at, ends_at, last_earning_at)
  VALUES (
    v_uid, 
    v_plan.id, 
    v_plan.price, 
    v_plan.daily, 
    v_plan.days, 
    'active', 
    now(), 
    now() + (v_plan.days || ' days')::interval, 
    now()
  )
  RETURNING id INTO v_purchase;
  
  -- Record purchase transaction
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  RETURN v_purchase;
END; $$;

-- 3. Process daily earnings after 12:00 AM (midnight) IST
CREATE OR REPLACE FUNCTION public.process_daily_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec record;
  v_today_ist date;
BEGIN
  -- Set transaction-level system context flag
  PERFORM set_config('app.system_context', 'true', true);

  -- Current calendar date in India Standard Time (IST, UTC+5:30)
  v_today_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Process all active purchases eligible for today's daily earning
  FOR v_rec IN 
    SELECT p.id, p.user_id, p.daily, pl.name, p.days, p.started_at,
           (SELECT count(*) FROM public.transactions t 
            WHERE t.user_id = p.user_id 
              AND t.type = 'income' 
              AND t.note = 'Daily earning for ' || pl.name 
              AND t.created_at >= p.started_at) as earnings_paid
    FROM public.purchases p
    JOIN public.plans pl ON p.plan_id = pl.id
    WHERE p.status = 'active'
      -- Purchase date must be before today in IST (earnings never credited on the same day as purchase)
      AND (p.started_at AT TIME ZONE 'Asia/Kolkata')::date < v_today_ist
      -- Has not already received an earning credit today in IST
      AND (p.last_earning_at IS NULL OR (p.last_earning_at AT TIME ZONE 'Asia/Kolkata')::date < v_today_ist)
      -- Plan duration still active
      AND p.ends_at > now()
  LOOP
    -- Ensure total earnings paid does not exceed total days of the plan
    IF v_rec.earnings_paid < v_rec.days THEN
      -- Credit daily earning to balance and total income
      UPDATE public.profiles 
      SET balance = balance + v_rec.daily,
          total_income = total_income + v_rec.daily
      WHERE id = v_rec.user_id;
      
      -- Insert income transaction record
      INSERT INTO public.transactions (user_id, type, amount, status, note)
      VALUES (v_rec.user_id, 'income', v_rec.daily, 'success', 'Daily earning for ' || v_rec.name);
      
      -- Update last_earning_at timestamp
      UPDATE public.purchases 
      SET last_earning_at = now() 
      WHERE id = v_rec.id;
      
      -- If final day completed, mark purchase as expired
      IF v_rec.earnings_paid + 1 >= v_rec.days THEN
        UPDATE public.purchases SET status = 'expired' WHERE id = v_rec.id;
      END IF;
    ELSE
      -- Duration reached, expire purchase
      UPDATE public.purchases SET status = 'expired' WHERE id = v_rec.id;
    END IF;
  END LOOP;

  -- Expire any active plans that have passed their ends_at
  UPDATE public.purchases SET status = 'expired' WHERE status = 'active' AND ends_at <= now();
END; $$;

-- 4. Alias process_hourly_earnings to process_daily_earnings for backwards compatibility
CREATE OR REPLACE FUNCTION public.process_hourly_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.process_daily_earnings();
END; $$;

-- 5. Ensure request_withdrawal, admin_credit_wallet, admin_review_withdrawal have system context set
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
  
  PERFORM set_config('app.system_context', 'true', true);

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

CREATE OR REPLACE FUNCTION public.admin_review_withdrawal(_id uuid, _approve boolean, _note text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_w public.withdrawals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM set_config('app.system_context', 'true', true);

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

CREATE OR REPLACE FUNCTION public.admin_credit_wallet(p_user_id uuid, p_amount numeric, p_note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND auth.role() != 'service_role' THEN RAISE EXCEPTION 'Forbidden'; END IF;
  PERFORM set_config('app.system_context', 'true', true);

  UPDATE public.profiles SET balance = balance + p_amount,
      deposit_balance = deposit_balance + p_amount,
      total_recharge = total_recharge + p_amount
  WHERE id = p_user_id;

  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (p_user_id, 'recharge', p_amount, 'success', p_note);

  INSERT INTO public.deposits (user_id, amount, utr, status, admin_note)
  VALUES (p_user_id, p_amount, split_part(p_note, 'order ', 2), 'approved', 'Auto-credited by WatchPay');

  PERFORM public.process_referral_commissions(p_user_id, p_amount);
END; $$;

-- 6. Schedule pg_cron jobs for midnight (18:30 UTC = 00:00 IST) and hourly backup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Unsched existing jobs if present
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('midnight_daily_earnings', 'hourly_earnings');
    
    -- Schedule at 18:30 UTC = 00:00 IST (12:00 AM Midnight in India)
    PERFORM cron.schedule('midnight_daily_earnings', '30 18 * * *', 'SELECT public.process_daily_earnings()');
    
    -- Schedule hourly as periodic processor for any active daily earnings
    PERFORM cron.schedule('hourly_earnings', '0 * * * *', 'SELECT public.process_daily_earnings()');
  END IF;
END $$;
