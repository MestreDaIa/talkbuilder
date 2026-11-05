import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const ALLOWED_ORIGINS = ["https://booking.zailom.com", "https://zailom-booking.lovable.app"];
function corsHeaders(origin: string | null): HeadersInit {
  const allow = origin && (ALLOWED_ORIGINS.includes(origin) || origin.endsWith(".lovable.app")) ? origin : ALLOWED_ORIGINS[0];
  return { "Access-Control-Allow-Origin": allow, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}
function json(status: number, body: unknown, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...corsHeaders(origin) } });
}
function decode(input: string): Uint8Array {
  const padded = input + "=".repeat((4 - input.length % 4) % 4);
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function verify(token: string, secret: string) {
  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false as const, reason: "Formato JWT inválido" };
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", key, decode(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]))) return { ok: false as const, reason: "Assinatura inválida" };
    const payload = JSON.parse(new TextDecoder().decode(decode(parts[1])));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return { ok: false as const, reason: "Token expirado" };
    return { ok: true as const };
  } catch { return { ok: false as const, reason: "Erro ao validar token" }; }
}
function cleanSlug(value: unknown) {
  return String(value ?? "").toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
}

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(origin) });
  if (req.method !== "POST") return json(405, { success: false, error: "Method not allowed" }, origin);
  const secret = Deno.env.get("EMBED_SHARED_SECRET");
  if (!secret) return json(500, { success: false, error: "EMBED_SHARED_SECRET não configurado" }, origin);
  const auth = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const verified = await verify(auth, secret);
  if (!verified.ok) return json(401, { success: false, error: verified.reason }, origin);

  let body: any;
  try { body = await req.json(); } catch { return json(400, { success: false, error: "JSON inválido" }, origin); }
  const email = String(body.email ?? "").trim().toLowerCase();
  const slug = cleanSlug(body.slug);
  const password = body.password;
  const passwordHash = typeof body.password_hash === "string" ? body.password_hash : null;
  const source = String(body.embed_source || "booking").trim().toLowerCase();
  const isBooking = source === "booking";
  if (!email || !slug) return json(400, { success: false, error: "email e slug são obrigatórios" }, origin);
  if (isBooking && !body.company_id) return json(400, { success: false, error: "company_id é obrigatório para Booking" }, origin);
  if (password !== undefined && (typeof password !== "string" || password.length < 6)) return json(400, { success: false, error: "Senha inválida" }, origin);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { success: false, error: "Configuração Supabase incompleta" }, origin);
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  let userId: string | null = null;
  const { data: profile, error: profileLookupError } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
  if (profileLookupError) return json(500, { success: false, error: "Falha ao consultar perfil", details: profileLookupError.message }, origin);
  userId = profile?.id ?? null;

  if (!userId) {
    const { data: users, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return json(500, { success: false, error: "Falha ao consultar Auth", details: error.message }, origin);
    userId = users.users.find(u => u.email?.toLowerCase() === email)?.id ?? null;
  }

  if (!userId) {
    // A identidade global do Auth guarda somente o perfil/e-mail.
    // A senha empresarial é gravada separadamente por workspace.
    const { data, error } = await admin.auth.admin.createUser({
      email, email_confirm: true,
      user_metadata: { full_name: body.display_name, display_name: body.display_name, slug },
    });
    if (error || !data.user) return json(500, { success: false, error: error?.message || "Falha ao criar usuário" }, origin);
    userId = data.user.id;
  }

  // Atualiza apenas dados pessoais; empresa/workspace é uma relação N:N e não
  // pode ser gravada em campos globais do perfil.
  const profileData: Record<string, unknown> = { display_name: body.display_name || undefined };
  const { error: profileUpdateError } = await admin.from("profiles").update(profileData).eq("id", userId);
  if (profileUpdateError) return json(500, { success: false, error: "Falha ao atualizar perfil", details: profileUpdateError.message }, origin);

  let workspaceId: string | null = null;
  if (isBooking) {
    const companyId = String(body.company_id);
    const { data: mapping, error } = await admin.from("booking_workspace_links").select("workspace_id")
      .eq("source", source).eq("external_company_id", companyId).maybeSingle();
    if (error) return json(500, { success: false, error: "Falha ao consultar vínculo da empresa", details: error.message }, origin);
    workspaceId = mapping?.workspace_id ?? null;

    if (!workspaceId) {
      const { data: bySlug, error: slugError } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
      if (slugError) return json(500, { success: false, error: "Falha ao consultar workspace", details: slugError.message }, origin);
      if (bySlug?.id) workspaceId = bySlug.id;
      else {
        const { data: created, error: createError } = await admin.from("workspaces")
          .insert({ name: `${body.display_name || email} Workspace`, slug, owner_id: userId }).select("id").single();
        if (createError || !created) return json(500, { success: false, error: "Falha ao criar workspace", details: createError?.message }, origin);
        workspaceId = created.id;
      }
      const { error: insertMappingError } = await admin.from("booking_workspace_links")
        .insert({ source, external_company_id: companyId, workspace_id: workspaceId });
      if (insertMappingError) {
        const { data: concurrent } = await admin.from("booking_workspace_links").select("workspace_id")
          .eq("source", source).eq("external_company_id", companyId).maybeSingle();
        if (!concurrent?.workspace_id) return json(500, { success: false, error: "Falha ao persistir vínculo Booking/Flow", details: insertMappingError.message }, origin);
        workspaceId = concurrent.workspace_id;
      }
    }
    const metadata: Record<string, unknown> = { synced_at: new Date().toISOString() };
    if (body.embed_plan_tier) metadata.plan_tier = body.embed_plan_tier;
    if (body.limits !== undefined) metadata.limits = body.limits;
    const { error: syncError } = await admin.from("booking_workspace_links").update(metadata)
      .eq("source", source).eq("external_company_id", companyId);
    if (syncError) return json(500, { success: false, error: "Falha ao sincronizar plano", details: syncError.message }, origin);
  } else {
    const { data: existing } = await admin.from("workspaces").select("id").eq("slug", slug).maybeSingle();
    workspaceId = existing?.id ?? null;
    if (!workspaceId) {
      const { data: created, error } = await admin.from("workspaces")
        .insert({ name: `${body.display_name || email} Workspace`, slug, owner_id: userId }).select("id").single();
      if (error || !created) return json(500, { success: false, error: "Falha ao criar workspace standalone", details: error?.message }, origin);
      workspaceId = created.id;
    }
  }
  if (!workspaceId) return json(500, { success: false, error: "Workspace não resolvido" }, origin);

  // Senha contextual por empresa/workspace; nunca gravar ou atualizar senha no Auth.
  if (password || passwordHash) {
    const rpcName = password ? "set_flow_workspace_credential" : "set_flow_workspace_credential_hash";
    const rpcArgs = password
      ? { p_workspace_id: workspaceId, p_user_id: userId, p_email: email, p_password: password }
      : { p_workspace_id: workspaceId, p_user_id: userId, p_email: email, p_password_hash: passwordHash };
    const { data: credentialResult, error: credentialError } = await admin.rpc(rpcName, rpcArgs);
    if (credentialError || !credentialResult?.success) {
      return json(500, { success: false, error: credentialResult?.error || "Falha ao salvar credencial contextual", details: credentialError?.message }, origin);
    }
  }

  const accessHost = String(body.access_host || "").trim().toLowerCase();
  if (accessHost) {
    let validHost = false;
    try { const parsedHost = new URL("https://" + accessHost); validHost = parsedHost.hostname === accessHost && accessHost.includes("."); } catch { validHost = false; }
    if (!validHost) {
      return json(400, { success: false, error: "Domínio de acesso do Flow inválido." }, origin);
    }
    const domainRecord = {
      workspace_id: workspaceId, source: isBooking ? "booking" : "standalone",
      external_company_id: isBooking ? String(body.company_id) : null,
      hostname: accessHost, domain_type: String(body.domain_type || (isBooking ? "subdomain" : "standalone")),
      is_primary: true, is_verified: Boolean(body.domain_verified),
      updated_at: new Date().toISOString(),
    };
    const domainWrite = isBooking
      ? await admin.from("flow_workspace_domains").upsert(domainRecord, { onConflict: "source,external_company_id" })
      : await admin.from("flow_workspace_domains").upsert(domainRecord, { onConflict: "hostname" });
    const domainError = domainWrite.error;
    if (domainError) {
      return json(409, { success: false, error: "Este domínio já está vinculado a outro workspace ou não pôde ser registrado.", details: domainError.message }, origin);
    }
  }

  const { error: memberError } = await admin.from("workspace_members")
    .upsert({ workspace_id: workspaceId, user_id: userId, role: "owner" }, { onConflict: "workspace_id,user_id", ignoreDuplicates: true });
  if (memberError) return json(500, { success: false, error: "Falha ao associar usuário ao workspace", details: memberError.message }, origin);

  const { data: key, error: keyError } = await admin.from("api_keys").select("key_value")
    .eq("workspace_id", workspaceId).eq("is_active", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (keyError) return json(500, { success: false, error: "Falha ao consultar API Key", details: keyError.message }, origin);
  let apiKey = key?.key_value;
  if (!apiKey) {
    const { data: generated, error } = await admin.rpc("generate_api_key");
    if (error || !generated) return json(500, { success: false, error: "Falha ao gerar API Key", details: error?.message }, origin);
    apiKey = generated;
    const { error: saveError } = await admin.from("api_keys").insert({
      name: "Zailom Booking Auto-Provisioned", workspace_id: workspaceId,
      key_value: apiKey, created_by: userId, is_active: true,
    });
    if (saveError) return json(500, { success: false, error: "Falha ao salvar API Key", details: saveError.message }, origin);
  }
  return json(200, { success: true, workspace_id: workspaceId, api_key: apiKey, user_id: userId }, origin);
});
