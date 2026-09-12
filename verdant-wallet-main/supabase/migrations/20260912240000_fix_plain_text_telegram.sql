-- Migration: Remove parse_mode Markdown from send_telegram_via_pg_net to ensure 100% delivery without syntax parsing errors
-- =======================================================================================================================

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
    RETURN NULL;
  END IF;

  -- Send as plain text (no parse_mode) so Telegram API never fails due to special characters like -, ., (), _, etc.
  SELECT net.http_post(
    url     := 'https://api.telegram.org/bot' || p_bot_token || '/sendMessage',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body    := jsonb_build_object(
      'chat_id', p_chat_id,
      'text',    p_text
    )
  ) INTO v_req_id;

  RETURN v_req_id;
END;
$$;
