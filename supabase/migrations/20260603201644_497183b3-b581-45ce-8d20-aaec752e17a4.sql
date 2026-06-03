-- 1. Garante que a tabela exista com a estrutura correta
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_value TEXT NOT NULL UNIQUE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    created_by UUID REFERENCES auth.users(id) DEFAULT auth.uid()
);

-- 2. Permissões básicas para PostgREST
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

-- 3. Habilita RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 4. Remove políticas antigas
DROP POLICY IF EXISTS "Users can manage their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Workspace members can manage API keys" ON public.api_keys;

-- 5. Cria política simplificada baseada no criador para garantir o funcionamento imediato
CREATE POLICY "Users can manage their own API keys" ON public.api_keys
    FOR ALL 
    USING (auth.uid() = created_by)
    WITH CHECK (auth.uid() = created_by);

-- 6. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER tr_api_keys_updated_at
    BEFORE UPDATE ON public.api_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();