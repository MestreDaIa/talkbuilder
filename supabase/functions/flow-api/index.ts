// Zailom Flow — Public API (inline para publicação pelo editor web do Supabase)
// Verify JWT: desativado; a autenticação é feita pela Flow API Key.
// Endpoints: health, workspace, instances, bots, bot run e sessions.
// A chave determina o workspace; workspace_id nunca é aceito do cliente.
// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-flow-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

let cachedClient = null;
function getServiceClient() {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

function extractKey(req) {
  const auth = req.headers.get("authorization");
  if (auth) {
    const match = /^Bearer\s+(zf_live_[a-f0-9]{64})$/.exec(auth.trim());
    if (match) return match[1];
  }
  const alt = req.headers.get("x-flow-api-key");
  if (alt && /^zf_live_[a-f0-9]{64}$/.test(alt.trim())) return alt.trim();
  return null;
}

function clientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

async function authenticateFlowRequest(req, opts = {}) {
  const supabase = getServiceClient();
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");
  const route = opts.route || new URL(req.url).pathname;
  const plaintext = extractKey(req);

  if (!plaintext) {
    return { error: { status: 401, body: { error: "Chave de API ausente ou mal formatada", code: "missing_key" } } };
  }

  const { data, error } = await supabase.rpc("validate_flow_api_key", { _plaintext: plaintext });
  if (error || !Array.isArray(data) || data.length === 0) {
    return { error: { status: 401, body: { error: "Falha ao validar a chave", code: "validation_error" } } };
  }

  const row = data[0];
  if (!row.is_valid) {
    await supabase.from("flow_api_key_audit").insert({
      key_id: row.key_id, workspace_id: row.workspace_id, event: "auth_failed",
      ip, user_agent: userAgent, route, metadata: { reason: row.reason },
    });
    return { error: { status: 401, body: { error: `Chave inválida (${row.reason})`, code: row.reason } } };
  }

  const scopes = row.scopes || [];
  if (opts.requireScope && !scopes.includes(opts.requireScope)) {
    await supabase.from("flow_api_key_audit").insert({
      key_id: row.key_id, workspace_id: row.workspace_id, event: "auth_failed",
      ip, user_agent: userAgent, route,
      metadata: { reason: "insufficient_scope", required: opts.requireScope, granted: scopes },
    });
    return { error: { status: 403, body: {
      error: `Chave sem escopo necessário: ${opts.requireScope}`, code: "insufficient_scope",
    } } };
  }

  await Promise.all([
    supabase.rpc("touch_flow_api_key", { _key_id: row.key_id, _ip: ip }),
    supabase.from("flow_api_key_audit").insert({
      key_id: row.key_id, workspace_id: row.workspace_id, event: "used",
      scope_used: opts.requireScope || "health", ip, user_agent: userAgent, route,
    }),
  ]);

  return { ctx: { keyId: row.key_id, workspaceId: row.workspace_id, scopes, ip, userAgent, supabase } };
}

function mapInstance(row) {
  const settings = row.settings || {};
  return {
    id: row.id,
    name: row.name ?? row.instance_name ?? null,
    instance_name: row.instance_name ?? null,
    status: row.status ?? null,
    connection_state: settings.connection_state ?? settings.state ?? row.status ?? null,
    phone_number: settings.phone_number ?? settings.number ?? settings.wa_number ?? settings.owner ?? null,
    last_connected_at: settings.last_connected_at ?? settings.connected_at ?? settings.lastConnectedAt ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapWorkspace(ws, ownerProfile) {
  const profile = ownerProfile || {};
  return {
    id: ws.id,
    name: ws.name ?? profile.full_name ?? profile.email ?? null,
    slug: ws.slug ?? profile.slug ?? null,
    email: profile.email ?? null,
    plan: profile.plan ?? "starter",
    status: profile.is_suspended ? "suspended" : "active",
    owner_id: ws.owner_id ?? null,
    embed: {
      source: profile.embed_source ?? null,
      company_id: profile.embed_company_id ?? null,
      plan_tier: profile.embed_plan_tier ?? null,
      plan_synced_at: profile.embed_plan_synced_at ?? null,
      is_embed: !!profile.embed_source,
    },
    created_at: ws.created_at,
    updated_at: ws.updated_at,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const vIdx = parts.indexOf("v1");
  const route = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;

  try {
    // GET /v1/health — exige chave válida, sem scope específico.
    if (req.method === "GET" && route.length === 1 && route[0] === "health") {
      const auth = await authenticateFlowRequest(req, { requireScope: null, route: "/v1/health" });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { workspaceId, keyId, scopes } = auth.ctx;
      return jsonResponse({ ok: true, workspace_id: workspaceId, key_id: keyId, scopes, server_time: new Date().toISOString() });
    }

    // GET /v1/workspace
    if (req.method === "GET" && route.length === 1 && route[0] === "workspace") {
      const auth = await authenticateFlowRequest(req, { requireScope: "workspace:read", route: "/v1/workspace" });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const { data: ws, error: wsErr } = await supabase.from("workspaces")
        .select("id, name, slug, owner_id, created_at, updated_at")
        .eq("id", workspaceId).maybeSingle();
      if (wsErr) return jsonResponse({ error: wsErr.message }, 500);
      if (!ws) return jsonResponse({ error: "Workspace não encontrado" }, 404);

      let ownerProfile = null;
      if (ws.owner_id) {
        const { data: profile } = await supabase.from("profiles")
          .select("id, full_name, email, slug, plan, is_suspended, embed_source, embed_company_id, embed_plan_tier, embed_plan_synced_at")
          .eq("id", ws.owner_id).maybeSingle();
        ownerProfile = profile || null;
      }
      return jsonResponse({ data: mapWorkspace(ws, ownerProfile) });
    }

    // GET /v1/instances
    if (req.method === "GET" && route.length === 1 && route[0] === "instances") {
      const auth = await authenticateFlowRequest(req, { requireScope: "instances:read", route: "/v1/instances" });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const { data, error } = await supabase.from("whatsapp_connections")
        .select("id, instance_name, name, status, settings, created_at, updated_at")
        .eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(200);
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data: (data || []).map(mapInstance) });
    }

    // GET /v1/instances/:id
    if (req.method === "GET" && route.length === 2 && route[0] === "instances") {
      const instanceId = route[1];
      const auth = await authenticateFlowRequest(req, { requireScope: "instances:read", route: `/v1/instances/${instanceId}` });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const { data, error } = await supabase.from("whatsapp_connections")
        .select("id, instance_name, name, status, settings, created_at, updated_at")
        .eq("workspace_id", workspaceId).eq("id", instanceId).maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: "Instância não encontrada" }, 404);
      return jsonResponse({ data: mapInstance(data) });
    }

    // GET /v1/bots (?all=1 inclui rascunhos)
    if (req.method === "GET" && route.length === 1 && route[0] === "bots") {
      const auth = await authenticateFlowRequest(req, { requireScope: "bots:read", route: "/v1/bots" });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const includeAll = url.searchParams.get("all") === "1";
      let query = supabase.from("chatbot_flows")
        .select("id, name, description, is_published, updated_at, created_at, public_id")
        .eq("workspace_id", workspaceId).order("updated_at", { ascending: false }).limit(200);
      if (!includeAll) query = query.eq("is_published", true);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data: (data || []).map((bot) => ({
        id: bot.id, public_id: bot.public_id ?? null, name: bot.name,
        description: bot.description ?? null, is_published: !!bot.is_published,
        status: bot.is_published ? "published" : "draft",
        created_at: bot.created_at, updated_at: bot.updated_at,
      })) });
    }

    // GET /v1/bots/:id
    if (req.method === "GET" && route.length === 2 && route[0] === "bots") {
      const botId = route[1];
      const auth = await authenticateFlowRequest(req, { requireScope: "bots:read", route: `/v1/bots/${botId}` });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const { data, error } = await supabase.from("chatbot_flows")
        .select("id, name, description, is_published, updated_at, created_at, public_id")
        .eq("workspace_id", workspaceId).eq("id", botId).maybeSingle();
      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: "Bot não encontrado" }, 404);
      return jsonResponse({ data: { ...data, status: data.is_published ? "published" : "draft" } });
    }

    // POST /v1/bots/:id/run
    if (req.method === "POST" && route.length === 3 && route[0] === "bots" && route[2] === "run") {
      const botId = route[1];
      const auth = await authenticateFlowRequest(req, { requireScope: "bots:run", route: `/v1/bots/${botId}/run` });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const { data: bot, error: botErr } = await supabase.from("chatbot_flows")
        .select("id").eq("workspace_id", workspaceId).eq("id", botId).maybeSingle();
      if (botErr) return jsonResponse({ error: botErr.message }, 500);
      if (!bot) return jsonResponse({ error: "Bot não encontrado" }, 404);

      let body = {};
      try { body = await req.json(); } catch {
        return jsonResponse({ error: "Body inválido (JSON esperado)" }, 400);
      }
      const contactId = typeof body.contact_id === "string" ? body.contact_id.trim() : "";
      const message = typeof body.message === "string" ? body.message : "";
      const channelId = typeof body.channel_id === "string" && body.channel_id.trim() ? body.channel_id.trim() : "api";
      const reset = body.reset === true;
      if (!contactId || contactId.length > 128) return jsonResponse({ error: "contact_id obrigatório (1..128 chars)" }, 400);
      if (message.length > 8000) return jsonResponse({ error: "message excede 8000 caracteres" }, 400);

      const { data: runResult, error: runErr } = await supabase.functions.invoke("chatbot-runtime", {
        body: { flow_id: botId, contact_id: contactId, message, channel_id: channelId, reset },
      });
      if (runErr) return jsonResponse({ error: runErr.message }, 502);
      return jsonResponse({ data: runResult });
    }

    // GET /v1/sessions?bot_id=&contact_id=
    if (req.method === "GET" && route.length === 1 && route[0] === "sessions") {
      const auth = await authenticateFlowRequest(req, { requireScope: "sessions:read", route: "/v1/sessions" });
      if (auth.error) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;
      const botId = url.searchParams.get("bot_id");
      const contactId = url.searchParams.get("contact_id");
      let query = supabase.from("conversation_sessions").select("*")
        .eq("workspace_id", workspaceId).order("last_interaction_at", { ascending: false }).limit(100);
      if (botId) query = query.eq("flow_id", botId);
      if (contactId) query = query.eq("contact_id", contactId);
      const { data, error } = await query;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }

    return jsonResponse({ error: "Rota não encontrada" }, 404);
  } catch (error) {
    console.error("[flow-api] erro não tratado:", error);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
