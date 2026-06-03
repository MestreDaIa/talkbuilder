ALTER FUNCTION generate_api_key() SET search_path = public;
ALTER FUNCTION update_updated_at_column() SET search_path = public;

REVOKE EXECUTE ON FUNCTION generate_api_key() FROM public, anon;
REVOKE EXECUTE ON FUNCTION update_updated_at_column() FROM public, anon;

GRANT EXECUTE ON FUNCTION generate_api_key() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_updated_at_column() TO authenticated, service_role;