CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ws_slug text;
BEGIN
  ws_slug := lower(coalesce(NEW.raw_user_meta_data->>'slug', ''));
  ws_slug := regexp_replace(ws_slug, '[^a-z0-9-]+', '-', 'g');
  ws_slug := regexp_replace(ws_slug, '(^-+|-+$)', '', 'g');

  IF ws_slug = '' THEN
    RAISE EXCEPTION 'slug é obrigatório no user_metadata';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, slug)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url',
    ws_slug
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;