-- Persistent mapping between an external Booking company and its Flow workspace.
-- A user may belong to multiple companies; this relation must not live on profiles.
CREATE TABLE IF NOT EXISTS public.booking_workspace_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'booking',
  external_company_id TEXT NOT NULL,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  plan_tier TEXT,
  limits JSONB,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT booking_workspace_links_source_company_key UNIQUE (source, external_company_id),
  CONSTRAINT booking_workspace_links_workspace_key UNIQUE (workspace_id)
);
CREATE INDEX IF NOT EXISTS booking_workspace_links_workspace_idx ON public.booking_workspace_links(workspace_id);
ALTER TABLE public.booking_workspace_links ENABLE ROW LEVEL SECURITY;
-- Edge Function accesses this table with service_role only; no client policies are created.
