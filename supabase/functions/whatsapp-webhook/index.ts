// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configurações da Evolution API (Prioriza variáveis de ambiente)
const EVO_BASE_URL = Deno.env.get("EVO_BASE_URL") ?? "https://evo.zailom.com";
const EVO_GLOBAL_KEY = Deno.env.get("EVO_GLOBAL_KEY") ?? "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";


Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log(`[whatsapp-webhook] Evento recebido: ${body.event} da instância: ${body.instance}`);

    // Alguns servidores mandam em lowercase ou prefixado
    const isUpsert = body.event === "MESSAGES_UPSERT" || body.event === "messages.upsert";

    if (!isUpsert) {
      console.log("[whatsapp-webhook] Evento ignorado (não é MESSAGES_UPSERT)");
      return new Response(JSON.stringify({ status: "ignored_event", event: body.event }), { headers: { "Content-Type": "application/json" } });
    }

    const messageData = body.data;
    if (!messageData || !messageData.key) {
      console.error("[whatsapp-webhook] Payload inválido: falta 'data' ou 'key'");
      return new Response(JSON.stringify({ error: "invalid_payload" }), { status: 400 });
    }

    const instanceName = body.instance;
    const remoteJid = messageData.key.remoteJid;
    const isGroup = remoteJid.endsWith("@g.us");
    const fromMe = messageData.key.fromMe;

    if (fromMe) {
      console.log("[whatsapp-webhook] Mensagem ignorada (enviada pelo próprio bot)");
      return new Response(JSON.stringify({ status: "ignored_self_message" }), { headers: { "Content-Type": "application/json" } });
    }

    if (isGroup) {
      console.log("[whatsapp-webhook] Mensagem ignorada (grupo)");
      return new Response(JSON.stringify({ status: "ignored_group_message" }), { headers: { "Content-Type": "application/json" } });
    }

    // Extrair texto da mensagem
    const text = messageData.message?.conversation || 
                 messageData.message?.extendedTextMessage?.text || 
                 messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                 messageData.message?.templateButtonReplyMessage?.selectedId ||
                 "";

    console.log(`[whatsapp-webhook] Mensagem de ${remoteJid}: "${text}"`);

    if (!text && !messageData.message?.buttonsResponseMessage) {
      console.log("[whatsapp-webhook] Mensagem sem texto, ignorando.");
      return new Response(JSON.stringify({ status: "no_text" }), { headers: { "Content-Type": "application/json" } });
    }

    // Inicializar Supabase Client (usando credenciais do projeto externo fixo para garantir)
    const supabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "https://fwoescubnnagdvwasbjl.supabase.co",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Buscar Bot vinculado a esta instância
    const { data: binding, error: bindingError } = await supabase
      .from("whatsapp_bindings")
      .select("bot_public_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (bindingError) {
      console.error("[whatsapp-webhook] Erro ao buscar vínculo no banco:", bindingError);
      return new Response(JSON.stringify({ error: "db_error" }), { status: 500 });
    }

    if (!binding) {
      console.error(`[whatsapp-webhook] NENHUM VÍNCULO ENCONTRADO para a instância: ${instanceName}. Certifique-se de clicar em 'Vincular este bot' no painel.`);
      return new Response(JSON.stringify({ status: "no_binding", instance: instanceName }), { headers: { "Content-Type": "application/json" } });
    }

    console.log(`[whatsapp-webhook] Bot identificado: ${binding.bot_public_id}. Chamando runtime...`);

    // 2. Chamar Chatbot Runtime
    const runtimeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatbot-runtime`;
    const runtimeResponse = await fetch(runtimeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
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

    if (!runtimeResponse.ok) {
      const errorText = await runtimeResponse.text();
      console.error("[whatsapp-webhook] Erro no Chatbot Runtime:", errorText);
      return new Response(JSON.stringify({ status: "runtime_error", details: errorText }), { status: 500 });
    }

    const runtimeData = await runtimeResponse.json();
    const responseMessages = runtimeData.messages || [];
    console.log(`[whatsapp-webhook] Runtime respondeu com ${responseMessages.length} mensagens.`);

    // 3. Enviar mensagens de volta via Evolution API
    for (const msg of responseMessages) {
      const msgText = msg.content || msg.text;
      if (!msgText) continue;


      const buttons = runtimeData.buttons || [];
      const hasButtons = buttons.length > 0;

      const endpoint = hasButtons ? "message/sendButtons" : "message/sendText";
      const payload = hasButtons 
        ? {
            number: remoteJid,
            title: "Escolha uma opção:",
            description: msg.text,
            footer: "Bot",
            buttons: buttons.map(b => ({
              buttonId: b.id,
              buttonText: { displayText: b.label },
              type: 1
            }))
          }
        : {
            number: remoteJid,
            text: msg.text
          };

      console.log(`[whatsapp-webhook] Enviando resposta via Evolution (${endpoint})...`);
      const sendResponse = await fetch(`${EVO_BASE_URL}/${endpoint}/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVO_GLOBAL_KEY
        },
        body: JSON.stringify(payload)
      });

      if (!sendResponse.ok) {
        const sendError = await sendResponse.text();
        console.error("[whatsapp-webhook] Erro ao enviar mensagem via Evolution:", sendError);
      } else {
        console.log("[whatsapp-webhook] Resposta enviada com sucesso!");
      }
    }

    return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[whatsapp-webhook] Erro fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});