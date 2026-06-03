-- 1. Drop da tabela atual e dependências de forma forçada
DROP TABLE IF EXISTS public.api_keys CASCADE;

-- 2. Criação da tabela limpa, sem a coluna user_id
CREATE TABLE public.api_keys (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    workspace_id UUID NOT NULL,
    name TEXT NOT NULL,
    key_value TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID DEFAULT auth.uid(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Permissões necessárias
GRANT SELECT, INSERT, UPDATE, DELETE ON public.api_keys TO authenticated;
GRANT ALL ON public.api_keys TO service_role;

-- 4. Ativa RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- 5. Política de acesso (libera para o criador ou via workspace_id se preferir, mas mantendo o padrão)
CREATE POLICY "Manage own keys" ON public.api_keys
    FOR ALL 
    USING (auth.uid() = created_by OR created_by IS NULL)
    WITH CHECK (auth.uid() = created_by);

-- 6. Trigger de timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at = now(); 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_api_keys_updated_at ON public.api_keys;
CREATE TRIGGER update_api_keys_updated_at 
    BEFORE UPDATE ON public.api_keys 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- 7. Reset TOTAL do cache da API
NOTIFY pgrst, 'reload schema';
ANALYZE public.api_keys;