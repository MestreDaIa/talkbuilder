import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
import { supabase } from "./supabase.js";
import { handleWhatsAppWebhook } from "./whatsapp.js";
import { processRuntime } from "./runtime.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 80;

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
app.use(express.json({ limit: "50mb" }));
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

    const result = await handleWhatsAppWebhook(req.body, req.query, {
      receivedAt: new Date().toISOString(),
      method: req.method,
      headers: req.headers,
      params: req.params,
    });
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
// Proxy para Edge Functions do Supabase
// Encaminha /functions/v1/* -> ${SUPABASE_URL}/functions/v1/*
// Permite que o domínio público (ex: api-flowbuilder.zailom.com) sirva
// a API pública sem expor o domínio *.supabase.co ao cliente.
// =====================================================================
app.use("/functions/v1", async (req: Request, res: Response) => {
  const target = process.env.SUPABASE_URL;
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
    if (!headers["apikey"] && process.env.SUPABASE_ANON_KEY) {
      headers["apikey"] = process.env.SUPABASE_ANON_KEY;
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
