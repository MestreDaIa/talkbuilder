// =============================================================================
// sync-embed-plan — Edge Function (Deno)
// -----------------------------------------------------------------------------
// O Flow-Appoint chama este endpoint sempre que o plano/status de uma empresa
// muda. Atualiza profiles.embed_plan_tier no banco do builder.
//
// Auth:    JWT HS256 com EMBED_SHARED_SECRET. Claims:
//          iss=flow-appoint, aud=builder-flow-api, purpose=sync-plan, exp futuro.
// Method:  POST
// Body:    { company_id: string, slug: string, tier: string, source: "flow-appoint" }
// Tiers:   "starter" | "pro" | "business" | "suspended"
// Resposta: 200 { ok: true, updated: number } | 404 { ok:false, error } | 401/400
//
// Idempotente: o mesmo tier pode ser enviado quantas vezes for.
//
// Deploy:
//   supabase functions deploy sync-embed-plan --no-verify-jwt
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders, json, verifyHs256Jwt } from "../_shared/embedJwt.ts";

const VALID_TIERS = ["starter", "pro", "business", "suspended"] as const;
type Tier = typeof VALID_TIERS[number];

type SyncBody = {
  company_id: string;
  slug: string;
  tier: Tier;
  source: "flow-appoint";
};

function validateBody(input: unknown):
  | { ok: true; data: SyncBody }
  | { ok: false; reason: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "Body deve ser JSON" };
  }
  const b = input as Record<string, unknown>;
  const company_id = typeof b.company_id === "string" ? b.company_id.trim() : "";
  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";
  const tier = typeof b.tier === "string" ? b.tier.trim().toLowerCase() : "";
  const source = typeof b.source === "string" ? b.source.trim() : "";

  if (!company_id) return { ok: false, reason: "company_id obrigatório" };
  if (!slug) return { ok: false, reason: "slug obrigatório" };
  if (!VALID_TIERS.includes(tier as Tier)) {
    return { ok: false, reason: `tier inválido (esperado: ${VALID_TIERS.join("|")})` };
  }
  if (source !== "flow-appoint") {
    return { ok: false, reason: "source inválido" };
  }
  return {
    ok: true,
    data: { company_id, slug, tier: tier as Tier, source: "flow-appoint" },
  };
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
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
    claims.purpose !== "sync-plan"
  ) {
    return json(401, { ok: false, error: "Token com iss/aud/purpose inválidos" }, origin);
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { ok: false, error: "JSON inválido" }, origin);
  }
  const validated = validateBody(raw);
  if (!validated.ok) {
    return json(400, { ok: false, error: validated.reason }, origin);
  }
  const data = validated.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, { ok: false, error: "Supabase admin env ausente" }, origin);
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Localiza por (embed_source, embed_company_id)
  const { data: rows, error: selErr } = await admin
    .from("profiles")
    .select("id, slug, embed_plan_tier")
    .eq("embed_source", data.source)
    .eq("embed_company_id", data.company_id);

  if (selErr) {
    console.error("[sync-embed-plan] select falhou:", selErr);
    return json(500, { ok: false, error: selErr.message }, origin);
  }
  if (!rows || rows.length === 0) {
    console.warn(
      "[sync-embed-plan] workspace não encontrado",
      { company_id: data.company_id, slug: data.slug },
    );
    return json(404, {
      ok: false,
      error: "Workspace não provisionado ainda — provavelmente provision-account não rodou. Retentar.",
    }, origin);
  }

  const { error: updErr, count } = await admin
    .from("profiles")
    .update({
      embed_plan_tier: data.tier,
      embed_plan_synced_at: new Date().toISOString(),
    }, { count: "exact" })
    .eq("embed_source", data.source)
    .eq("embed_company_id", data.company_id);

  if (updErr) {
    console.error("[sync-embed-plan] update falhou:", updErr);
    return json(500, { ok: false, error: updErr.message }, origin);
  }

  return json(200, {
    ok: true,
    updated: count ?? rows.length,
    tier: data.tier,
    company_id: data.company_id,
  }, origin);
});
