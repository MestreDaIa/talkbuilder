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
    console.log(`[whatsapp-webhook] Evento recebido: ${body.event || "EvolutionBot"} da instância: ${body.instance}`);

    let instanceName = body.instance;
    let remoteJid: string | null = null;
    let text: string | null = null;
    let isGroup = false;
    let fromMe = false;
    let buttonId: string | null = null;
    let apiKey = body.apikey || body.apiKey; // Tenta pegar a chave da requisição

    // 1. Verificar se é um evento padrão (MESSAGES_UPSERT) ou chamada direta do EvolutionBot
    const isUpsert = body.event === "MESSAGES_UPSERT" || body.event === "messages.upsert";

    if (isUpsert) {
      // 1.1 Pode ser um objeto direto ou um array dentro de data
      let messageData = body.data;
      
      // Se data for um array (comum em algumas versões), pega o primeiro
      if (Array.isArray(messageData)) {
        messageData = messageData[0];
      } else if (messageData?.messages && Array.isArray(messageData.messages)) {
        messageData = messageData.messages[0];
      }

      if (!messageData || !messageData.key) {
        console.error("[whatsapp-webhook] Payload inválido ou mensagem vazia");
        return new Response(JSON.stringify({ error: "invalid_payload_or_empty" }), { status: 200 }); // Retorna 200 para evitar retentativas infinitas da Evo
      }

      remoteJid = messageData.key.remoteJid;
      isGroup = remoteJid?.endsWith("@g.us") || false;
      fromMe = messageData.key.fromMe || false;

      // Extrair texto da mensagem
      const msg = messageData.message || {};
      text = msg.conversation || 
             msg.extendedTextMessage?.text || 
             msg.buttonsResponseMessage?.selectedButtonId ||
             msg.templateButtonReplyMessage?.selectedId ||
             msg.listResponseMessage?.singleSelectReply?.selectedRowId ||
             "";
      
      buttonId = msg.buttonsResponseMessage?.selectedButtonId || 
                 msg.templateButtonReplyMessage?.selectedId ||
                 msg.listResponseMessage?.singleSelectReply?.selectedRowId;
    } else if (body.remoteJid && body.content !== undefined) {
      // Formato do Evolution Bot (chamada direta)
      remoteJid = body.remoteJid;
      text = body.content || "";
      isGroup = body.isGroup || false;
      fromMe = body.isMe || false;
      console.log(`[whatsapp-webhook] Processando via Evolution Bot Direct Call: ${remoteJid}`);
    } else {
      console.log("[whatsapp-webhook] Evento ignorado (não reconhecido ou não é MESSAGES_UPSERT)");
      return new Response(JSON.stringify({ status: "ignored_event", event: body.event }), { headers: { "Content-Type": "application/json" } });
    }

    if (fromMe) {
      console.log("[whatsapp-webhook] Mensagem ignorada (enviada pelo próprio bot)");
      return new Response(JSON.stringify({ status: "ignored_self_message" }), { headers: { "Content-Type": "application/json" } });
    }

    if (isGroup) {
      console.log("[whatsapp-webhook] Mensagem ignorada (grupo)");
      return new Response(JSON.stringify({ status: "ignored_group_message" }), { headers: { "Content-Type": "application/json" } });
    }

    if (!text && !buttonId) {
      console.log("[whatsapp-webhook] Mensagem sem texto ou botão, ignorando.");
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

    console.log(`[whatsapp-webhook] Bot identificado: ${binding.bot_public_id}. Chamando runtime para ${remoteJid}...`);

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
          button_id: buttonId
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
            description: msgText,
            footer: "Bot",
            buttons: buttons.map(b => ({
              buttonId: b.id,
              buttonText: { displayText: b.label },
              type: 1
            }))
          }
        : {
            number: remoteJid,
            text: msgText
          };


      console.log(`[whatsapp-webhook] Enviando resposta via Evolution (${endpoint})...`);
      const sendResponse = await fetch(`${EVO_BASE_URL}/${endpoint}/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey || EVO_GLOBAL_KEY
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