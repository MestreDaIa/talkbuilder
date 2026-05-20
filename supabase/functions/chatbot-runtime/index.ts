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
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
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

    // 2. Session (best-effort - don't fail if table missing)
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

    // 3. Execution state (best-effort)
    let execution: any = null;
    if (action === "start") {
      // Reset on explicit start
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
            .update({ current_node_id: null, variables: {}, waiting_for_input: false })
            .eq("id", existing.id);
          execution = { ...existing, current_node_id: null, variables: {}, waiting_for_input: false };
        } else {
          const { data: created } = await supabase
            .from("flow_executions")
            .insert({ workspace_id: flow.user_id, flow_id: flow.id, contact_id, channel_id: channel })
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
      // Use state from client if it exists and we're not starting fresh
      execution = { ...execution, ...normalizeClientState(clientState), id: execution.id };
    }

    const result = await runFlow(execution, containers, edges, payload, flow?.settings || {});

    // Persist new state
    if (execution.id) {
      try {
        await supabase
          .from("flow_executions")
          .update({
            current_node_id: result.next_node_id,
            variables: result.variables,
            waiting_for_input: !!result.waiting_for,
            updated_at: new Date().toISOString(),
          })
          .eq("id", execution.id);
      } catch {}
    }

    const runtimeState = {
      current_node_id: result.next_node_id,
      variables: result.variables,
      waiting_for_input: !!result.waiting_for,
      is_waiting_time: result.wait_ms > 0,
    };
    writeMemoryState(memoryKey, runtimeState);

    return json({
      messages: result.messages,
      waiting_for: result.waiting_for,
      wait_ms: result.wait_ms,
      buttons: result.buttons,
      session_id: session?.id ?? null,
      runtime_state: runtimeState,
      debug: { node: result.next_node_id, steps: result.steps },
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
    variables: state?.variables && typeof state.variables === "object" ? state.variables : {},
    waiting_for_input: !!state?.waiting_for_input,
    is_waiting_time: !!state?.is_waiting_time, // Restore the wait timer flag
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

async function runFlow(execution: any, containers: any[], edges: any[], input: any, settings: any = {}) {
  let currentNodeId: string | null = execution.current_node_id;
  const variables: Record<string, any> = { ...(execution.variables || {}) };
  const messages: any[] = [];
  let waiting_for: string | null = null;
  let buttons: any[] = [];
  let wait_ms = 0;
  let steps = 0;

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

  const firstRunnableNodeOfContainer = (container: any): string | null => {
    if (!container?.nodes?.length) return null;
    const explicitStart = container.nodes.find((node: any) => node.type === "start");
    return explicitStart?.id ?? container.nodes[0].id;
  };

  const resolveGraphStartNode = (): string | null => {
    const explicitStart = containers.flatMap((container: any) => container.nodes || []).find((node: any) => node.type === "start");
    if (explicitStart) return explicitStart.id;

    const containerById = new Map(containers.map((container: any) => [container.id, container]));
    const incomingContainerIds = new Set<string>();

    for (const edge of edges || []) {
      if (!edge?.target) continue;
      if (containerById.has(edge.target)) {
        incomingContainerIds.add(edge.target);
        continue;
      }
      const targetNode = findNode(edge.target);
      if (targetNode) incomingContainerIds.add(targetNode.container.id);
    }

    const byCanvasPosition = (a: any, b: any) => {
      const ax = Number(a?.position?.x ?? 0);
      const bx = Number(b?.position?.x ?? 0);
      if (ax !== bx) return ax - bx;
      return Number(a?.position?.y ?? 0) - Number(b?.position?.y ?? 0);
    };

    const rootContainers = containers
      .filter((container: any) => (container.nodes || []).length > 0 && !incomingContainerIds.has(container.id))
      .sort(byCanvasPosition);
    const startContainer = rootContainers[0] ?? containers.filter((container: any) => (container.nodes || []).length > 0).sort(byCanvasPosition)[0];
    return firstRunnableNodeOfContainer(startContainer);
  };

  const normalizeHandle = (value?: string | null) => {
    if (!value) return "";
    const raw = String(value);
    const buttonMatch = raw.match(/-btn-(.+)$/);
    if (buttonMatch?.[1]) return buttonMatch[1];
    if (raw.endsWith("-default")) return "default";
    return raw;
  };

  const nextFromNode = (nodeId: string, container: any, handle?: string, strictHandle = false): string | null => {
    const resolveTarget = (target: string): string | null => {
      if (!target) return null;
      if (findNode(target)) return target;
      return firstNodeOfContainer(target);
    };
    const isInnerNodeHandle = (value?: string | null) =>
      !!value && String(value).startsWith(`${nodeId}-`);
    const wantedHandle = normalizeHandle(handle);
    const validEdges = edges.filter((e: any) => resolveTarget(e.target) !== null);
    const fromNode = validEdges.filter(
      (e: any) => e.source === nodeId || (e.source === container.id && isInnerNodeHandle(e.sourceHandle))
    );
    let edge = fromNode.find((e: any) => wantedHandle && normalizeHandle(e.sourceHandle) === wantedHandle);
    if (!edge && strictHandle) return null;
    if (!edge && wantedHandle) edge = fromNode.find((e: any) => normalizeHandle(e.sourceHandle) === "default");
    if (!edge) edge = fromNode.find((e: any) => !e.sourceHandle);
    if (!edge) edge = fromNode[0];
    if (edge) return resolveTarget(edge.target);
    // fallback: container-level edge
    const cEdge = validEdges.find((e: any) => e.source === container.id && !e.sourceHandle);
    if (cEdge) return resolveTarget(cEdge.target);
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

  // Handle input and advance
  if (input && (input.message !== undefined || input.button_id !== undefined) && currentNodeId) {
    const info = findNode(currentNodeId);
    if (info) {
      const cfg = info.node.config || {};
      const nodeType = (info.node.type || "").toLowerCase();
      const varName = cfg.variableName || cfg.saveVariable;
      const value = input.message ?? input.button_id;
      
      if (varName && value !== undefined) variables[varName] = value;
      
      if (nodeType === "ai-agent") {
        // AGENT: persiste no mesmo node (loop conversacional)
        variables.__last_agent_user_message = value ?? "";
        console.log("[Runtime] Mantendo modo AGENTE no node:", info.node.id);
      } else if (nodeType === "ai-node") {
        // AI pontual: usa input para gerar resposta e DEPOIS avança
        variables.__last_agent_user_message = value ?? "";
        console.log("[Runtime] AI pontual recebeu input no node:", info.node.id);
      } else if (!execution.is_waiting_time) {
        if (execution.waiting_for_input) {
          currentNodeId = nextFromNode(info.node.id, info.container, input.button_id);
        }
      }
    }
  }

  // No current node => find the real graph start, not merely containers[0].
  if (!currentNodeId) {
    currentNodeId = resolveGraphStartNode();
    console.log("[Runtime] Start resolvido pelo grafo:", { currentNodeId });
  }

  while (currentNodeId && steps < 100) {
    steps++;
    const info = findNode(currentNodeId);
    if (!info) {
      const first = firstNodeOfContainer(currentNodeId);
      if (first) {
        currentNodeId = first;
        continue;
      }
      break;
    }
    const { node, container } = info;
    const cfg = node.config || {};
    const nodeType = (node.type || "").toLowerCase();

    // Check if node is a wait node (Aguardar)
    if (nodeType === "wait" || nodeType === "await") {
      // If we are NOT already in a waiting state for THIS SPECIFIC execution call
      if (!execution.is_waiting_time) {
        wait_ms = parseWaitMs(cfg);
        // CRITICAL: We DO NOT advance currentNodeId yet. 
        // We stay on the wait node so that next time we come back, 
        // we hit the "else" block below.
        break; 
      } else {
        // We are returning from a timer.
        // Mark waiting as finished for the state, then MOVE TO NEXT node.
        execution.is_waiting_time = false;
        currentNodeId = nextFromNode(node.id, container);
        // Continue to the next node in the same execution loop 
        // so messages after the wait are returned now.
        continue;
      }
    }

    switch (nodeType) {
      case "start":
        break;
      case "bubble-text":
      case "bubble-number": {
        const content = replaceVars(firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value));
        if (content) {
          messages.push({ id: crypto.randomUUID(), type: "bot", content });
        }
        break;
      }
      case "bubble-image":
        messages.push({
          id: crypto.randomUUID(),
          type: "bot",
          content: firstText(cfg.ImageURL, cfg.imageUrl, cfg.url, cfg.src),
          isImage: true,
          alt: firstText(cfg.ImageAlt, cfg.alt),
        });
        break;
      case "bubble-video":
        messages.push({
          id: crypto.randomUUID(),
          type: "bot",
          content: firstText(cfg.VideoURL, cfg.videoUrl, cfg.url, cfg.src),
          isVideo: true,
        });
        break;
      case "bubble-audio":
        messages.push({
          id: crypto.randomUUID(),
          type: "bot",
          content: firstText(cfg.AudioURL, cfg.audioUrl, cfg.url, cfg.src),
          isAudio: true,
          autoplay: cfg.AudioAutoplay ?? cfg.autoplay,
        });
        break;
      case "bubble-file":
      case "bubble-document":
        messages.push({
          id: crypto.randomUUID(),
          type: "bot",
          content: firstText(cfg.FileURL, cfg.fileUrl, cfg.url, cfg.FileName, cfg.name),
          isFile: true,
        });
        break;
      case "input-text":
      case "input-mail":
      case "input-number":
      case "input-phone":
      case "input-website":
      case "input-webSite":
        waiting_for = "text";
        break;
      case "input-buttons":
        waiting_for = "buttons";
        buttons = (cfg.buttons || []).map((b: any) => ({
          id: b.id,
          label: b.label || b.text || b.value || "",
          value: b.value,
        }));
        break;
      case "set-variable":
        if (cfg.variableName) {
          const valueType = String(cfg.valueType || "custom").toLowerCase();
          const raw = String(cfg.value ?? "");
          if (valueType === "empty") {
            variables[cfg.variableName] = "";
          } else {
            const interpolated = raw.replace(/\{\{\s*(.*?)\s*\}\}/g, (_m: string, key: string) => {
              const v = variables[String(key).trim()];
              return JSON.stringify(v == null ? "" : v);
            });
            try {
              const hasReturn = /\breturn\b/.test(interpolated);
              const body = hasReturn ? interpolated : `return (${interpolated});`;
              const fn = new Function(`"use strict"; ${body}`);
              variables[cfg.variableName] = fn();
            } catch (err) {
              console.warn("[set-variable] eval failed:", err);
              variables[cfg.variableName] = valueType === "custom" ? replaceVars(raw) : raw;
            }
          }
        }
        break;
      case "script": {
        const code = String(cfg.code || "");
        if (code) {
          try {
            const interpolated = code.replace(/{{\s*(.*?)\s*}}/g, (_, key) => {
              const v = variables[String(key).trim()];
              return JSON.stringify(v == null ? "" : v);
            });

            // Context provided to the script
            const scriptContext = {
              variables: { ...variables },
              getVariable: (name: string) => variables[name],
              setVariable: (name: string, value: any) => { variables[name] = value; },
            };

            const body = `"use strict";
              const variables = this.variables;
              const getVariable = this.getVariable;
              const setVariable = this.setVariable;
              ${interpolated}`;

            const fn = new Function(body);
            const result = fn.call(scriptContext);

            if (cfg.variableName && result !== undefined) {
              variables[cfg.variableName] = result;
            }

            if (result && typeof result === "object" && !Array.isArray(result)) {
              Object.assign(variables, result);
            }
          } catch (err) {
            console.error("[script-node] execution failed:", err);
          }
        }
        break;
      }
      case "condition": {
        const conditions = cfg.conditions || [];
        const matchedCondition = conditions.find(evaluateCondition);
        const conditionHandle = matchedCondition ? `${node.id}-cond-${matchedCondition.id}` : `${node.id}-else`;
        currentNodeId = nextFromNode(node.id, container, conditionHandle, true);
        continue;
      }
      case "ai-agent":
      case "ai-node": {
        const isAgent = nodeType === "ai-agent";
        const lastMsg = variables.__last_agent_user_message;
        const objective = cfg.objective || cfg.systemPrompt || "agente de teste";
        let instructions = cfg.instructions || cfg.prompt || cfg.message || "";
        const userMessage = String(lastMsg || "").trim();

        // Knowledge Base Injection
        if (cfg.kbFilesEnabled && cfg.kbFiles?.length > 0) {
          const filesContent = cfg.kbFiles
            .map((f: any) => `ARQUIVO: ${f.name}\nCONTEÚDO:\n${f.content}`)
            .join("\n\n---\n\n");
          instructions = `${instructions}\n\nBASE DE CONHECIMENTO (ARQUIVOS):\n${filesContent}`;
        }

        if (cfg.kbLinksEnabled && cfg.kbLinks?.length > 0) {
          const linksList = cfg.kbLinks.map((l: any) => l.url).filter(Boolean).join(", ");
          if (linksList) {
            instructions = `${instructions}\n\nLINKS DE REFERÊNCIA:\n${linksList}`;
          }
        }

        console.log(`[Node:${nodeType}] Executando:`, node.id, { isAgent, hasInput: !!userMessage, instructions_length: instructions.length });

        // Check for keys
        const nodeKey = (cfg.apiKey || "").trim();
        const globalKeys = flow?.settings?.aiKeys || {};
        const provider = (cfg.provider || "openai").toLowerCase();
        
        // Harmonize key naming
        const openaiKey = (globalKeys.openaiKey || "").trim() || (provider === "openai" ? nodeKey : "");
        const anthropicKey = (globalKeys.anthropicKey || "").trim() || (provider === "anthropic" ? nodeKey : "");
        const googleKey = (globalKeys.googleKey || globalKeys.geminiKey || "").trim() || (provider === "google" || provider === "gemini" ? nodeKey : "");
        
        const activeKey = provider === "openai" ? openaiKey : provider === "anthropic" ? anthropicKey : googleKey;
        const hasAnyKey = !!openaiKey || !!anthropicKey || !!googleKey;


        // 1. Handle START sequence (when userMessage is empty)
        if (!userMessage) {
          const startMode = cfg.startMode || "automatic";
          const welcome = cfg.welcomeMessage || "";

          // If there is a welcome message to send first
          if (welcome && startMode === "automatic") {
             messages.push({ id: crypto.randomUUID(), type: "bot", content: replaceVars(welcome) });
             console.log(`[Runtime] [Node:${nodeType}] Enviou welcome message:`, welcome);
             // After sending welcome, we MUST wait for the user to reply before processing the AI prompt
             waiting_for = "text";
             break;
          }

          // If manual mode or no welcome, just wait
          if (startMode === "manual" || !welcome) {
            console.log(`[Runtime] [Node:${nodeType}] Aguardando input inicial (manual ou sem welcome)`);
            waiting_for = "text";
            break;
          }
        }

        let aiReply: string | null = null;

        if (activeKey && userMessage) {
          try {
            if (provider === "openai") {
              const res = await fetch("https://api.openai.com/v1/chat/completions", {
                method: "POST",
                headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: cfg.model || "gpt-3.5-turbo",
                  messages: [
                    { role: "system", content: `Objetivo: ${objective}\nInstruções: ${instructions}` },
                    { role: "user", content: userMessage }
                  ],
                }),
              });
              if (res.ok) {
                const data = await res.json();
                aiReply = data.choices?.[0]?.message?.content ?? null;
              } else {
                const error = await res.json();
                aiReply = `❌ Erro OpenAI: ${error.error?.message || res.statusText}`;
              }

            } else if (provider === "anthropic") {
              const res = await fetch("https://api.anthropic.com/v1/messages", {
                method: "POST",
                headers: { "x-api-key": activeKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
                body: JSON.stringify({
                  model: cfg.model || "claude-3-haiku-20240307",
                  max_tokens: 1024,
                  system: `Objetivo: ${objective}\nInstruções: ${instructions}`,
                  messages: [{ role: "user", content: userMessage }],
                }),
              });
              if (res.ok) {
                const data = await res.json();
                aiReply = data.content?.[0]?.text ?? null;
              } else {
                const error = await res.json();
                aiReply = `❌ Erro Anthropic: ${error.error?.message || res.statusText}`;
              }

            } else if (provider === "google" || provider === "gemini") {
              let model = (cfg.model || "gemini-1.5-flash").trim().replace("gemini-2.5", "gemini-1.5").replace(/^models\//, "");

              const res = await fetch(`https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${activeKey}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: [{ parts: [{ text: `System: ${objective}\n${instructions}\n\nUser: ${userMessage}` }] }],
                }),
              });
              if (res.ok) {
                const data = await res.json();
                aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null;
              } else {
                const error = await res.json();
                aiReply = `❌ Erro Gemini/Google: ${error.error?.message || res.statusText}`;
              }

            }
          } catch (e) {
            console.error(`[${nodeType}] AI Call failed`, e);
          }
        }

        if (!aiReply) {
          aiReply = hasAnyKey
            ? `🤖 [${isAgent ? "AGENTE" : "AI"} - ${provider}]\nRecebi: "${userMessage}"`
            : `🤖 [SIMULAÇÃO]\nObjetivo: ${objective}\nRecebi: "${userMessage}"\n(Configure API key)`;
        }

        messages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
        variables.__last_agent_user_message = "";

        if (isAgent) {
          // AGENT: continua aguardando próxima mensagem no mesmo node
          console.log("[Runtime] AGENTE respondeu, mantendo loop");
          waiting_for = "input-text";
          break;
        } else {
          // AI pontual: respondeu, avança para o próximo node
          console.log("[Runtime] AI pontual respondeu, avançando fluxo");
          const nextId = nextFromNode(node.id, container);
          currentNodeId = nextId;
          
          // Se houve input, pausamos para o usuário ler a resposta antes de prosseguir
          if (userMessage) {
            waiting_for = "text";
            break;
          }
          continue;
        }

      }
    }

    if (waiting_for && !execution.is_waiting_time) break;
    currentNodeId = nextFromNode(node.id, container);
  }

  return {
    messages,
    waiting_for,
    wait_ms,
    buttons,
    variables,
    next_node_id: currentNodeId,
    steps,
  };
}
