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
  } else if (action !== "start" && clientState?.current_node_id) {
    // Apenas sobrescreve se o estado for válido
    const newState = normalizeClientState(clientState);
    if (newState.current_node_id) {
       execution = { ...execution, ...newState, id: execution.id };
    }
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

  const decodeText = (text: string) =>
    String(text || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .trim();

  const replaceVars = (text: string) =>
    !text ? text : decodeText(text).replace(/{{(.*?)}}/g, (_, k) => variables[k.trim()] ?? `{{${k}}}`);

  const evaluateComparison = (comparison: any) => {
    const key = String(comparison?.variableName || "").trim().replace(/^{{\s*/, "").replace(/\s*}}$/, "");
    const rawValue = key ? variables[key] : undefined;
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
    if (input.remoteJid) variables["remoteJid"] = input.remoteJid;
    if (input.pushName) variables["pushName"] = input.pushName;
    if (input.instanceName) variables["instanceName"] = input.instanceName;
    if (input.serverUrl) variables["serverUrl"] = input.serverUrl;
    if (input.apiKey) variables["apiKey"] = input.apiKey;
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
         const nodeType = (info.node.type || "").toLowerCase();
         const varName = cfg.variableName || cfg.saveVariable;
         if (varName && userValue !== undefined) variables[varName] = userValue;

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
      waiting_for = nodeType === "input-buttons" ? "buttons" : "text";
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
              const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: cfg.model || "gpt-4o-mini",
                  messages: [{ role: "system", content: systemPrompt + context }, { role: "user", content: userPrompt }],
                }),
              });
              if (res.ok) {
                const data: any = await res.json();
                aiReply = data.choices?.[0]?.message?.content || "";
              }
            } else if (provider === "gemini") {
              const model = cfg.model || "gemini-2.0-flash";
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`;
              const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contents: [{ parts: [{ text: `Instructions: ${systemPrompt}${context}\n\nUser: ${userPrompt}` }] }] }),
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
      case "redirect": {
        const targetRef = cfg.targetFlow || cfg.targetFlowId;
        if (!targetRef || visitedRedirects.has(targetRef)) {
          console.warn(`[runtime:redirect] abortando redirect para ${targetRef} (circular ou vazio)`);
          break;
        }
        
        console.log(`[runtime:redirect] redirecionando para o fluxo: ${targetRef}`);
        visitedRedirects.add(targetRef);

        // Busca o novo fluxo
        const { data: targetFlow } = await supabase
          .from("chatbot_flows")
          .select("*")
          .or(`id.eq.${targetRef},public_id.eq.${targetRef}`)
          .maybeSingle();

        if (!targetFlow) {
          messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ Fluxo de destino não encontrado." });
          break;
        }

        // Executa o novo fluxo recursivamente, passando as variáveis atuais
        const subExecution = {
          current_node_id: cfg.startNodeId || null,
          variables: { ...variables },
          runtime_mode: "flow"
        };

        const targetContainers = targetFlow.published_containers || targetFlow.draft_containers || [];
        const targetEdges = targetFlow.published_edges || targetFlow.draft_edges || [];

        const subResult = await runFlow(subExecution, targetContainers, targetEdges, null, targetFlow, supabase, visitedRedirects);
        
        // Mescla resultados
        messages.push(...(subResult.messages || []));
        Object.assign(variables, subResult.variables || {});
        
        // O estado final será o do novo fluxo
        return {
          ...subResult,
          messages,
          variables,
          steps: steps + (subResult.steps || 0)
        };
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
