// =============================================================================
// provision-account — Edge Function (Deno) do builder-flow-api (TalkMap)
// -----------------------------------------------------------------------------
// Recebe do Flow-Appoint os dados de um usuário recém-cadastrado lá e cria
// (ou reaproveita) a conta correspondente aqui no builder, usando a
// SERVICE_ROLE_KEY do Supabase externo.
//
// Auth: JWT HS256 assinado com EMBED_SHARED_SECRET (mesmo secret já usado
// pelo embed). O JWT precisa ter:
//   - iss: "flow-appoint"
//   - aud: "builder-flow-api"
//   - purpose: "provision"
//   - exp: timestamp curto (recomendado 60s)
//
// O body do POST contém os dados da conta a provisionar:
//   {
//     "email": "user@empresa.com",
//     "password": "<senha gerada/igual à do flow-appoint>",
//     "slug": "minha-empresa",
//     "display_name": "Fulano de Tal",   // opcional
//     "plan": "starter" | "pro" | "business", // opcional, default starter
//     "company_id": "<uuid no flow-appoint>",  // opcional, vai pra metadata
//     "metadata": { ... }                // opcional, merge em user_metadata
//   }
//
// Resposta (200):
//   { ok: true, user_id, email, slug, created: boolean }
//
// Erros: 400 (payload inválido), 401 (JWT inválido/expirado), 500 (Supabase).
//
// Deploy:
//   supabase functions deploy provision-account --no-verify-jwt
//   (--no-verify-jwt porque NÓS validamos nosso próprio JWT compartilhado;
//    o JWT do Supabase Auth não se aplica aqui.)
//
// Secrets necessários no projeto Supabase externo:
//   - EMBED_SHARED_SECRET            (mesma chave do Flow-Appoint)
//   - SUPABASE_URL                   (auto-injetado pelo Supabase)
//   - SUPABASE_SERVICE_ROLE_KEY      (auto-injetado pelo Supabase)
// =============================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// -------- CORS ---------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://flow-appoint.lovable.app",
  // adicione domínios extras do Flow-Appoint conforme necessário
];

function corsHeaders(origin: string | null): HeadersInit {
  const allow =
    origin &&
    (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".lovable.app"))
      ? origin
      : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
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

// -------- JWT HS256 verify (sem dependências) --------------------------------
function b64urlToBytes(input: string): Uint8Array {
  const pad = "=".repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function verifyHs256Jwt(
  token: string,
  secret: string,
): Promise<{ ok: true; payload: Record<string, unknown> } | { ok: false; reason: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Formato JWT inválido" };
  const [headerB64, payloadB64, sigB64] = parts;

  let header: Record<string, unknown>;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlToBytes(headerB64)));
  } catch {
    return { ok: false, reason: "Header inválido" };
  }
  if (header.alg !== "HS256" || header.typ !== "JWT") {
    return { ok: false, reason: "Algoritmo não suportado" };
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  const expectedSig = new Uint8Array(
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(`${headerB64}.${payloadB64}`),
    ),
  );
  const providedSig = b64urlToBytes(sigB64);
  if (!bytesEqual(expectedSig, providedSig)) {
    return { ok: false, reason: "Assinatura inválida" };
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(payloadB64)));
  } catch {
    return { ok: false, reason: "Payload inválido" };
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp === "number" && payload.exp < now) {
    return { ok: false, reason: "Token expirado" };
  }
  if (typeof payload.nbf === "number" && payload.nbf > now) {
    return { ok: false, reason: "Token ainda não válido" };
  }

  return { ok: true, payload };
}

// -------- Validação do body --------------------------------------------------
type ProvisionBody = {
  email: string;
  password: string;
  slug: string;
  display_name?: string;
  plan?: "starter" | "pro" | "business";
  company_id?: string;
  metadata?: Record<string, unknown>;
};

function validateBody(input: unknown):
  | { ok: true; data: ProvisionBody }
  | { ok: false; reason: string } {
  if (!input || typeof input !== "object") {
    return { ok: false, reason: "Body deve ser JSON" };
  }
  const b = input as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  const password = typeof b.password === "string" ? b.password : "";
  const slug = typeof b.slug === "string" ? b.slug.trim().toLowerCase() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, reason: "Email inválido" };
  }
  if (password.length < 8 || password.length > 72) {
    return { ok: false, reason: "Senha deve ter entre 8 e 72 caracteres" };
  }
  if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(slug)) {
    return {
      ok: false,
      reason: "Slug inválido (use letras, números e hífens)",
    };
  }

  const plan = b.plan;
  if (plan !== undefined && !["starter", "pro", "business"].includes(plan as string)) {
    return { ok: false, reason: "Plan inválido" };
  }

  return {
    ok: true,
    data: {
      email,
      password,
      slug,
      display_name: typeof b.display_name === "string" ? b.display_name : undefined,
      plan: plan as ProvisionBody["plan"],
      company_id: typeof b.company_id === "string" ? b.company_id : undefined,
      metadata:
        b.metadata && typeof b.metadata === "object"
          ? (b.metadata as Record<string, unknown>)
          : undefined,
    },
  };
}

// -------- Handler ------------------------------------------------------------
Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json(405, { ok: false, error: "Method not allowed" }, origin);
  }

  // 1) Auth: JWT compartilhado
  const sharedSecret = Deno.env.get("EMBED_SHARED_SECRET");
  if (!sharedSecret) {
    return json(
      500,
      { ok: false, error: "EMBED_SHARED_SECRET não configurado" },
      origin,
    );
  }

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length).trim()
    : "";
  if (!bearer) {
    return json(
      401,
      { ok: false, error: "Authorization Bearer ausente" },
      origin,
    );
  }

  const verified = await verifyHs256Jwt(bearer, sharedSecret);
  if (!verified.ok) {
    return json(401, { ok: false, error: verified.reason }, origin);
  }
  const claims = verified.payload;
  if (
    claims.iss !== "flow-appoint" ||
    claims.aud !== "builder-flow-api" ||
    claims.purpose !== "provision"
  ) {
    return json(
      401,
      { ok: false, error: "Token com iss/aud/purpose inválidos" },
      origin,
    );
  }

  // 2) Body
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

  // 3) Supabase admin client
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json(
      500,
      { ok: false, error: "Supabase admin env ausente" },
      origin,
    );
  }
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const userMetadata: Record<string, unknown> = {
    slug: data.slug,
    display_name: data.display_name ?? null,
    plan: data.plan ?? "starter",
    source: "flow-appoint",
    flow_appoint_company_id: data.company_id ?? null,
    ...(data.metadata ?? {}),
  };

  // 4) Tenta criar — se já existir, busca e retorna idempotente
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: true,
    user_metadata: userMetadata,
  });

  if (!createErr && created?.user) {
    // Marca o profile como gerenciado pelo Flow-Appoint (quando aplicável).
    // O trigger handle_new_user já criou a row em profiles; aqui só
    // anotamos as colunas de embed para sync-embed-plan funcionar depois.
    if (data.company_id) {
      const { error: embedErr } = await admin
        .from("profiles")
        .update({
          embed_source: "flow-appoint",
          embed_company_id: data.company_id,
          embed_plan_tier: data.plan ?? "starter",
          embed_plan_synced_at: new Date().toISOString(),
        })
        .eq("id", created.user.id);
      if (embedErr) {
        console.warn("[provision-account] update embed_* falhou:", embedErr);
      }
    }
    return json(
      200,
      {
        ok: true,
        created: true,
        user_id: created.user.id,
        email: created.user.email,
        slug: data.slug,
      },
      origin,
    );
  }

  // Detecta "já existe" (mensagem ou status do GoTrue)
  const errMsg = (createErr?.message ?? "").toLowerCase();
  const alreadyExists =
    errMsg.includes("already registered") ||
    errMsg.includes("already been registered") ||
    errMsg.includes("user already exists") ||
    errMsg.includes("duplicate");

  if (!alreadyExists) {
    console.error("[provision-account] createUser falhou:", createErr);
    return json(
      500,
      { ok: false, error: createErr?.message ?? "Falha ao criar usuário" },
      origin,
    );
  }

  // 5) Idempotente: localiza usuário existente por email
  // listUsers não tem filter por email no v2 estável, então paginamos curto.
  // Para volumes grandes, troque por uma RPC SQL que faz select em auth.users.
  let existingId: string | null = null;
  let existingEmail: string | null = null;
  for (let page = 1; page <= 20 && !existingId; page++) {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (listErr) {
      console.error("[provision-account] listUsers falhou:", listErr);
      return json(500, { ok: false, error: listErr.message }, origin);
    }
    const match = list.users.find(
      (u) => (u.email ?? "").toLowerCase() === data.email,
    );
    if (match) {
      existingId = match.id;
      existingEmail = match.email ?? data.email;
    }
    if (list.users.length < 200) break;
  }

  if (!existingId) {
    return json(
      500,
      { ok: false, error: "Usuário marcado como duplicado mas não localizado" },
      origin,
    );
  }

  return json(
    200,
    {
      ok: true,
      created: false,
      user_id: existingId,
      email: existingEmail,
      slug: data.slug,
    },
    origin,
  );
});
