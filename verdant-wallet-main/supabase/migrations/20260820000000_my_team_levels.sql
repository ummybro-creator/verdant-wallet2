CREATE OR REPLACE FUNCTION public.my_team()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v jsonb;
  l1_size int := 0; l1_recharge numeric := 0;
  l2_size int := 0; l2_recharge numeric := 0;
  l3_size int := 0; l3_recharge numeric := 0;
  total_size int := 0; total_recharge numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  
  -- Level 1
  SELECT count(*), COALESCE(sum(total_recharge), 0) INTO l1_size, l1_recharge
  FROM public.profiles WHERE referred_by = v_uid;
  
  -- Level 2
  SELECT count(*), COALESCE(sum(total_recharge), 0) INTO l2_size, l2_recharge
  FROM public.profiles WHERE referred_by IN (
    SELECT id FROM public.profiles WHERE referred_by = v_uid
  );
  
  -- Level 3
  SELECT count(*), COALESCE(sum(total_recharge), 0) INTO l3_size, l3_recharge
  FROM public.profiles WHERE referred_by IN (
    SELECT id FROM public.profiles WHERE referred_by IN (
      SELECT id FROM public.profiles WHERE referred_by = v_uid
    )
  );
  
  total_size := l1_size + l2_size + l3_size;
  total_recharge := l1_recharge + l2_recharge + l3_recharge;

  SELECT jsonb_build_object(
    'size', total_size,
    'recharge', total_recharge,
    'level1_size', l1_size,
    'level1_recharge', l1_recharge,
    'level2_size', l2_size,
    'level2_recharge', l2_recharge,
    'level3_size', l3_size,
    'level3_recharge', l3_recharge,
    'members', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('phone', left(phone,3)||'****'||right(phone,3), 'joined', created_at, 'recharge', total_recharge, 'level', 1) ORDER BY created_at DESC)
      FROM public.profiles WHERE referred_by = v_uid
    ), '[]'::jsonb)
  ) INTO v;
  
  RETURN v;
END; $$;