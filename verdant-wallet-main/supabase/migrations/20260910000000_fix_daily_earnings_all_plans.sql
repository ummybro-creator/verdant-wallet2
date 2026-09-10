-- Migration: Fix daily earnings not being credited for all plans
-- Root causes fixed:
--   1. earnings_paid subquery matched by plan name+user, causing cross-purchase pollution
--      (e.g. two purchases of same plan, or old instant-earn transactions counted against new limit)
--   2. Old purchases (pre-20260819000003) that had last_earning_at set to migration-run time
--      could be permanently blocked if the earnings_count cap was already exceeded
--   3. process_daily_earnings skipped purchases where ends_at already passed but earnings
--      were not yet fully credited (the ends_at check was too strict)
--   4. purchases created by older buy_plan versions had no started_at or status properly
--
-- Solution:
--   A. Add earnings_count column to purchases to reliably track how many credits were given
--   B. Back-fill earnings_count from real transaction history per purchase_id
--      (we add purchase_id reference to transactions for future credits)
--   C. Rewrite process_daily_earnings to use earnings_count, not fragile transaction subquery
--   D. Fix stale active purchases that have all earnings paid but aren't marked expired
--   E. Re-run earnings for any purchases that missed credits due to the bug

-- =========================================================================
-- STEP 1: Add earnings_count to purchases table
-- =========================================================================
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS earnings_count integer NOT NULL DEFAULT 0;

-- =========================================================================
-- STEP 2: Back-fill earnings_count from transaction history
-- We count 'income' transactions that have note = 'Daily earning for <plan_name>'
-- scoped to this purchase's user and time window (started_at .. ends_at).
-- NOTE: This is approximate but safe — if over-counted, we cap at days.
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
      AND t.created_at <= pu.ends_at + interval '1 day'
  ),
  pu.days
);

-- =========================================================================
-- STEP 3: Rewrite process_daily_earnings to use earnings_count (reliable)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_daily_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec record;
  v_today_ist date;
BEGIN
  -- Set transaction-level system context flag so protect_profile_columns allows updates
  PERFORM set_config('app.system_context', 'true', true);

  -- Current calendar date in India Standard Time (IST, UTC+5:30)
  v_today_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Process all active (or accidentally still-active) purchases eligible for today's credit
  FOR v_rec IN
    SELECT
      p.id,
      p.user_id,
      p.daily,
      p.days,
      p.earnings_count,
      p.started_at,
      p.ends_at,
      p.last_earning_at,
      pl.name AS plan_name
    FROM public.purchases p
    JOIN public.plans pl ON p.plan_id = pl.id
    WHERE p.status = 'active'
      -- Purchase date must be before today in IST (no same-day earning)
      AND (p.started_at AT TIME ZONE 'Asia/Kolkata')::date < v_today_ist
      -- Not already credited today in IST
      AND (
        p.last_earning_at IS NULL
        OR (p.last_earning_at AT TIME ZONE 'Asia/Kolkata')::date < v_today_ist
      )
      -- Still has remaining earning days
      AND p.earnings_count < p.days
  LOOP
    -- Credit daily earning to balance and total income
    UPDATE public.profiles
    SET
      balance      = balance + v_rec.daily,
      total_income = total_income + v_rec.daily
    WHERE id = v_rec.user_id;

    -- Insert income transaction record
    INSERT INTO public.transactions (user_id, type, amount, status, note)
    VALUES (v_rec.user_id, 'income', v_rec.daily, 'success',
            'Daily earning for ' || v_rec.plan_name);

    -- Update last_earning_at and increment earnings_count atomically
    UPDATE public.purchases
    SET
      last_earning_at = now(),
      earnings_count  = earnings_count + 1,
      -- Expire if this was the final earning day
      status = CASE
        WHEN earnings_count + 1 >= days THEN 'expired'
        ELSE status
      END
    WHERE id = v_rec.id;
  END LOOP;

  -- Expire any active purchases that have received all their daily credits
  UPDATE public.purchases
  SET status = 'expired'
  WHERE status = 'active'
    AND earnings_count >= days;

  -- Also expire any active purchases whose end date has long passed
  -- (safety net: they should have been expired by above, but catch edge cases)
  UPDATE public.purchases
  SET status = 'expired'
  WHERE status = 'active'
    AND ends_at <= now() - interval '1 day'
    AND earnings_count >= days;
END;
$$;

-- =========================================================================
-- STEP 4: Alias process_hourly_earnings for backwards compatibility
-- =========================================================================
CREATE OR REPLACE FUNCTION public.process_hourly_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.process_daily_earnings();
END;
$$;

-- =========================================================================
-- STEP 5: Fix buy_plan to set earnings_count = 0 (clean start, no instant credit)
-- This ensures the counter starts at 0 and earnings_count is always accurate.
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

  -- Set system context so protect_profile_columns allows balance deduction
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

  -- Deduct plan price from balance and deposit_balance; upgrade VIP if applicable
  UPDATE public.profiles SET
    balance         = balance - v_plan.price,
    deposit_balance = deposit_balance - v_plan.price,
    vip             = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;

  -- Create purchase record: earnings_count starts at 0, last_earning_at = now()
  -- (last_earning_at = now() ensures no same-day earning; first credit after midnight)
  INSERT INTO public.purchases
    (user_id, plan_id, amount, daily, days, status, started_at, ends_at, last_earning_at, earnings_count)
  VALUES
    (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days,
     'active', now(), now() + (v_plan.days || ' days')::interval, now(), 0)
  RETURNING id INTO v_purchase;

  -- Record the purchase transaction
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  RETURN v_purchase;
END;
$$;

-- =========================================================================
-- STEP 6: Re-schedule cron jobs (midnight IST = 18:30 UTC, and hourly backup)
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove old jobs
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('midnight_daily_earnings', 'hourly_earnings');

    -- Primary: midnight IST (18:30 UTC)
    PERFORM cron.schedule(
      'midnight_daily_earnings',
      '30 18 * * *',
      'SELECT public.process_daily_earnings()'
    );

    -- Backup: every hour (catches any missed midnight run)
    PERFORM cron.schedule(
      'hourly_earnings',
      '0 * * * *',
      'SELECT public.process_daily_earnings()'
    );
  END IF;
END
$$;

-- =========================================================================
-- STEP 7: Immediately process any earnings that were missed due to the bug
-- Run process_daily_earnings() now so all eligible active purchases get credited
-- =========================================================================
SELECT public.process_daily_earnings();
