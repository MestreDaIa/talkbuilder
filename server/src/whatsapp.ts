import { supabase } from "./supabase.js";
import { processRuntime } from "./runtime.js";
import { evolutionApi, EVO_BASE_URL, EVO_GLOBAL_KEY } from "./evolution.js";

export async function handleWhatsAppWebhook(payload: any, query?: any) {
  // console.log("Recebendo webhook WhatsApp:", JSON.stringify(payload, null, 2));
  
  // Suporte a ambos formatos: com ou sem o wrapper de evento da Evolution API
  const eventName: string = payload.event || payload.eventType || "";
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

  const instanceName: string = payload.instance;
  const remoteJid: string = messageData.key.remoteJid;
  const fromMe: boolean = !!messageData.key.fromMe;

  console.log(`Mensagem de ${remoteJid} na instância ${instanceName}. FromMe: ${fromMe}. Query: ${JSON.stringify(query)}`);

  if (fromMe || remoteJid.endsWith("@g.us")) {
    console.log("Mensagem ignorada (enviada por mim ou grupo)");
    return { status: "ignored" };
  }

  const text: string = messageData.message?.conversation || 
                       messageData.message?.extendedTextMessage?.text || 
                       messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                       messageData.message?.templateButtonReplyMessage?.selectedId ||
                       "";

  if (!text && !messageData.message?.buttonsResponseMessage) {
    return { status: "no_text" };
  }

  // 1. Identify Bot
  let botPublicId = query?.bot_id || query?.flow_id;

  // 1.1 Se não veio ID na URL, tentamos encontrar uma execução ativa para este contato
  if (!botPublicId) {
    const { data: activeExecutions } = await supabase
      .from("flow_executions")
      .select("flow_id, chatbot_flows(public_id)")
      .eq("contact_id", remoteJid)
      .eq("channel_id", "whatsapp")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (activeExecutions && activeExecutions.length > 0) {
      const exec = activeExecutions[0];
      // Acessamos o public_id com cast para evitar erro de tipo do TS
      const flowData = exec.chatbot_flows as any;
      botPublicId = (flowData && flowData.public_id) || exec.flow_id;
      console.log(`Execução ativa encontrada para ${remoteJid}: redirecionando para o bot ${botPublicId}`);
    }
  }

  // 1.2 Se ainda não temos ID, buscamos o binding da instância
  if (!botPublicId) {
    const { data: bindings, error: bindingError } = await supabase
      .from("whatsapp_bindings")
      .select("bot_public_id")
      .eq("instance_name", instanceName);

    if (bindingError) {
      console.error(`Erro ao buscar binding para ${instanceName}:`, bindingError);
    }

    if (bindings && bindings.length > 0) {
      botPublicId = bindings[0].bot_public_id;
      console.log(`Binding padrão encontrado para a instância ${instanceName}: ${botPublicId}`);
    }
  }

  if (!botPublicId) {
    console.error(`Binding não encontrado para a instância: ${instanceName}`);
    // Debug: Listar bindings existentes para ajudar o usuário
    const { data: allBindings } = await supabase.from("whatsapp_bindings").select("instance_name, bot_public_id");
    console.log("Bindings cadastrados no banco:", JSON.stringify(allBindings));
    return { error: "binding_not_found", instance: instanceName };
  }
  
  console.log(`Flow ID encontrado: ${botPublicId}`);

  // 2. Process via Runtime
  const runtimeResult = await processRuntime({
    action: "message",
    flow_id: botPublicId,
    contact_id: remoteJid,
    channel: "whatsapp",
    payload: {
      message: text,
      button_id: messageData.message?.buttonsResponseMessage?.selectedButtonId || messageData.message?.templateButtonReplyMessage?.selectedId,
      // Special Evolution Bot variables
      messageId: messageData.key.id,
      remoteJid,
      pushName: messageData.pushName || "",
      instanceName,
      serverUrl: EVO_BASE_URL,
      apiKey: EVO_GLOBAL_KEY
    }
  });

  // 2.1 Verificar se o fluxo parou em um nó de "Wait/Await"
  if (runtimeResult?.wait_ms > 0) {
    const waitMs = runtimeResult.wait_ms;
    console.log(`[WHATSAPP] Agendando retomada do fluxo em ${waitMs}ms para ${remoteJid}`);
    
    // Retomada assíncrona
    setTimeout(async () => {
      try {
        console.log(`[WHATSAPP:TIMEOUT] Retomando fluxo para ${remoteJid} após ${waitMs}ms`);
        const resumeResult = await processRuntime({
          action: "resume",
          flow_id: botPublicId,
          contact_id: remoteJid,
          channel: "whatsapp",
          payload: {
            messageId: messageData.key.id,
            remoteJid,
            pushName: messageData.pushName || "",
            instanceName,
            serverUrl: EVO_BASE_URL,
            apiKey: EVO_GLOBAL_KEY
          }
        });
        
        // Se a retomada gerou mensagens, enviamos elas agora
        if (resumeResult?.messages && resumeResult.messages.length > 0) {
          for (const msg of resumeResult.messages) {
            if (!msg.content) continue;
            if (resumeResult.buttons && resumeResult.buttons.length > 0) {
              await evolutionApi.sendButtons(instanceName, remoteJid, msg.content, resumeResult.buttons);
            } else {
              await evolutionApi.sendText(instanceName, remoteJid, msg.content);
            }
          }
        }
        
        // Se após a retomada ainda houver um wait (wait encadeado), o processo se repetirá 
        // mas precisamos de uma lógica recursiva ou que o processRuntime lide com isso.
        // Por enquanto, resolvemos o caso principal de 1 wait.
      } catch (err) {
        console.error(`[WHATSAPP:TIMEOUT] Erro ao retomar fluxo:`, err);
      }
    }, waitMs);
  }

  // 3. Send Responses (and also return them for Evolution Bot compatibility)
  console.log(`[WHATSAPP] Resultado do runtime: ${JSON.stringify({ 
    msgCount: runtimeResult?.messages?.length, 
    status: runtimeResult?.debug?.status,
    next_node: runtimeResult?.debug?.node
  })}`);

  const botResponses: any[] = [];
  if (runtimeResult && runtimeResult.messages && runtimeResult.messages.length > 0) {

    for (const msg of runtimeResult.messages) {
      if (!msg.content) continue;
      
      // Preparar para o retorno da Evolution Bot (caso seja chamada via API de Bot)
      if (runtimeResult.buttons && runtimeResult.buttons.length > 0) {
        botResponses.push({
          buttons: {
            text: msg.content,
            buttons: runtimeResult.buttons.map((b: any) => ({
              buttonId: b.id,
              buttonText: { displayText: b.label },
              type: 1
            })),
            footer: "Bot"
          }
        });
        // Também enviamos via API para garantir (Webhook mode)
        console.log(`[WHATSAPP] Enviando botões via API Evolution para ${remoteJid}`);
        const result = await evolutionApi.sendButtons(instanceName, remoteJid, msg.content, runtimeResult.buttons);
        console.log(`[WHATSAPP] Resultado envio botões:`, JSON.stringify(result));
      } else {
        botResponses.push({ text: msg.content });
        // Também enviamos via API para garantir (Webhook mode)
        console.log(`[WHATSAPP] Enviando texto via API Evolution para ${remoteJid}`);
        const result = await evolutionApi.sendText(instanceName, remoteJid, msg.content);
        console.log(`[WHATSAPP] Resultado envio texto:`, JSON.stringify(result));
      }
    }
  }

  console.log(`[WHATSAPP] Resposta final para Evolution: ${JSON.stringify(botResponses)}`);
  return { 
    status: "success",
    messages: botResponses 
  };

}
