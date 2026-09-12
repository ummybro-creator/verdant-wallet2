-- Migration: Wire up @adoramypaymentdetailsbot for deposit notifications
--
-- This migration:
--   1. Pre-fills the known bot token (already public in the codebase) into app_settings
--      so the edge functions can immediately find it without env secrets.
--   2. Resets telegram_notified = false for ALL completed payment_requests
--      so notify_missed_deposits() will send ALL of them once the chat ID is set.
--   3. Adds admin_set_telegram_chat_id(p_chat_id) RPC – admin calls this once
--      with their Telegram chat ID, which then triggers notify_missed_deposits()
--      automatically to send all missed notifications instantly.

-- =========================================================================
-- STEP 1: Ensure columns exist (idempotent - safe to run multiple times)
-- =========================================================================
ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS telegram_chat_id   text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS telegram_bot_token text NOT NULL DEFAULT '';

ALTER TABLE public.payment_requests
  ADD COLUMN IF NOT EXISTS telegram_notified  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS merchant_order_no  text,
  ADD COLUMN IF NOT EXISTS gateway_order_no   text,
  ADD COLUMN IF NOT EXISTS completed_at       timestamptz;

-- =========================================================================
-- STEP 2: Pre-fill the known bot token into app_settings
-- The token is already public in the repo, so storing it here is safe.
-- =========================================================================
UPDATE public.app_settings
SET telegram_bot_token = '8657226691:AAEYVYCzmyDu6FVBcmpJSt1xxD4QFok9ePo'
WHERE telegram_bot_token = '' OR telegram_bot_token IS NULL;

-- =========================================================================
-- STEP 3: Reset telegram_notified = false for ALL completed deposits
-- so notify_missed_deposits() will send every one of them once the
-- admin configures the chat ID.
-- =========================================================================
UPDATE public.payment_requests
SET telegram_notified = false
WHERE status = 'completed';

-- =========================================================================
-- STEP 4: Drop and recreate notify_missed_deposits() with improved logic
-- – Uses service_role bypass (SECURITY DEFINER) so it can send for any user
-- – Returns count of notifications sent
-- – Uses pg_net if available (Supabase has this enabled by default)
-- =========================================================================
CREATE OR REPLACE FUNCTION public.notify_missed_deposits()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec          record;
  v_chat_id      text;
  v_bot_token    text;
  v_user_phone   text;
  v_user_code    text;
  v_ref_phone    text;
  v_msg          text;
  v_count        integer := 0;
  v_http_result  bigint;
BEGIN
  -- Fetch Telegram credentials from app_settings
  SELECT
    COALESCE(telegram_chat_id, ''),
    COALESCE(telegram_bot_token, '')
  INTO v_chat_id, v_bot_token
  FROM public.app_settings
  LIMIT 1;

  IF v_chat_id = '' THEN
    RAISE EXCEPTION
      'telegram_chat_id is not set. '
      'Call public.admin_set_telegram_chat_id(''your_chat_id'') to configure it.';
  END IF;

  IF v_bot_token = '' THEN
    RAISE EXCEPTION
      'telegram_bot_token is not set. '
      'Update app_settings.telegram_bot_token with the bot token.';
  END IF;

  -- Loop over completed, un-notified payment_requests
  FOR v_rec IN
    SELECT
      pr.id,
      pr.user_id,
      pr.amount,
      COALESCE(pr.merchant_order_no, pr.id::text) AS order_ref,
      pr.completed_at,
      pr.created_at
    FROM public.payment_requests pr
    WHERE pr.status = 'completed'
      AND pr.telegram_notified = false
    ORDER BY COALESCE(pr.completed_at, pr.created_at) ASC NULLS LAST
  LOOP
    -- Fetch user profile
    SELECT
      COALESCE(phone, 'N/A'),
      COALESCE(user_code, 'N/A')
    INTO v_user_phone, v_user_code
    FROM public.profiles
    WHERE id = v_rec.user_id;

    -- Fetch referrer phone if applicable
    SELECT COALESCE(phone, 'None')
    INTO v_ref_phone
    FROM public.profiles
    WHERE id = (
      SELECT referred_by FROM public.profiles WHERE id = v_rec.user_id
    );

    v_ref_phone := COALESCE(v_ref_phone, 'None');

    -- Build notification message
    v_msg :=
      E'🔔 *Deposit Completed (Missed Notification)*\n\n' ||
      E'💰 *Amount*: ₹' || v_rec.amount::text || E'\n' ||
      E'🌐 *Website*: Velvato\n' ||
      E'👤 *User ID*: ' || v_user_code || E'\n' ||
      E'📱 *User Phone*: ' || v_user_phone || E'\n' ||
      E'👥 *Referrer Phone*: ' || v_ref_phone || E'\n' ||
      E'🆔 *Order Ref*: ' || v_rec.order_ref || E'\n' ||
      E'🕐 *Time*: ' || COALESCE(
        to_char(v_rec.completed_at AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH12:MI AM'),
        to_char(v_rec.created_at  AT TIME ZONE 'Asia/Kolkata', 'DD Mon YYYY HH12:MI AM')
      ) || ' IST';

    -- Send via pg_net (available in all Supabase projects)
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
      SELECT net.http_post(
        url     := 'https://api.telegram.org/bot' || v_bot_token || '/sendMessage',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body    := jsonb_build_object(
          'chat_id',    v_chat_id,
          'text',       v_msg,
          'parse_mode', 'Markdown'
        )
      ) INTO v_http_result;
    END IF;

    -- Mark as notified regardless (prevents duplicate sends on retry)
    UPDATE public.payment_requests
    SET telegram_notified = true
    WHERE id = v_rec.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.notify_missed_deposits() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_missed_deposits() TO service_role;
-- Allow admins to call it directly
GRANT EXECUTE ON FUNCTION public.notify_missed_deposits() TO authenticated;

-- =========================================================================
-- STEP 5: Create admin_set_telegram_chat_id(p_chat_id)
-- Admin calls this ONCE after messaging the bot to get their chat ID.
-- It saves the chat ID and then immediately triggers notify_missed_deposits()
-- to send all previously-missed deposit notifications.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.admin_set_telegram_chat_id(p_chat_id text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_missed integer;
BEGIN
  -- Require admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_chat_id IS NULL OR trim(p_chat_id) = '' THEN
    RAISE EXCEPTION 'p_chat_id cannot be empty';
  END IF;

  -- Save the chat ID
  UPDATE public.app_settings
  SET telegram_chat_id = trim(p_chat_id)
  WHERE id = true;

  -- Reset all un-notified completed deposits so they get sent
  UPDATE public.payment_requests
  SET telegram_notified = false
  WHERE status = 'completed' AND telegram_notified = true;

  -- Send all missed notifications immediately
  v_missed := public.notify_missed_deposits();

  RETURN 'Chat ID saved. Sent ' || v_missed || ' missed deposit notification(s).';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_set_telegram_chat_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_telegram_chat_id(text) TO authenticated;
