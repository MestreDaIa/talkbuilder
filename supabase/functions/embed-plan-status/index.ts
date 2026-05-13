// =============================================================================
// embed-plan-status — Edge Function (Deno)
// -----------------------------------------------------------------------------
// Endpoint de auditoria. Usa a MESMA auth JWT HS256 do sync-embed-plan, mas com
// claim purpose="read-plan". Útil para reconciliação e debug.
//
// GET /functions/v1/embed-plan-status?company_id=...&source=flow-appoint
// Resposta: { ok:true, tier, synced_at, source, slug } | 404
//
// Deploy:
//   supabase functions deploy embed-plan-status --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json, verifyHs256Jwt } from "../_shared/embedJwt.ts";

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "GET") {
    return json(405, { ok: false, error: "Method not allowed" }, origin);
  }

  const sharedSecret = Deno.env.get("EMBED_SHARED_SECRET");
  if (!sharedSecret) {
    return json(500, { ok: false, error: "EMBED_SHARED_SECRET não configurado" }, origin);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!bearer) {
    return json(401, { ok: false, error: "Authorization Bearer ausente" }, origin);
  }

  const verified = await verifyHs256Jwt(bearer, sharedSecret);
  if (!verified.ok) {
    return json(401, { ok: false, error: verified.reason }, origin);
  }
  const claims = verified.payload;
  if (
    claims.iss !== "flow-appoint" ||
    claims.aud !== "builder-flow-api" ||
    (claims.purpose !== "read-plan" && claims.purpose !== "sync-plan")
  ) {
    return json(401, { ok: false, error: "Token com iss/aud/purpose inválidos" }, origin);
  }

  const url = new URL(req.url);
  const company_id = (url.searchParams.get("company_id") ?? "").trim();
  const source = (url.searchParams.get("source") ?? "flow-appoint").trim();
  if (!company_id) {
    return json(400, { ok: false, error: "company_id obrigatório" }, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, error: "Supabase admin env ausente" }, origin);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data, error } = await admin
    .from("profiles")
    .select("slug, embed_plan_tier, embed_plan_synced_at, embed_source")
    .eq("embed_source", source)
    .eq("embed_company_id", company_id)
    .maybeSingle();

  if (error) {
    console.error("[embed-plan-status] select falhou:", error);
    return json(500, { ok: false, error: error.message }, origin);
  }
  if (!data) {
    return json(404, { ok: false, error: "Workspace não encontrado" }, origin);
  }

  return json(200, {
    ok: true,
    source: data.embed_source,
    slug: data.slug,
    tier: data.embed_plan_tier,
    synced_at: data.embed_plan_synced_at,
  }, origin);
});
