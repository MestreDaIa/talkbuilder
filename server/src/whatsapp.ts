import { supabase } from "./supabase.js";
import { processRuntime } from "./runtime.js";
import { evolutionApi } from "./evolution.js";

export async function handleWhatsAppWebhook(payload: any) {
  console.log("Recebendo webhook WhatsApp:", JSON.stringify(payload, null, 2));
  
  // Suporte a ambos formatos: com ou sem o wrapper de evento da Evolution API
  const eventName = payload.event || payload.eventType || "";
  const isUpsert = eventName === "MESSAGES_UPSERT" || eventName === "messages.upsert" || (!eventName && payload.data?.key);
  
  if (!isUpsert && eventName) {
    console.log("Evento ignorado:", eventName);
    return { status: "ignored_event", event: eventName };
  }

  // Se byEvents estiver false, a Evolution manda o objeto direto no payload.
  // Se estiver true, manda dentro de payload.data.
  const messageData = payload.data || (payload.key ? payload : null);
  if (!messageData?.key) {
    console.error("Payload inválido: faltando messageData.key");
    return { error: "invalid_payload" };
  }

  const instanceName = payload.instance;
  const remoteJid = messageData.key.remoteJid;
  const fromMe = messageData.key.fromMe;

  console.log(`Mensagem de ${remoteJid} na instância ${instanceName}. FromMe: ${fromMe}`);

  if (fromMe || remoteJid.endsWith("@g.us")) {
    console.log("Mensagem ignorada (enviada por mim ou grupo)");
    return { status: "ignored" };
  }

  const text = messageData.message?.conversation || 
               messageData.message?.extendedTextMessage?.text || 
               messageData.message?.buttonsResponseMessage?.selectedButtonId ||
               messageData.message?.templateButtonReplyMessage?.selectedId ||
               "";

  if (!text && !messageData.message?.buttonsResponseMessage) {
    return { status: "no_text" };
  }

  // 1. Identify Bot
  const { data: binding } = await supabase
    .from("whatsapp_bindings")
    .select("bot_public_id")
    .eq("instance_name", instanceName)
    .maybeSingle();

  if (!binding) {
    console.error(`Binding não encontrado para a instância: ${instanceName}`);
    return { error: "binding_not_found" };
  }
  
  console.log(`Flow ID encontrado: ${binding.bot_public_id}`);

  // 2. Process via Runtime
  const runtimeResult = await processRuntime({
    action: "message",
    flow_id: binding.bot_public_id,
    contact_id: remoteJid,
    channel: "whatsapp",
    payload: {
      message: text,
      button_id: messageData.message?.buttonsResponseMessage?.selectedButtonId || messageData.message?.templateButtonReplyMessage?.selectedId
    }
  });

  // 3. Send Responses
  for (const msg of runtimeResult.messages) {
    if (!msg.content) continue;
    if (runtimeResult.buttons?.length > 0) {
      await evolutionApi.sendButtons(instanceName, remoteJid, msg.content, runtimeResult.buttons);
    } else {
      await evolutionApi.sendText(instanceName, remoteJid, msg.content);
    }
  }

  return { status: "success" };
}
