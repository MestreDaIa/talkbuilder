-- ============================================================================
-- Zailom Flow · Runtime Context / Session Memory / Live Data
-- Deploy MANUAL no Supabase externo (SQL Editor).
-- Idempotente: pode ser rodado múltiplas vezes.
-- ============================================================================
-- Camadas:
--   1. context_schema     → catálogo de conceitos POR bot (chaves reutilizáveis)
--   2. session_memory     → valores POR conversation (isolados por usuário)
--   3. skill_execution_log→ registro de execuções de skills (p/ revalidação Live Data)
--   4. skill_registry     → cache dos endpoints/skills declarados por HTTP Dinâmico
-- ============================================================================

-- ---------- 1. Context Schema (catálogo por Bot) ----------------------------
CREATE TABLE IF NOT EXISTS public.context_schema (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id       TEXT NOT NULL,
    key          TEXT NOT NULL,
    description  TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bot_id, key)
);
CREATE INDEX IF NOT EXISTS idx_context_schema_bot ON public.context_schema (bot_id);

-- ---------- 2. Session Memory (valores por Conversation) --------------------
CREATE TABLE IF NOT EXISTS public.session_memory (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    bot_id          TEXT NOT NULL,
    key             TEXT NOT NULL,
    value           JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (conversation_id, key)
);
CREATE INDEX IF NOT EXISTS idx_session_memory_conv ON public.session_memory (conversation_id);
CREATE INDEX IF NOT EXISTS idx_session_memory_bot  ON public.session_memory (bot_id);

-- ---------- 3. Skill Execution Log (rastreio de Live Data) ------------------
CREATE TABLE IF NOT EXISTS public.skill_execution_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id TEXT NOT NULL,
    bot_id          TEXT NOT NULL,
    skill_id        TEXT NOT NULL,            -- node_id ou endpoint_id
    skill_name      TEXT,
    result_type     TEXT NOT NULL DEFAULT 'context'  -- 'context' | 'live'
        CHECK (result_type IN ('context','live')),
    input           JSONB,
    output          JSONB,
    executed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skill_log_conv     ON public.skill_execution_log (conversation_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_skill_log_conv_type ON public.skill_execution_log (conversation_id, result_type);

-- ---------- 4. Skill Registry (endpoints do HTTP Dinâmico) ------------------
CREATE TABLE IF NOT EXISTS public.skill_registry (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id        TEXT NOT NULL,
    node_id       TEXT NOT NULL,               -- id do HTTP Request no flow
    endpoint_id   TEXT NOT NULL,               -- ex: "GET /services"
    name          TEXT,
    description   TEXT,
    method        TEXT NOT NULL,
    url_template  TEXT NOT NULL,
    request_spec  JSONB NOT NULL DEFAULT '{}'::jsonb,   -- headers/query/body base
    permissions   JSONB NOT NULL DEFAULT '{}'::jsonb,   -- quais campos IA pode alterar
    response_map  JSONB NOT NULL DEFAULT '[]'::jsonb,   -- mapeamentos JSONPath → variável/contexto
    result_type   TEXT NOT NULL DEFAULT 'context'
        CHECK (result_type IN ('context','live')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (bot_id, node_id, endpoint_id)
);
CREATE INDEX IF NOT EXISTS idx_skill_registry_bot ON public.skill_registry (bot_id);

-- ---------- Trigger updated_at compartilhado --------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_ctxschema_touch ON public.context_schema;
CREATE TRIGGER trg_ctxschema_touch  BEFORE UPDATE ON public.context_schema
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_sessmem_touch  ON public.session_memory;
CREATE TRIGGER trg_sessmem_touch    BEFORE UPDATE ON public.session_memory
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS trg_skillreg_touch ON public.skill_registry;
CREATE TRIGGER trg_skillreg_touch   BEFORE UPDATE ON public.skill_registry
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ---------- GRANTS (Data API precisa disso) ---------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.context_schema      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_memory      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_execution_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_registry      TO authenticated;
GRANT ALL ON public.context_schema, public.session_memory,
             public.skill_execution_log, public.skill_registry TO service_role;

-- ---------- RLS -------------------------------------------------------------
ALTER TABLE public.context_schema      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_memory      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_execution_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_registry      ENABLE ROW LEVEL SECURITY;

-- A edge function usa service_role (bypass RLS). Policies abaixo apenas
-- permitem leitura via anon/authenticated para telas administrativas se
-- houver. Se preferir 100% fechado, delete as policies abaixo.
DROP POLICY IF EXISTS "read_all_context_schema" ON public.context_schema;
CREATE POLICY "read_all_context_schema" ON public.context_schema
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "read_all_skill_registry" ON public.skill_registry;
CREATE POLICY "read_all_skill_registry" ON public.skill_registry
    FOR SELECT TO authenticated USING (true);

-- session_memory e skill_execution_log ficam acessíveis apenas via service_role.

-- ---------- View auxiliar: última execução por skill numa conversation ------
CREATE OR REPLACE VIEW public.v_last_skill_execution AS
SELECT DISTINCT ON (conversation_id, skill_id)
       conversation_id, skill_id, skill_name, result_type, output, executed_at
FROM public.skill_execution_log
ORDER BY conversation_id, skill_id, executed_at DESC;

GRANT SELECT ON public.v_last_skill_execution TO authenticated, service_role;
