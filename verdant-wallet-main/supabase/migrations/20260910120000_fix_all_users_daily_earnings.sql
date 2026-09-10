-- Migration: Comprehensive Fix for Plan-Based Daily Earnings Auto-Crediting
--
-- This migration fixes all issues preventing daily earnings from being credited to Wallet Balance:
-- 1. Un-expires any purchases that were prematurely marked 'expired' before receiving all eligible days of earnings.
-- 2. Recalculates earnings_count for all existing purchases from transaction history.
-- 3. Implements full catch-up logic in process_daily_earnings() so any missed daily earnings (due to downtime or cron delays)
--    are immediately calculated and credited to the user's Wallet Balance (profiles.balance) and Total Income (profiles.total_income).
-- 4. Ensures daily earnings run automatically every day after 12:00 AM IST (18:30 UTC).
-- 5. Immediately runs process_daily_earnings() so all eligible users (including user 7984730886 and others) get credited for any missed days today.

-- =========================================================================
-- STEP 1: Ensure purchases table has earnings_count column
-- =========================================================================
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS earnings_count integer NOT NULL DEFAULT 0;

-- =========================================================================
-- STEP 2: Accurately back-fill earnings_count from actual transaction history
-- =========================================================================
UPDATE public.purchases pu
SET earnings_count = LEAST(
  (
    SELECT count(*)
    FROM public.transactions t
    JOIN public.plans pl ON pl.id = pu.plan_id
    WHERE t.user_id = pu.user_id
      AND t.type = 'income'
      AND t.note = 'Daily earning for ' || pl.name
      AND t.created_at >= pu.started_at
  ),
  pu.days
);

-- =========================================================================
-- STEP 3: Reactivate any purchases prematurely marked 'expired' if earnings_count < days
-- =========================================================================
UPDATE public.purchases
SET status = 'active'
WHERE COALESCE(earnings_count, 0) < days;

-- =========================================================================
-- STEP 4: Rewrite process_daily_earnings() with catch-up logic & Wallet Balance credits
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
  WHERE status = 'expired'
    AND COALESCE(earnings_count, 0) < days;

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
    
    -- Number of calendar days elapsed since purchase (0 if purchased today in IST)
    v_days_elapsed := v_today_ist - v_started_ist;

    -- Daily earnings start the calendar day after purchase (v_days_elapsed >= 1)
    IF v_days_elapsed >= 1 THEN
      -- Maximum earnings this purchase should have received by today
      v_target_earnings := LEAST(v_days_elapsed, v_rec.days);
      
      -- Number of daily earnings due (including missed days + today)
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

    -- Expire purchase if all plan days have been credited
    IF (v_rec.earnings_count) >= v_rec.days THEN
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
-- STEP 5: Update buy_plan to properly initialize new plan purchases
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

  -- Deduct plan price from balance and deposit_balance; update VIP rank
  UPDATE public.profiles SET
    balance         = balance - v_plan.price,
    deposit_balance = deposit_balance - v_plan.price,
    vip             = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;

  -- Create active purchase record starting with 0 earnings
  INSERT INTO public.purchases
    (user_id, plan_id, amount, daily, days, status, started_at, ends_at, last_earning_at, earnings_count)
  VALUES
    (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days,
     'active', now(), now() + (v_plan.days || ' days')::interval, now(), 0)
  RETURNING id INTO v_purchase;

  -- Record transaction entry for purchase
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  RETURN v_purchase;
END;
$$;

-- =========================================================================
-- STEP 6: Ensure cron schedules for 12:00 AM IST (18:30 UTC) and hourly backup
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
-- STEP 7: Immediately process any missed daily earnings for all users now
-- =========================================================================
SELECT public.process_daily_earnings();
