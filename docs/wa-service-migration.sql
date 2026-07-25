-- ============================================================================
-- Zailom Flow x zailom-wa-service — Migração de integração
-- Rodar manualmente no Supabase externo do Zailom Flow.
-- Adiciona colunas em `workspaces` para guardar o vínculo com o wa-service.
-- ============================================================================

BEGIN;

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS wa_service_tenant_id text,
  ADD COLUMN IF NOT EXISTS wa_service_api_key   text,
  ADD COLUMN IF NOT EXISTS wa_service_provisioned_at timestamptz;

COMMENT ON COLUMN public.workspaces.wa_service_tenant_id IS
  'ID do tenant criado no zailom-wa-service (product=flow, product_tenant_id=workspace.id).';
COMMENT ON COLUMN public.workspaces.wa_service_api_key IS
  'Chave zwa_live_... usada pelo backend do Flow para chamar wa.zailom.com em nome deste workspace.';

CREATE INDEX IF NOT EXISTS workspaces_wa_service_tenant_id_idx
  ON public.workspaces (wa_service_tenant_id);

COMMIT;

-- ============================================================================
-- Notas
-- ============================================================================
-- 1. `wa_service_api_key` é lida SOMENTE pelo backend (service_role).
--    Nenhuma RLS política do frontend deve permitir SELECT dessa coluna.
--    Se você tem policy `USING (auth.uid() = owner_id)` em SELECT, adicione
--    uma view sem essa coluna ou revogue coluna a coluna:
--      REVOKE SELECT (wa_service_api_key) ON public.workspaces FROM authenticated;
--
-- 2. Provisionamento é automático: o backend do Flow chama
--    POST {WA_SERVICE_URL}/v1/admin/tenants e /v1/admin/api-keys na primeira
--    vez que qualquer rota /api/wa/* for chamada para um workspace ainda sem
--    key. As colunas ficam vazias até esse primeiro uso.
--
-- 3. Rollback:
--      ALTER TABLE public.workspaces
--        DROP COLUMN IF EXISTS wa_service_tenant_id,
--        DROP COLUMN IF EXISTS wa_service_api_key,
--        DROP COLUMN IF EXISTS wa_service_provisioned_at;
