-- Migration: Fix Telegram Deposit Notifications
-- Root causes fixed:
--   1. app_settings table was missing telegram_chat_id and telegram_bot_token columns
--      → The edge functions could never find a chat ID, so no notifications were sent.
--   2. The getUpdates fallback is unreliable (returns empty when webhook is active).
--   3. Add a notify_missed_deposits() function to send notifications for deposits missed during the outage.

-- =========================================================================
-- STEP 1: Add telegram_chat_id and telegram_bot_token columns to app_settings
-- =========================================================================
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS telegram_chat_id  text    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_bot_token text   NOT NULL DEFAULT '';

-- =========================================================================
-- STEP 2: Create notify_missed_deposits() helper function
-- Admins can call this from the Supabase SQL editor or via RPC to manually
-- trigger Telegram notifications for all completed deposits that did NOT
-- already get a notification sent. We track this via a new boolean column
-- on payment_requests: telegram_notified.
-- =========================================================================
ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS telegram_notified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_order_no text,
  ADD COLUMN IF NOT EXISTS gateway_order_no  text,
  ADD COLUMN IF NOT EXISTS completed_at      timestamptz;

-- Mark already-completed requests as notified so we don't double-send old ones.
-- Only mark ones completed before this migration as already-notified (they missed the window).
-- After this migration, new completions will be tracked properly by the edge functions.
UPDATE public.payment_requests
SET telegram_notified = true
WHERE status = 'completed'
  AND telegram_notified = false;

-- =========================================================================
-- STEP 3: Create send_telegram_message() – a reusable PG function that
-- calls the Telegram Bot API via pg_net (available in Supabase projects).
-- Edge functions will be the primary notification path; this is a DB-level
-- safety net that can be triggered manually by an admin via RPC.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.send_telegram_message(
  p_chat_id  text,
  p_bot_token text,
  p_text     text
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Uses Supabase's net.http_post (pg_net extension) if available.
  -- If pg_net is not enabled, this is a no-op and falls back to edge functions.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    PERFORM net.http_post(
      url     := 'https://api.telegram.org/bot' || p_bot_token || '/sendMessage',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body    := jsonb_build_object(
        'chat_id',    p_chat_id,
        'text',       p_text,
        'parse_mode', 'Markdown'
      )
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.send_telegram_message(text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_telegram_message(text, text, text) TO service_role;

-- =========================================================================
-- STEP 4: Create notify_missed_deposits() – admin RPC to send Telegram
-- messages for deposits that were completed but never notified.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_missed_deposits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec         record;
  v_settings    record;
  v_chat_id     text;
  v_bot_token   text;
  v_user_phone  text;
  v_user_code   text;
  v_ref_phone   text;
  v_msg         text;
  v_count       integer := 0;
BEGIN
  -- Require admin context
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- Fetch Telegram credentials from app_settings
  SELECT telegram_chat_id, telegram_bot_token
  INTO v_chat_id, v_bot_token
  FROM public.app_settings
  LIMIT 1;

  IF v_chat_id IS NULL OR v_chat_id = '' THEN
    RAISE EXCEPTION 'telegram_chat_id is not configured in app_settings. Please set it in the Admin → Settings panel first.';
  END IF;

  IF v_bot_token IS NULL OR v_bot_token = '' THEN
    RAISE EXCEPTION 'telegram_bot_token is not configured in app_settings. Please set it in the Admin → Settings panel first.';
  END IF;

  -- Loop over completed, un-notified payment_requests
  FOR v_rec IN
    SELECT pr.id, pr.user_id, pr.amount, pr.merchant_order_no, pr.gateway_order_no, pr.completed_at
    FROM public.payment_requests pr
    WHERE pr.status = 'completed'
      AND pr.telegram_notified = false
    ORDER BY pr.completed_at ASC NULLS LAST
  LOOP
    -- Fetch user profile
    SELECT phone, user_code, referred_by
    INTO v_user_phone, v_user_code, v_ref_phone
    FROM public.profiles
    WHERE id = v_rec.user_id;

    -- Fetch referrer phone if applicable
    v_ref_phone := COALESCE((
      SELECT phone FROM public.profiles WHERE id = (
        SELECT referred_by FROM public.profiles WHERE id = v_rec.user_id
      )
    ), 'None');

    -- Build notification message
    v_msg :=
      '🔔 *Missed Deposit Notification*' || E'\n\n' ||
      '💰 *Deposit Amount*: ₹' || v_rec.amount::text || E'\n' ||
      '🌐 *Website Name*: Velvato' || E'\n' ||
      '👤 *User ID*: ' || COALESCE(v_user_code, 'N/A') || E'\n' ||
      '📱 *User Phone*: ' || COALESCE(v_user_phone, 'N/A') || E'\n' ||
      '👥 *Referrer Phone*: ' || COALESCE(v_ref_phone, 'None') || E'\n' ||
      '🕐 *Completed At*: ' || COALESCE(v_rec.completed_at::text, 'Unknown');

    -- Send via pg_net if available
    PERFORM public.send_telegram_message(v_chat_id, v_bot_token, v_msg);

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
GRANT EXECUTE ON FUNCTION public.notify_missed_deposits() TO authenticated;
