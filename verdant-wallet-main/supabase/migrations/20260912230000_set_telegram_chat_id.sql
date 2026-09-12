-- Migration: Hardcode Chat ID 7224100814 for @adoramypaymentdetailsbot
-- ============================================================================
-- Sets chat ID 7224100814 (user andry0725) and bot token in app_settings,
-- resets all completed deposit notifications, and triggers resend.

ALTER TABLE public.app_settings
  ALTER COLUMN telegram_chat_id SET DEFAULT '7224100814',
  ALTER COLUMN telegram_bot_token SET DEFAULT '8657226691:AAEYVYCzmyDu6FVBcmpJSt1xxD4QFok9ePo';

UPDATE public.app_settings
SET
  telegram_chat_id = '7224100814',
  telegram_bot_token = '8657226691:AAEYVYCzmyDu6FVBcmpJSt1xxD4QFok9ePo'
WHERE id = true;

-- Reset telegram_notified = false for all completed payment requests
UPDATE public.payment_requests
SET telegram_notified = false
WHERE status = 'completed';

-- Trigger sending of all missed deposit notifications
SELECT public.notify_missed_deposits();
