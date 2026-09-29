-- Permite que o TestPanel autenticado registre métricas de execuções locais.
-- O vínculo com o workspace e o fluxo é validado contra a associação real do fluxo.

DROP POLICY IF EXISTS "Authenticated members can create execution events"
ON public.flow_execution_events;

CREATE POLICY "Authenticated members can create execution events"
ON public.flow_execution_events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.workspace_members wm
    JOIN public.chatbot_flows f
      ON f.id = flow_execution_events.flow_id
     AND f.workspace_id = flow_execution_events.workspace_id
    WHERE wm.workspace_id = flow_execution_events.workspace_id
      AND wm.user_id = auth.uid()
  )
);
