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

DROP POLICY IF EXISTS "Workspace members can update execution records" ON public.flow_executions;
CREATE POLICY "Workspace members can update execution records"
ON public.flow_executions
FOR UPDATE
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.chatbot_flows f
    WHERE f.id = flow_executions.flow_id
      AND f.is_published = true
      AND f.is_active = true
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.chatbot_flows f
    WHERE f.id = flow_executions.flow_id
      AND f.is_published = true
      AND f.is_active = true
  )
);
