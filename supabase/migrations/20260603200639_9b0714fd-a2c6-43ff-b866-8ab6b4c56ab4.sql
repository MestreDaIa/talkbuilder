CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.generate_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_key TEXT;
BEGIN
    -- Gera uma string aleatória e adiciona o prefixo tmk_
    new_key := 'tmk_' || encode(gen_random_bytes(24), 'hex');
    RETURN new_key;
END;
$$;

GRANT EXECUTE ON FUNCTION public.generate_api_key() TO authenticated;
GRANT EXECUTE ON FUNCTION public.generate_api_key() TO service_role;