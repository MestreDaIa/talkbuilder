// Compartilha o vínculo de bot publicado entre Booking e Flow.
// Somente chamadas servidor-servidor assinadas com EMBED_SHARED_SECRET são aceitas.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

function b64urlToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - input.length % 4) % 4);
  const bin = atob((input + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyJwt(token: string, secret: string): Promise<any | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(parts[0] + "." + parts[1])));
    const actual = b64urlToBytes(parts[2]);
    if (expected.length !== actual.length) return null;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected[i] ^ actual[i];
    if (diff !== 0) return null;
    const header = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[0])));
    const claims = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    if (header.alg !== "HS256" || claims.iss !== "zailom-booking" || claims.aud !== "zailom-flow-api" || !claims.company_id || !claims.exp || claims.exp < Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "https://booking.zailom.com", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: { "Access-Control-Allow-Origin": "https://booking.zailom.com", "Access-Control-Allow-Headers": "authorization, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const secret = Deno.env.get("EMBED_SHARED_SECRET") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  if (!secret || !serviceRole || !supabaseUrl) return json({ error: "server_not_configured" }, 500);

  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const claims = await verifyJwt(token, secret);
  if (!claims) return json({ error: "unauthorized" }, 401);

  const body = await req.json().catch(() => null);
  if (!body || body.company_id !== claims.company_id) return json({ error: "company_mismatch" }, 403);
  const instanceName = String(body.instance_name ?? "").trim();
  if (!instanceName || instanceName.length > 200) return json({ error: "invalid_instance_name" }, 400);

  const admin = createClient(supabaseUrl, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  if (body.action === "get") {
    const { data, error } = await admin.from("whatsapp_bindings").select("instance_name, bot_public_id, updated_at").eq("instance_name", instanceName).maybeSingle();
    if (error) return json({ error: "binding_read_failed", details: error.message }, 500);
    return json({ binding: data ?? null });
  }
  if (body.action === "set") {
    const botPublicId = String(body.bot_public_id ?? "").trim();
    if (!botPublicId || botPublicId.length > 200) return json({ error: "invalid_bot_public_id" }, 400);
    const { data: flow } = await admin.from("chatbot_flows").select("public_id, is_published").eq("public_id", botPublicId).eq("is_published", true).maybeSingle();
    if (!flow) return json({ error: "published_bot_not_found" }, 404);
    const { data, error } = await admin.from("whatsapp_bindings").upsert({ instance_name: instanceName, bot_public_id: botPublicId, updated_at: new Date().toISOString() }, { onConflict: "instance_name" }).select("instance_name, bot_public_id, updated_at").single();
    if (error) return json({ error: "binding_write_failed", details: error.message }, 500);
    return json({ binding: data });
  }
  if (body.action === "delete") {
    const { error } = await admin.from("whatsapp_bindings").delete().eq("instance_name", instanceName);
    if (error) return json({ error: "binding_delete_failed", details: error.message }, 500);
    return json({ success: true });
  }
  return json({ error: "invalid_action" }, 400);
});
