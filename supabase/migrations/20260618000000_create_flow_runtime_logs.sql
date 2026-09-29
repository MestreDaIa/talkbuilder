CREATE TABLE IF NOT EXISTS public.flow_runtime_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  flow_id uuid NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  execution_id text,
  node_id text,
  level text NOT NULL DEFAULT 'error',
  category text NOT NULL DEFAULT 'provider',
  provider text,
  error_code text,
  http_status integer,
  title text NOT NULL,
  message text NOT NULL,
  suggestion text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS flow_runtime_logs_workspace_created_idx
  ON public.flow_runtime_logs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS flow_runtime_logs_flow_created_idx
  ON public.flow_runtime_logs (flow_id, created_at DESC);

ALTER TABLE public.flow_runtime_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view runtime logs" ON public.flow_runtime_logs;
CREATE POLICY "Workspace members can view runtime logs"
ON public.flow_runtime_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = flow_runtime_logs.workspace_id
      AND wm.user_id = auth.uid()
  )
);

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
  v_log_id uuid;
BEGIN
  SELECT workspace_id
    INTO v_workspace_id
  FROM public.chatbot_flows
  WHERE id = p_flow_id
    AND is_published = true
    AND is_active = true;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Fluxo não encontrado ou inativo';
  END IF;

  INSERT INTO public.flow_runtime_logs (
    workspace_id,
    flow_id,
    execution_id,
    node_id,
    level,
    category,
    provider,
    error_code,
    http_status,
    title,
    message,
    suggestion,
    metadata
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

GRANT SELECT ON public.flow_runtime_logs TO authenticated;

ALTER PUBLICATION supabase_realtime ADD TABLE public.flow_runtime_logs;
