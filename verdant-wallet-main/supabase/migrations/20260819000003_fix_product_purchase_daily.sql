-- Add last_earning_at to purchases to track daily payouts
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS last_earning_at timestamp with time zone DEFAULT now();

-- Create function to process daily earnings
CREATE OR REPLACE FUNCTION public.process_hourly_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec record;
BEGIN
  FOR v_rec IN 
    SELECT p.id, p.user_id, p.daily, pl.name 
    FROM public.purchases p
    JOIN public.plans pl ON p.plan_id = pl.id
    WHERE p.status = 'active' AND p.ends_at > now() AND p.last_earning_at < now() - interval '24 hours'
  LOOP
    UPDATE public.profiles 
    SET balance = balance + v_rec.daily,
        total_income = total_income + v_rec.daily
    WHERE id = v_rec.user_id;
    
    INSERT INTO public.transactions (user_id, type, amount, status, note)
    VALUES (v_rec.user_id, 'income', v_rec.daily, 'success', 'Daily earning for ' || v_rec.name);
    
    UPDATE public.purchases SET last_earning_at = now() WHERE id = v_rec.id;
  END LOOP;

  UPDATE public.purchases SET status = 'expired' WHERE status = 'active' AND ends_at <= now();
END; $$;

-- Schedule it to run every hour using pg_cron (if already exists, ignore or drop first)
-- (We assume pg_cron extension is enabled and handled in live db)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule('hourly_earnings', '0 * * * *', 'SELECT public.process_hourly_earnings()');
  END IF;
END $$;

-- Fix buy_plan to properly deduct price and credit ONLY the first daily earning instantly
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

  UPDATE public.profiles SET 
    balance = balance - v_plan.price + v_plan.daily,
    deposit_balance = deposit_balance - v_plan.price,
    total_income = total_income + v_plan.daily,
    vip = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;
  
  INSERT INTO public.purchases (user_id, plan_id, amount, daily, days, ends_at, last_earning_at)
  VALUES (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days, now() + (v_plan.days || ' days')::interval, now())
  RETURNING id INTO v_purchase;
  
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'income', v_plan.daily, 'success', 'Daily earning for ' || v_plan.name);

  RETURN v_purchase;
END; $$;
