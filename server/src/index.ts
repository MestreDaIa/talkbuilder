import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { supabase } from "./supabase.js";
import { handleWhatsAppWebhook } from "./whatsapp.js";
import { processRuntime } from "./runtime.js";
import { getWorkspaceCredentials, reprovisionWorkspace, waApi } from "./waService.js";
import { resolveChannelRoute, invalidateChannelRoute } from "./channelRoute.js";

import { createClient } from "@supabase/supabase-js";
import ws from "ws";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configuração de CORS robusta
const corsOptions = {
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  credentials: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// Middleware manual para garantir que OPTIONS nunca trave e logue preflights
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    console.log(`[CORS-PREFLIGHT] ${req.url}`);
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    return res.sendStatus(204);
  }
  next();
});

app.use(morgan("dev"));
// Captura body cru para verificação de HMAC do webhook do wa-service.
app.use(express.json({
  limit: "50mb",
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Middleware de Autenticação via API Key
const authenticateApiKey = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing or invalid Authorization header" });
  }

  const keyValue = authHeader.split(" ")[1];
  
  try {
    const { data, error } = await supabase
      .from("api_keys")
      .select("workspace_id, is_active")
      .eq("key_value", keyValue)
      .maybeSingle();

    if (error || !data) {
      return res.status(401).json({ error: "Invalid API Key" });
    }

    if (!data.is_active) {
      return res.status(403).json({ error: "API Key is disabled" });
    }

    // Injeta o workspace_id na requisição para uso posterior
    (req as any).workspaceId = data.workspace_id;
    
    // Atualiza o last_used_at de forma assíncrona
    supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("key_value", keyValue)
      .then(() => {});

    next();
  } catch (err) {
    console.error("API Key Auth Error:", err);
    res.status(500).json({ error: "Internal server error during authentication" });
  }
};

// Log de todas as requisições para depuração no servidor
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// =====================================================================
// Webhook Test Capture (n8n-style) — buffer compartilhado
// =====================================================================
type CapturedRequest = {
  receivedAt: string;
  method: string;
  headers: Record<string, any>;
  query: Record<string, any>;
  params: Record<string, any>;
  body: any;
};
// Fila de eventos por path (mais recentes no fim). Limite por path para não vazar memória.
const MAX_EVENTS_PER_PATH = 100;
const webhookCaptures = new Map<string, CapturedRequest[]>();

function pushCapture(path: string, captured: CapturedRequest) {
  const arr = webhookCaptures.get(path) || [];
  arr.push(captured);
  if (arr.length > MAX_EVENTS_PER_PATH) arr.splice(0, arr.length - MAX_EVENTS_PER_PATH);
  webhookCaptures.set(path, arr);
}

// Rota GET auxiliar para testar se o endpoint existe via navegador
app.get("/webhook/whatsapp", (req: Request, res: Response) => {
  res.json({ 
    message: "Webhook endpoint is active. Use POST to send data from Evolution API.",
    usage: "POST /webhook/whatsapp"
  });
});

// Endpoint para Webhook da Evolution API
// Usando :event? e curinga * para suportar o modo byEvents da Evolution API
// Mudamos para uma regex mais flexível para evitar 404 em sub-rotas
app.post("/webhook/whatsapp*", async (req: Request, res: Response) => {
  try {
    console.log(`[WEBHOOK] Recebido na rota: ${req.url}`);

    // Também grava no buffer de captura para o node Webhook (Listen for test event)
    // Assim eventos reais da Evolution aparecem no Output do editor.
    try {
      const sub = req.url.replace(/^\/webhook\//, "").split("?")[0].replace(/\/+$/, "");
      const captured: CapturedRequest = {
        receivedAt: new Date().toISOString(),
        method: req.method,
        headers: req.headers as Record<string, any>,
        query: req.query as Record<string, any>,
        params: {},
        body: req.body,
      };
      pushCapture(sub, captured);
      const base = sub.split("/")[0];
      if (base && base !== sub) pushCapture(base, captured);
    } catch (e) {
      console.warn("[WEBHOOK] Falha ao capturar payload:", e);
    }

    const signature = (req.headers["x-zailom-signature"] || req.headers["x-hub-signature-256"]) as string | undefined;
    const rawBody: Buffer | undefined = (req as any).rawBody;

    const result = await handleWhatsAppWebhook(
      req.body,
      req.query,
      { receivedAt: new Date().toISOString(), method: req.method, headers: req.headers, params: req.params },
      rawBody,
      signature
    );
    if ((result as any)?.error === "invalid_signature") return res.status(401).json(result);
    res.json(result);
  } catch (error: any) {
    console.error("Erro no webhook WhatsApp:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para o Runtime (Substitui a Edge Function)
app.post("/runtime", async (req: Request, res: Response) => {
  try {
    const result = await processRuntime(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Erro no runtime:", error);
    res.status(500).json({ error: error.message });
  }
});

// (CapturedRequest / webhookCaptures movidos para o topo do arquivo)

function extractPath(url: string, prefix: string) {
  const cleaned = url.replace(prefix, "").split("?")[0] || "";
  return cleaned.replace(/^\/+/, "").replace(/\/+$/, "");
}

app.all("/webhook-test/*", (req: Request, res: Response) => {
  const path = extractPath(req.path, "/webhook-test");
  const captured: CapturedRequest = {
    receivedAt: new Date().toISOString(),
    method: req.method,
    headers: req.headers as Record<string, any>,
    query: req.query as Record<string, any>,
    params: {},
    body: req.body,
  };
  pushCapture(path, captured);
  console.log(`[WEBHOOK-TEST] Capturado em "${path}"`);
  res.json({
    status: "ok",
    message: "Test event received and captured. Open the Webhook node in the editor to inspect it.",
    path,
    receivedAt: captured.receivedAt,
  });
});

// Endpoint de Produção (Este seria o que o chatbot usa em execução real)
app.all("/chatbot-webhook/*", (req: Request, res: Response) => {
  const path = extractPath(req.path, "/chatbot-webhook");
  console.log(`[WEBHOOK-PROD] Recebido em "${path}"`);
  res.json({ status: "ok", message: "Production webhook received" });
});

// Retorna a fila de eventos capturados (mais recentes no fim). Use ?since=N para incremental.
app.get("/webhook-capture/:path(*)", (req: Request, res: Response) => {
  const path = (req.params.path || "").replace(/^\/+/, "").replace(/\/+$/, "");
  const arr = webhookCaptures.get(path) || [];
  const since = Math.max(0, Number(req.query.since) || 0);
  const events = arr.slice(since);
  if (!arr.length) {
    return res.json({ 
      path, 
      total: 0, 
      since, 
      events: [],
      message: "No events captured yet for this path" 
    });
  }
  res.json({
    path,
    total: arr.length,
    since,
    events,
    // backwards-compat: campo legado com o último evento
    receivedAt: arr[arr.length - 1].receivedAt,
    method: arr[arr.length - 1].method,
    headers: arr[arr.length - 1].headers,
    query: arr[arr.length - 1].query,
    params: arr[arr.length - 1].params,
    body: arr[arr.length - 1].body,
  });
});

app.delete("/webhook-capture/:path(*)", (req: Request, res: Response) => {
  const path = (req.params.path || "").replace(/^\/+/, "").replace(/\/+$/, "");
  webhookCaptures.delete(path);
  res.json({ status: "ok" });
});



// =====================================================================
// API Externa para integrações (ex: Zailom Booking)
// =====================================================================

// Executar um fluxo via API Externa
app.post("/api/v1/flow/execute", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { flowId, contactId, channel, payload } = req.body;
    
    if (!flowId) return res.status(400).json({ error: "Missing flowId" });
    
    // Busca o fluxo para garantir que pertence ao workspace da API Key
    const { data: flow, error: flowError } = await supabase
      .from("flows")
      .select("*")
      .eq("id", flowId)
      .eq("workspace_id", (req as any).workspaceId)
      .maybeSingle();

    if (flowError || !flow) {
      return res.status(404).json({ error: "Flow not found or access denied" });
    }

    const result = await processRuntime({
      flow,
      contact_id: contactId || "api-external",
      channel: channel || "api",
      payload: payload || {},
      action: "start"
    });

    res.json(result);
  } catch (error: any) {
    console.error("Erro na execução via API externa:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req: Request, res: Response) => {
  res.json({ 
    status: "ok", 
    message: "Flow Builder Server is running",
    port: port,
    timestamp: new Date().toISOString()
  });
});

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// =====================================================================
// /api/wa/* — Proxy autenticado do frontend do Flow -> wa-service
// Substitui completamente as chamadas diretas à Evolution API que existiam
// no antigo src/services/evolutionApi.ts.
//
// Autenticação: Authorization: Bearer <supabase access token do usuário>
// Header extra:  x-workspace-id: <workspace UUID>
// O server valida o JWT, confere se o usuário tem acesso ao workspace,
// resolve/provisiona a zwa_live_ do workspace e chama wa.zailom.com.
// =====================================================================
// Chave anon usada para validar JWT de usuário e para o proxy das edge functions.
// Aceita variações de nome para não quebrar quando o .env é substituído por
// variáveis de ambiente no Portainer.
export const SUPABASE_ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_EXTERNAL_SUPABASE_ANON_KEY ||
  "";

const SUPABASE_URL_ENV =
  process.env.SUPABASE_URL ||
  process.env.VITE_EXTERNAL_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "";

if (!SUPABASE_URL_ENV || !SUPABASE_ANON) {
  console.error(
    "[boot] AVISO: SUPABASE_URL e/ou SUPABASE_ANON_KEY ausentes. " +
      "Rotas autenticadas (/api/wa/*) e o proxy /functions/v1 vão falhar até configurar."
  );
}

const authSupabase = createClient(
  SUPABASE_URL_ENV || "https://placeholder.supabase.co",
  SUPABASE_ANON || process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-key",
  {
    auth: { persistSession: false },
    realtime: { transport: ws as any },
  }
);


async function requireWorkspace(req: Request, res: Response): Promise<{ workspaceId: string; userId: string } | null> {
  const auth = req.headers.authorization;
  const workspaceId = (req.headers["x-workspace-id"] as string) || "";
  if (!auth?.startsWith("Bearer ")) { res.status(401).json({ error: "missing_auth" }); return null; }
  if (!workspaceId) { res.status(400).json({ error: "missing_workspace" }); return null; }

  const token = auth.slice(7);
  const { data: userData, error: userErr } = await authSupabase.auth.getUser(token);
  if (userErr || !userData?.user) { res.status(401).json({ error: "invalid_token" }); return null; }
  const userId = userData.user.id;

  // Autoriza: workspaceId == userId (modelo 1-para-1), owner do workspace,
  // ou profile.workspace_id.
  let allowed = workspaceId === userId;
  if (!allowed) {
    const { data: ws } = await supabase
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", workspaceId)
      .maybeSingle();
    if (ws?.owner_id === userId) allowed = true;
  }
  if (!allowed) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, workspace_id")
      .eq("id", userId)
      .maybeSingle();
    if ((prof as any)?.workspace_id === workspaceId) allowed = true;
  }
  if (!allowed) { res.status(403).json({ error: "forbidden" }); return null; }
  return { workspaceId, userId };
}

function waRoute(handler: (req: Request, res: Response, api: ReturnType<typeof waApi>) => Promise<void>) {
  return async (req: Request, res: Response) => {
    const ctx = await requireWorkspace(req, res);
    if (!ctx) return;
    try {
      const creds = await getWorkspaceCredentials(ctx.workspaceId);
      const api = waApi(creds.apiKey);
      await handler(req, res, api);
    } catch (err: any) {
      console.error("[/api/wa] erro:", err?.message || err);
      res.status(err?.status || 500).json({ error: err?.message || "wa_service_error", details: err?.body });
    }
  };
}

// Re-provisiona o vínculo com o wa-service (migra para o tenant compartilhado do Booking)
app.post("/api/wa/reprovision", async (req: Request, res: Response) => {
  const ctx = await requireWorkspace(req, res);
  if (!ctx) return;
  try {
    const creds = await reprovisionWorkspace(ctx.workspaceId);
    invalidateChannelRoute();
    res.json({ ok: true, tenant_id: creds.tenantId });
  } catch (err: any) {
    console.error("[/api/wa/reprovision] erro:", err?.message || err);
    res.status(err?.status || 500).json({ error: err?.message || "reprovision_failed" });
  }
});

// Instâncias
app.get("/api/wa/instances", waRoute(async (_req, res, api) => { res.json(await api.listInstances()); }));

app.post("/api/wa/instances", waRoute(async (req, res, api) => {
  const name = String(req.body?.name || "").trim();
  if (!name) { res.status(400).json({ error: "missing_name" }); return; }
  res.json(await api.createInstance(name));
}));
app.get("/api/wa/instances/:name", waRoute(async (req, res, api) => { res.json(await api.getInstance(req.params.name)); }));
app.delete("/api/wa/instances/:name", waRoute(async (req, res, api) => { res.json(await api.deleteInstance(req.params.name)); }));
app.post("/api/wa/instances/:name/logout", waRoute(async (req, res, api) => { res.json(await api.logoutInstance(req.params.name)); }));
app.get("/api/wa/instances/:name/qr", waRoute(async (req, res, api) => { res.json(await api.getQrCode(req.params.name)); }));
app.get("/api/wa/instances/:name/status", waRoute(async (req, res, api) => { res.json(await api.getStatus(req.params.name)); }));

// Webhook / settings / bot
app.get("/api/wa/instances/:name/webhook", waRoute(async (req, res, api) => { res.json(await api.getWebhook(req.params.name)); }));
app.post("/api/wa/instances/:name/webhook", waRoute(async (req, res, api) => {
  const out = await api.setWebhook(req.params.name, req.body);
  invalidateChannelRoute(req.params.name);
  res.json(out);
}));
// Diagnóstico: qual produto é dono do canal desta instância (flow | direct | none | unknown)
app.get("/api/wa/instances/:name/route", waRoute(async (req, res) => {
  const info = await resolveChannelRoute(req.params.name);
  res.json({ instance: req.params.name, ...info });
}));

app.get("/api/wa/instances/:name/settings", waRoute(async (req, res, api) => { res.json(await api.getSettings(req.params.name)); }));
app.post("/api/wa/instances/:name/settings", waRoute(async (req, res, api) => { res.json(await api.setSettings(req.params.name, req.body)); }));
app.get("/api/wa/instances/:name/bot", waRoute(async (req, res, api) => { res.json(await api.getBot(req.params.name)); }));
app.post("/api/wa/instances/:name/bot", waRoute(async (req, res, api) => { res.json(await api.setBot(req.params.name, req.body)); }));
app.delete("/api/wa/instances/:name/bot", waRoute(async (req, res, api) => { res.json(await api.deleteBot(req.params.name)); }));

// Envio (raramente usado direto do frontend, mas útil pra testes)
app.post("/api/wa/messages/text", waRoute(async (req, res, api) => {
  const { instance, to, text } = req.body || {};
  res.json(await api.sendText(instance, to, text));
}));
app.post("/api/wa/messages/buttons", waRoute(async (req, res, api) => {
  const { instance, to, text, buttons } = req.body || {};
  res.json(await api.sendButtons(instance, to, text, buttons || []));
}));

// =====================================================================
// Proxy para Edge Functions do Supabase
// Encaminha /functions/v1/* -> ${SUPABASE_URL}/functions/v1/*
// =====================================================================
app.use("/functions/v1", async (req: Request, res: Response) => {
  const target = SUPABASE_URL_ENV;
  if (!target) {
    return res.status(500).json({ error: "SUPABASE_URL not configured on server" });
  }
  try {
    const upstreamUrl = `${target.replace(/\/$/, "")}/functions/v1${req.url}`;

    // Copia headers relevantes; remove hop-by-hop e host
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(req.headers)) {
      if (!v) continue;
      const key = k.toLowerCase();
      if (["host", "connection", "content-length", "accept-encoding"].includes(key)) continue;
      headers[k] = Array.isArray(v) ? v.join(", ") : String(v);
    }
    // Garante apikey (algumas edge functions exigem) usando anon do próprio servidor
    if (!headers["apikey"] && SUPABASE_ANON) {
      headers["apikey"] = SUPABASE_ANON;
    }


    const method = req.method.toUpperCase();
    const hasBody = !["GET", "HEAD", "OPTIONS"].includes(method);
    let body: string | undefined;
    if (hasBody) {
      body = typeof req.body === "string" ? req.body : JSON.stringify(req.body ?? {});
      if (!headers["content-type"]) headers["content-type"] = "application/json";
    }

    const upstream = await fetch(upstreamUrl, { method, headers, body });
    const buf = Buffer.from(await upstream.arrayBuffer());

    upstream.headers.forEach((value, key) => {
      const lk = key.toLowerCase();
      if (["content-encoding", "transfer-encoding", "connection", "content-length"].includes(lk)) return;
      res.setHeader(key, value);
    });
    res.status(upstream.status).send(buf);
  } catch (err: any) {
    console.error("[functions-proxy] error:", err?.message || err);
    res.status(502).json({ error: "Bad Gateway", message: err?.message || "proxy_failed" });
  }
});

// Rota de captura para 404 (garante que retorne JSON e não HTML)
app.use((req: Request, res: Response) => {
  console.warn(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({
    error: "Not Found",
    message: `A rota ${req.method} ${req.url} não existe neste servidor.`
  });
});


app.listen(Number(port), "0.0.0.0", () => {
  console.log(`[${new Date().toISOString()}] Servidor inicializado com sucesso!`);
  console.log(`[${new Date().toISOString()}] Ouvindo em 0.0.0.0:${port}`);
  console.log(`[${new Date().toISOString()}] Modo: ${process.env.NODE_ENV || 'development'}`);
});
