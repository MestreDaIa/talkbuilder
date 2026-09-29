-- Reparo idempotente da infraestrutura de métricas.
-- Alguns ambientes podem ter marcado a migration original como aplicada
-- sem que a tabela tenha sido criada. Esta migration garante o estado final.

CREATE TABLE IF NOT EXISTS public.flow_execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  flow_id uuid NOT NULL REFERENCES public.chatbot_flows(id) ON DELETE CASCADE,
  contact_id text NOT NULL,
  channel_id text NOT NULL DEFAULT 'webchat',
  action text NOT NULL DEFAULT 'start',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS flow_execution_events_workspace_idx
  ON public.flow_execution_events (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS flow_execution_events_flow_idx
  ON public.flow_execution_events (flow_id, created_at DESC);

ALTER TABLE public.flow_execution_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can view execution events" ON public.flow_execution_events;
CREATE POLICY "Workspace members can view execution events"
ON public.flow_execution_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    WHERE wm.workspace_id = flow_execution_events.workspace_id
      AND wm.user_id = auth.uid()
  )
);

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
    workspace_id, flow_id, contact_id, channel_id, action
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
