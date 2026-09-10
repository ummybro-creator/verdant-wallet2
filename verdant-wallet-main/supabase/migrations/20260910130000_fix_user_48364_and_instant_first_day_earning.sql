-- Migration: Fix UID 48364 & All Users Daily Earning Logic (Instant Day 1 + Midnight IST Progression)
--
-- Fixes:
-- 1. Day 1 daily earning is credited on purchase day (or immediately upon catch-up).
-- 2. Subsequent days (Day 2, Day 3, etc.) are auto-credited after 12:00 AM Midnight IST.
-- 3. All missed earnings for existing users (including UID 48364's Rs. 800 plan and all others)
--    are immediately calculated and added to their Wallet Balance (balance) & Total Income (total_income).

-- =========================================================================
-- STEP 1: Ensure purchases table has earnings_count column
-- =========================================================================
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS earnings_count integer NOT NULL DEFAULT 0;

-- =========================================================================
-- STEP 2: Reactivate all purchases that have not received all plan days
-- =========================================================================
UPDATE public.purchases
SET status = 'active'
WHERE COALESCE(earnings_count, 0) < days;

-- =========================================================================
-- STEP 3: Rewrite process_daily_earnings() with Day 1 + Catch-up logic
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_daily_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec record;
  v_today_ist date;
  v_started_ist date;
  v_days_elapsed integer;
  v_target_earnings integer;
  v_due integer;
  v_amount_to_credit numeric;
  i integer;
BEGIN
  -- Set transaction-level system context flag so protect_profile_columns trigger permits balance updates
  PERFORM set_config('app.system_context', 'true', true);

  -- Current calendar date in India Standard Time (IST, UTC+5:30)
  v_today_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- 1. Ensure any purchase that hasn't received all its plan days remains active
  UPDATE public.purchases
  SET status = 'active'
  WHERE COALESCE(earnings_count, 0) < days;

  -- 2. Process all active purchases
  FOR v_rec IN
    SELECT
      p.id,
      p.user_id,
      p.daily,
      p.days,
      COALESCE(p.earnings_count, 0) AS earnings_count,
      p.started_at,
      p.ends_at,
      p.last_earning_at,
      pl.name AS plan_name
    FROM public.purchases p
    JOIN public.plans pl ON p.plan_id = pl.id
    WHERE p.status = 'active'
      AND COALESCE(p.earnings_count, 0) < p.days
    FOR UPDATE OF p
  LOOP
    -- Calculate plan purchase date in IST
    v_started_ist := (v_rec.started_at AT TIME ZONE 'Asia/Kolkata')::date;
    
    -- Number of calendar days elapsed including purchase day (1 on purchase date, 2 on next day, etc.)
    v_days_elapsed := (v_today_ist - v_started_ist) + 1;

    IF v_days_elapsed >= 1 THEN
      -- Target earnings count expected by today (capped at total plan days)
      v_target_earnings := LEAST(v_days_elapsed, v_rec.days);
      
      -- Calculate how many daily earnings are due (missed + today)
      v_due := v_target_earnings - v_rec.earnings_count;

      IF v_due > 0 THEN
        v_amount_to_credit := v_rec.daily * v_due;

        -- Credit total due amount directly to user's Wallet Balance and Total Income
        UPDATE public.profiles
        SET
          balance      = balance + v_amount_to_credit,
          total_income = total_income + v_amount_to_credit
        WHERE id = v_rec.user_id;

        -- Record transaction entry for each credited day
        FOR i IN 1..v_due LOOP
          INSERT INTO public.transactions (user_id, type, amount, status, note)
          VALUES (
            v_rec.user_id,
            'income',
            v_rec.daily,
            'success',
            'Daily earning for ' || v_rec.plan_name
          );
        END LOOP;

        -- Update purchase tracking record
        UPDATE public.purchases
        SET
          last_earning_at = now(),
          earnings_count  = v_rec.earnings_count + v_due,
          status          = CASE WHEN (v_rec.earnings_count + v_due) >= v_rec.days THEN 'expired' ELSE 'active' END
        WHERE id = v_rec.id;
      END IF;
    END IF;

    -- Safety check: if already at max days, mark expired
    IF (v_rec.earnings_count + GREATEST(v_due, 0)) >= v_rec.days THEN
      UPDATE public.purchases SET status = 'expired' WHERE id = v_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Alias process_hourly_earnings for backwards compatibility
CREATE OR REPLACE FUNCTION public.process_hourly_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.process_daily_earnings();
END;
$$;

-- =========================================================================
-- STEP 4: Update buy_plan to deduct price and credit Day 1 daily earning immediately
-- =========================================================================
CREATE OR REPLACE FUNCTION public.buy_plan(_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_plan     public.plans%ROWTYPE;
  v_bal      numeric;
  v_dep      numeric;
  v_purchase uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Set system context so protect_profile_columns trigger permits balance updates
  PERFORM set_config('app.system_context', 'true', true);

  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;

  SELECT balance, deposit_balance INTO v_bal, v_dep
  FROM public.profiles WHERE id = v_uid FOR UPDATE;

  IF v_dep < v_plan.price THEN
    RAISE EXCEPTION 'Plans can only be purchased with recharged funds. Please recharge to continue.';
  END IF;
  IF v_bal < v_plan.price THEN
    RAISE EXCEPTION 'Insufficient total balance';
  END IF;

  -- Deduct plan price from balance and deposit_balance; credit Day 1 daily earning immediately
  UPDATE public.profiles SET
    balance         = balance - v_plan.price + v_plan.daily,
    deposit_balance = deposit_balance - v_plan.price,
    total_income    = total_income + v_plan.daily,
    vip             = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;

  -- Create purchase record starting with 1 earning credited
  INSERT INTO public.purchases
    (user_id, plan_id, amount, daily, days, status, started_at, ends_at, last_earning_at, earnings_count)
  VALUES
    (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days,
     CASE WHEN v_plan.days <= 1 THEN 'expired' ELSE 'active' END,
     now(), now() + (v_plan.days || ' days')::interval, now(), 1)
  RETURNING id INTO v_purchase;

  -- Record transaction entry for purchase
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  -- Record transaction entry for Day 1 income
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'income', v_plan.daily, 'success', 'Daily earning for ' || v_plan.name);

  RETURN v_purchase;
END;
$$;

-- =========================================================================
-- STEP 5: Ensure cron schedules for 12:00 AM IST (18:30 UTC) and hourly backup
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('midnight_daily_earnings', 'hourly_earnings');

    -- Midnight IST schedule (18:30 UTC)
    PERFORM cron.schedule(
      'midnight_daily_earnings',
      '30 18 * * *',
      'SELECT public.process_daily_earnings()'
    );

    -- Backup hourly schedule
    PERFORM cron.schedule(
      'hourly_earnings',
      '0 * * * *',
      'SELECT public.process_daily_earnings()'
    );
  END IF;
END
$$;

-- =========================================================================
-- STEP 6: Execute process_daily_earnings() immediately right now!
-- =========================================================================
SELECT public.process_daily_earnings();
