-- ============================================================
-- SETUP COMPLETO DO SEU SUPABASE (fwoescubnnagdvwasbjl)
-- Rode este SQL no SQL Editor do seu Supabase
-- ============================================================

-- Primeiro, limpar se já existir algo com estrutura diferente
-- DROP TABLE IF EXISTS public.whatsapp_bindings;
-- DROP TABLE IF EXISTS public.workspace_members;
-- DROP TABLE IF EXISTS public.workspaces;

-- 1) Tabela de Workspaces (multi-tenant)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  slug       TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Adiciona a coluna owner_id caso não exista (importante para quem já tem a tabela)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workspaces' AND column_name = 'owner_id') THEN
        ALTER TABLE public.workspaces ADD COLUMN owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

-- 2) Tabela de membros do workspace
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin','editor')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

-- 3) Políticas RLS
DROP POLICY IF EXISTS "ws read own" ON public.workspaces;
CREATE POLICY "ws read own" ON public.workspaces FOR SELECT
  USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = id AND m.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "ws insert own" ON public.workspaces;
CREATE POLICY "ws insert own" ON public.workspaces FOR INSERT WITH CHECK (owner_id = auth.uid());
DROP POLICY IF EXISTS "ws update owner" ON public.workspaces;
CREATE POLICY "ws update owner" ON public.workspaces FOR UPDATE USING (owner_id = auth.uid());

DROP POLICY IF EXISTS "wm read own" ON public.workspace_members;
CREATE POLICY "wm read own" ON public.workspace_members FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "wm insert self" ON public.workspace_members;
CREATE POLICY "wm insert self" ON public.workspace_members FOR INSERT WITH CHECK (user_id = auth.uid());

-- 4) Função RPC get_my_workspaces  (resolve o 404!)
CREATE OR REPLACE FUNCTION public.get_my_workspaces()
RETURNS TABLE (id UUID, name TEXT, slug TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT w.id, w.name, w.slug, COALESCE(m.role, 'owner') AS role
  FROM public.workspaces w
  LEFT JOIN public.workspace_members m
    ON m.workspace_id = w.id AND m.user_id = auth.uid()
  WHERE w.owner_id = auth.uid()
     OR m.user_id  = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_workspaces() TO authenticated;

-- 5) Trigger: ao criar usuário, criar workspace pessoal + profile
CREATE TABLE IF NOT EXISTS public.profiles (
  id         UUID PRIMARY KEY,
  email      TEXT,
  full_name  TEXT,
  avatar_url TEXT,
  slug       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles public read" ON public.profiles;
CREATE POLICY "profiles public read" ON public.profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "profiles update own" ON public.profiles;
CREATE POLICY "profiles update own" ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ws_slug TEXT;
  ws_id   UUID;
BEGIN
  ws_slug := split_part(NEW.email, '@', 1) || '-' || floor(random()*10000)::text;

  INSERT INTO public.profiles (id, email, full_name, avatar_url, slug)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'avatar_url', ws_slug)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workspaces (name, slug, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Meu Workspace'), ws_slug, NEW.id)
  RETURNING id INTO ws_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (ws_id, NEW.id, 'owner');

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6) Backfill: cria workspace para usuários que já existem
INSERT INTO public.workspaces (name, slug, owner_id)
SELECT 'Meu Workspace',
       split_part(u.email, '@', 1) || '-' || floor(random()*10000)::text,
       u.id
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.workspaces w WHERE w.owner_id = u.id);

INSERT INTO public.workspace_members (workspace_id, user_id, role)
SELECT w.id, w.owner_id, 'owner'
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.workspace_members m
  WHERE m.workspace_id = w.id AND m.user_id = w.owner_id
);

-- 7) Tabela whatsapp_bindings (caso ainda não exista)
CREATE TABLE IF NOT EXISTS public.whatsapp_bindings (
  instance_name TEXT PRIMARY KEY,
  bot_public_id TEXT NOT NULL,
  webhook_url   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_bindings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wb read all" ON public.whatsapp_bindings;
CREATE POLICY "wb read all"  ON public.whatsapp_bindings FOR SELECT USING (true);
DROP POLICY IF EXISTS "wb write all" ON public.whatsapp_bindings;
CREATE POLICY "wb write all" ON public.whatsapp_bindings FOR ALL    USING (true) WITH CHECK (true);

-- 8) Tabela whatsapp_connections + RLS (resolve "new row violates row-level security policy")
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  name          TEXT,
  status        TEXT DEFAULT 'disconnected',
  settings      JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wc select members" ON public.whatsapp_connections;
CREATE POLICY "wc select members" ON public.whatsapp_connections
  FOR SELECT USING (
    workspace_id IS NULL
    OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = whatsapp_connections.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wc insert members" ON public.whatsapp_connections;
CREATE POLICY "wc insert members" ON public.whatsapp_connections
  FOR INSERT WITH CHECK (
    workspace_id IS NULL
    OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = whatsapp_connections.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wc update members" ON public.whatsapp_connections;
CREATE POLICY "wc update members" ON public.whatsapp_connections
  FOR UPDATE USING (
    workspace_id IS NULL
    OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = whatsapp_connections.workspace_id AND m.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "wc delete members" ON public.whatsapp_connections;
CREATE POLICY "wc delete members" ON public.whatsapp_connections
  FOR DELETE USING (
    workspace_id IS NULL
    OR EXISTS (SELECT 1 FROM public.workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.workspace_members m WHERE m.workspace_id = whatsapp_connections.workspace_id AND m.user_id = auth.uid())
  );
