CREATE OR REPLACE FUNCTION public.my_team()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v jsonb;
  l1_size int := 0; l1_recharge numeric := 0;
  l2_size int := 0; l2_recharge numeric := 0;
  l3_size int := 0; l3_recharge numeric := 0;
  total_size int := 0; total_recharge_val numeric := 0;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Level 1: direct referrals
  SELECT count(*), COALESCE(sum(p.total_recharge), 0)
  INTO l1_size, l1_recharge
  FROM public.profiles p WHERE p.referred_by = v_uid;

  -- Level 2: referrals of referrals
  SELECT count(*), COALESCE(sum(p.total_recharge), 0)
  INTO l2_size, l2_recharge
  FROM public.profiles p
  WHERE p.referred_by IN (
    SELECT p1.id FROM public.profiles p1 WHERE p1.referred_by = v_uid
  );

  -- Level 3: referrals of referrals of referrals
  SELECT count(*), COALESCE(sum(p.total_recharge), 0)
  INTO l3_size, l3_recharge
  FROM public.profiles p
  WHERE p.referred_by IN (
    SELECT p1.id FROM public.profiles p1
    WHERE p1.referred_by IN (
      SELECT p2.id FROM public.profiles p2 WHERE p2.referred_by = v_uid
    )
  );

  total_size := l1_size + l2_size + l3_size;
  total_recharge_val := l1_recharge + l2_recharge + l3_recharge;

  v := jsonb_build_object(
    'size', total_size,
    'recharge', total_recharge_val,
    'level1_size', l1_size,
    'level1_recharge', l1_recharge,
    'level2_size', l2_size,
    'level2_recharge', l2_recharge,
    'level3_size', l3_size,
    'level3_recharge', l3_recharge,
    'members', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'phone', left(m.phone,3)||'****'||right(m.phone,3),
          'joined', m.created_at,
          'recharge', m.total_recharge,
          'level', 1
        )
        ORDER BY m.created_at DESC
      )
      FROM public.profiles m WHERE m.referred_by = v_uid
    ), '[]'::jsonb)
  );

  RETURN v;
END;
$$;