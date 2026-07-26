import { supabase } from "./supabase.js";
import { processRuntime } from "./runtime.js";
import { evolutionApi, EVO_BASE_URL } from "./evolution.js";
import { verifyWebhookSignature, findWorkspaceByInstance } from "./waService.js";
import { shouldFlowHandle } from "./channelRoute.js";


export async function handleWhatsAppWebhook(
  payload: any,
  query?: any,
  requestMeta?: any,
  rawBody?: Buffer | string,
  signature?: string
) {
  // 0. HMAC — rejeita payloads sem assinatura válida do wa-service.
  if (!verifyWebhookSignature(rawBody ?? JSON.stringify(payload ?? {}), signature)) {
    console.warn("[webhook] assinatura HMAC ausente/ inválida — rejeitando payload");
    return { error: "invalid_signature" };
  }

  // 1. Normaliza formato:
  //    - wa-service: { event, tenant:{id,product,product_tenant_id}, instance, message:{...} }
  //    - legado Evolution (não deve mais chegar): { event, data:{key,message,...} }
  const eventName: string = payload.event || payload.eventType || "";
  const isUpsert =
    eventName === "MESSAGES_UPSERT" ||
    eventName === "messages.upsert" ||
    eventName === "message.received" ||
    (!eventName && (payload.data?.key || payload.message));

  if (!isUpsert && eventName) {
    console.log("Evento ignorado:", eventName);
    return { status: "ignored_event", event: eventName };
  }

  // Suporta ambas as formas
  const messageData =
    payload.message || payload.data || (payload.key ? payload : null);
  if (!messageData?.key && !messageData?.id && !messageData?.text && !messageData?.message) {
    console.error("Payload inválido: sem message/data reconhecível");
    return { error: "invalid_payload" };
  }

  const instanceName: string = payload.instance?.name || payload.instance || payload.data?.instance || "";
  const remoteJid: string =
    messageData.key?.remoteJid || messageData.from || messageData.remoteJid || "";
  const fromMe: boolean = !!(messageData.key?.fromMe ?? messageData.fromMe);

  // Resolve a zwa_live_ do workspace dono da instância (webhook é anônimo).
  const creds = instanceName ? await findWorkspaceByInstance(instanceName) : null;
  const currentApiKey = creds?.apiKey || "";

  console.log(`Mensagem de ${remoteJid} na instância ${instanceName}. FromMe: ${fromMe}. Query: ${JSON.stringify(query)}`);

  if (fromMe || remoteJid.endsWith("@g.us")) {
    console.log("Mensagem ignorada (enviada por mim ou grupo)");
    return { status: "ignored" };
  }

  // 1.5 Rota do canal: só processa se esta instância estiver atribuída ao Flow.
  //     Fonte da verdade: wa-service (se expuser rota) → Booking API → fallback.
  if (instanceName) {
    const { handle, route, source } = await shouldFlowHandle(instanceName);
    if (!handle) {
      console.log(`[channel-route] instância ${instanceName} roteada para "${route}" (${source}) — Flow ignora.`);
      return { status: "ignored_channel_route", route, source, instance: instanceName };
    }
    console.log(`[channel-route] instância ${instanceName} => "${route}" (${source}) — Flow processa.`);
  }


  // Detectar tipo de mensagem e conteúdo (aceita shape wa-service E legado Evolution)
  const rawMsg = messageData.message || {};
  const messageType =
    messageData.type ||
    messageData.messageType ||
    (typeof rawMsg === "object" && rawMsg && Object.keys(rawMsg)[0]) ||
    "unknown";

  const text: string =
    messageData.text ||
    messageData.body ||
    rawMsg.conversation ||
    rawMsg.extendedTextMessage?.text ||
    messageData.buttonId ||
    rawMsg.buttonsResponseMessage?.selectedButtonId ||
    rawMsg.templateButtonReplyMessage?.selectedId ||
    "";

  const caption: string =
    messageData.caption ||
    rawMsg.imageMessage?.caption ||
    rawMsg.videoMessage?.caption ||
    rawMsg.documentMessage?.caption ||
    "";

  const media =
    messageData.media ||
    rawMsg.imageMessage ||
    rawMsg.audioMessage ||
    rawMsg.videoMessage ||
    rawMsg.stickerMessage ||
    rawMsg.documentMessage;

  const mimetype = media?.mimetype || "";
  const mediaUrl = media?.url || "";
  const base64 = messageData.base64 || media?.base64 || payload.base64 || "";

  // Não bloqueamos se texto vazio (pode ser mídia sem legenda)
  if (!text && !caption && !messageData.buttonId && !rawMsg.buttonsResponseMessage && !media) {
    console.log("Mensagem sem conteúdo reconhecido ignorada.");
    return { status: "no_content" };
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
      message: text || caption || "",
      button_id: messageData.buttonId || rawMsg.buttonsResponseMessage?.selectedButtonId || rawMsg.templateButtonReplyMessage?.selectedId,
      body: payload,
      headers: requestMeta?.headers || {},
      query: query || {},
      params: requestMeta?.params || {},
      method: requestMeta?.method || "POST",
      receivedAt: requestMeta?.receivedAt || new Date().toISOString(),
      // Contexto do canal (agora fornecido pelo wa-service, não pela Evolution).
      messageId: messageData.id || messageData.key?.id,
      remoteJid,
      pushName: messageData.pushName || "",
      instanceName,
      serverUrl: EVO_BASE_URL,
      apiKey: currentApiKey,
      apikey: currentApiKey,
      // Novos campos para suporte a mídia e condições
      messageType,
      caption,
      mimetype,
      mediaUrl,
      base64
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
            messageId: messageData.id || messageData.key?.id,
            remoteJid,
            pushName: messageData.pushName || "",
            instanceName,
            serverUrl: EVO_BASE_URL,
            apiKey: currentApiKey,
          }
        });
        
        // Se a retomada gerou mensagens, enviamos elas agora
        if (resumeResult?.messages && resumeResult.messages.length > 0) {
          for (const msg of resumeResult.messages) {
            if (!msg.content) continue;
            if (resumeResult.buttons && resumeResult.buttons.length > 0) {
              await evolutionApi.sendButtons(instanceName, remoteJid, msg.content, resumeResult.buttons, currentApiKey);
            } else {
              await evolutionApi.sendText(instanceName, remoteJid, msg.content, currentApiKey);
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
        const result = await evolutionApi.sendButtons(instanceName, remoteJid, msg.content, runtimeResult.buttons, currentApiKey);
        console.log(`[WHATSAPP] Resultado envio botões:`, JSON.stringify(result));
      } else {
        botResponses.push({ text: msg.content });
        // Também enviamos via API para garantir (Webhook mode)
        console.log(`[WHATSAPP] Enviando texto via API Evolution para ${remoteJid}`);
        const result = await evolutionApi.sendText(instanceName, remoteJid, msg.content, currentApiKey);
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
