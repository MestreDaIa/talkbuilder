import express from "express";
import cors from "cors";
import morgan from "morgan";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import { handleWhatsAppWebhook } from "./whatsapp";
import { processRuntime } from "./runtime";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan("dev"));
app.use(express.json());

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
  res.json({ status: "ok", message: "Flow Builder Server is running" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});
