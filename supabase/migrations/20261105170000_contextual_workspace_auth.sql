-- Contextual Flow authentication: one credential set per workspace, never in Supabase Auth.
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE TABLE IF NOT EXISTS public.flow_workspace_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'standalone',
  external_company_id TEXT,
  hostname TEXT NOT NULL,
  domain_type TEXT NOT NULL DEFAULT 'subdomain' CHECK (domain_type IN ('platform','subdomain','custom','standalone')),
  is_primary BOOLEAN NOT NULL DEFAULT true,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flow_workspace_domains_hostname_unique UNIQUE (hostname),
  CONSTRAINT flow_workspace_domains_source_company_unique UNIQUE (source, external_company_id)
);
CREATE INDEX IF NOT EXISTS flow_workspace_domains_workspace_idx ON public.flow_workspace_domains(workspace_id);
ALTER TABLE public.flow_workspace_domains ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flow_workspace_domains FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.flow_workspace_domains TO service_role;

CREATE TABLE IF NOT EXISTS public.flow_workspace_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT flow_workspace_credentials_workspace_email_unique UNIQUE (workspace_id, email)
);
CREATE INDEX IF NOT EXISTS flow_workspace_credentials_user_idx ON public.flow_workspace_credentials(user_id);
ALTER TABLE public.flow_workspace_credentials ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flow_workspace_credentials FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.flow_workspace_credentials TO service_role;

CREATE OR REPLACE FUNCTION public.set_flow_workspace_credential(
  p_workspace_id UUID, p_user_id UUID, p_email TEXT, p_password TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  IF p_workspace_id IS NULL OR p_user_id IS NULL OR NULLIF(trim(p_email),'') IS NULL
     OR COALESCE(char_length(p_password),0) < 8 OR octet_length(p_password) > 72 THEN
    RETURN json_build_object('success',false,'error','Dados de credencial inválidos.');
  END IF;
  INSERT INTO public.flow_workspace_credentials(workspace_id,user_id,email,password_hash)
  VALUES(p_workspace_id,p_user_id,lower(trim(p_email)),extensions.crypt(p_password,extensions.gen_salt('bf')))
  ON CONFLICT(workspace_id,email) DO UPDATE SET
    user_id=EXCLUDED.user_id,password_hash=EXCLUDED.password_hash,updated_at=now();
  RETURN json_build_object('success',true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','Não foi possível salvar a credencial.');
END; $$;
REVOKE ALL ON FUNCTION public.set_flow_workspace_credential(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_flow_workspace_credential(UUID,UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.validate_flow_workspace_credential(
  p_workspace_id UUID, p_email TEXT, p_password TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v RECORD;
BEGIN
  SELECT c.user_id,c.password_hash,w.slug INTO v
  FROM public.flow_workspace_credentials c
  JOIN public.workspaces w ON w.id=c.workspace_id
  JOIN public.workspace_members wm ON wm.workspace_id=c.workspace_id AND wm.user_id=c.user_id
  WHERE c.workspace_id=p_workspace_id AND lower(c.email)=lower(trim(p_email))
  LIMIT 1;
  IF NOT FOUND OR v.password_hash IS NULL OR extensions.crypt(p_password,v.password_hash) <> v.password_hash THEN
    RETURN json_build_object('success',false,'error','E-mail ou senha incorretos para esta empresa.');
  END IF;
  RETURN json_build_object('success',true,'user_id',v.user_id,'workspace_slug',v.slug);
END; $$;
REVOKE ALL ON FUNCTION public.validate_flow_workspace_credential(UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.validate_flow_workspace_credential(UUID,TEXT,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_flow_workspace(p_identifier TEXT)
RETURNS TABLE(workspace_id UUID, workspace_slug TEXT, workspace_name TEXT, hostname TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id,w.slug,w.name,d.hostname
  FROM public.flow_workspace_domains d
  JOIN public.workspaces w ON w.id=d.workspace_id
  WHERE lower(d.hostname)=lower(trim(regexp_replace(p_identifier,'^https?://','')))
     OR lower(w.slug)=lower(trim(regexp_replace(p_identifier,'^https?://','')))
  ORDER BY d.is_primary DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_flow_workspace(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_flow_workspace(TEXT) TO service_role;
