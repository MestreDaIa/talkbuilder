DROP FUNCTION IF EXISTS public.resolve_flow_workspace(TEXT);
CREATE FUNCTION public.resolve_flow_workspace(p_identifier TEXT)
RETURNS TABLE(workspace_id UUID, workspace_slug TEXT, workspace_name TEXT, hostname TEXT, workspace_source TEXT)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT w.id,w.slug,w.name,d.hostname,d.source
  FROM public.flow_workspace_domains d
  JOIN public.workspaces w ON w.id=d.workspace_id
  WHERE lower(d.hostname)=lower(trim(regexp_replace(p_identifier,'^https?://','')))
     OR lower(w.slug)=lower(trim(regexp_replace(p_identifier,'^https?://','')))
  ORDER BY d.is_primary DESC LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.resolve_flow_workspace(TEXT) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_flow_workspace(TEXT) TO service_role;
