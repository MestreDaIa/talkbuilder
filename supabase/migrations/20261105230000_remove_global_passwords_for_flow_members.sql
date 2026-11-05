-- Remove legacy global Auth password hashes for regular Flow users once
-- their workspace-scoped credentials are present. Super Admin accounts are excluded.
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
  UPDATE auth.users u SET encrypted_password=''
  WHERE u.id=p_user_id
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='super_admin');
  RETURN json_build_object('success',true);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','Não foi possível salvar a credencial.');
END; $$;
REVOKE ALL ON FUNCTION public.set_flow_workspace_credential(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_flow_workspace_credential(UUID,UUID,TEXT,TEXT) TO service_role;

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
  UPDATE auth.users u SET encrypted_password=''
  WHERE u.id=p_user_id
    AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id=u.id AND ur.role='super_admin');
  RETURN json_build_object('success',true,'created',v_inserted IS NOT NULL);
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success',false,'error','Não foi possível migrar a credencial.');
END; $$;
REVOKE ALL ON FUNCTION public.set_flow_workspace_credential_hash(UUID,UUID,TEXT,TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.set_flow_workspace_credential_hash(UUID,UUID,TEXT,TEXT) TO service_role;
