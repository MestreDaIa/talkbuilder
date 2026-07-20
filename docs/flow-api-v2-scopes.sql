-- ============================================================
-- Zailom Flow — Public API v2 (scopes p/ integração Booking)
-- ------------------------------------------------------------
-- Rodar UMA ÚNICA VEZ no SQL Editor do Supabase externo.
-- Estende os escopos permitidos da tabela flow_api_keys para incluir
-- os endpoints da integração Zailom Booking:
--   - workspace:read
--   - instances:read
--
-- Não altera dados existentes. Chaves já criadas continuam válidas.
-- ============================================================

BEGIN;

-- 1) Atualiza CHECK constraint da tabela
ALTER TABLE public.flow_api_keys
  DROP CONSTRAINT IF EXISTS flow_api_keys_scope_check;

ALTER TABLE public.flow_api_keys
  ADD CONSTRAINT flow_api_keys_scope_check CHECK (
    scopes <@ ARRAY[
      'bots:read',
      'bots:run',
      'bots:write',
      'flows:read',
      'flows:write',
      'sessions:read',
      'sessions:write',
      'workspace:read',
      'instances:read'
    ]::text[]
    AND array_length(scopes, 1) >= 1
  );

-- 2) Atualiza validação dentro da função create_flow_api_key
--    (substitui a lista de escopos aceitos)
CREATE OR REPLACE FUNCTION public.create_flow_api_key(
  _workspace_id UUID,
  _name         TEXT,
  _scopes       TEXT[] DEFAULT ARRAY['bots:read']::text[],
  _expires_at   TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  plaintext     TEXT,
  key_prefix    TEXT,
  key_last_four TEXT,
  scopes        TEXT[],
  expires_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id         UUID := gen_random_uuid();
  v_bytes      BYTEA;
  v_plaintext  TEXT;
  v_prefix     TEXT := 'zf_live_';
  v_last_four  TEXT;
  v_hash       TEXT;
BEGIN
  IF _workspace_id IS NULL THEN
    RAISE EXCEPTION 'workspace_id_required';
  END IF;

  IF _name IS NULL OR length(trim(_name)) < 3 THEN
    RAISE EXCEPTION 'name_too_short';
  END IF;

  IF _scopes IS NULL OR array_length(_scopes, 1) IS NULL THEN
    _scopes := ARRAY['bots:read']::text[];
  END IF;

  IF NOT (_scopes <@ ARRAY[
      'bots:read','bots:run','bots:write',
      'flows:read','flows:write',
      'sessions:read','sessions:write',
      'workspace:read','instances:read']::text[]) THEN
    RAISE EXCEPTION 'invalid_scope';
  END IF;

  BEGIN
    v_bytes := extensions.gen_random_bytes(32);
  EXCEPTION WHEN undefined_function THEN
    v_bytes := gen_random_bytes(32);
  END;

  v_plaintext := v_prefix || encode(v_bytes, 'hex');
  v_last_four := right(v_plaintext, 4);

  BEGIN
    v_hash := encode(extensions.digest(v_plaintext, 'sha256'), 'hex');
  EXCEPTION WHEN undefined_function THEN
    v_hash := encode(digest(v_plaintext, 'sha256'), 'hex');
  END;

  INSERT INTO public.flow_api_keys (
    id, workspace_id, name,
    key_prefix, key_last_four, key_hash,
    scopes, expires_at
  ) VALUES (
    v_id, _workspace_id, trim(_name),
    v_prefix, v_last_four, v_hash,
    _scopes, _expires_at
  );

  INSERT INTO public.flow_api_key_audit (key_id, workspace_id, event, metadata)
  VALUES (v_id, _workspace_id, 'created', jsonb_build_object('name', _name, 'scopes', _scopes));

  RETURN QUERY
    SELECT v_id, v_plaintext, v_prefix, v_last_four, _scopes, _expires_at, now();
END;
$$;

COMMIT;
