// =============================================================================
// sync-embed-plan — Edge Function (Deno)
// -----------------------------------------------------------------------------
// O Zailom Booking chama este endpoint sempre que o plano/status de uma empresa
// muda. Atualiza profiles.embed_plan_tier e limites no banco do builder.
//
// Auth:    JWT HS256 com EMBED_SHARED_SECRET.
// Method:  POST
// Body:    { company_id: string, slug: string, tier: string, source: "booking", limits?: { ... } }
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

// -------- JWT HS256 verify (Simplificado para manter no arquivo se necessário ou importar) --------
async function verifyHs256Jwt(token: string, secret: string) {
  try {
    const [headerB64, payloadB64, sigB64] = token.split(".");
    const key = await crypto.subtle.importKey(
      "raw", new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
    );
    const data = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
    const sig = new Uint8Array(atob(sigB64.replace(/-/g, "+").replace(/_/g, "/")).split("").map(c => c.charCodeAt(0)));
    const valid = await crypto.subtle.verify("HMAC", key, sig, data);
    if (!valid) return { ok: false };
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, "+").replace(/_/g, "/")));
    return { ok: true, payload };
  } catch (e) {
    return { ok: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  
  const sharedSecret = Deno.env.get("EMBED_SHARED_SECRET");
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  
  const verified = await verifyHs256Jwt(token, sharedSecret!);
  if (!verified.ok) return json(401, { ok: false, error: "Unauthorized" });

  const body = await req.json();
  const { company_id, slug, tier, source, limits } = body;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // 1. Localizar Profile
  let { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("embed_company_id", company_id)
    .eq("embed_source", source || "booking")
    .maybeSingle();

  if (!profile && slug) {
    // Fallback por slug
    const { data: bySlug } = await admin
      .from("profiles")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    profile = bySlug;
  }

  if (!profile) return json(404, { ok: false, error: "User not found" });

  // 2. Atualizar
  const updateData: any = {
    embed_plan_tier: tier,
    embed_plan_synced_at: new Date().toISOString(),
    embed_source: source || "booking",
    embed_company_id: company_id
  };

  if (limits) {
    if (limits.max_chatbots !== undefined) updateData.embed_max_chatbots = limits.max_chatbots;
    if (limits.max_messages !== undefined) updateData.embed_max_messages = limits.max_messages;
    if (limits.max_integrations !== undefined) updateData.embed_max_integrations = limits.max_integrations;
  }

  const { error } = await admin
    .from("profiles")
    .update(updateData)
    .eq("id", profile.id);

  if (error) return json(500, { ok: false, error: error.message });

  return json(200, { ok: true, message: "Plan updated successfully" });
});