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

function sanitizeSlug(input: unknown): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
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
  const sanitizedSlug = sanitizeSlug(slug);
  if (!sanitizedSlug) return json(400, { ok: false, error: "slug é obrigatório" }, origin);

  // 1. Criar ou obter usuário (Lógica de Upsert)
  let userId;
  
  // Primeiro tentamos ver se já existe um perfil com esse e-mail (mais rápido)
  const { data: existingProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingProfile) {
    console.log(`Usuário encontrado no profiles: ${email} (${existingProfile.id})`);
    userId = existingProfile.id;
  } else {
    // Tenta criar o usuário no Auth
    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: display_name, slug: sanitizedSlug }
    });

    if (createError) {
      if (createError.message.includes("already registered") || createError.message.includes("already exists")) {
        console.log(`Usuário já registrado no Auth, buscando ID: ${email}`);
        // Se já existe no Auth mas não no profiles, buscamos no Auth
        const { data: usersData } = await admin.auth.admin.listUsers();
        const existingUser = usersData?.users?.find(u => u.email === email);
        
        if (!existingUser) {
          return json(500, { ok: false, error: "Usuário reportado como existente, mas não localizado no Auth." }, origin);
        }
        userId = existingUser.id;
      } else {
        console.error("Erro ao criar usuário:", createError);
        return json(500, { ok: false, error: createError.message }, origin);
      }
    } else {
      console.log(`Novo usuário criado: ${email} (${newUser.user.id})`);
      userId = newUser.user.id;
    }
  }

  // 2. Atualizar Profile (Garantir que limites e dados de embed estejam sincronizados)
  // Usamos um objeto de update dinâmico para evitar sobrescrever com defaults indesejados
  const updateData: any = {
    id: userId,
    email: email,
    embed_source: embed_source || "booking",
    embed_company_id: company_id,
    embed_plan_synced_at: new Date().toISOString(),
  };

  if (display_name) updateData.display_name = display_name;
  updateData.slug = sanitizedSlug;
  if (embed_plan_tier) updateData.embed_plan_tier = embed_plan_tier;
  
  // Só atualiza limites se eles forem explicitamente enviados no payload
  if (limits) {
    if (limits.max_chatbots !== undefined) updateData.embed_max_chatbots = limits.max_chatbots;
    if (limits.max_messages !== undefined) updateData.embed_max_messages = limits.max_messages;
    if (limits.max_integrations !== undefined) updateData.embed_max_integrations = limits.max_integrations;
  }

  const { error: profileError } = await admin
    .from("profiles")
    .upsert(updateData);

  if (profileError) {
    console.error("Erro ao atualizar profile:", profileError);
    // Não paramos aqui pois o usuário/workspace já existem, mas é um sinal de alerta
  }

  // 3. Obter o workspace_id (Trigger handle_new_user já deve ter criado o workspace)
  const { data: membership, error: memberError } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (memberError) {
    console.error("Erro ao buscar workspace_members:", memberError);
    return json(500, { ok: false, error: "Erro ao localizar workspace" }, origin);
  }

  let workspaceId;

  if (!membership) {
    console.log(`Membership ausente para ${userId}. Verificando workspace por slug=${sanitizedSlug}...`);

    // Idempotência: se já existir um workspace com esse slug (criado por trigger
    // ou execução anterior), reutiliza em vez de tentar inserir e bater no unique.
    const { data: existingWorkspace, error: existingWsError } = await admin
      .from("workspaces")
      .select("id, owner_id")
      .eq("slug", sanitizedSlug)
      .maybeSingle();

    if (existingWsError) {
      console.error("Erro ao buscar workspace por slug:", existingWsError);
    }

    if (existingWorkspace) {
      console.log(`Workspace reutilizado (slug=${sanitizedSlug}, id=${existingWorkspace.id})`);
      workspaceId = existingWorkspace.id;
    } else {
      console.log(`Criando workspace fallback para ${userId}...`);
      const { data: newWorkspace, error: wsError } = await admin
        .from("workspaces")
        .insert({
          name: `${display_name || email} Workspace`,
          slug: sanitizedSlug,
          owner_id: userId,
        })
        .select("id")
        .single();

      if (wsError || !newWorkspace) {
        console.error("Erro no fallback de workspace:", wsError);
        return json(500, { ok: false, error: "Falha ao criar workspace de contingência" }, origin);
      }
      workspaceId = newWorkspace.id;
    }

    // Garante a membership (idempotente via unique workspace_id+user_id).
    const { error: memberInsertError } = await admin
      .from("workspace_members")
      .upsert(
        { workspace_id: workspaceId, user_id: userId, role: "owner" },
        { onConflict: "workspace_id,user_id", ignoreDuplicates: true },
      );
    if (memberInsertError) {
      console.error("Erro ao garantir workspace_member:", memberInsertError);
    }
  } else {
    workspaceId = membership.workspace_id;
  }

  // 4. Obter ou Gerar API Key
  // Buscamos se já existe uma chave ativa para este workspace
  const { data: existingKey } = await admin
    .from("api_keys")
    .select("key_value")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let apiKeyRaw;
  if (existingKey) {
    console.log(`Reutilizando API Key existente para workspace ${workspaceId}`);
    apiKeyRaw = existingKey.key_value;
  } else {
    console.log(`Gerando nova API Key para workspace ${workspaceId}`);
    const { data: newKeyRaw, error: rpcError } = await admin.rpc('generate_api_key');
    if (rpcError) {
      console.error("Erro RPC generate_api_key:", rpcError);
      // Fallback se o RPC não existir no banco externo
      apiKeyRaw = crypto.randomUUID().replace(/-/g, ''); 
    } else {
      apiKeyRaw = newKeyRaw;
    }

    const { error: keyInsertError } = await admin
      .from("api_keys")
      .insert({
        name: "Zailom Booking Auto-Provisioned",
        workspace_id: workspaceId,
        key_value: apiKeyRaw,
        created_by: userId,
        is_active: true
      });

    if (keyInsertError) {
      console.error("Erro ao salvar nova API Key:", keyInsertError);
      // Se a tabela api_keys não tiver created_by ou workspace_id, o erro aparecerá aqui
    }
  }

  return json(200, {
    success: true,
    workspace_id: workspaceId,
    api_key: apiKeyRaw,
    user_id: userId
  }, origin);
});