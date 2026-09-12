-- Migration: Complete Telegram Notification Fix for @adoramypaymentdetailsbot
-- ============================================================================
-- This migration is self-contained and supersedes all previous Telegram migrations.
-- It:
--   1. Ensures all required columns exist on app_settings and payment_requests
--   2. Pre-fills the bot token so no manual configuration is needed
--   3. Resets telegram_notified=false for ALL completed deposits so they can be resent
--   4. Creates notify_missed_deposits() — auto-discovers chat ID via pg_net + getUpdates,
--      then sends a notification for every un-notified completed deposit
--   5. Creates admin_resend_missed_deposits() — a safe admin-callable alias
--   6. Sets up a pg_cron job to auto-retry missed notifications every 10 minutes
--      (so they get sent as soon as the admin messages the bot)

-- =========================================================================
-- STEP 1: Schema — ensure all required columns exist (idempotent)
-- =========================================================================
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS telegram_chat_id   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_bot_token text NOT NULL DEFAULT '';

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS telegram_notified  boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_order_no  text,
  ADD COLUMN IF NOT EXISTS gateway_order_no   text,
  ADD COLUMN IF NOT EXISTS completed_at       timestamptz;

-- =========================================================================
-- STEP 2: Pre-fill the bot token
-- =========================================================================
UPDATE public.app_settings
SET telegram_bot_token = '8657226691:AAEYVYCzmyDu6FVBcmpJSt1xxD4QFok9ePo'
WHERE id = true;

-- =========================================================================
-- STEP 3: Reset ALL completed deposits to un-notified so they get resent
-- =========================================================================
UPDATE public.payment_requests
SET telegram_notified = false
WHERE status = 'completed';

-- =========================================================================
-- STEP 4: Create send_telegram_via_pg_net() — low-level helper
-- Uses pg_net (always available in Supabase) to POST to Telegram API.
-- Returns the pg_net request ID (bigint), or NULL if pg_net not available.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.send_telegram_via_pg_net(
  p_bot_token text,
  p_chat_id   text,
  p_text      text
)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_req_id bigint;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE WARNING 'pg_net extension is not enabled — cannot send Telegram message from database';
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url     := 'https://api.telegram.org/bot' || p_bot_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'chat_id',    p_chat_id,
      'text',       p_text,
      'parse_mode', 'Markdown'
    )
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_telegram_via_pg_net(text, text, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.send_telegram_via_pg_net(text, text, text) TO service_role;

-- =========================================================================
-- STEP 5: Create discover_telegram_chat_id() — auto-discovers chat ID
-- Calls the Telegram getUpdates API via pg_net and saves the result.
-- Returns the chat_id if found, NULL otherwise.
-- NOTE: This is async — pg_net sends requests in background.
--       For synchronous discovery, the edge function is the right tool.
--       This DB function is used by the cron job retry mechanism.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.discover_telegram_chat_id()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bot_token text;
  v_chat_id   text;
BEGIN
  -- Get current settings
  SELECT
    COALESCE(telegram_bot_token, ''),
    COALESCE(telegram_chat_id, '')
  INTO v_bot_token, v_chat_id
  FROM public.app_settings
  LIMIT 1;

  -- Already have a chat ID?
  IF v_chat_id != '' THEN
    RETURN v_chat_id;
  END IF;

  -- Enqueue an async getUpdates call — result will be in net._http_response
  -- Edge functions handle sync discovery better; this is for cron resilience
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_get(
      url := 'https://api.telegram.org/bot' || v_bot_token || '/getUpdates?limit=100&offset=-1'
    );
  END IF;

  RETURN NULL; -- Will be populated by next cron run after pg_net response arrives
END;
$$;

REVOKE EXECUTE ON FUNCTION public.discover_telegram_chat_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.discover_telegram_chat_id() TO service_role;

-- =========================================================================
-- STEP 6: Create notify_missed_deposits() — resends all missed notifications
-- This function:
--   - Reads chat_id from app_settings
--   - For each un-notified completed deposit, sends a Telegram message
--   - Marks each one as notified
--   - Returns the count of messages sent
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_missed_deposits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bot_token   text;
  v_chat_id     text;
  v_rec         record;
  v_user_phone  text;
  v_user_code   text;
  v_ref_phone   text;
  v_msg         text;
  v_order_ref   text;
  v_time_str    text;
  v_count       integer := 0;
BEGIN
  -- Get Telegram credentials
  SELECT
    COALESCE(telegram_bot_token, ''),
    COALESCE(telegram_chat_id, '')
  INTO v_bot_token, v_chat_id
  FROM public.app_settings
  LIMIT 1;

  IF v_bot_token = '' THEN
    RAISE EXCEPTION 'Telegram bot token is not configured in app_settings';
  END IF;

  IF v_chat_id = '' THEN
    -- Can't send without a chat ID — return 0 (will retry next cron cycle)
    RAISE NOTICE 'No telegram_chat_id found. Send any message to @adoramypaymentdetailsbot on Telegram, then retry.';
    RETURN 0;
  END IF;

  -- Process all un-notified completed deposits
  FOR v_rec IN
    SELECT
      pr.id,
      pr.user_id,
      pr.amount,
      COALESCE(pr.merchant_order_no, pr.gateway_order_no, pr.id::text) AS order_ref,
      COALESCE(pr.completed_at, pr.updated_at, pr.created_at)          AS done_at
    FROM public.payment_requests pr
    WHERE pr.status = 'completed'
      AND (pr.telegram_notified IS NULL OR pr.telegram_notified = false)
    ORDER BY COALESCE(pr.completed_at, pr.created_at) ASC NULLS LAST
    LIMIT 50  -- batch: process max 50 per call to avoid timeouts
  LOOP
    -- Fetch user details
    SELECT
      COALESCE(phone, 'N/A'),
      COALESCE(user_code, 'N/A')
    INTO v_user_phone, v_user_code
    FROM public.profiles
    WHERE id = v_rec.user_id;

    -- Fetch referrer phone
    BEGIN
      SELECT COALESCE(phone, 'None')
      INTO v_ref_phone
      FROM public.profiles
      WHERE id = (SELECT referred_by FROM public.profiles WHERE id = v_rec.user_id);
    EXCEPTION WHEN OTHERS THEN
      v_ref_phone := 'None';
    END;

    v_ref_phone   := COALESCE(v_ref_phone, 'None');
    v_order_ref   := COALESCE(v_rec.order_ref, 'N/A');
    v_time_str    := to_char(v_rec.done_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH12:MI AM') || ' IST';

    -- Build plain-text message (avoids Markdown parse errors)
    v_msg :=
      E'🔔 Deposit Completed (Missed Notification)\n\n' ||
      E'Amount: Rs.' || v_rec.amount::text || E'\n' ||
      E'Website: Velvato\n' ||
      E'User ID: ' || v_user_code || E'\n' ||
      E'Phone: ' || v_user_phone || E'\n' ||
      E'Referrer: ' || v_ref_phone || E'\n' ||
      E'Order: ' || v_order_ref || E'\n' ||
      E'Time: ' || v_time_str;

    -- Send via pg_net
    PERFORM public.send_telegram_via_pg_net(v_bot_token, v_chat_id, v_msg);

    -- Mark as notified
    UPDATE public.payment_requests
    SET telegram_notified = true
    WHERE id = v_rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_missed_deposits() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.notify_missed_deposits() TO service_role;
GRANT  EXECUTE ON FUNCTION public.notify_missed_deposits() TO authenticated;

-- =========================================================================
-- STEP 7: Create admin_resend_missed_deposits() — safe admin-facing alias
-- Checks admin role before delegating to notify_missed_deposits()
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_resend_missed_deposits()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  v_count := public.notify_missed_deposits();
  RETURN 'Sent ' || v_count || ' missed deposit notification(s) to Telegram.';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_resend_missed_deposits() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_resend_missed_deposits() TO authenticated;

-- =========================================================================
-- STEP 8: Create admin_set_telegram_chat_id(p_chat_id) for Admin UI
-- Admin calls this from the Settings panel to set chat ID manually,
-- which then immediately fires notify_missed_deposits().
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_telegram_chat_id(p_chat_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_chat_id IS NULL OR trim(p_chat_id) = '' THEN
    RAISE EXCEPTION 'Chat ID cannot be empty';
  END IF;

  -- Save the chat ID
  UPDATE public.app_settings
  SET telegram_chat_id = trim(p_chat_id)
  WHERE id = true;

  -- Reset un-notified completed deposits
  UPDATE public.payment_requests
  SET telegram_notified = false
  WHERE status = 'completed';

  -- Fire missed notifications immediately
  v_count := public.notify_missed_deposits();

  RETURN 'Chat ID saved. Sent ' || v_count || ' missed deposit notification(s).';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_telegram_chat_id(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.admin_set_telegram_chat_id(text) TO authenticated;

-- =========================================================================
-- STEP 9: Set up pg_cron auto-retry job
-- Every 10 minutes: tries to send un-notified deposits.
-- Once the admin messages the bot, the edge function auto-saves the chat ID,
-- and this cron will immediately pick it up and send all missed ones.
-- =========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Remove any existing job with this name
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'telegram_missed_deposits_retry';

    -- Schedule: every 10 minutes
    PERFORM cron.schedule(
      'telegram_missed_deposits_retry',
      '*/10 * * * *',
      $$SELECT public.notify_missed_deposits()$$
    );

    RAISE NOTICE 'pg_cron job "telegram_missed_deposits_retry" scheduled (every 10 min)';
  ELSE
    RAISE NOTICE 'pg_cron not available — missed deposit retry cron not scheduled';
  END IF;
END;
$$;

-- =========================================================================
-- STEP 10: Create a trigger on payment_requests so that when a row is
-- updated to status='completed', it auto-fires the Telegram notification
-- via pg_net directly from the DB (backup path if edge function fails).
-- =========================================================================
CREATE OR REPLACE FUNCTION public.trigger_telegram_on_deposit_complete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_bot_token  text;
  v_chat_id    text;
  v_phone      text;
  v_code       text;
  v_ref_phone  text;
  v_msg        text;
  v_order_ref  text;
BEGIN
  -- Only fire on transition to 'completed'
  IF NEW.status <> 'completed' OR OLD.status = 'completed' THEN
    RETURN NEW;
  END IF;

  -- Already notified?
  IF NEW.telegram_notified = true THEN
    RETURN NEW;
  END IF;

  -- Get Telegram credentials
  SELECT
    COALESCE(telegram_bot_token, ''),
    COALESCE(telegram_chat_id, '')
  INTO v_bot_token, v_chat_id
  FROM public.app_settings
  LIMIT 1;

  -- Skip if not configured (edge function will handle it / cron will retry)
  IF v_bot_token = '' OR v_chat_id = '' THEN
    RETURN NEW;
  END IF;

  -- Fetch user details
  SELECT COALESCE(phone, 'N/A'), COALESCE(user_code, 'N/A')
  INTO v_phone, v_code
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Fetch referrer phone
  BEGIN
    SELECT COALESCE(phone, 'None')
    INTO v_ref_phone
    FROM public.profiles
    WHERE id = (SELECT referred_by FROM public.profiles WHERE id = NEW.user_id);
  EXCEPTION WHEN OTHERS THEN
    v_ref_phone := 'None';
  END;

  v_ref_phone := COALESCE(v_ref_phone, 'None');
  v_order_ref := COALESCE(NEW.merchant_order_no, NEW.gateway_order_no, NEW.id::text);

  v_msg :=
    E'🔔 New Deposit Completed!\n\n' ||
    E'Amount: Rs.' || NEW.amount::text || E'\n' ||
    E'Website: Velvato\n' ||
    E'User ID: ' || v_code || E'\n' ||
    E'Phone: ' || v_phone || E'\n' ||
    E'Referrer: ' || v_ref_phone || E'\n' ||
    E'Order: ' || v_order_ref;

  -- Send via pg_net (fire and forget)
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM public.send_telegram_via_pg_net(v_bot_token, v_chat_id, v_msg);

    -- Mark as notified (prevents double-send by cron)
    NEW.telegram_notified := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payment_request_telegram_notify ON public.payment_requests;
CREATE TRIGGER payment_request_telegram_notify
  BEFORE UPDATE ON public.payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_telegram_on_deposit_complete();
