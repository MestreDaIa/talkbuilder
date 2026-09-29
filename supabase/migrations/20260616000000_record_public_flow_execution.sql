-- Registra uma execução iniciada pela URL pública do fluxo.
-- O TestPanel interno não chama esta função e, portanto, não entra na métrica.

CREATE OR REPLACE FUNCTION public.record_public_flow_execution(
  p_flow_id uuid,
  p_contact_id text,
  p_channel_id text DEFAULT 'webchat'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_event_id uuid;
BEGIN
  SELECT workspace_id
    INTO v_workspace_id
  FROM public.chatbot_flows
  WHERE id = p_flow_id
    AND is_published = true
    AND is_active = true;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Fluxo público não encontrado ou inativo';
  END IF;

  INSERT INTO public.flow_execution_events (
    workspace_id,
    flow_id,
    contact_id,
    channel_id,
    action
  )
  VALUES (
    v_workspace_id,
    p_flow_id,
    p_contact_id,
    COALESCE(NULLIF(p_channel_id, ''), 'webchat'),
    'start'
  )
  RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_public_flow_execution(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_public_flow_execution(uuid, text, text) TO anon, authenticated;
