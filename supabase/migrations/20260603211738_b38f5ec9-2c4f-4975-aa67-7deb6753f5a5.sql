-- 1. Garante que as colunas necessárias existam
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS workspace_id UUID;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS key_value TEXT;
ALTER TABLE public.api_keys ADD COLUMN IF NOT EXISTS created_by UUID;

-- 2. Torna as colunas workspace_id e key_value obrigatórias (se já tiverem dados)
-- Nota: Se a tabela estiver vazia ou todos os registros tiverem esses dados, isso funciona.
-- Se houver nulos, primeiro teríamos que limpá-los. Assumindo que o usuário está tentando criar agora.
ALTER TABLE public.api_keys ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE public.api_keys ALTER COLUMN key_value SET NOT NULL;

-- 3. Configura o valor padrão para created_by e permite nulo para evitar erros de restrição se o auth.uid() falhar
ALTER TABLE public.api_keys ALTER COLUMN created_by DROP NOT NULL;
ALTER TABLE public.api_keys ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 4. Força o recarregamento do cache do PostgREST
NOTIFY pgrst, 'reload schema';