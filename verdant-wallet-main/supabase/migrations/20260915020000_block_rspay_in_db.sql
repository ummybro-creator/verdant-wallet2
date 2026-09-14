-- Migration: Block RSPay order creation at Database Level
-- =========================================================================
-- Prevents any payment_request row with merchant_order_no starting with 'RSP'
-- or referencing legacy gateways from being created under any condition.

CREATE OR REPLACE FUNCTION public.block_rspay_order_creation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.merchant_order_no ILIKE 'RSP%' OR NEW.merchant_order_no ILIKE '%rspay%' THEN
    RAISE EXCEPTION 'RSPay payment gateway has been permanently disabled.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_rspay_order ON public.payment_requests;
CREATE TRIGGER trg_block_rspay_order
  BEFORE INSERT ON public.payment_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.block_rspay_order_creation();
