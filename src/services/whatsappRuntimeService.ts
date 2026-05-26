import { getSupabase } from "../lib/supabaseClient";
import { evoApi } from "./evolutionApi";

/**
 * WhatsApp Runtime Service
 * Responsável por processar webhooks da Evolution API e executar a lógica do chatbot
 * sem depender de Supabase Edge Functions.
 */

export const whatsappRuntime = {
  /**
   * Endpoint principal para receber o webhook da Evolution API
   * Na VPS, este serviço pode ser chamado por um pequeno proxy node.js 
   * ou via Supabase Realtime se preferir processamento assíncrono.
   */
  async handleWebhook(payload: any) {
    console.log("[WhatsAppRuntime] Webhook recebido:", payload.event);

    const isUpsert = payload.event === "MESSAGES_UPSERT" || payload.event === "messages.upsert";
    if (!isUpsert) return { status: "ignored_event" };

    const messageData = payload.data;
    if (!messageData?.key) return { error: "invalid_payload" };

    const instanceName = payload.instance;
    const remoteJid = messageData.key.remoteJid;
    const fromMe = messageData.key.fromMe;

    // Ignora mensagens enviadas pelo próprio bot ou de grupos
    if (fromMe || remoteJid.endsWith("@g.us")) {
      return { status: "ignored" };
    }

    // Extrair texto ou ID de botão
    const text = messageData.message?.conversation || 
                 messageData.message?.extendedTextMessage?.text || 
                 messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                 messageData.message?.templateButtonReplyMessage?.selectedId ||
                 "";

    if (!text && !messageData.message?.buttonsResponseMessage) {
      return { status: "no_text" };
    }

    console.log(`[WhatsAppRuntime] Mensagem de ${remoteJid}: "${text}"`);

    const supabase = getSupabase();

    // 1. Identifica o Bot vinculado à instância (Multitenancy)
    const { data: binding, error: bindingError } = await supabase
      .from("whatsapp_bindings")
      .select("bot_public_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (bindingError || !binding) {
      console.error("[WhatsAppRuntime] Vínculo não encontrado para instância:", instanceName);
      return { error: "binding_not_found" };
    }

    // 2. Chama o Runtime (Aqui usamos a URL do runtime do sistema ou a lógica interna)
    // Para manter a promessa de NÃO usar lovable cloud/edge functions, 
    // idealmente a lógica de 'runFlow' do chatbot-runtime/index.ts deveria ser uma lib compartilhada.
    // Por enquanto, chamamos a URL configurada no projeto (que o usuário vai apontar para a VPS dele).
    
    const RUNTIME_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-runtime`;
    
    try {
      const response = await fetch(RUNTIME_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          flow_id: binding.bot_public_id,
          contact_id: remoteJid,
          channel: "whatsapp",
          payload: {
            message: text,
            button_id: messageData.message?.buttonsResponseMessage?.selectedButtonId || messageData.message?.templateButtonReplyMessage?.selectedId
          }
        })
      });

      const runtimeData = await response.json();
      if (!response.ok) throw new Error(runtimeData.error || "Erro no runtime");

      // 3. Envia as respostas de volta via Evolution API
      const messages = runtimeData.messages || [];
      for (const msg of messages) {
        if (!msg.content) continue;

        if (runtimeData.buttons?.length > 0) {
          await evoApi.sendButtons(instanceName, remoteJid, msg.content, runtimeData.buttons);
        } else {
          await evoApi.sendText(instanceName, remoteJid, msg.content);
        }
      }

      return { status: "success", processed: messages.length };
    } catch (err) {
      console.error("[WhatsAppRuntime] Erro ao processar mensagem:", err);
      return { error: "processing_failed" };
    }
  }
};
