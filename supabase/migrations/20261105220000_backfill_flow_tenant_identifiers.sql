-- Backfill tenant identifiers for workspaces created before hostname-aware provisioning.
INSERT INTO public.flow_workspace_domains
  (workspace_id,source,external_company_id,hostname,domain_type,is_primary,is_verified)
SELECT w.id,'booking',b.external_company_id,w.slug,'platform',true,false
FROM public.booking_workspace_links b
JOIN public.workspaces w ON w.id=b.workspace_id
ON CONFLICT DO NOTHING;

INSERT INTO public.flow_workspace_domains
  (workspace_id,source,external_company_id,hostname,domain_type,is_primary,is_verified)
SELECT w.id,'standalone',NULL,w.slug,'standalone',true,true
FROM public.workspaces w
WHERE NOT EXISTS (
  SELECT 1 FROM public.booking_workspace_links b WHERE b.workspace_id=w.id
)
ON CONFLICT DO NOTHING;
