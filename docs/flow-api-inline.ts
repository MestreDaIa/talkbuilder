// ============================================================
// Zailom Flow — Public API (versão INLINE para colar direto no
// editor web do Supabase → Edge Functions → New function.
//
// Nome da function: flow-api
// Verify JWT: DESATIVADO (autenticação é feita via Flow API Key)
//
// Basta:
//   1. Criar function chamada `flow-api` no dashboard.
//   2. Colar ESTE arquivo inteiro em index.ts.
//   3. Salvar / Deploy.
//
// Endpoints (mesma spec da versão modular):
//   GET  /flow-api/v1/bots
//   GET  /flow-api/v1/bots/:botId
//   POST /flow-api/v1/bots/:botId/run
//   GET  /flow-api/v1/sessions?bot_id=&contact_id=
// ============================================================
// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";

// ---------- CORS ----------
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-flow-api-key, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ---------- Supabase service client ----------
let cachedClient = null;
function getServiceClient() {
  if (cachedClient) return cachedClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
  }
  cachedClient = createClient(url, key, { auth: { persistSession: false } });
  return cachedClient;
}

// ---------- Extração da API Key ----------
function extractKey(req) {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (auth) {
    const m = /^Bearer\s+(zf_live_[a-f0-9]{64})$/.exec(auth.trim());
    if (m) return m[1];
  }
  const alt = req.headers.get("x-flow-api-key");
  if (alt && /^zf_live_[a-f0-9]{64}$/.test(alt.trim())) return alt.trim();
  return null;
}

function clientIp(req) {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

// ---------- Autenticação via Flow API Key ----------
async function authenticateFlowRequest(req, opts) {
  const supabase = getServiceClient();
  const ip = clientIp(req);
  const userAgent = req.headers.get("user-agent");
  const route = opts.route || new URL(req.url).pathname;

  const plaintext = extractKey(req);
  if (!plaintext) {
    return {
      error: {
        status: 401,
        body: { error: "Chave de API ausente ou mal formatada", code: "missing_key" },
      },
    };
  }

  const { data, error } = await supabase.rpc("validate_flow_api_key", {
    _plaintext: plaintext,
  });

  if (error || !data || !Array.isArray(data) || data.length === 0) {
    return {
      error: {
        status: 401,
        body: { error: "Falha ao validar a chave", code: "validation_error" },
      },
    };
  }

  const row = data[0];

  if (!row.is_valid) {
    await supabase.from("flow_api_key_audit").insert({
      key_id: row.key_id,
      workspace_id: row.workspace_id,
      event: "auth_failed",
      ip,
      user_agent: userAgent,
      route,
      metadata: { reason: row.reason },
    });
    return {
      error: {
        status: 401,
        body: { error: `Chave inválida (${row.reason})`, code: row.reason },
      },
    };
  }

  const scopes = row.scopes || [];
  if (!scopes.includes(opts.requireScope)) {
    await supabase.from("flow_api_key_audit").insert({
      key_id: row.key_id,
      workspace_id: row.workspace_id,
      event: "auth_failed",
      ip,
      user_agent: userAgent,
      route,
      metadata: {
        reason: "insufficient_scope",
        required: opts.requireScope,
        granted: scopes,
      },
    });
    return {
      error: {
        status: 403,
        body: {
          error: `Chave sem escopo necessário: ${opts.requireScope}`,
          code: "insufficient_scope",
        },
      },
    };
  }

  await Promise.all([
    supabase.rpc("touch_flow_api_key", { _key_id: row.key_id, _ip: ip }),
    supabase.from("flow_api_key_audit").insert({
      key_id: row.key_id,
      workspace_id: row.workspace_id,
      event: "used",
      scope_used: opts.requireScope,
      ip,
      user_agent: userAgent,
      route,
    }),
  ]);

  return {
    ctx: {
      keyId: row.key_id,
      workspaceId: row.workspace_id,
      scopes,
      ip,
      userAgent,
      supabase,
    },
  };
}

// ============================================================
// HANDLER
// ============================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const vIdx = parts.indexOf("v1");
  const route = vIdx >= 0 ? parts.slice(vIdx + 1) : parts;

  try {
    // ---- GET /v1/bots ----
    if (req.method === "GET" && route.length === 1 && route[0] === "bots") {
      const auth = await authenticateFlowRequest(req, {
        requireScope: "bots:read",
        route: "/v1/bots",
      });
      if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);

      const { supabase, workspaceId } = auth.ctx;
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("id, name, description, is_published, updated_at, created_at")
        .eq("workspace_id", workspaceId)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }

    // ---- GET /v1/bots/:id ----
    if (req.method === "GET" && route.length === 2 && route[0] === "bots") {
      const botId = route[1];
      const auth = await authenticateFlowRequest(req, {
        requireScope: "bots:read",
        route: `/v1/bots/${botId}`,
      });
      if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);

      const { supabase, workspaceId } = auth.ctx;
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("id, name, description, is_published, updated_at, created_at, public_id")
        .eq("workspace_id", workspaceId)
        .eq("id", botId)
        .maybeSingle();

      if (error) return jsonResponse({ error: error.message }, 500);
      if (!data) return jsonResponse({ error: "Bot não encontrado" }, 404);
      return jsonResponse({ data });
    }

    // ---- POST /v1/bots/:id/run ----
    if (
      req.method === "POST" &&
      route.length === 3 &&
      route[0] === "bots" &&
      route[2] === "run"
    ) {
      const botId = route[1];
      const auth = await authenticateFlowRequest(req, {
        requireScope: "bots:run",
        route: `/v1/bots/${botId}/run`,
      });
      if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;

      const { data: bot, error: botErr } = await supabase
        .from("chatbot_flows")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("id", botId)
        .maybeSingle();
      if (botErr) return jsonResponse({ error: botErr.message }, 500);
      if (!bot) return jsonResponse({ error: "Bot não encontrado" }, 404);

      let body = {};
      try {
        body = await req.json();
      } catch {
        return jsonResponse({ error: "Body inválido (JSON esperado)" }, 400);
      }
      const contactId =
        typeof body.contact_id === "string" ? body.contact_id.trim() : "";
      const message = typeof body.message === "string" ? body.message : "";
      const channelId =
        typeof body.channel_id === "string" && body.channel_id.trim()
          ? body.channel_id.trim()
          : "api";
      const reset = body.reset === true;

      if (!contactId || contactId.length > 128) {
        return jsonResponse(
          { error: "contact_id obrigatório (1..128 chars)" },
          400
        );
      }
      if (message.length > 8000) {
        return jsonResponse({ error: "message excede 8000 caracteres" }, 400);
      }

      const { data: runResult, error: runErr } = await supabase.functions.invoke(
        "chatbot-runtime",
        {
          body: {
            flow_id: botId,
            contact_id: contactId,
            message,
            channel_id: channelId,
            reset,
          },
        }
      );
      if (runErr) return jsonResponse({ error: runErr.message }, 502);
      return jsonResponse({ data: runResult });
    }

    // ---- GET /v1/sessions ----
    if (req.method === "GET" && route.length === 1 && route[0] === "sessions") {
      const auth = await authenticateFlowRequest(req, {
        requireScope: "sessions:read",
        route: "/v1/sessions",
      });
      if ("error" in auth) return jsonResponse(auth.error.body, auth.error.status);
      const { supabase, workspaceId } = auth.ctx;

      const botId = url.searchParams.get("bot_id");
      const contactId = url.searchParams.get("contact_id");
      let q = supabase
        .from("conversation_sessions")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("last_interaction_at", { ascending: false })
        .limit(100);
      if (botId) q = q.eq("flow_id", botId);
      if (contactId) q = q.eq("contact_id", contactId);

      const { data, error } = await q;
      if (error) return jsonResponse({ error: error.message }, 500);
      return jsonResponse({ data });
    }

    return jsonResponse({ error: "Rota não encontrada" }, 404);
  } catch (e) {
    console.error("[flow-api] erro não tratado:", e);
    return jsonResponse({ error: "Erro interno" }, 500);
  }
});
