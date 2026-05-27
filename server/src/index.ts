import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
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
app.use((req, res, next) => {
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
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});


// Rota GET auxiliar para testar se o endpoint existe via navegador
app.get("/webhook/whatsapp", (req, res) => {
  res.json({ 
    message: "Webhook endpoint is active. Use POST to send data from Evolution API.",
    usage: "POST /webhook/whatsapp"
  });
});

// Endpoint para Webhook da Evolution API
// Usando :event? e curinga * para suportar o modo byEvents da Evolution API
app.post("/webhook/whatsapp/:event?*", async (req, res) => {
  try {
    const result = await handleWhatsAppWebhook(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Erro no webhook WhatsApp:", error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para o Runtime (Substitui a Edge Function)
app.post("/runtime", async (req, res) => {
  try {
    const result = await processRuntime(req.body);
    res.json(result);
  } catch (error: any) {
    console.error("Erro no runtime:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    message: "Flow Builder Server is running",
    port: port,
    timestamp: new Date().toISOString()
  });
});


app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Rota de captura para 404 (garante que retorne JSON e não HTML)
app.use((req, res) => {
  console.warn(`404 Not Found: ${req.method} ${req.url}`);
  res.status(404).json({ 
    error: "Not Found", 
    message: `A rota ${req.method} ${req.url} não existe neste servidor.` 
  });
});

app.listen(port, () => {
  console.log(`[${new Date().toISOString()}] Servidor inicializado com sucesso!`);
  console.log(`[${new Date().toISOString()}] Ouvindo na porta ${port}`);
  console.log(`[${new Date().toISOString()}] Modo: ${process.env.NODE_ENV || 'development'}`);
});
