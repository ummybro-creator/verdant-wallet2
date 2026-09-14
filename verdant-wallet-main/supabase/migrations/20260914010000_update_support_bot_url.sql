-- Migration: Update support_url to @Verdant_service_bot in app_settings
-- =========================================================================

UPDATE public.app_settings
SET support_url = 'https://t.me/Verdant_service_bot'
WHERE id = true;

ALTER TABLE public.app_settings
  ALTER COLUMN support_url SET DEFAULT 'https://t.me/Verdant_service_bot';
