import { supabase } from "./supabase.js";
import * as crypto from "node:crypto";

const runtimeMemory = new Map<string, { state: any; expiresAt: number }>();
const MEMORY_TTL_MS = 1000 * 60 * 60 * 6;

const DEFAULT_MEDIA_MIME_BY_TYPE: Record<string, string> = {
  audio: "audio/ogg",
  audiomessage: "audio/ogg",
  audioinput: "audio/ogg",
  image: "image/jpeg",
  imagemessage: "image/jpeg",
  imageinput: "image/jpeg",
  video: "video/mp4",
  videomessage: "video/mp4",
  videoinput: "video/mp4",
  documentmessage: "application/pdf",
  documentwithcaptionmessage: "application/pdf",
  documentinput: "application/pdf",
};

function firstNonEmpty(...values: any[]) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");
}

function isUnsupportedGenericMime(mime: string) {
  return !mime || mime === "application/octet-stream" || mime === "binary/octet-stream";
}

function mimeFromDataUrl(value: any) {
  const match = String(value || "").match(/^data:([^;]+);base64,/i);
  return match?.[1]?.toLowerCase();
}

function mimeFromExtension(value: any) {
  const path = String(value || "").split("?")[0].toLowerCase();
  if (/\.(ogg|oga|opus)$/.test(path)) return "audio/ogg";
  if (/\.(mp3|mpeg|mpga)$/.test(path)) return "audio/mpeg";
  if (/\.(wav)$/.test(path)) return "audio/wav";
  if (/\.(m4a|aac)$/.test(path)) return "audio/aac";
  if (/\.(webm)$/.test(path)) return "audio/webm";
  if (/\.(jpg|jpeg)$/.test(path)) return "image/jpeg";
  if (/\.(png)$/.test(path)) return "image/png";
  if (/\.(webp)$/.test(path)) return "image/webp";
  if (/\.(gif)$/.test(path)) return "image/gif";
  if (/\.(mp4|m4v)$/.test(path)) return "video/mp4";
  if (/\.(mov)$/.test(path)) return "video/quicktime";
  if (/\.(pdf)$/.test(path)) return "application/pdf";
  return undefined;
}

function normalizeMediaMimeType(...candidates: any[]) {
  for (const candidate of candidates) {
    if (candidate === undefined || candidate === null) continue;
    const raw = String(candidate).trim().toLowerCase();
    if (!raw) continue;
    const clean = raw.split(";")[0].trim();
    if (/^[a-z0-9.+-]+\/[a-z0-9.+-]+$/i.test(clean)) {
      if (!isUnsupportedGenericMime(clean)) return clean;
      continue;
    }
    const byType = DEFAULT_MEDIA_MIME_BY_TYPE[clean];
    if (byType) return byType;
  }
  for (const candidate of candidates) {
    const fromExt = mimeFromExtension(candidate);
    if (fromExt) return fromExt;
  }
  return "application/octet-stream";
}

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

  // Sanitiza edges órfãs: opcional, mas vamos manter os logs para debug se necessário
  // removido o filtro agressivo que estava descartando edges válidas
  const validContainerIds = new Set<string>(containers.map((c: any) => c.id));
  const validNodeIds = new Set<string>();
  for (const c of containers) {
    if (c.nodes) {
      for (const n of c.nodes) {
        if (n.id) validNodeIds.add(n.id);
      }
    }
  }
  
  const orphanEdges = edges.filter((e: any) => {
    const sourceOk = validNodeIds.has(e.source) || validContainerIds.has(e.source);
    const targetOk = validNodeIds.has(e.target) || validContainerIds.has(e.target);
    return !sourceOk || !targetOk;
  });

  if (orphanEdges.length > 0) {
    console.log(`[runtime] ${orphanEdges.length} edges potencialmente órfãs detectadas:`, 
      orphanEdges.map((e: any) => `${e.source}->${e.target}`).join(", "));
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
  execution.channel_id = execution.channel_id || channel;
  execution.contact_id = execution.contact_id || contact_id;

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
  
  // Ensure system variables are available
  const channelValue = execution.channel_id || "webchat";
  console.log(`[runtime] Initializing variables for execution ${execution.id || 'new'}. Channel: ${channelValue}, Contact: ${execution.contact_id}`);
  
  if (!variables.channel) variables.channel = channelValue;
  if (!variables.contact_id) variables.contact_id = execution.contact_id;
  
  if (!variables.data) variables.data = {};
  // Always ensure data.channel is sync with the actual channel
  variables.data.channel = channelValue;
  variables.data.contact_id = execution.contact_id;
  
  console.log(`[runtime] System variables set. data:`, JSON.stringify(variables.data));
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
    let raw = String(value).toLowerCase().trim();
    
    // console.log(`[runtime:normalize] input="${value}", node="${currentNodeId}"`);


    // Se o handle for exatamente o ID do node ou começar com ele, tratamos como padrão/vazio
    if (currentNodeId && (raw === currentNodeId.toLowerCase() || raw.startsWith(`${currentNodeId.toLowerCase()}-`))) {
      // Mas precisamos checar se é um sufixo especial
      if (raw.endsWith("-else") || raw.endsWith("-senão") || raw.endsWith("-senao")) return "else";
      if (raw.endsWith("-default") || raw.endsWith("-padrão") || raw.endsWith("-padrao")) return "default";
      if (raw.includes("-cond-")) return "cond-" + raw.split("-cond-")[1];
      if (raw.includes("-btn-")) return "btn-" + raw.split("-btn-")[1];
      
      // Se for apenas o ID ou o ID seguido de algo não reconhecido, é o handle principal (vazio)
      return "";
    }
    
    // Fallbacks para strings que contêm as palavras chave
    if (raw.includes("else") || raw.includes("senão") || raw.includes("senao")) return "else";
    if (raw.includes("default") || raw.includes("padrão") || raw.includes("padrao")) return "default";
    
    // Mapeamento de botões (btn-ID)
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

    console.log(`[runtime:debug] Procurando saída para ${nodeId} no container ${container?.id}. Handle desejado: "${wantedHandle}". Edges candidatos: ${fromNode.length}`);
    
    // 1. Tenta match de handle (exato ou normalizado)
    let edge = fromNode.find((e: any) => {
      const normSource = normalizeHandle(e.sourceHandle, nodeId);
      const normWanted = normalizeHandle(wantedHandle, nodeId);
      const isMatch = e.sourceHandle === wantedHandle || (!!normSource && normSource === normWanted);
      
      if (wantedHandle) {
        console.log(`[runtime:debug]   Checando edge: handle="${e.sourceHandle}" -> target=${e.target} | NormSource="${normSource}", NormWanted="${normWanted}" | Match: ${isMatch}`);
      }
      
      return isMatch;
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
    const incomingType = input.messageType || input.mediaType || input.midiaType;
    const hasIncomingMessage = input.message !== undefined || input.button_id !== undefined || incomingType || input.base64 || input.mediaUrl;
    if (hasIncomingMessage) {
      ["base64", "image_base64", "audio_base64", "mediaUrl", "media_url", "mimetype", "mimeType", "mediaType", "midiaType", "url"].forEach((key) => {
        if (variables[key] !== undefined) delete variables[key];
      });
    }

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
    if (input.mimeType) variables["mimeType"] = input.mimeType;
    if (input.mediaType) variables["mediaType"] = input.mediaType;
    if (input.midiaType) variables["midiaType"] = input.midiaType;

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
        receivedAt: input.receivedAt,
        channel: variables.channel || "webchat"
      };
      
      // Salva tanto no padrão quanto em variáveis específicas se o input veio de um webhook
      variables["webhookData"] = webhookData;
      // Merge into existing 'data' object instead of overwriting it, to preserve system fields
      variables["data"] = { 
        ...(variables["data"] || {}), 
        ...webhookData 
      };
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
                "textInput": "textInput",
                "imageMessage": "imageInput",
                "imageInput": "imageInput",
                "videoMessage": "videoInput",
                "videoInput": "videoInput",
                "audioMessage": "audioInput",
                "audioInput": "audioInput",
                "documentMessage": "documentInput",
                "documentInput": "documentInput",
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

             if (channelValue === "webchat") {
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
             } else {
               // Para outros canais (como WhatsApp via Evolution), usamos os tipos reais da API
               variables[varName] = {
                 type: input.messageType || mappedType,
                 content: userValue, // Mantém o texto/legenda se houver, mas ignora o base64/URL no campo content principal
                 metadata: {
                   base64: input.base64,
                   link: input.mediaUrl,
                   caption: input.caption || input.message,
                   mimetype: input.mimetype,
                   fileName: input.fileName,
                   rawType: input.messageType
                 }
               };
             }
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
      // Se ainda temos um input não consumido (ex.: o fluxo foi iniciado por uma
      // mensagem do usuário e chegou agora a um node de input), consumimos esse
      // valor aqui em vez de aguardar uma nova mensagem. Isso evita que o usuário
      // precise enviar a mesma mídia/texto duas vezes para o bot prosseguir.
      if (input && !inputConsumed && (input.message !== undefined || input.button_id !== undefined || input.base64 || input.mediaUrl)) {
        const userValue = input.message ?? input.button_id ?? "";
        variables["last_message"] = userValue;
        const varName = cfg.variableName || cfg.saveVariable;
        if (varName) {
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
            let mappedType = typeMap[input.messageType] || "textInput";
            if (input.mimetype?.startsWith("image/")) mappedType = "imageInput";
            else if (input.mimetype?.startsWith("video/")) mappedType = "videoInput";
            else if (input.mimetype?.startsWith("audio/")) mappedType = "audioInput";
            else if (input.mimetype?.startsWith("application/")) mappedType = "documentInput";
            variables[varName] = channelValue === "webchat"
              ? {
                  type: mappedType,
                  content: input.mediaUrl || input.base64 || userValue,
                  metadata: { base64: input.base64, link: input.mediaUrl, caption: input.caption || input.message, mimetype: input.mimetype, fileName: input.fileName }
                }
              : {
                  type: input.messageType || mappedType,
                  content: userValue,
                  metadata: { base64: input.base64, link: input.mediaUrl, caption: input.caption || input.message, mimetype: input.mimetype, fileName: input.fileName, rawType: input.messageType }
                };
          } else {
            variables[varName] = userValue;
          }
        }
        console.log(`[runtime:input_consume_inline] consumindo input atual no node ${node.id} (${nodeType}) e prosseguindo`);
        inputConsumed = true;
        currentNodeId = nextFromNode(node.id, container, input.button_id);
        input = null;
        continue;
      }

      // IMPORTANTE: quando alcançamos um input-* DURANTE o loop sem input pendente,
      // paramos e aguardamos a próxima mensagem do usuário.
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
          // Merge into existing 'data' object instead of overwriting it
          variables["data"] = { 
            ...(variables["data"] || {}), 
            ...webhookData 
          };

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
          let fallbackId = nextFromNode(node.id, container); // sequential/container exit
          if (!fallbackId) {
            // Último recurso: pega qualquer edge saindo deste node de condição
            // (caso o "Senão" não tenha sido conectado, mas as condições levam a algum lugar)
            const anyEdge = edges.find((e: any) =>
              e.source === node.id ||
              (e.source === container.id && (String(e.sourceHandle || "") === node.id || String(e.sourceHandle || "").startsWith(`${node.id}-`)))
            );
            if (anyEdge) {
              console.log(`[runtime:condition] último fallback: seguindo edge "${anyEdge.sourceHandle}" -> ${anyEdge.target}`);
              fallbackId = findNode(anyEdge.target) ? anyEdge.target : firstNodeOfContainer(anyEdge.target);
            }
          }
          currentNodeId = fallbackId;
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
                // Tenta pegar de variáveis específicas ou do input universal
                const mediaUrl = variables["mediaUrl"] || variables["media_url"] || variables["url"] || 
                               (variables[variables.last_input_var]?.metadata?.link);
                const base64 = variables["base64"] || variables["image_base64"] || 
                             (variables[variables.last_input_var]?.metadata?.base64);
                const mimetype = variables["mimetype"] || 
                                (variables[variables.last_input_var]?.metadata?.mimetype) || "image/jpeg";

                if (base64) {
                  const b64Data = String(base64).replace(/^data:[a-z]+\/[a-z]+;base64,/, "");
                  userParts.push({ inline_data: { mime_type: mimetype, data: b64Data } });
                } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
                  try {
                    const imgRes = await fetch(mediaUrl);
                    if (imgRes.ok) {
                      const arrayBuffer = await imgRes.arrayBuffer();
                      const b64 = Buffer.from(arrayBuffer).toString('base64');
                      userParts.push({ inline_data: { mime_type: imgRes.headers.get("content-type") || mimetype, data: b64 } });
                    }
                  } catch (e) { console.error("[Gemini:AI-Node] failed to fetch media", e); }
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
            const userPrompt = replaceVars(input?.message || variables["last_message"] || "").trim();
            const exitKeywordsStr = cfg.exitKeywords || "sair,exit,parar,encerrar,voltar,quit,cancelar";
            const exitKeywords = exitKeywordsStr.split(",").map((k: string) => k.trim().toLowerCase());

            if (!isFirstTime && userPrompt && exitKeywords.includes(userPrompt.toLowerCase())) {
               console.log(`[ai-agent] user requested exit: ${userPrompt}`);
               const nextId = nextFromNode(node.id, container, "exit", true) || nextFromNode(node.id, container);
               return { 
                 messages: [...messages], 
                 variables, 
                 next_node_id: nextId, 
                 active_agent_node_id: null, 
                 mode: "flow", 
                 steps, 
                 status: nextId ? "running" : "completed" 
               };
            }

            // Extração de mídia: prioriza o retorno do HTTP getBase64FromMediaMessage,
            // sem apagar essas variáveis quando o input original do WhatsApp ainda está em memória.
            const inputMediaBase64 = input?.base64;
            const inputMediaUrl = input?.mediaUrl || input?.url;
            const inputMediaType = input?.mediaType || input?.midiaType || input?.messageType;
            const isMediaMessage = ["imageMessage", "audioMessage", "videoMessage", "documentMessage", "documentWithCaptionMessage"].includes(input?.messageType || "");

            const base64 = firstNonEmpty(inputMediaBase64, variables["base64"], variables["image_base64"], variables["audio_base64"]);
            const mediaUrl = firstNonEmpty(inputMediaUrl, variables["mediaUrl"], variables["media_url"], variables["url"]);
            const mimetype = normalizeMediaMimeType(
              input?.mimetype,
              input?.mimeType,
              variables["mimetype"],
              variables["mimeType"],
              mimeFromDataUrl(base64),
              variables["mediaType"],
              variables["midiaType"],
              inputMediaType,
              mediaUrl,
            );

            const hasMedia = !!(base64 || mediaUrl || isMediaMessage);

            console.log(`[ai-agent] node=${node.id} provider=${provider} hasMedia=${hasMedia} hasBase64=${!!base64} hasUrl=${!!mediaUrl} mimetype=${mimetype} userPromptLen=${userPrompt.length} isFirstTime=${isFirstTime}`);

            if (isFirstTime && cfg.welcomeMessage && !hasMedia && !userPrompt) {
               messages.push({ id: crypto.randomUUID(), type: "bot", content: replaceVars(cfg.welcomeMessage) });
               return { messages, waiting_for: "text", variables, next_node_id: node.id, active_agent_node_id: node.id, mode: "agent", steps, status: "waiting_input" };
            }

            // Processa se houver prompt do usuário OU se houver mídia (mesmo sem prompt de texto)
            if (userPrompt || hasMedia) {
              let aiReply = "";
              const instructions = replaceVars(cfg.instructions || "");
              
              if (provider === "openai") {
                const messages: any[] = [{ role: "system", content: instructions }];
                const userContent: any[] = [];
                
                if (userPrompt) {
                  userContent.push({ type: "text", text: userPrompt });
                } else if (hasMedia) {
                  userContent.push({ type: "text", text: "Processe o conteúdo enviado (mídia)." });
                }

                if (base64) {
                  const b64 = String(base64).startsWith("data:") ? base64 : `data:${mimetype};base64,${base64}`;
                  userContent.push({ type: "image_url", image_url: { url: b64 } });
                } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
                  userContent.push({ type: "image_url", image_url: { url: mediaUrl } });
                }

                messages.push({ role: "user", content: userContent });

                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: cfg.model || "gpt-4o-mini",
                    messages: messages,
                  }),
                });
                if (res.ok) {
                  const data: any = await res.json();
                  aiReply = data.choices?.[0]?.message?.content || "";
                  console.log(`[ai-agent:openai] reply len=${aiReply.length}`);
                } else {
                  const errText = await res.text().catch(() => "");
                  console.error(`[ai-agent:openai] HTTP ${res.status}: ${errText.slice(0, 500)}`);
                }
              } else if (provider === "gemini") {
                const model = cfg.model || "gemini-2.0-flash";
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;

                const userParts: any[] = [];
                if (userPrompt) {
                  userParts.push({ text: userPrompt });
                } else if (hasMedia) {
                  userParts.push({ text: "Processe o conteúdo enviado (mídia)." });
                }

                if (base64) {
                  const b64Data = String(base64).replace(/^data:[^;]+;base64,/, "");
                  userParts.push({ inline_data: { mime_type: mimetype, data: b64Data } });
                } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
                  try {
                    const imgRes = await fetch(mediaUrl);
                    if (imgRes.ok) {
                      const arrayBuffer = await imgRes.arrayBuffer();
                      const b64 = Buffer.from(arrayBuffer).toString('base64');
                      const ct = normalizeMediaMimeType(imgRes.headers.get("content-type"), mimetype, mediaUrl);
                      userParts.push({ inline_data: { mime_type: ct, data: b64 } });
                    } else {
                      console.error(`[ai-agent:gemini] fetch media HTTP ${imgRes.status}`);
                    }
                  } catch (e) { console.error("[ai-agent:gemini] failed to fetch media", e); }
                }

                console.log(`[ai-agent:gemini] calling model=${model} parts=${userParts.length} inlineData=${userParts.some(p => p.inline_data)}`);
                const res = await fetch(url, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    system_instruction: { parts: [{ text: instructions }] },
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
                  console.log(`[ai-agent:gemini] reply len=${aiReply.length} finishReason=${data.candidates?.[0]?.finishReason}`);
                  if (!aiReply) {
                    console.error(`[ai-agent:gemini] empty reply. Full response: ${JSON.stringify(data).slice(0, 800)}`);
                  }
                } else {
                  const errText = await res.text().catch(() => "");
                  console.error(`[ai-agent:gemini] HTTP ${res.status}: ${errText.slice(0, 500)}`);
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
