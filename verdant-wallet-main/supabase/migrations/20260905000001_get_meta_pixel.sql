CREATE OR REPLACE FUNCTION public.get_meta_pixel_id(p_invite_code text)
RETURNS text LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT meta_pixel_id FROM public.profiles WHERE invite_code = p_invite_code LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_meta_pixel_id(text) TO anon, authenticated;
