-- Credit return earning automatically after purchase
CREATE OR REPLACE FUNCTION public.buy_plan(_plan_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_plan public.plans%ROWTYPE;
  v_bal numeric;
  v_dep numeric;
  v_purchase uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_plan FROM public.plans WHERE id = _plan_id AND active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Plan unavailable'; END IF;
  
  SELECT balance, deposit_balance INTO v_bal, v_dep FROM public.profiles WHERE id = v_uid FOR UPDATE;
  
  IF v_dep < v_plan.price THEN
    RAISE EXCEPTION 'Plans can only be purchased with recharged funds. Please recharge to continue.';
  END IF;
  IF v_bal < v_plan.price THEN RAISE EXCEPTION 'Insufficient total balance'; END IF;

  UPDATE public.profiles SET 
    balance = balance - v_plan.price + v_plan.total,
    deposit_balance = deposit_balance - v_plan.price,
    total_income = total_income + v_plan.total,
    vip = CASE WHEN v_plan.kind = 'vip' THEN v_plan.name ELSE vip END
  WHERE id = v_uid;
  
  INSERT INTO public.purchases (user_id, plan_id, amount, daily, days, ends_at)
  VALUES (v_uid, v_plan.id, v_plan.price, v_plan.daily, v_plan.days, now() + (v_plan.days || ' days')::interval)
  RETURNING id INTO v_purchase;
  
  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'purchase', v_plan.price, 'success', 'Purchased ' || v_plan.name);

  INSERT INTO public.transactions (user_id, type, amount, status, note)
  VALUES (v_uid, 'income', v_plan.total, 'success', 'Plan return earning: ' || v_plan.name);

  RETURN v_purchase;
END; $$;
