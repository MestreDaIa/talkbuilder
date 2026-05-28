// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-embed-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const runtimeMemory = new Map<string, { state: any; expiresAt: number }>();
const MEMORY_TTL_MS = 1000 * 60 * 60 * 6;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "https://fwoescubnnagdvwasbjl.supabase.co",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, flow_id: flowRef, contact_id, channel = "webchat", payload } = body || {};

    if (!action || !flowRef || !contact_id) {
      return json({ error: "missing required fields: action, flow_id, contact_id" }, 400);
    }

    // 1. Resolve Flow (try public_id first, then id)
    let flow: any = null;
    {
      const { data } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("public_id", flowRef)
        .maybeSingle();
      flow = data;
    }
    if (!flow && /^[0-9a-f-]{36}$/i.test(flowRef)) {
      const { data } = await supabase
        .from("chatbot_flows")
        .select("*")
        .eq("id", flowRef)
        .maybeSingle();
      flow = data;
    }
    if (!flow) return json({ error: "Flow não encontrado", flow_id: flowRef }, 404);

    const containers = flow.published_containers || flow.draft_containers || [];
    const edges = flow.published_edges || flow.draft_edges || [];

    if (!containers.length) {
      return json({ error: "Fluxo vazio (nenhum container)" }, 400);
    }

    // 2. Session
    let session: any = null;
    try {
      const { data: existing } = await supabase
        .from("conversation_sessions")
        .select("*")
        .eq("flow_id", flow.id)
        .eq("contact_id", contact_id)
        .eq("channel_id", channel)
        .eq("status", "active")
        .order("last_interaction_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      session = existing;
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
    if (action === "start") {
      try {
        const { data: existing } = await supabase
          .from("flow_executions")
          .select("*")
          .eq("flow_id", flow.id)
          .eq("contact_id", contact_id)
          .eq("channel_id", channel)
          .maybeSingle();
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
      } catch (e) {
        console.warn("[runtime] execution table missing", e);
      }
    } else {
      try {
        const { data: existing } = await supabase
          .from("flow_executions")
          .select("*")
          .eq("flow_id", flow.id)
          .eq("contact_id", contact_id)
          .eq("channel_id", channel)
          .maybeSingle();
        execution = existing;
      } catch {}
    }

    const memoryKey = `${flow.id}:${channel}:${contact_id}`;
    const clientState = payload?.runtime_state || body?.runtime_state || readMemoryState(memoryKey);

    if (!execution) {
      execution = normalizeClientState(clientState);
    } else if (action !== "start" && clientState?.current_node_id) {
      execution = { ...execution, ...normalizeClientState(clientState), id: execution.id };
    }

    // Executar Fluxo
    const result = await runFlow(execution, containers, edges, payload, flow, supabase);

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
      last_execution_status: result.status
    };
    writeMemoryState(memoryKey, runtimeState);

    return json({
      messages: result.messages,
      waiting_for: result.waiting_for,
      wait_ms: result.wait_ms,
      buttons: result.buttons,
      session_id: session?.id ?? null,
      runtime_state: runtimeState,
      debug: { node: result.next_node_id, steps: result.steps, status: result.status },
    });
  } catch (err: any) {
    console.error("[runtime] fatal", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeClientState(state: any) {
  return {
    id: null,
    current_node_id: typeof state?.current_node_id === "string" ? state.current_node_id : null,
    active_agent_node_id: state?.active_agent_node_id || null,
    variables: state?.variables && typeof state.variables === "object" ? state.variables : {},
    waiting_for_input: !!state?.waiting_for_input,
    is_waiting_time: !!state?.is_waiting_time,
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

async function runFlow(execution: any, containersIn: any[], edgesIn: any[], input: any, flow: any, supabase: any, visitedRedirects = new Set<string>()) {
  if (flow?.id) {
    // We don't block by flow ID anymore to allow A -> B -> A
  }
  let containers: any[] = containersIn;
  let edges: any[] = edgesIn;
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

  const normalizeHandle = (value?: string | null) => {
    if (!value) return "";
    let raw = String(value);
    // Remove prefixo de ID de node se existir (ex: node-123-cond-abc -> cond-abc)
    if (raw.includes("-cond-")) raw = "cond-" + raw.split("-cond-")[1];
    else if (raw.includes("-btn-")) raw = "btn-" + raw.split("-btn-")[1];
    else if (raw.endsWith("-else")) raw = "else";
    else if (raw.endsWith("-default")) raw = "default";
    
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

    // 1. Tenta match exato ou normalizado
    let edge = fromNode.find((e: any) => 
      wantedHandle && (e.sourceHandle === wantedHandle || normalizeHandle(e.sourceHandle) === normalizeHandle(wantedHandle))
    );

    // 2. Fallbacks
    if (!edge && !strictHandle) {
      edge = fromNode.find((e: any) => normalizeHandle(e.sourceHandle) === "default" || normalizeHandle(e.sourceHandle) === "else");
      if (!edge) edge = fromNode.find((e: any) => !e.sourceHandle);
    }

    if (edge) {
      if (findNode(edge.target)) return edge.target;
      const first = firstNodeOfContainer(edge.target);
      if (first) return first;
      return edge.target;
    }
    // Fallback: avançar para o próximo node dentro do mesmo bloco (ordem do array).
    // Nodes internos não possuem edges entre si — são sequenciais.
    if (container?.nodes?.length) {
      const idx = container.nodes.findIndex((n: any) => n.id === nodeId);
      if (idx >= 0 && idx < container.nodes.length - 1) {
        return container.nodes[idx + 1].id;
      }
    }
    const cEdge = edges.find((e: any) => e.source === container.id && !e.sourceHandle);
    if (cEdge) {
      if (findNode(cEdge.target)) return cEdge.target;
      return firstNodeOfContainer(cEdge.target);
    }
    return null;
  };

  const firstText = (...values: any[]) => {
    const value = values.find((v) => typeof v === "string" && v.trim() !== "");
    return value ? String(value) : "";
  };

  const decodeText = (text: string) =>
    String(text || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();

  const replaceVars = (text: string) =>
    !text ? text : decodeText(text).replace(/{{(.*?)}}/g, (_, k) => variables[k.trim()] ?? `{{${k}}}`);

  const collectAgentSkills = (agentNodeId?: string | null) => containers.flatMap((container: any) =>
    (container.nodes || [])
      .filter((node: any) => node.id !== agentNodeId && node.config?.isSkill)
      .map((node: any) => ({
        id: node.id,
        type: node.type,
        containerId: container.id,
        containerName: container.nameContainer || `Bloco #${String(container.id).slice(-4)}`,
        description: String(node.config?.skillDescription || "Use quando esta ação for útil para atender o usuário."),
        label: node.type === "redirect"
          ? `Redirecionar para ${node.config?.targetFlowName || node.config?.targetFlow || "outro fluxo"}`
          : node.type === "go-to"
            ? `Ir para ${node.config?.targetContainerName || node.config?.targetContainerId || "outro bloco"}`
            : String(node.config?.name || node.config?.label || node.type),
      }))
  );

  const buildSkillSystemPrompt = (skills: any[]) => {
    if (!skills.length) return "\n\n[SKILLS DISPONÍVEIS]\nNenhuma skill foi habilitada nos outros nodes deste fluxo.";
    const list = skills.map((skill, index) => `${index + 1}. ID: ${skill.id}\nTipo: ${skill.type}\nBloco: ${skill.containerName}\nNome: ${skill.label}\nInstrução da skill: ${skill.description}`).join("\n\n");
    return `\n\n[SKILLS DISPONÍVEIS PARA O AGENTE]\n${list}\n\nQuando a mensagem do usuário combinar com a instrução de uma skill, use a ferramenta use_skill com o ID exato da skill. Se a chamada de ferramenta não estiver disponível, responda apenas com JSON neste formato: {"skill_id":"ID_DA_SKILL","message":"mensagem opcional"}. Não invente perguntas antes de usar uma skill claramente solicitada.`;
  };

  const buildUseSkillTool = (skills: any[]) => skills.length ? {
    type: "function",
    function: {
      name: "use_skill",
      description: "Executa um node marcado como Skill/Ferramenta IA no fluxo atual.",
      parameters: {
        type: "object",
        properties: {
          skill_id: { type: "string", enum: skills.map((skill: any) => skill.id), description: "ID exato do node skill que deve ser executado." },
          message: { type: "string", description: "Mensagem curta para avisar o usuário antes de executar a skill." }
        },
        required: ["skill_id"]
      }
    }
  } : undefined;

  const parseSkillFromText = (reply: string | null) => {
    if (!reply) return null;
    const jsonMatch = reply.match(/\{[\s\S]*"skill_id"[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed?.skill_id ? { skill_id: String(parsed.skill_id), message: parsed.message ? String(parsed.message) : "" } : null;
    } catch {
      return null;
    }
  };

  const getVariableValue = (variableName: string) => {
    const key = String(variableName || "").trim().replace(/^{{\s*/, "").replace(/\s*}}$/, "");
    return key ? variables[key] : undefined;
  };

  const evaluateComparison = (comparison: any) => {
    const rawValue = getVariableValue(comparison?.variableName);
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

  const parseWaitMs = (cfg: any) => {
    const rawTime = Number(cfg.waitTime ?? cfg.duration ?? cfg.seconds ?? 5);
    const safeTime = Number.isFinite(rawTime) && rawTime > 0 ? Math.min(rawTime, 24 * 60 * 60) : 5;
    const unit = String(cfg.timeUnit ?? cfg.unit ?? "seconds").toLowerCase();
    const multiplier = unit.startsWith("hour") || unit.startsWith("hora")
      ? 60 * 60 * 1000
      : unit.startsWith("minute") || unit.startsWith("minuto")
        ? 60 * 1000
        : 1000;
    return Math.round(safeTime * multiplier);
  };

  // 1. Processar Entrada do Usuário
  let inputConsumed = false;
  if (input && (input.message !== undefined || input.button_id !== undefined)) {
    console.log("[runtime:input_received]", input);
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

        // Se o nó estava aguardando, agora podemos avançar (exceto para agentes)
        if (nodeType !== "ai-agent") {
            currentNodeId = nextFromNode(info.node.id, info.container, input.button_id);
            // Consumimos a entrada: o loop não deve usá-la novamente para o próximo input
            inputConsumed = true;
            input = null; 
        }
      }
    }

  }


  // 2. Encontrar Nó de Início
  if (!currentNodeId) {
    for (const c of containers) {
      const startNode = (c.nodes || []).find((n: any) => n.type === "start");
      if (startNode) {
        currentNodeId = startNode.id;
        break;
      }
    }
    if (!currentNodeId && containers[0]?.nodes?.[0]) {
      currentNodeId = containers[0].nodes[0].id;
    }
  }

  // 3. Loop de Execução
  while (currentNodeId && steps < 100) {
    steps++;
    const info = findNode(currentNodeId);
    if (!info) {
      console.warn("[node:not_found]", currentNodeId);
      break;
    }

    const { node, container } = info;
    const cfg = node.config || {};
    const nodeType = (node.type || "").toLowerCase();

    console.log(`[node:start] [${nodeType}] ${node.id}`);

    if (nodeType === "wait" || nodeType === "await") {
      if (!execution.is_waiting_time) {
        wait_ms = parseWaitMs(cfg);
        console.log(`[node:paused] Wait ${wait_ms}ms`);
        status = "paused";
        break; 
      } else {
        execution.is_waiting_time = false;
        currentNodeId = nextFromNode(node.id, container);
        continue;
      }
    }

    // Comportamento de Entrada
    if (nodeType.startsWith("input-")) {
      if (!input || (input.message === undefined && input.button_id === undefined)) {
        console.log("[node:waiting_input]", node.id);
        waiting_for = nodeType === "input-buttons" ? "buttons" : "text";
        if (nodeType === "input-buttons") {
          buttons = (cfg.buttons || []).map((b: any) => ({
            id: b.id,
            label: b.label || b.text || b.value || "",
            value: b.value,
          }));
        }
        status = "waiting_input";
        break;
      }
    }

    // AI Node (Execução Única)
    if (nodeType === "ai-node") {
      const hasUserInput = !!(variables["last_message"] && String(variables["last_message"]).trim());
      if (!hasUserInput) {
        console.log("[node:ai_skipped] sem input do usuário", node.id);
        currentNodeId = nextFromNode(node.id, container);
        continue;
      }
      if (cfg.waitForInput && (!input || (input.message === undefined && input.button_id === undefined))) {
        console.log("[node:waiting_input] AI Node", node.id);
        waiting_for = "text";
        status = "waiting_input";
        break;
      }

      console.log("[node:ai_generating] AI Node", node.id);
      const objective = cfg.objective || cfg.systemPrompt || "assistente";
      const instructions = cfg.instructions || cfg.prompt || cfg.message || "";
      const userMessage = String(variables["last_message"] || "").trim();

      let kbContext = "";
      if (cfg.kbFilesEnabled !== false && cfg.kbFiles?.length) {
        const filesContent = cfg.kbFiles
          .filter((f: any) => f.content)
          .map((f: any) => `### Arquivo: ${f.name}\n${f.content}`)
          .join("\n\n");
        if (filesContent) kbContext += `\n\n[CONHECIMENTO - ARQUIVOS]\n${filesContent}`;
      }

      if (cfg.kbLinksEnabled !== false && cfg.kbLinks?.length) {
        const linksContent = cfg.kbLinks
          .filter((l: any) => l.url)
          .map((l: any) => `### Fonte (URL): ${l.url}\n${l.content ? `Conteúdo:\n${l.content}` : ""}`)
          .join("\n\n");
        if (linksContent) kbContext += `\n\n[CONHECIMENTO - LINKS]\n${linksContent}`;
      }

      let systemPrompt = `Você é um assistente virtual especializado.\nObjetivo: ${objective}\nInstruções: ${instructions}`;
      if (kbContext) {
        systemPrompt += `\n\n[INSTRUÇÕES DA BASE DE CONHECIMENTO]\nResponda o usuário BASEANDO-SE EXCLUSIVAMENTE nas informações abaixo. Se a pergunta for sobre algo não mencionado, diga que não encontrou essa informação específica na base de dados, mas tente ser útil com o que você sabe.\n\n${kbContext}`;
      }
      const provider = (cfg.provider || "openai").toLowerCase();
      const nodeKey = cfg.apiKey;
      const globalKeys = flow?.settings?.aiKeys || {};
      const activeKey = globalKeys[`${provider}Key`] || nodeKey;

      if (activeKey) {
        try {
          let aiReply = "";
          if (provider === "openai") {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: cfg.model || "gpt-4o-mini",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage || "Olá" }],
              }),
            });
            if (res.ok) {
              const data = await res.json();
              aiReply = data.choices?.[0]?.message?.content || "";
            }
          } else if (provider === "google" || provider === "gemini") {
            const model = cfg.model || "gemini-2.0-flash";
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ parts: [{ text: userMessage || "Olá" }] }],
              }),
            });
            if (res.ok) {
              const data = await res.json();
              aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
            }
          }

          if (aiReply) {
            messages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
            if (cfg.saveVariable) variables[cfg.saveVariable] = aiReply;
          }
        } catch (e) {
          console.error("[ai-node] failed", e);
        }
      } else {
        messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ AI Key não configurada." });
      }

      console.log("[node:ai_completed] AI Node", node.id);
      currentNodeId = nextFromNode(node.id, container);
      continue;
    }

    // Agent AI Node (Contínuo)
    if (nodeType === "ai-agent") {
      mode = "agent";
      activeAgentNodeId = node.id;

      const startMode = cfg.startMode || "automatic";
      const welcomeMessage = cfg.welcomeMessage || "";

      // Se acabamos de entrar e tem saudação
      if (!input && startMode === "automatic" && welcomeMessage && messages.length === 0) {
        messages.push({ id: crypto.randomUUID(), type: "bot", content: replaceVars(welcomeMessage) });
        waiting_for = "text";
        status = "waiting_input";
        break;
      }

      if (!input || (input.message === undefined && input.button_id === undefined)) {
        waiting_for = "text";
        status = "waiting_input";
        break;
      }

      const userMsg = String(input.message || "").toLowerCase();
      const exitPhrases = ["voltar menu", "sair", "parar", "cancelar", "exit", "stop"];
      if (exitPhrases.some(p => userMsg.includes(p))) {
        console.log("[node:agent_exit]", node.id);
        mode = "flow";
        activeAgentNodeId = null;
        currentNodeId = nextFromNode(node.id, container);
        continue;
      }

      console.log("[node:ai_generating] Agent", node.id);
      const objective = cfg.objective || "assistente conversacional";
      const instructions = cfg.instructions || "Ajude o usuário de forma natural.";
      const skills = cfg.toolCallingEnabled === false ? [] : collectAgentSkills(node.id);
      const useSkillTool = buildUseSkillTool(skills);
      const provider = (cfg.provider || "openai").toLowerCase();
      const nodeKey = cfg.apiKey;
      const globalKeys = flow?.settings?.aiKeys || {};
      const activeKey = globalKeys[`${provider}Key`] || nodeKey;
      const systemPrompt = `Você é um agente autônomo do fluxo.\nObjetivo: ${objective}\nInstruções: ${instructions}${buildSkillSystemPrompt(skills)}\n\nResponda de forma natural. Se usar uma skill, acione a ferramenta e não apenas diga que vai acionar.`;
      let aiReply = "";
      let skillCall: any = null;

      if (activeKey) {
        try {
          if (provider === "openai") {
            const res = await fetch("https://api.openai.com/v1/chat/completions", {
              method: "POST",
              headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: cfg.model || "gpt-4o-mini",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMsg || "Olá" }],
                ...(useSkillTool ? { tools: [useSkillTool], tool_choice: "auto" } : {}),
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const msg = data.choices?.[0]?.message;
              const toolCall = msg?.tool_calls?.find((call: any) => call?.function?.name === "use_skill");
              if (toolCall?.function?.arguments) {
                const args = JSON.parse(toolCall.function.arguments);
                skillCall = args?.skill_id ? { skill_id: String(args.skill_id), message: args.message } : null;
              }
              aiReply = msg?.content || "";
            }
          } else if (provider === "google" || provider === "gemini") {
            const model = cfg.model || "gemini-2.0-flash";
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                system_instruction: { parts: [{ text: systemPrompt }] },
                contents: [{ role: "user", parts: [{ text: userMsg || "Olá" }] }],
                ...(useSkillTool ? {
                  tools: [{ function_declarations: [{
                    name: useSkillTool.function.name,
                    description: useSkillTool.function.description,
                    parameters: useSkillTool.function.parameters
                  }] }],
                  tool_config: { function_calling_config: { mode: "AUTO" } }
                } : {})
              }),
            });
            if (res.ok) {
              const data = await res.json();
              const parts = data.candidates?.[0]?.content?.parts || [];
              const fn = parts.find((part: any) => part.functionCall?.name === "use_skill")?.functionCall;
              if (fn?.args?.skill_id) skillCall = { skill_id: String(fn.args.skill_id), message: fn.args.message };
              aiReply = parts.map((part: any) => part.text).filter(Boolean).join("\n").trim();
            }
          }
        } catch (e) {
          console.error("[agent-node] failed", e);
        }
      } else {
        messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ AI Key não configurada." });
      }

      skillCall = skillCall || parseSkillFromText(aiReply);
      if (skillCall?.skill_id && skills.some((skill: any) => skill.id === skillCall.skill_id)) {
        const notice = String(skillCall.message || "").trim();
        if (notice) messages.push({ id: crypto.randomUUID(), type: "bot", content: notice });
        const skillResult = await runFlow(
          { ...execution, current_node_id: skillCall.skill_id, active_agent_node_id: null, runtime_mode: "flow", waiting_for_input: false, is_waiting_time: false },
          containers,
          edges,
          null,
          flow,
          supabase,
          visitedRedirects
        );
        messages.push(...(skillResult.messages || []));
        if (skillResult.buttons?.length) buttons = skillResult.buttons;
        if (skillResult.waiting_for) waiting_for = skillResult.waiting_for;
        return { ...skillResult, messages, steps: steps + skillResult.steps };
      }
      if (aiReply) messages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
      
      // Para o agente, sempre voltamos a aguardar input
      waiting_for = "text";
      status = "waiting_input";
      break; 
    }

    // Outros Nodes (bubbles, set-variable, etc.)
    switch (nodeType) {
      case "bubble-text":
      case "bubble-number": {
        const content = replaceVars(firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value));
        if (content) messages.push({ id: crypto.randomUUID(), type: "bot", content });
        break;
      }
      case "bubble-image":
        messages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.ImageURL, cfg.imageUrl, cfg.url, cfg.src), isImage: true, alt: firstText(cfg.ImageAlt, cfg.alt) });
        break;
      case "set-variable":
        if (cfg.variableName) variables[cfg.variableName] = replaceVars(String(cfg.value || ""));
        break;
      case "condition": {
        const conditions = cfg.conditions || [];
        const matchedCondition = conditions.find(evaluateCondition);
        const conditionHandle = matchedCondition ? `${node.id}-cond-${matchedCondition.id}` : `${node.id}-else`;
        currentNodeId = nextFromNode(node.id, container, conditionHandle, true);
        continue;
      }
      case "redirect": {
        const targetRef = cfg.targetFlow || cfg.targetFlowId;
        if (!targetRef) {
          console.warn("[node:redirect] sem targetFlow", node.id);
          currentNodeId = null;
          break;
        }
        console.log(`[node:redirect] carregando fluxo ${targetRef}`);
        const redirectKey = `${node.id}:${targetRef}`;
        if (visitedRedirects.has(redirectKey)) {
          console.warn("[node:redirect] loop detectado no node", node.id);
          messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ Loop de redirecionamento detectado." });
          currentNodeId = null;
          break;
        }
        visitedRedirects.add(redirectKey);

        let targetFlow: any = null;
        try {
          const { data: byId } = await supabase
            .from("chatbot_flows")
            .select("*")
            .eq("id", targetRef)
            .maybeSingle();
          targetFlow = byId;
          if (!targetFlow) {
            const { data: byPublic } = await supabase
              .from("chatbot_flows")
              .select("*")
              .eq("public_id", targetRef)
              .maybeSingle();
            targetFlow = byPublic;
          }
        } catch (e) {
          console.error("[node:redirect] erro ao carregar fluxo", e);
        }
        if (!targetFlow) {
          messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ Fluxo de destino não encontrado." });
          currentNodeId = null;
          break;
        }
        const newContainers = targetFlow.published_containers || targetFlow.draft_containers || [];
        const newEdges = targetFlow.published_edges || targetFlow.draft_edges || [];
        if (!newContainers.length) {
          messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ Fluxo de destino vazio." });
          currentNodeId = null;
          break;
        }
        // Recursivamente executa o novo fluxo
        const redirectResult = await runFlow(
          { 
            ...execution, 
            current_node_id: cfg.startNodeId || null, 

            waiting_for_input: false,
            is_waiting_time: false 
          }, 
          newContainers, 
          newEdges, 
          null, 
          targetFlow, 
          supabase,
          visitedRedirects
        );

        messages.push(...redirectResult.messages);
        if (redirectResult.buttons?.length) buttons = redirectResult.buttons;
        if (redirectResult.waiting_for) waiting_for = redirectResult.waiting_for;
        
        return {
          ...redirectResult,
          messages, // Acumula mensagens
          steps: steps + redirectResult.steps
        };
      }
    }

    currentNodeId = nextFromNode(node.id, container);
    console.log(`[node:completed] ${node.id} → next: ${currentNodeId}`);
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

