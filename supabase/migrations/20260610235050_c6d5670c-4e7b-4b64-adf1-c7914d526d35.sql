-- 1. Expansão da tabela profiles para provisionamento
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'starter',
ADD COLUMN IF NOT EXISTS embed_source TEXT,
ADD COLUMN IF NOT EXISTS embed_company_id TEXT,
ADD COLUMN IF NOT EXISTS embed_plan_tier TEXT,
ADD COLUMN IF NOT EXISTS embed_plan_synced_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS embed_max_chatbots INT4,
ADD COLUMN IF NOT EXISTS embed_max_messages INT4,
ADD COLUMN IF NOT EXISTS embed_max_integrations INT4;

-- 2. Garantir que a tabela api_keys tenha o grant para service_role (usado na Edge Function)
GRANT ALL ON public.api_keys TO service_role;

-- 3. Função para atualizar updated_at se não existir
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 4. Trigger para profiles
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_profiles_updated_at') THEN
        CREATE TRIGGER update_profiles_updated_at
        BEFORE UPDATE ON public.profiles
        FOR EACH ROW
        EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;
