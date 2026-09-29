-- Permite que bots publicados registrem execuções anonimamente para métricas.
-- A leitura permanece restrita a membros do workspace.

ALTER TABLE public.flow_executions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public flows can create execution records" ON public.flow_executions;
CREATE POLICY "Public flows can create execution records"
ON public.flow_executions
FOR INSERT
TO anon, authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chatbot_flows f
    WHERE f.id = flow_executions.flow_id
      AND f.is_published = true
      AND f.is_active = true
  )
);

DROP POLICY IF EXISTS "Workspace members can view execution records" ON public.flow_executions;
CREATE POLICY "Workspace members can view execution records"
ON public.flow_executions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chatbot_flows f
    JOIN public.workspace_members wm
      ON wm.workspace_id = f.workspace_id
    WHERE f.id = flow_executions.flow_id
      AND wm.user_id = auth.uid()
  )
);



-- Histórico de execuções reais do runtime.
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
