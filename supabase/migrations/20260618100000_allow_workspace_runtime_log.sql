CREATE OR REPLACE FUNCTION public.record_flow_runtime_log(
  p_flow_id uuid,
  p_node_id text,
  p_level text,
  p_category text,
  p_provider text,
  p_error_code text,
  p_http_status integer,
  p_title text,
  p_message text,
  p_suggestion text,
  p_execution_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_is_public boolean;
  v_log_id uuid;
BEGIN
  SELECT workspace_id, (is_published AND is_active)
    INTO v_workspace_id, v_is_public
  FROM public.chatbot_flows
  WHERE id = p_flow_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Fluxo não encontrado';
  END IF;

  IF NOT v_is_public AND NOT EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = v_workspace_id
      AND wm.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Sem permissão para registrar log neste fluxo';
  END IF;

  INSERT INTO public.flow_runtime_logs (
    workspace_id, flow_id, execution_id, node_id, level, category,
    provider, error_code, http_status, title, message, suggestion, metadata
  )
  VALUES (
    v_workspace_id,
    p_flow_id,
    p_execution_id,
    NULLIF(p_node_id, ''),
    COALESCE(NULLIF(p_level, ''), 'error'),
    COALESCE(NULLIF(p_category, ''), 'provider'),
    NULLIF(p_provider, ''),
    NULLIF(p_error_code, ''),
    p_http_status,
    LEFT(COALESCE(p_title, 'Erro de execução'), 200),
    LEFT(COALESCE(p_message, 'Ocorreu um erro durante a execução.'), 2000),
    LEFT(p_suggestion, 2000),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_flow_runtime_log(uuid, text, text, text, text, text, integer, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_flow_runtime_log(uuid, text, text, text, text, text, integer, text, text, text, text, jsonb) TO anon, authenticated;
