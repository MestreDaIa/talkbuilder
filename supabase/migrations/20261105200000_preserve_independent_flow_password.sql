-- Booking may call provisioning again when a domain changes. Never overwrite an
-- existing Flow password: seed it only once, so the two systems remain independent.
CREATE OR REPLACE FUNCTION public.set_flow_workspace_credential_hash(
  p_workspace_id UUID, p_user_id UUID, p_email TEXT, p_password_hash TEXT
) RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_inserted UUID;
BEGIN
  IF p_workspace_id IS NULL OR p_user_id IS NULL OR NULLIF(trim(p_email),'') IS NULL
     OR p_password_hash !~ '^\$2[aby]\$[0-9]{2}\$[./A-Za-z0-9]{53}$' THEN
    RETURN json_build_object('success',false,'error','Hash de credencial inválido.');
  END IF;
  INSERT INTO public.flow_workspace_credentials(workspace_id,user_id,email,password_hash)
  VALUES(p_workspace_id,p_user_id,lower(trim(p_email)),p_password_hash)
  ON CONFLICT(workspace_id,email) DO NOTHING
  RETURNING id INTO v_inserted;
  RETURN json_build_object('success',true,'created',v_inserted IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','Não foi possível migrar a credencial.');
END; $$;
REVOKE ALL ON FUNCTION public.set_flow_workspace_credential_hash(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_flow_workspace_credential_hash(UUID,UUID,TEXT,TEXT) TO service_role;
