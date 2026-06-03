CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    new_key TEXT;
BEGIN
    -- Tenta usar gen_random_bytes do schema extensions ou public
    BEGIN
        new_key := 'tmk_' || encode(extensions.gen_random_bytes(24), 'hex');
    EXCEPTION WHEN undefined_function THEN
        new_key := 'tmk_' || encode(gen_random_bytes(24), 'hex');
    END;
    RETURN new_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key() TO service_role;