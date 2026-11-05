CREATE TABLE IF NOT EXISTS public.flow_workspace_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '30 minutes'),
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS flow_workspace_password_resets_token_idx
  ON public.flow_workspace_password_resets(token) WHERE used_at IS NULL;
ALTER TABLE public.flow_workspace_password_resets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.flow_workspace_password_resets FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.flow_workspace_password_resets TO service_role;

CREATE OR REPLACE FUNCTION public.create_flow_workspace_password_reset(p_workspace_id UUID,p_email TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_token UUID;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.flow_workspace_credentials
    WHERE workspace_id=p_workspace_id AND lower(email)=lower(trim(p_email))) THEN
    RETURN json_build_object('success',true);
  END IF;
  INSERT INTO public.flow_workspace_password_resets(workspace_id,email)
  VALUES(p_workspace_id,lower(trim(p_email))) RETURNING token INTO v_token;
  RETURN json_build_object('success',true,'token',v_token);
END; $$;
REVOKE ALL ON FUNCTION public.create_flow_workspace_password_reset(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_flow_workspace_password_reset(UUID,TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.reset_flow_workspace_password(p_token UUID,p_password TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,extensions AS $$
DECLARE v_reset RECORD;
BEGIN
  IF p_token IS NULL OR COALESCE(char_length(p_password),0)<8 OR octet_length(p_password)>72 THEN
    RETURN json_build_object('success',false,'error','A nova senha deve ter ao menos 8 caracteres.');
  END IF;
  SELECT id,workspace_id,email INTO v_reset FROM public.flow_workspace_password_resets
  WHERE token=p_token AND used_at IS NULL AND expires_at>now() FOR UPDATE;
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Link expirado ou já utilizado.'); END IF;
  UPDATE public.flow_workspace_credentials
  SET password_hash=extensions.crypt(p_password,extensions.gen_salt('bf')),updated_at=now()
  WHERE workspace_id=v_reset.workspace_id AND lower(email)=lower(v_reset.email);
  IF NOT FOUND THEN RETURN json_build_object('success',false,'error','Credencial não encontrada.'); END IF;
  UPDATE public.flow_workspace_password_resets SET used_at=now()
  WHERE workspace_id=v_reset.workspace_id AND lower(email)=lower(v_reset.email) AND used_at IS NULL;
  RETURN json_build_object('success',true);
END; $$;
REVOKE ALL ON FUNCTION public.reset_flow_workspace_password(UUID,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.reset_flow_workspace_password(UUID,TEXT) TO service_role;
