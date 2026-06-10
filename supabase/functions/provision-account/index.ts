// =============================================================================
// provision-account — Edge Function (Deno) do builder-flow-api (Zailom Flow)
// -----------------------------------------------------------------------------
// Recebe do Zailom Booking os dados de um usuário recém-cadastrado lá e cria
// (ou reaproveita) a conta correspondente aqui no builder.
//
// Auth: JWT HS256 assinado com EMBED_SHARED_SECRET.
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = [
  "https://booking.zailom.com",
  "https://zailom-booking.lovable.app",
];

function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".lovable.app"))
    ? origin
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

// -------- JWT HS256 verify --------
function b64urlToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyHs256Jwt(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Formato JWT inválido" };
  const [headerB64, payloadB64, sigB64] = parts;

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
    const expectedSig = new Uint8Array(
      await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${headerB64}.${payloadB64}`))
    );
    const providedSig = b64urlToBytes(sigB64);
    
    let diff = 0;
    if (expectedSig.length !== providedSig.length) return { ok: false, reason: "Assinatura inválida" };
    for (let i = 0; i < expectedSig.length; i++) diff |= expectedSig[i] ^ providedSig[i];
    if (diff !== 0) return { ok: false, reason: "Assinatura inválida" };

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return { ok: false, reason: "Token expirado" };
    
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, reason: "Erro ao validar token" };
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { ok: false, error: "Method not allowed" }, origin);

  const sharedSecret = Deno.env.get("EMBED_SHARED_SECRET");
  if (!sharedSecret) return json(500, { ok: false, error: "EMBED_SHARED_SECRET não configurado" }, origin);

  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace("Bearer ", "").trim();
  const verified = await verifyHs256Jwt(token, sharedSecret);
  if (!verified.ok) return json(401, { ok: false, error: verified.reason }, origin);

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { ok: false, error: "JSON inválido" }, origin);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(supabaseUrl!, serviceRoleKey!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { email, password, slug, display_name, company_id, embed_source, embed_plan_tier, limits } = body;

  // 1. Criar ou obter usuário
  let userId;
  const { data: newUser, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: display_name, slug }
  });

  if (createError) {
    if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
      const { data: users } = await admin.auth.admin.listUsers();
      const existingUser = users.users.find(u => u.email === email);
      if (!existingUser) return json(500, { ok: false, error: "Erro ao localizar usuário existente" }, origin);
      userId = existingUser.id;
    } else {
      return json(500, { ok: false, error: createError.message }, origin);
    }
  } else {
    userId = newUser.user.id;
  }

  // 2. Atualizar Profile (Trigger handle_new_user já deve ter criado a base)
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      embed_source: embed_source || "booking",
      embed_company_id: company_id,
      embed_plan_tier: embed_plan_tier || "starter",
      embed_plan_synced_at: new Date().toISOString(),
      embed_max_chatbots: limits?.max_chatbots,
      embed_max_messages: limits?.max_messages,
      embed_max_integrations: limits?.max_integrations,
    })
    .eq("id", userId);

  if (profileError) console.error("Erro ao atualizar profile:", profileError);

  // 3. Gerar API Key (Usando a função SQL já existente)
  const { data: apiKeyRaw, error: rpcError } = await admin.rpc('generate_api_key');
  if (rpcError) return json(500, { ok: false, error: "Erro ao gerar chave de API" }, origin);

  // Como não temos tabela de workspaces (apenas profiles.slug), usamos o userId como workspace_id temporário
  // ou o UUID do profile. O sistema atual parece usar currentWorkspace.id, que no useAuth é carregado de profiles.id se workspaces falhar.
  const workspaceId = userId; 

  const { error: keyInsertError } = await admin
    .from("api_keys")
    .insert({
      name: "Zailom Booking Auto-Provisioned",
      workspace_id: workspaceId,
      key_value: apiKeyRaw,
      created_by: userId,
      is_active: true
    });

  if (keyInsertError) console.error("Erro ao salvar API Key:", keyInsertError);

  return json(200, {
    success: true,
    workspace_id: workspaceId,
    api_key: apiKeyRaw,
    user_id: userId
  }, origin);
});