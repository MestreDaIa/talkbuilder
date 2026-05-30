import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import dotenv from "dotenv";
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
app.use(express.json());

// Log de todas as requisições para depuração no servidor
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  // console.log('Headers:', JSON.stringify(req.headers));
  // if (req.body && Object.keys(req.body).length > 0) {
  //   console.log('Body:', JSON.stringify(req.body, null, 2));
  // }
  next();
});

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
      webhookCaptures.set(sub, captured);
      const base = sub.split("/")[0];
      if (base && base !== sub) webhookCaptures.set(base, captured);
    } catch (e) {
      console.warn("[WEBHOOK] Falha ao capturar payload:", e);
    }

    const result = await handleWhatsAppWebhook(req.body, req.query);
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
  webhookCaptures.set(path, captured);
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
  
  // Aqui no futuro integraremos com o processamento do fluxo do chatbot
  // Por enquanto apenas respondemos OK
  res.json({ status: "ok", message: "Production webhook received" });
});

app.get("/webhook-capture/:path(*)", (req: Request, res: Response) => {
  const path = (req.params.path || "").replace(/^\/+/, "").replace(/\/+$/, "");
  const captured = webhookCaptures.get(path);
  if (!captured) {
    return res.status(404).json({ error: "no_capture", path });
  }
  res.json(captured);
});

app.delete("/webhook-capture/:path(*)", (req: Request, res: Response) => {
  const path = (req.params.path || "").replace(/^\/+/, "").replace(/\/+$/, "");
  webhookCaptures.delete(path);
  res.json({ status: "ok" });
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
