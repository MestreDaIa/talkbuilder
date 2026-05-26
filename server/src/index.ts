import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { handleWhatsAppWebhook } from "./whatsapp";
import { processRuntime } from "./runtime";

dotenv.config();

const app = express();
const port = process.env.PORT || 80;

// Configuração de CORS usando o pacote 'cors'
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Origin", "X-Requested-With", "Content-Type", "Accept", "Authorization"],
  credentials: true
}));


app.use(morgan("dev"));
app.use(express.json());

// Log de todas as requisições para depuração no servidor
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers));
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
app.post("/webhook/whatsapp", async (req, res) => {
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
  console.log(`Servidor rodando na porta ${port}`);
});
