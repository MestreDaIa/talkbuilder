-- ============================================================
-- ZAILOM FLOW — API Keys (produto independente do Booking)
-- Deploy manual: rode no SQL Editor do seu Supabase externo.
--
-- Segurança:
--   • A chave em plaintext NUNCA é armazenada. Guardamos apenas SHA-256.
--   • O plaintext é retornado UMA ÚNICA VEZ, no momento da criação (RPC).
--   • Cada chave tem prefix visível (para identificação na UI) + last_four.
--   • Escopos granulares controlados por text[] com CHECK.
--   • Revogação lógica (revoked_at) + expiração opcional (expires_at).
--   • Auditoria de uso em tabela separada (append-only).
--   • RLS: só o dono do workspace / membros enxergam as chaves do próprio ws.
--   • pgcrypto habilitado para digest/gen_random_bytes.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- 1) Tabela: flow_api_keys
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flow_api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name          TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),

  -- Identificação segura da chave (sem plaintext)
  key_prefix    TEXT NOT NULL,           -- ex: 'zf_live_ab12cd34' (16 chars)
  key_last_four TEXT NOT NULL,           -- ex: 'a9f2'
  key_hash      TEXT NOT NULL UNIQUE,    -- SHA-256 hex da chave inteira

  -- Escopos granulares (MVP)
  scopes        TEXT[] NOT NULL DEFAULT ARRAY['bots:read']::text[],

  -- Ciclo de vida
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  last_used_at  TIMESTAMPTZ,
  last_used_ip  INET,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT flow_api_keys_scope_check CHECK (
    scopes <@ ARRAY[
      'bots:read',
      'bots:run',
      'bots:write',
      'flows:read',
      'flows:write',
      'sessions:read',
      'sessions:write'
    ]::text[]
    AND array_length(scopes, 1) >= 1
  )
);

CREATE INDEX IF NOT EXISTS flow_api_keys_workspace_idx
  ON public.flow_api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS flow_api_keys_hash_idx
  ON public.flow_api_keys(key_hash);

-- GRANTs (Data API)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.flow_api_keys TO authenticated;
GRANT ALL ON public.flow_api_keys TO service_role;

ALTER TABLE public.flow_api_keys ENABLE ROW LEVEL SECURITY;

-- Só quem é dono/membro do workspace enxerga
DROP POLICY IF EXISTS "flow_api_keys read members" ON public.flow_api_keys;
CREATE POLICY "flow_api_keys read members" ON public.flow_api_keys
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces w
              WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m
              WHERE m.workspace_id = flow_api_keys.workspace_id AND m.user_id = auth.uid())
  );

-- Inserção: apenas dono ou membro do workspace, e o próprio criador
DROP POLICY IF EXISTS "flow_api_keys insert members" ON public.flow_api_keys;
CREATE POLICY "flow_api_keys insert members" ON public.flow_api_keys
  FOR INSERT WITH CHECK (
    created_by = auth.uid() AND (
      EXISTS (SELECT 1 FROM public.workspaces w
                WHERE w.id = workspace_id AND w.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.workspace_members m
                WHERE m.workspace_id = flow_api_keys.workspace_id AND m.user_id = auth.uid())
    )
  );

-- Update (renomear, revogar): apenas membros
DROP POLICY IF EXISTS "flow_api_keys update members" ON public.flow_api_keys;
CREATE POLICY "flow_api_keys update members" ON public.flow_api_keys
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.workspaces w
              WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m
              WHERE m.workspace_id = flow_api_keys.workspace_id AND m.user_id = auth.uid())
  );

-- Delete (hard delete): apenas dono do workspace
DROP POLICY IF EXISTS "flow_api_keys delete owner" ON public.flow_api_keys;
CREATE POLICY "flow_api_keys delete owner" ON public.flow_api_keys
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.workspaces w
              WHERE w.id = workspace_id AND w.owner_id = auth.uid())
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_flow_api_keys_updated_at ON public.flow_api_keys;
CREATE TRIGGER trg_flow_api_keys_updated_at
  BEFORE UPDATE ON public.flow_api_keys
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ------------------------------------------------------------
-- 2) Tabela: flow_api_key_audit (auditoria append-only)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.flow_api_key_audit (
  id            BIGSERIAL PRIMARY KEY,
  key_id        UUID REFERENCES public.flow_api_keys(id) ON DELETE SET NULL,
  workspace_id  UUID,
  event         TEXT NOT NULL, -- 'created' | 'used' | 'revoked' | 'rotated' | 'auth_failed'
  scope_used    TEXT,
  ip            INET,
  user_agent    TEXT,
  route         TEXT,
  status_code   INT,
  metadata      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flow_api_key_audit_key_idx
  ON public.flow_api_key_audit(key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS flow_api_key_audit_ws_idx
  ON public.flow_api_key_audit(workspace_id, created_at DESC);

GRANT SELECT ON public.flow_api_key_audit TO authenticated;
GRANT ALL ON public.flow_api_key_audit TO service_role;

ALTER TABLE public.flow_api_key_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flow_api_key_audit read members" ON public.flow_api_key_audit;
CREATE POLICY "flow_api_key_audit read members" ON public.flow_api_key_audit
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.workspaces w
              WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m
              WHERE m.workspace_id = flow_api_key_audit.workspace_id AND m.user_id = auth.uid())
  );

-- Inserção só via service_role (edge function). Nenhuma política p/ authenticated = negado.

-- ------------------------------------------------------------
-- 3) RPC: create_flow_api_key
--    Retorna o plaintext UMA VEZ SÓ. Cliente deve guardar imediatamente.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_flow_api_key(
  _workspace_id UUID,
  _name         TEXT,
  _scopes       TEXT[] DEFAULT ARRAY['bots:read']::text[],
  _expires_at   TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  id            UUID,
  plaintext_key TEXT,
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
  v_uid       UUID := auth.uid();
  v_random    TEXT;
  v_plaintext TEXT;
  v_prefix    TEXT;
  v_last_four TEXT;
  v_hash      TEXT;
  v_id        UUID;
  v_allowed   BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Verifica membership
  SELECT (
    EXISTS (SELECT 1 FROM public.workspaces w
              WHERE w.id = _workspace_id AND w.owner_id = v_uid)
    OR EXISTS (SELECT 1 FROM public.workspace_members m
              WHERE m.workspace_id = _workspace_id AND m.user_id = v_uid)
  ) INTO v_allowed;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'forbidden_workspace';
  END IF;

  -- Escopos válidos
  IF _scopes IS NULL OR array_length(_scopes, 1) IS NULL THEN
    _scopes := ARRAY['bots:read']::text[];
  END IF;

  IF NOT (_scopes <@ ARRAY[
      'bots:read','bots:run','bots:write',
      'flows:read','flows:write',
      'sessions:read','sessions:write']::text[]) THEN
    RAISE EXCEPTION 'invalid_scope';
  END IF;

  -- Gera 32 bytes aleatórios (~256 bits de entropia) — usa pgcrypto
  BEGIN
    v_random := encode(extensions.gen_random_bytes(32), 'hex');
  EXCEPTION WHEN undefined_function THEN
    v_random := encode(gen_random_bytes(32), 'hex');
  END;

  v_plaintext := 'zf_live_' || v_random;                -- ex: zf_live_ab12...ef98
  v_prefix    := substr(v_plaintext, 1, 16);            -- 'zf_live_ab12cd34'
  v_last_four := right(v_plaintext, 4);
  v_hash      := encode(digest(v_plaintext, 'sha256'), 'hex');

  INSERT INTO public.flow_api_keys(
    workspace_id, created_by, name,
    key_prefix, key_last_four, key_hash,
    scopes, expires_at
  ) VALUES (
    _workspace_id, v_uid, _name,
    v_prefix, v_last_four, v_hash,
    _scopes, _expires_at
  )
  RETURNING flow_api_keys.id INTO v_id;

  INSERT INTO public.flow_api_key_audit(key_id, workspace_id, event, metadata)
  VALUES (v_id, _workspace_id, 'created', jsonb_build_object('name', _name, 'scopes', _scopes));

  RETURN QUERY
    SELECT v_id, v_plaintext, v_prefix, v_last_four, _scopes, _expires_at, now();
END;
$$;

REVOKE ALL ON FUNCTION public.create_flow_api_key(UUID, TEXT, TEXT[], TIMESTAMPTZ) FROM public;
GRANT EXECUTE ON FUNCTION public.create_flow_api_key(UUID, TEXT, TEXT[], TIMESTAMPTZ) TO authenticated;

-- ------------------------------------------------------------
-- 4) RPC: revoke_flow_api_key (soft delete recomendado)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.revoke_flow_api_key(_key_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ws  UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT workspace_id INTO v_ws FROM public.flow_api_keys WHERE id = _key_id;
  IF v_ws IS NULL THEN RETURN FALSE; END IF;

  IF NOT (
    EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = v_ws AND w.owner_id = v_uid)
    OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = v_ws AND m.user_id = v_uid)
  ) THEN
    RAISE EXCEPTION 'forbidden_workspace';
  END IF;

  UPDATE public.flow_api_keys
     SET revoked_at = now()
   WHERE id = _key_id AND revoked_at IS NULL;

  INSERT INTO public.flow_api_key_audit(key_id, workspace_id, event)
  VALUES (_key_id, v_ws, 'revoked');

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_flow_api_key(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.revoke_flow_api_key(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 5) RPC (service_role only): validate_flow_api_key
--    Chamada pela edge function. Não deve ser exposta a authenticated/anon.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_flow_api_key(_plaintext TEXT)
RETURNS TABLE (
  key_id       UUID,
  workspace_id UUID,
  scopes       TEXT[],
  is_valid     BOOLEAN,
  reason       TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
  v_row  public.flow_api_keys%ROWTYPE;
BEGIN
  IF _plaintext IS NULL OR _plaintext !~ '^zf_live_[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT[], FALSE, 'malformed';
    RETURN;
  END IF;

  v_hash := encode(digest(_plaintext, 'sha256'), 'hex');

  SELECT * INTO v_row FROM public.flow_api_keys WHERE key_hash = v_hash LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::UUID, NULL::UUID, NULL::TEXT[], FALSE, 'not_found';
    RETURN;
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RETURN QUERY SELECT v_row.id, v_row.workspace_id, v_row.scopes, FALSE, 'revoked';
    RETURN;
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < now() THEN
    RETURN QUERY SELECT v_row.id, v_row.workspace_id, v_row.scopes, FALSE, 'expired';
    RETURN;
  END IF;

  RETURN QUERY SELECT v_row.id, v_row.workspace_id, v_row.scopes, TRUE, 'ok';
END;
$$;

REVOKE ALL ON FUNCTION public.validate_flow_api_key(TEXT) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_flow_api_key(TEXT) TO service_role;

-- ------------------------------------------------------------
-- 6) RPC (service_role only): touch_flow_api_key
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_flow_api_key(_key_id UUID, _ip INET)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.flow_api_keys
     SET last_used_at = now(),
         last_used_ip = _ip
   WHERE id = _key_id;
$$;

REVOKE ALL ON FUNCTION public.touch_flow_api_key(UUID, INET) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_flow_api_key(UUID, INET) TO service_role;

-- ============================================================
-- FIM
-- ============================================================
