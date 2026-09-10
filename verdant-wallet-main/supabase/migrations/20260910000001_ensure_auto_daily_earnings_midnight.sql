-- Migration: Ensure daily earnings are auto credited after 12 AM midnight IST for all plans
-- Re-runs process_daily_earnings() and ensures proper handling for all active plans.

CREATE OR REPLACE FUNCTION public.process_daily_earnings()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec record;
  v_today_ist date;
BEGIN
  -- Set transaction-level system context flag so protect_profile_columns allows balance updates
  PERFORM set_config('app.system_context', 'true', true);

  -- Current calendar date in India Standard Time (IST, UTC+5:30)
  v_today_ist := (now() AT TIME ZONE 'Asia/Kolkata')::date;

  -- Process all active purchases eligible for today's daily earning credit
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
      -- Purchase date must be before today in IST (no same-day earning on purchase date)
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
END;
$$;

-- Ensure cron schedule is active for 12:00 AM Midnight IST (18:30 UTC) and hourly backup
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname IN ('midnight_daily_earnings', 'hourly_earnings');

    PERFORM cron.schedule(
      'midnight_daily_earnings',
      '30 18 * * *',
      'SELECT public.process_daily_earnings()'
    );

    PERFORM cron.schedule(
      'hourly_earnings',
      '0 * * * *',
      'SELECT public.process_daily_earnings()'
    );
  END IF;
END
$$;

-- Immediately execute to catch any pending/missed daily earnings right now
SELECT public.process_daily_earnings();
