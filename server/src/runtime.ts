import { supabase } from "./supabase.js";
import * as crypto from "node:crypto";

const runtimeMemory = new Map<string, { state: any; expiresAt: number }>();
const MEMORY_TTL_MS = 1000 * 60 * 60 * 6;

function evaluateSetVariableValue(cfg: any, variables: Record<string, any>, replaceVars: (s: string) => string): any {
  const valueType = cfg.valueType || "expression";
  const raw = String(cfg.value ?? "");
  switch (valueType) {
    case "empty": return "";
    case "now": return new Date().toISOString();
    case "today": return new Date().toLocaleDateString("pt-BR");
    case "yesterday": { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString("pt-BR"); }
    case "tomorrow": { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("pt-BR"); }
    case "random": return Math.random().toString(36).substring(2, 8);
    case "custom": {
      try {
        const interpolated = replaceVars(raw);
        const varNames = Object.keys(variables);
        const varValues = varNames.map((k) => variables[k]);
        const fn = new Function(...varNames, `"use strict";\n${interpolated}`);
        return fn(...varValues);
      } catch (e) {
        console.error("[set-variable:custom] erro ao avaliar", e);
        return raw;
      }
    }
    case "expression":
    default: {
      if (!raw) return "";
      const interpolated = replaceVars(raw);
      try {
        const hasReturn = /\breturn\b/.test(interpolated);
        const isBlock = interpolated.includes(";") || interpolated.includes("\n") || hasReturn;
        if (isBlock) {
          const body = hasReturn ? interpolated : `return (${interpolated});`;
          const fn = new Function(`"use strict";\n${body}`);
          return fn();
        }
        const fn = new Function(`"use strict"; return (${interpolated});`);
        return fn();
      } catch {
        return interpolated;
      }
    }
  }
}

export async function processRuntime(body: any) {
  const { action, flow_id: flowRef, contact_id, channel = "webchat", payload } = body || {};

  if (!action || !flowRef || !contact_id) {
    throw new Error("missing required fields: action, flow_id, contact_id");
  }

  // 1. Resolve Flow
  console.log(`[runtime] Resolvendo fluxo: ${flowRef}`);
  let flow: any = null;
  {
    const { data, error } = await supabase
      .from("chatbot_flows")
      .select("*")
      .eq("public_id", flowRef)
      .maybeSingle();
    if (error) console.error("[runtime] Erro ao buscar fluxo por public_id:", error);
    flow = data;
  }
  if (!flow && /^[0-9a-f-]{36}$/i.test(flowRef)) {
    const { data, error } = await supabase
      .from("chatbot_flows")
      .select("*")
      .eq("id", flowRef)
      .maybeSingle();
    if (error) console.error("[runtime] Erro ao buscar fluxo por id:", error);
    flow = data;
  }
  if (!flow) {
    console.error(`[runtime] Fluxo não encontrado: ${flowRef}`);
    throw new Error(`Flow não encontrado: ${flowRef}`);
  }
  console.log(`[runtime] Fluxo encontrado: ${flow.name} (${flow.id})`);

  // Preferimos draft quando ele é mais recente que o published. saveDraft já
  // espelha para published quando o fluxo está publicado, então usar o mais
  // novo evita executar uma versão obsoleta com nodes/edges órfãs.
  const publishedAt = flow.published_at ? new Date(flow.published_at).getTime() : 0;
  const draftAt = flow.draft_updated_at ? new Date(flow.draft_updated_at).getTime() : 0;
  const useDraft = !flow.published_containers?.length || draftAt > publishedAt;
  let containers = (useDraft ? flow.draft_containers : flow.published_containers) || flow.draft_containers || [];
  let edges = (useDraft ? flow.draft_edges : flow.published_edges) || flow.draft_edges || [];
  console.log(`[runtime] Usando versão ${useDraft ? "DRAFT" : "PUBLISHED"} (containers=${containers.length}, edges=${edges.length})`);

  // Sanitiza edges órfãs: remove conexões para containers/nodes que não existem mais.
  const validContainerIds = new Set<string>(containers.map((c: any) => c.id));
  const validNodeIds = new Set<string>();
  for (const c of containers) for (const n of (c.nodes || [])) validNodeIds.add(n.id);
  const beforeEdges = edges.length;
  edges = edges.filter((e: any) => {
    const sourceOk = validNodeIds.has(e.source) || validContainerIds.has(e.source);
    const targetOk = validNodeIds.has(e.target) || validContainerIds.has(e.target);
    
    // Silenciamos o log de edges órfãs por padrão para não poluir o console,
    // já que agora temos uma limpeza ativa no salvamento/publicação.
    // if (!sourceOk || !targetOk) {
    //   console.log(`[runtime:orphan_edge] removida edge órfã ${e.source} -> ${e.target}`);
    // }
    
    return sourceOk && targetOk;
  });
  if (edges.length !== beforeEdges) {
    console.log(`[runtime] ${beforeEdges - edges.length} edges órfãs descartadas`);
  }

  if (!containers.length) {
    throw new Error("Fluxo vazio (nenhum container)");
  }

  // 2. Session
  let session: any = null;
  try {
    const { data: existingSessions } = await supabase
      .from("conversation_sessions")
      .select("*")
      .eq("flow_id", flow.id)
      .eq("contact_id", contact_id)
      .eq("channel_id", channel)
      .eq("status", "active")
      .order("last_interaction_at", { ascending: false })
      .limit(1);
    session = existingSessions && existingSessions.length > 0 ? existingSessions[0] : null;
    if (!session) {
      const { data: created } = await supabase
        .from("conversation_sessions")
        .insert({ workspace_id: flow.user_id, flow_id: flow.id, contact_id, channel_id: channel })
        .select()
        .single();
      session = created;
    } else {
      await supabase
        .from("conversation_sessions")
        .update({ last_interaction_at: new Date().toISOString() })
        .eq("id", session.id);
    }
  } catch (e) {
    console.warn("[runtime] session table missing or error", e);
  }

  // 3. Execution state
  let execution: any = null;
  if (action === "start" || action === "resume") {
    try {
      const { data: executions } = await supabase
        .from("flow_executions")
        .select("*")
        .eq("flow_id", flow.id)
        .eq("contact_id", contact_id)
        .eq("channel_id", channel)
        .limit(1);
      const existing = executions && executions.length > 0 ? executions[0] : null;
      
      if (action === "start") {
        if (existing) {
          await supabase
            .from("flow_executions")
            .update({ current_node_id: null, variables: {}, waiting_for_input: false, runtime_mode: "flow" })
            .eq("id", existing.id);
          execution = { ...existing, current_node_id: null, variables: {}, waiting_for_input: false, runtime_mode: "flow" };
        } else {
          const { data: created } = await supabase
            .from("flow_executions")
            .insert({ workspace_id: flow.user_id, flow_id: flow.id, contact_id, channel_id: channel, runtime_mode: "flow" })
            .select()
            .single();
          execution = created;
        }
      } else {
        // resume
        execution = existing;
      }
    } catch (e) {
      console.warn("[runtime] execution table missing", e);
    }
  } else {
    try {
      const { data: executions } = await supabase
        .from("flow_executions")
        .select("*")
        .eq("flow_id", flow.id)
        .eq("contact_id", contact_id)
        .eq("channel_id", channel)
        .limit(1);
      execution = executions && executions.length > 0 ? executions[0] : null;
    } catch {}
  }

  const memoryKey = `${flow.id}:${channel}:${contact_id}`;
  const clientState = payload?.runtime_state || body?.runtime_state || readMemoryState(memoryKey);

  if (!execution) {
    execution = normalizeClientState(clientState);
  } else if (action !== "start" && action !== "resume" && clientState?.current_node_id) {
    // Apenas sobrescreve se o estado for válido e não for um comando de controle (start/resume)
    const newState = normalizeClientState(clientState);
    if (newState.current_node_id) {
       execution = { ...execution, ...newState, id: execution.id };
    }
  }

  // Tratamento especial para o comando "resume" do nó Wait
  if (action === "resume") {
    execution.is_waiting_time = true;
  }

  // Executar Fluxo
  console.log(`[runtime] Iniciando execução do fluxo. Input: ${JSON.stringify(payload || body?.payload)}`);
  const result = await runFlow(execution, containers, edges, payload || body?.payload, flow, supabase);
  console.log(`[runtime] Execução finalizada. Status: ${result.status}. Mensagens geradas: ${result.messages?.length || 0}`);


  // Persistir novo estado
  if (execution.id) {
    try {
      await supabase
        .from("flow_executions")
        .update({
          current_node_id: result.next_node_id,
          variables: result.variables,
          waiting_for_input: result.status === "waiting_input",
          runtime_mode: result.mode,
          active_agent_node_id: result.active_agent_node_id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", execution.id);
    } catch {}
  }

  const runtimeState = {
    current_node_id: result.next_node_id,
    active_agent_node_id: result.active_agent_node_id,
    variables: result.variables,
    waiting_for_input: result.status === "waiting_input",
    mode: result.mode,
    is_waiting_time: result.wait_ms > 0,
    last_execution_status: result.status,
    wait_until: result.wait_ms > 0 ? Date.now() + result.wait_ms : null
  };
  writeMemoryState(memoryKey, runtimeState);

  return {
    messages: result.messages,
    waiting_for: result.waiting_for,
    wait_ms: result.wait_ms,
    buttons: result.buttons,
    session_id: session?.id ?? null,
    runtime_state: runtimeState,
    debug: { node: result.next_node_id, steps: result.steps, status: result.status },
  };
}

function normalizeClientState(state: any) {
  return {
    id: null,
    current_node_id: typeof state?.current_node_id === "string" ? state.current_node_id : null,
    active_agent_node_id: state?.active_agent_node_id || null,
    variables: state?.variables && typeof state.variables === "object" ? state.variables : {},
    waiting_for_input: !!state?.waiting_for_input,
    is_waiting_time: !!state?.is_waiting_time,
    wait_until: state?.wait_until || null,
    runtime_mode: state?.mode || "flow"
  };
}

function readMemoryState(key: string) {
  const entry = runtimeMemory.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    runtimeMemory.delete(key);
    return null;
  }
  return entry.state;
}

function writeMemoryState(key: string, state: any) {
  const now = Date.now();
  if (runtimeMemory.size > 1000) {
    for (const [k, entry] of runtimeMemory.entries()) {
      if (entry.expiresAt < now) runtimeMemory.delete(k);
    }
  }
  runtimeMemory.set(key, { state, expiresAt: now + MEMORY_TTL_MS });
}

async function runFlow(execution: any, containersIn: any[], edgesIn: any[], input: any, flow: any, supabase: any, visitedRedirects = new Set<string>()): Promise<any> {
  const containers: any[] = containersIn;
  const edges: any[] = edgesIn;
  let currentNodeId: string | null = execution.current_node_id;
  let activeAgentNodeId: string | null = execution.active_agent_node_id || null;
  let mode: string = execution.runtime_mode || "flow";
  const variables: Record<string, any> = { ...(execution.variables || {}) };
  const messages: any[] = [];
  let waiting_for: string | null = null;
  let buttons: any[] = [];
  let wait_ms = 0;
  let steps = 0;
  let status: string = "running";

  const findNode = (id: string | null) => {
    if (!id) return null;
    for (const c of containers) {
      const nodes = c.nodes || [];
      const n = nodes.find((node: any) => node.id === id);
      if (n) return { node: n, container: c };
    }
    return null;
  };

  const firstNodeOfContainer = (containerId: string): string | null => {
    const c = containers.find((x: any) => x.id === containerId);
    return c?.nodes?.[0]?.id ?? null;
  };

  const normalizeHandle = (value: string | null | undefined, currentNodeId?: string) => {
    if (!value) return "";
    let raw = String(value);
    
    // Remove prefixo de ID de node se existir (ex: node-123-cond-abc -> cond-abc)
    if (raw.includes("-cond-")) {
      raw = "cond-" + raw.split("-cond-")[1];
    } else if (raw.includes("-btn-")) {
      raw = "btn-" + raw.split("-btn-")[1];
    } else if (raw.endsWith("-else")) {
      raw = "else";
    } else if (raw.endsWith("-default")) {
      raw = "default";
    }
    
    // Se o handle for exatamente o ID do node, normalizamos para vazio para facilitar match padrão
    if (currentNodeId && raw === currentNodeId) return "";
    
    // Legacy mapping para botões
    const buttonMatch = raw.match(/btn-(.+)$/);
    if (buttonMatch?.[1]) return buttonMatch[1];
    
    return raw;
  };

  const nextFromNode = (nodeId: string, container: any, handle?: string, strictHandle = false): string | null => {
    const isInnerNodeHandle = (value?: string | null) =>
      !!value && (String(value) === nodeId || String(value).startsWith(`${nodeId}-`));

    const wantedHandle = handle || "";
    const fromNode = edges.filter(
      (e: any) => e.source === nodeId || (e.source === container.id && isInnerNodeHandle(e.sourceHandle))
    );

    // 1. Tenta match de handle (exato ou normalizado)
    let edge = fromNode.find((e: any) => {
      if (!wantedHandle) {
        // Se não queremos um handle específico, aceitamos edges sem handle ou que apontem para o ID do node
        return !e.sourceHandle || e.sourceHandle === nodeId || normalizeHandle(e.sourceHandle, nodeId) === "";
      }
      return e.sourceHandle === wantedHandle || normalizeHandle(e.sourceHandle, nodeId) === normalizeHandle(wantedHandle, nodeId);
    });
    
    // 2. Fallbacks de handle (default/else)
    if (!edge && !strictHandle) {
       edge = fromNode.find((e: any) => {
         const norm = normalizeHandle(e.sourceHandle, nodeId);
         return norm === "default" || norm === "else";
       });
    }

    if (edge) {
      console.log(`[runtime:edge_found] de ${nodeId} para ${edge.target} via handle "${wantedHandle || "(default/auto)"}"`);
      if (findNode(edge.target)) return edge.target;
      const first = firstNodeOfContainer(edge.target);
      if (first) return first;
      return edge.target;
    }

    // 3. Sequencial dentro do bloco (apenas se não for strictHandle)
    if (!strictHandle && container?.nodes?.length) {
      const idx = container.nodes.findIndex((n: any) => n.id === nodeId);
      if (idx >= 0 && idx < container.nodes.length - 1) {
        const nextId = container.nodes[idx + 1].id;
        console.log(`[runtime:sequential] movendo de ${nodeId} para o próximo node no bloco: ${nextId}`);
        return nextId;
      }
    }

    // 4. Edge saindo do container (apenas se não for strictHandle)
    if (!strictHandle) {
      const cEdge = edges.find((e: any) => e.source === container.id && !e.sourceHandle);
      if (cEdge) {
        console.log(`[runtime:container_exit] saindo do bloco ${container.id} para ${cEdge.target}`);
        const targetId = findNode(cEdge.target) ? cEdge.target : firstNodeOfContainer(cEdge.target);
        if (targetId) return targetId;
      }
    }

    console.log(`[runtime:edge_not_found] nenhum caminho saindo de ${nodeId}${wantedHandle ? ` com handle "${wantedHandle}"` : ""}`);
    return null;
  };

  const decodeText = (text: string) => {
    if (!text) return "";
    let decoded = String(text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    // Only trim if it's not likely to be a JSON body (which might want to preserve spaces, though rare)
    // For now, let's keep trim() but make it safer
    return decoded.trim();
  };

  const getVarValue = (path: string) => {
    const key = String(path || "").trim();
    if (!key) return undefined;
    if (Object.prototype.hasOwnProperty.call(variables, key)) return variables[key];

    const val = key.split(".").reduce((acc: any, part: string) => {
      if (acc == null) return undefined;
      return acc[part];
    }, variables as any);

    if (val === undefined) {
      console.log(`[runtime:var] variável não encontrada: ${key}`);
    }
    return val;
  };

  const stringifyVarValue = (value: any) =>
    value != null && typeof value === "object" ? JSON.stringify(value) : String(value ?? "");

  const replaceVars = (text: string, raw = false) => {
    if (!text) return text;
    // Remove caracteres de controle invisíveis (exceto \n, \r, \t) que podem corromper JSON ou requisições
    const sanitized = String(text).replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");
    
    let baseText;
    if (raw) {
      baseText = sanitized;
    } else {
      // Se parecer JSON ou URL, não aplicamos o decodeText completo para não estragar aspas ou estruturas
      const isJsonOrUrl = /^\s*[{\[]/.test(sanitized) || /^\s*http/.test(sanitized);
      baseText = isJsonOrUrl ? sanitized : decodeText(sanitized);
    }
    
    if (text !== baseText) {
      console.log(`[runtime:replaceVars] Modified text. Len diff: ${baseText.length - text.length}`);
    }
    
    return baseText.replace(/{{(.*?)}}/g, (_, k) => {
      const value = getVarValue(k);
      return value === undefined ? `{{${k}}}` : stringifyVarValue(value);
    });
  };

  const evaluateComparison = (comparison: any) => {
    const key = String(comparison?.variableName || "").trim().replace(/^{{\s*/, "").replace(/\s*}}$/, "");
    const rawValue = key ? getVarValue(key) : undefined;
    const actual = rawValue == null ? "" : String(rawValue).trim();
    const expected = replaceVars(String(comparison?.value ?? "")).trim();

    switch (comparison?.operator) {
      case "equals": return actual === expected;
      case "not_equals": return actual !== expected;
      case "contains": return actual.includes(expected);
      case "not_contains": return !actual.includes(expected);
      case "greater_than": return Number(actual) > Number(expected);
      case "less_than": return Number(actual) < Number(expected);
      case "is_set": return rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "";
      case "is_empty": return rawValue === undefined || rawValue === null || String(rawValue).trim() === "";
      case "starts_with": return actual.startsWith(expected);
      case "ends_with": return actual.endsWith(expected);
      case "matches_regex": {
        try { return new RegExp(expected).test(actual); } catch { return false; }
      }
      case "not_matches_regex": {
        try { return !new RegExp(expected).test(actual); } catch { return true; }
      }
      default: return false;
    }
  };

  const evaluateCondition = (condition: any) => {
    const comparisons = condition?.comparisons || [];
    if (!comparisons.length) return false;
    const results = comparisons.map(evaluateComparison);
    return condition?.logicalOperator === "OR" ? results.some(Boolean) : results.every(Boolean);
  };

  const getPublicImageUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const bucket = "chatbot-assets";
    return `${supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl}`;
  };

  // 1. Processar Entrada (Resumo de Estado)
  if (input) {
    if (input.messageId) variables["messageId"] = input.messageId;
    if (input.remoteJid) variables["remoteJid"] = input.remoteJid;
    if (input.pushName) variables["pushName"] = input.pushName;
    if (input.instanceName) variables["instanceName"] = input.instanceName;
    if (input.serverUrl) variables["serverUrl"] = input.serverUrl;
    if (input.apiKey) variables["apiKey"] = input.apiKey;
    
    // Mapeamento de variáveis de mídia para uso em condições
    if (input.messageType) variables["messageType"] = input.messageType;
    if (input.caption) variables["caption"] = input.caption;
    if (input.mimetype) variables["mimetype"] = input.mimetype;
    if (input.mediaUrl) variables["mediaUrl"] = input.mediaUrl;
    if (input.base64) variables["base64"] = input.base64;

    // Se houver dados de um webhook (payload), colocamos em webhookData
    // para que {{webhookData.body.data.messageType}} funcione se o nó Webhook
    // estiver configurado para salvar em 'webhookData' (padrão)
    if (input.body || input.headers || input.query) {
      // Procuramos se existe um nó Webhook no fluxo para saber o nome da variável
      // mas como o usuário usou webhookData no exemplo, vamos garantir que esteja lá
      // O nó Webhook por padrão salva em variables[cfg.responseVariable || "webhookData"]
      const webhookData = {
        body: input.body,
        headers: input.headers,
        query: input.query,
        method: input.method,
        receivedAt: input.receivedAt
      };
      
      // Salva tanto no padrão quanto em variáveis específicas se o input veio de um webhook
      variables["webhookData"] = webhookData;
      variables["data"] = webhookData;
    }
  }

  let inputConsumed = false;
  if (input && (input.message !== undefined || input.button_id !== undefined)) {
    const userValue = input.message ?? input.button_id;
    variables["last_message"] = userValue;


    if (mode === "agent" && activeAgentNodeId) {
       currentNodeId = activeAgentNodeId;
    } else if (currentNodeId && execution.waiting_for_input) {
       const info = findNode(currentNodeId);
       if (info) {
         const cfg = info.node.config || {};
         const nodeType = (info.node.type || "").toLowerCase().trim();
         const varName = cfg.variableName || cfg.saveVariable;
         
         if (varName && userValue !== undefined) {
           if (nodeType === "input-universal") {
             const typeMap: Record<string, string> = {
               "conversation": "textInput",
               "extendedTextMessage": "textInput",
               "imageMessage": "imageInput",
               "videoMessage": "videoInput",
               "audioMessage": "audioInput",
               "documentMessage": "documentInput",
               "documentWithCaptionMessage": "documentInput"
             };
             
             // Determinar o tipo baseado no messageType do WhatsApp ou na presença de mídia
             let mappedType = typeMap[input.messageType] || "textInput";
             if (input.mimetype?.startsWith("image/")) mappedType = "imageInput";
             else if (input.mimetype?.startsWith("video/")) mappedType = "videoInput";
             else if (input.mimetype?.startsWith("audio/")) mappedType = "audioInput";
             else if (input.mimetype?.startsWith("application/")) mappedType = "documentInput";
             else if (input.mediaUrl && !input.message) {
                // Fallback se não tiver mimetype mas tiver URL
                if (input.mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)/i)) mappedType = "imageInput";
                else if (input.mediaUrl.match(/\.(mp4|mov|avi)/i)) mappedType = "videoInput";
                else if (input.mediaUrl.match(/\.(mp3|ogg|wav|m4a)/i)) mappedType = "audioInput";
                else mappedType = "documentInput";
             }

             variables[varName] = {
               type: mappedType,
               content: input.mediaUrl || input.base64 || userValue,
               metadata: {
                 base64: input.base64,
                 link: input.mediaUrl,
                 caption: input.caption || input.message,
                 mimetype: input.mimetype,
                 fileName: input.fileName
               }
             };
             console.log(`[runtime:input-universal] Saved to ${varName}:`, variables[varName]);
           } else {
             variables[varName] = userValue;
           }
         }

         if (nodeType !== "ai-agent" && nodeType !== "agent") {
            currentNodeId = nextFromNode(info.node.id, info.container, input.button_id);
            inputConsumed = true;
            input = null; // Consumido para o loop
         }
       }
    }
  }

  // 2. Iniciar Fluxo se necessário
  if (!currentNodeId) {
    // Prioridade 1: node do tipo "start"
    for (const c of containers) {
      const startNode = (c.nodes || []).find((n: any) => String(n.type || "").toLowerCase() === "start");
      if (startNode) {
        currentNodeId = startNode.id;
        break;
      }
    }
    // Prioridade 2: container "raiz" do grafo (sem edges de entrada)
    if (!currentNodeId && containers.length > 0) {
      const incoming = new Set<string>();
      for (const e of edges) {
        if (!e?.target) continue;
        const targetContainer = containers.find((c: any) => (c.nodes || []).some((n: any) => n.id === e.target));
        if (targetContainer) incoming.add(targetContainer.id);
        else incoming.add(e.target);
      }
      const entryContainer = containers.find((c: any) => !incoming.has(c.id)) || containers[0];
      if (entryContainer?.nodes?.length) {
        currentNodeId = entryContainer.nodes[0].id;
        console.log(`[runtime] Container inicial detectado: ${entryContainer.id} (${entryContainer.nameContainer || "sem nome"})`);
      }
    }
  }


  // 3. Loop de Execução
  while (currentNodeId && steps < 100) {
    steps++;
    const info = findNode(currentNodeId);
    if (!info) {
       console.log(`[runtime] Node não encontrado: ${currentNodeId}. Resetando para o início.`);
       // Antes de resetar, vamos ver se o ID é de um container e pegar o primeiro node dele
       const firstNode = firstNodeOfContainer(currentNodeId);
       if (firstNode) {
          console.log(`[runtime] O ID ${currentNodeId} é um container. Iniciando pelo primeiro node: ${firstNode}`);
          currentNodeId = firstNode;
          continue;
       }
       currentNodeId = null; 
       break;
    }


    const { node, container } = info;
    const cfg = node.config || {};
    const nodeType = String(node.type || "").toLowerCase().trim();

    if (nodeType === "wait" || nodeType === "await") {
      if (!execution.is_waiting_time) {
        const seconds = Number(cfg.waitTime || cfg.duration || 5);
        wait_ms = seconds * 1000;
        status = "paused";
        break; 
      } else {
        execution.is_waiting_time = false;
        currentNodeId = nextFromNode(node.id, container);
        continue;
      }
    }

    if (nodeType.startsWith("input-")) {
      // IMPORTANTE: quando alcançamos um input-* DURANTE o loop (sem ter estado
      // previamente aguardando neste node), devemos SEMPRE parar e aguardar a
      // próxima mensagem do usuário. O consumo de input só acontece no bloco
      // pré-loop (quando execution.waiting_for_input estava true para este node).
      // Consumir a mensagem inicial aqui faria o bot pular a etapa de input.
      console.log(`[runtime:input_wait] aguardando entrada no node ${node.id} (${nodeType})`);
      waiting_for = nodeType === "input-buttons" ? "buttons" : nodeType;
      if (nodeType === "input-buttons") {
        buttons = (cfg.buttons || []).map((b: any) => ({
          id: b.id,
          label: b.label || b.text || b.value || "",
          value: b.value,
        }));
      }
      status = "waiting_input";
      currentNodeId = node.id; // garante que persistimos exatamente neste node
      break;
    }

    switch (nodeType) {
      case "bubble-text":
      case "bubble-number": {
        const text = replaceVars(cfg.message || cfg.content || cfg.text || cfg.number || "");
        if (text) messages.push({ id: crypto.randomUUID(), type: "bot", content: text });
        break;
      }
      case "webhook": {
        // O nó Webhook é um nó de entrada/gatilho.
        // Se chegamos aqui durante a execução, significa que o fluxo passou por ele.
        const varName = cfg.responseVariable || "webhookData";
        let webhookData: any = null;
        if (input && (input.body || input.headers || input.query)) {
          webhookData = {
            body: input.body,
            headers: input.headers,
            query: input.query,
            method: input.method,
            receivedAt: input.receivedAt
          };
        } else if (cfg.lastTestPayload) {
          webhookData = cfg.lastTestPayload;
        }
        if (webhookData) {
          variables[varName] = webhookData;
          variables["webhookData"] = webhookData;
          variables["data"] = webhookData;

          // Mapear campos: extrai paths do payload e salva em variáveis individuais
          if (Array.isArray(cfg.responseMappings)) {
            const getValueByPath = (obj: any, path: string): any => {
              if (!path) return obj;
              const parts = String(path).split('.').filter(Boolean);
              let current: any = obj;
              for (const part of parts) {
                if (current === null || current === undefined) return undefined;
                current = current[part];
              }
              return current;
            };
            cfg.responseMappings.forEach((mapping: any) => {
              if (mapping?.variableName) {
                const val = mapping.jsonPath
                  ? getValueByPath(webhookData, mapping.jsonPath)
                  : webhookData;
                if (val !== undefined) {
                  variables[mapping.variableName] = val;
                }
              }
            });
          }
        }
        break;
      }
      case "bubble-image": {
        const url = getPublicImageUrl(cfg.ImageURL || cfg.imageUrl || cfg.url || cfg.src || "");
        if (url) messages.push({ id: crypto.randomUUID(), type: "bot", content: url, isImage: true, alt: cfg.ImageAlt || cfg.alt });
        break;
      }
      case "set-variable":
        if (cfg.variableName) {
          variables[cfg.variableName] = evaluateSetVariableValue(cfg, variables, replaceVars);
        }
        break;
      case "condition": {
        const matchedCondition = (cfg.conditions || []).find(evaluateCondition);
        const handle = matchedCondition ? `${node.id}-cond-${matchedCondition.id}` : `${node.id}-else`;
        console.log(`[runtime:condition] node ${node.id}: ${matchedCondition ? `condição "${matchedCondition.id}" satisfeita` : "nenhuma condição satisfeita (indo para else)"}`);
        
        const nextId = nextFromNode(node.id, container, handle, true);
        if (nextId) {
          currentNodeId = nextId;
        } else {
          console.log(`[runtime:condition] fallback: nenhum edge encontrado para o handle "${handle}", tentando saída padrão`);
          currentNodeId = nextFromNode(node.id, container); // Fallback para sequential/container exit
        }
        continue;
      }
      case "ai-node": {
        const provider = (cfg.provider || "openai").toLowerCase();
        const activeKey = flow?.settings?.aiKeys?.[`${provider}Key`] || flow?.settings?.[`${provider}_key`] || cfg.apiKey;
        const userPrompt = replaceVars(cfg.userMessage || variables["last_message"] || "").trim();
        const systemPrompt = replaceVars(cfg.systemPrompt || cfg.instructions || "Você é um assistente útil.").trim();
        
        let context = "";
        if (cfg.kbFilesEnabled && cfg.kbFiles?.length > 0) {
          context = "\n\nConhecimento:\n" + cfg.kbFiles.map((f: any) => `### ${f.name}\n${f.content}`).join("\n");
        }

        if (activeKey && userPrompt) {
          try {
            let aiReply = "";
            if (provider === "openai") {
              const messages: any[] = [{ role: "system", content: systemPrompt + context }];
              
              if (cfg.visionEnabled) {
                const content: any[] = [{ type: "text", text: userPrompt }];
                
                // Detect image URLs or base64 in userPrompt or variables
                if (userPrompt.startsWith("http") || userPrompt.startsWith("data:image")) {
                  content.push({ type: "image_url", image_url: { url: userPrompt } });
                } else {
                  const mediaUrl = variables["mediaUrl"] || variables["media_url"] || variables["url"];
                  const base64 = variables["base64"] || variables["image_base64"];
                  
                  if (base64) {
                    const b64 = String(base64).startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
                    content.push({ type: "image_url", image_url: { url: b64 } });
                  } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
                    content.push({ type: "image_url", image_url: { url: mediaUrl } });
                  }
                }
                messages.push({ role: "user", content });
              } else {
                messages.push({ role: "user", content: userPrompt });
              }

              const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: cfg.model || "gpt-4o-mini",
                  messages: messages,
                  temperature: cfg.temperature ?? 0.7,
                  max_tokens: cfg.maxTokens ?? 1000,
                }),
              });
              if (res.ok) {
                const data: any = await res.json();
                aiReply = data.choices?.[0]?.message?.content || "";
              }
            } else if (provider === "gemini") {
              const model = cfg.model || "gemini-2.0-flash";
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
              
              const userParts: any[] = [{ text: userPrompt }];
              if (cfg.visionEnabled) {
                const mediaUrl = variables["mediaUrl"] || variables["media_url"] || variables["url"];
                const base64 = variables["base64"] || variables["image_base64"];

                if (base64) {
                  const b64Data = String(base64).replace(/^data:image\/[a-z]+;base64,/, "");
                  userParts.push({ inline_data: { mime_type: "image/jpeg", data: b64Data } });
                } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
                  try {
                    const imgRes = await fetch(mediaUrl);
                    if (imgRes.ok) {
                      const arrayBuffer = await imgRes.arrayBuffer();
                      const b64 = Buffer.from(arrayBuffer).toString('base64');
                      userParts.push({ inline_data: { mime_type: imgRes.headers.get("content-type") || "image/jpeg", data: b64 } });
                    }
                  } catch (e) { console.error("[Gemini:Vision] failed to fetch image", e); }
                }
              }

              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  system_instruction: { parts: [{ text: systemPrompt + context }] },
                  contents: [{ role: "user", parts: userParts }],
                  generationConfig: {
                    temperature: cfg.temperature ?? 0.7,
                    maxOutputTokens: cfg.maxTokens ?? 1000,
                  }
                }),
              });
              if (res.ok) {
                const data: any = await res.json();
                aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
              }
            }

            if (aiReply) {
              if (cfg.saveVariable) variables[cfg.saveVariable] = aiReply;
              else messages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
            }
          } catch (e) { console.error("[ai-node] failed", e); }
        }
        break;
      }
      case "ai-agent":
      case "agent": {
        const provider = (cfg.provider || "openai").toLowerCase();
        const activeKey = flow?.settings?.aiKeys?.[`${provider}Key`] || flow?.settings?.[`${provider}_key`] || cfg.apiKey;
        const isFirstTime = execution.active_agent_node_id !== node.id || mode !== "agent";
        
        if (activeKey) {
          try {
            if (isFirstTime && cfg.welcomeMessage) {
               messages.push({ id: crypto.randomUUID(), type: "bot", content: replaceVars(cfg.welcomeMessage) });
               return { messages, waiting_for: "text", variables, next_node_id: node.id, active_agent_node_id: node.id, mode: "agent", steps, status: "waiting_input" };
            }

            const userPrompt = replaceVars(input?.message || variables["last_message"] || "").trim();
            if (userPrompt) {
              let aiReply = "";
              if (provider === "openai") {
                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: cfg.model || "gpt-4o-mini",
                    messages: [{ role: "system", content: cfg.instructions || "" }, { role: "user", content: userPrompt }],
                  }),
                });
                if (res.ok) {
                  const data: any = await res.json();
                  aiReply = data.choices?.[0]?.message?.content || "";
                }
              }
              if (aiReply) messages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
            }
            
            return { messages, waiting_for: "text", variables, next_node_id: node.id, active_agent_node_id: node.id, mode: "agent", steps, status: "waiting_input" };
          } catch (e) { console.error("[ai-agent] failed", e); }
        }
        break;
      }
      case "http-request":
      case "http": {
        let url = replaceVars(cfg.url || "", true);
        const method = (cfg.method || "GET").toUpperCase();
        const headers: Record<string, string> = {};
        
        // Add Query Params to URL
        if (cfg.queryParams && Array.isArray(cfg.queryParams)) {
          const urlObj = new URL(url);
          cfg.queryParams.forEach((p: any) => {
            const key = p.key || p.name;
            if (key) urlObj.searchParams.append(replaceVars(key, true), replaceVars(p.value || "", true));
          });
          url = urlObj.toString();
        }

        // Tratar autenticação se configurada
        if (cfg.authentication === "basic" && cfg.authCredentials) {
          const auth = Buffer.from(`${cfg.authCredentials.username}:${cfg.authCredentials.password}`).toString("base64");
          headers["Authorization"] = `Basic ${auth}`;
        } else if (cfg.authentication === "header" && cfg.authCredentials) {
          headers[cfg.authCredentials.headerName] = replaceVars(cfg.authCredentials.headerValue || "", true);
        }

        if (cfg.headers && Array.isArray(cfg.headers)) {
          cfg.headers.forEach((h: any) => {
            const key = h.key || h.name;
            if (key) headers[key] = replaceVars(h.value || "", true);
          });
        } else if (cfg.headers && typeof cfg.headers === "object") {
          Object.entries(cfg.headers).forEach(([k, v]) => {
            headers[k] = replaceVars(String(v), true);
          });
        }

        // Add default Content-Type if not set and method has body
        if (["POST", "PUT", "PATCH"].includes(method) && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }
        if (["POST", "PUT", "PATCH", "GET"].includes(method) && !headers["Accept"]) {
          headers["Accept"] = "application/json, text/plain, */*";
        }

        let body: any = null;
        if (["POST", "PUT", "PATCH"].includes(method)) {
          if (cfg.bodyType === "json" || !cfg.bodyType || cfg.bodyContentType === "json") {
            const rawBody = cfg.bodyJson || cfg.body || "{}";
            const processedBody = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
            // IMPORTANTE: Para JSON e requisições técnicas, usamos raw=true para evitar decodeText
            body = replaceVars(processedBody, true);
            headers["Content-Type"] = "application/json";
            
            console.log(`[runtime:http] Body processado: ${body.substring(0, 200)}${body.length > 200 ? "..." : ""}`);
          } else if (cfg.bodyType === "form-data" || cfg.bodyType === "form-urlencoded" || cfg.bodyContentType === "form-urlencoded") {
            const params = new URLSearchParams();
            const bodyEntries = Array.isArray(cfg.bodyParams) ? cfg.bodyParams : (Array.isArray(cfg.body) ? cfg.body : []);
            bodyEntries.forEach((b: any) => {
              const key = b.key || b.name;
              if (key) params.append(key, replaceVars(b.value || "", true));
            });
            body = params.toString();
            headers["Content-Type"] = "application/x-www-form-urlencoded";
          }
        }

        try {
          console.log(`[runtime:http] chamando ${method} ${url}`);
          // Log seguro dos headers para debug
          Object.keys(headers).forEach(k => {
            const val = String(headers[k]);
            const masked = val.length > 8 ? `${val.substring(0, 4)}...${val.substring(val.length - 4)}` : "***";
            console.log(`[runtime:http] header: ${k} = ${masked}`);
          });
          const res = await fetch(url, {
            method,
            headers,
            body: method !== "GET" ? body : undefined
          });

          const responseText = await res.text();
          let responseData;
          try {
            responseData = JSON.parse(responseText);
          } catch {
            responseData = responseText;
          }

          if (cfg.saveVariable || cfg.responseVariable) {
            variables[cfg.saveVariable || cfg.responseVariable] = responseData;
          }

          // Suporte a múltiplos mapeamentos de resposta (Save in variable no builder)
          if (cfg.responseMappings && Array.isArray(cfg.responseMappings)) {
            const getValueByPath = (obj: any, path: string): any => {
              if (!path) return obj;
              const parts = path.split('.');
              // Se o path começar com "data.", removemos o prefixo pois o builder costuma incluir
              const remaining = (parts[0] === 'data') ? parts.slice(1) : parts;
              
              let current = obj;
              for (const part of remaining) {
                if (current === null || current === undefined || typeof current !== 'object') return undefined;
                current = current[part];
              }
              return current;
            };

            cfg.responseMappings.forEach((mapping: any) => {
              if (mapping.jsonPath && mapping.variableName) {
                const val = getValueByPath(responseData, mapping.jsonPath);
                if (val !== undefined) {
                  variables[mapping.variableName] = val;
                  console.log(`[runtime:http] salvando ${mapping.jsonPath} na variável ${mapping.variableName}`);
                }
              }
            });
          }
          
          // Se tivermos handles de sucesso/erro
          const statusHandle = res.ok ? "success" : "error";
          const nextId = nextFromNode(node.id, container, statusHandle, true);
          if (nextId) {
            currentNodeId = nextId;
            continue;
          }
        } catch (e) {
          console.error("[runtime:http] erro", e);
          if (cfg.saveVariable) variables[cfg.saveVariable] = { error: String(e) };
          const nextId = nextFromNode(node.id, container, "error", true);
          if (nextId) {
            currentNodeId = nextId;
            continue;
          }
        }
        break;
      }
      case "redirect": {
        const cfg = node.data || node.config || {};
        const targetFlowId = cfg.flowId || cfg.targetFlowId;
        
        if (targetFlowId && !visitedRedirects.has(targetFlowId)) {
          visitedRedirects.add(targetFlowId);
          console.log(`[runtime:redirect] redirecionando para o fluxo ${targetFlowId}`);
          
          const { data: targetFlow } = await supabase
            .from("chatbot_flows")
            .select("*")
            .eq("public_id", targetFlowId)
            .maybeSingle();
          
          if (targetFlow) {
             const targetContainers = targetFlow.draft_containers || [];
             const targetEdges = targetFlow.draft_edges || [];
             const startNodeId = targetContainers[0]?.nodes?.[0]?.id;
             
             if (startNodeId) {
               const subResult = await runFlow(
                 { ...execution, current_node_id: startNodeId, variables },
                 targetContainers,
                 targetEdges,
                 input,
                 targetFlow,
                 supabase,
                 visitedRedirects
               );
               
               messages.push(...(subResult.messages || []));
               Object.assign(variables, subResult.variables || {});
               currentNodeId = subResult.next_node_id;
               wait_ms = subResult.wait_ms;
               buttons = subResult.buttons;
               status = subResult.status;
               return { ...subResult, messages, variables };
             }
          }
        }
        break;
      }
    }

    currentNodeId = nextFromNode(node.id, container);
  }

  if (!currentNodeId) status = "completed";

  return {
    messages,
    waiting_for,
    wait_ms,
    buttons,
    variables,
    next_node_id: currentNodeId,
    active_agent_node_id: activeAgentNodeId,
    mode,
    steps,
    status
  };
}
