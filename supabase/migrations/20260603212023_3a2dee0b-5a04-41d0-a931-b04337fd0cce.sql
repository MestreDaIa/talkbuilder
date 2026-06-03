-- 1. Tenta remover a coluna user_id se ela ainda estiver de alguma forma sendo referenciada ou existindo como fantasma
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'api_keys' AND column_name = 'user_id') THEN
        ALTER TABLE public.api_keys DROP COLUMN user_id;
    END IF;
END $$;

-- 2. Garante que a coluna created_by é a que deve ser usada e permite nulo
ALTER TABLE public.api_keys ALTER COLUMN created_by DROP NOT NULL;

-- 3. Força a atualização do cache da API de forma agressiva
NOTIFY pgrst, 'reload schema';
ANALYZE public.api_keys;