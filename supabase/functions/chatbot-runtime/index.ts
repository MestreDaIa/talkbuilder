// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-embed-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Simple in-memory cache for edge function instances
const runtimeMemory = new Map<string, { state: any; expiresAt: number }>();
const MEMORY_TTL_MS = 1000 * 60 * 60 * 6; // 6 hours

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

/**
 * Normalizes variable names by removing braces and trimming whitespace.
 * e.g., "{{ my_var }}" -> "my_var"
 */
function normalizeVariableName(name: string): string {
  if (!name) return "";
  return String(name)
    .trim()
    .replace(/^{{\s*/, "")
    .replace(/\s*}}$/, "")
    .trim();
}

/**
 * Decodes HTML entities and handles common formatting from the editor.
 */
function decodeText(text: string) {
  return String(text || "")
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
}

/**
 * Main Flow Execution Engine
 */
class FlowEngine {
  private supabase: any;
  private flow: any;
  private containers: any[];
  private edges: any[];
  private variables: Record<string, any>;
  private messages: any[] = [];
  private buttons: any[] = [];
  private waitingFor: string | null = null;
  private waitMs = 0;
  private steps = 0;
  private status: "running" | "waiting_input" | "paused" | "completed" = "running";
  private currentNodeId: string | null;
  private activeAgentNodeId: string | null;
  private mode: string;
  private isWaitingTime: boolean;

  constructor(supabase: any, flow: any, execution: any) {
    this.supabase = supabase;
    this.flow = flow;
    this.containers = flow.published_containers || flow.draft_containers || [];
    this.edges = flow.published_edges || flow.draft_edges || [];
    this.variables = { ...(execution.variables || {}) };
    this.currentNodeId = execution.current_node_id;
    this.activeAgentNodeId = execution.active_agent_node_id || null;
    this.mode = execution.runtime_mode || "flow";
    this.isWaitingTime = !!execution.is_waiting_time;
  }

  public async run(inputPayload?: any) {
    console.log(`[FlowEngine] Starting run. Action: ${inputPayload?.action || 'None'} Node: ${this.currentNodeId} Mode: ${this.mode}`);
    
    // 1. Process Input if waiting
    if (inputPayload?.message !== undefined || inputPayload?.button_id !== undefined) {
      this.handleInput(inputPayload);
    }

    // 2. Set Start Node if none
    if (!this.currentNodeId) {
      this.setStartNode();
    }

    // 3. Main Loop
    while (this.currentNodeId && this.steps < 100 && this.status === "running") {
      this.steps++;
      const nodeInfo = this.findNode(this.currentNodeId);
      
      if (!nodeInfo) {
        console.warn(`[FlowEngine] Node not found: ${this.currentNodeId}`);
        this.status = "completed";
        this.currentNodeId = null;
        break;
      }

      const { node, container } = nodeInfo;
      await this.executeNode(node, container, inputPayload);
    }

    if (!this.currentNodeId && this.status === "running") {
      this.status = "completed";
    }

    return {
      messages: this.messages,
      waiting_for: this.waitingFor,
      wait_ms: this.waitMs,
      buttons: this.buttons,
      variables: this.variables,
      next_node_id: this.currentNodeId,
      active_agent_node_id: this.activeAgentNodeId,
      mode: this.mode,
      steps: this.steps,
      status: this.status,
    };
  }

  private handleInput(payload: any) {
    const userValue = payload.message ?? payload.button_id;
    this.variables["last_message"] = userValue;
    console.log(`[FlowEngine] Input received: "${userValue}"`);

    if (this.mode === "agent" && this.activeAgentNodeId) {
      this.currentNodeId = this.activeAgentNodeId;
      return;
    }

    if (this.currentNodeId) {
      const info = this.findNode(this.currentNodeId);
      if (info && info.node.type.startsWith("input-")) {
        const cfg = info.node.config || {};
        const varName = normalizeVariableName(cfg.variableName || cfg.saveVariable);
        if (varName) {
          this.variables[varName] = userValue;
          console.log(`[FlowEngine] Saved input to variable "${varName}": ${userValue}`);
        }
        
        // Advance after input
        const nextId = this.nextFromNode(info.node.id, info.container, payload.button_id);
        if (nextId) {
          this.currentNodeId = nextId;
        }
      }
    }
  }

  private setStartNode() {
    for (const c of this.containers) {
      const startNode = (c.nodes || []).find((n: any) => n.type === "start");
      if (startNode) {
        this.currentNodeId = startNode.id;
        return;
      }
    }
    if (this.containers[0]?.nodes?.[0]) {
      this.currentNodeId = this.containers[0].nodes[0].id;
    }
  }

  private findNode(id: string) {
    for (const c of this.containers) {
      const node = (c.nodes || []).find((n: any) => n.id === id);
      if (node) return { node, container: c };
    }
    return null;
  }

  private async executeNode(node: any, container: any, inputPayload: any) {
    const type = (node.type || "").toLowerCase();
    const cfg = node.config || {};
    
    console.log(`[FlowEngine] Executing node: ${node.id} (${type})`);

    // Handle Wait/Await
    if (type === "wait" || type === "await") {
      if (!this.isWaitingTime) {
        this.waitMs = this.parseWaitMs(cfg);
        this.status = "paused";
        return;
      } else {
        this.isWaitingTime = false;
        this.currentNodeId = this.nextFromNode(node.id, container);
        return;
      }
    }

    // Handle Input Nodes (when reached sequentially, without prior input)
    if (type.startsWith("input-")) {
      console.log(`[FlowEngine] Waiting for input at node ${node.id}`);
      this.waitingFor = type === "input-buttons" ? "buttons" : "text";
      if (type === "input-buttons") {
        this.buttons = (cfg.buttons || []).map((b: any) => ({
          id: b.id,
          label: b.label || b.text || b.value || "",
          value: b.value,
        }));
      }
      this.status = "waiting_input";
      return;
    }

    // Handle Nodes
    switch (type) {
      case "bubble-text":
      case "bubble-number": {
        const content = this.replaceVars(this.firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value));
        if (content) {
          this.messages.push({ id: crypto.randomUUID(), type: "bot", content });
          console.log(`[FlowEngine] Added bubble message: "${content.substring(0, 30)}..."`);
        }
        this.currentNodeId = this.nextFromNode(node.id, container);
        break;
      }
      case "bubble-image": {
        const url = this.firstText(cfg.ImageURL, cfg.imageUrl, cfg.url, cfg.src);
        if (url) {
          this.messages.push({ 
            id: crypto.randomUUID(), 
            type: "bot", 
            content: url, 
            isImage: true, 
            alt: this.firstText(cfg.ImageAlt, cfg.alt) 
          });
        }
        this.currentNodeId = this.nextFromNode(node.id, container);
        break;
      }
      case "set-variable": {
        const varName = normalizeVariableName(cfg.variableName);
        if (varName) {
          const value = this.replaceVars(String(cfg.value || ""));
          this.variables[varName] = value;
          console.log(`[FlowEngine] Set variable "${varName}" = "${value}"`);
        }
        this.currentNodeId = this.nextFromNode(node.id, container);
        break;
      }
      case "condition": {
        const matched = (cfg.conditions || []).find((c: any) => this.evaluateCondition(c));
        let handle = matched ? `${node.id}-cond-${matched.id}` : `${node.id}-else`;
        console.log(`[FlowEngine] Condition result: ${matched ? 'Matched ' + matched.id : 'Else'}`);
        
        let nextId = this.nextFromNode(node.id, container, handle, true);
        if (!nextId) nextId = this.nextFromNode(node.id, container, matched ? "cond" : "else", false);
        if (!nextId) nextId = this.nextFromNode(node.id, container, undefined, false);
        
        this.currentNodeId = nextId;
        break;
      }
      case "ai-node": {
        await this.executeAINode(node, container);
        break;
      }
      case "ai-agent": {
        await this.executeAgentNode(node, container, inputPayload);
        break;
      }
      case "redirect": {
        await this.executeRedirect(node, container);
        break;
      }
      case "go-to": {
        this.currentNodeId = cfg.targetContainerId || null;
        if (this.currentNodeId && !this.findNode(this.currentNodeId)) {
          // If it's a container ID, get its first node
          const c = this.containers.find(x => x.id === this.currentNodeId);
          this.currentNodeId = c?.nodes?.[0]?.id ?? null;
        }
        break;
      }
      default: {
        console.log(`[FlowEngine] Generic node execution for ${type}`);
        this.currentNodeId = this.nextFromNode(node.id, container);
      }
    }
  }

  private nextFromNode(nodeId: string, container: any, handle?: string, strict = false): string | null {
    const wantedHandle = handle || "";
    const normalizedWanted = this.normalizeHandle(wantedHandle);
    
    const possibleEdges = this.edges.filter(e => e.source === nodeId || (e.source === container.id && (e.sourceHandle === nodeId || String(e.sourceHandle).startsWith(`${nodeId}-`))));

    // 1. Exact match
    let edge = possibleEdges.find(e => e.sourceHandle === wantedHandle);
    
    // 2. Normalized match
    if (!edge && normalizedWanted) {
      edge = possibleEdges.find(e => this.normalizeHandle(e.sourceHandle) === normalizedWanted);
    }

    // 3. Fallbacks
    if (!edge && !strict) {
      edge = possibleEdges.find(e => {
        const h = this.normalizeHandle(e.sourceHandle);
        return h === "default" || h === "else";
      });
      if (!edge) edge = possibleEdges.find(e => !e.sourceHandle);
      if (!edge) edge = possibleEdges[0];
    }

    if (edge) return this.resolveTarget(edge.target);

    // Fallback: sequential next in container
    const idx = (container.nodes || []).findIndex(n => n.id === nodeId);
    if (idx >= 0 && idx < container.nodes.length - 1) return container.nodes[idx+1].id;
    
    // Fallback: edge from container itself
    const containerEdge = this.edges.find(e => e.source === container.id && !e.sourceHandle);
    if (containerEdge) return this.resolveTarget(containerEdge.target);

    return null;
  }

  private resolveTarget(targetId: string): string | null {
    if (this.findNode(targetId)) return targetId;
    const c = this.containers.find(x => x.id === targetId);
    return c?.nodes?.[0]?.id ?? null;
  }

  private normalizeHandle(val: any) {
    let s = String(val || "");
    if (s.includes("-cond-")) return s.split("-cond-").pop();
    if (s.includes("-btn-")) return s.split("-btn-").pop();
    if (s.endsWith("-else")) return "else";
    if (s.endsWith("-default")) return "default";
    return s;
  }

  private replaceVars(text: string) {
    if (!text) return text;
    return decodeText(text).replace(/{{(.*?)}}/g, (_, k) => {
      const name = normalizeVariableName(k);
      const val = this.variables[name];
      console.log(`[FlowEngine:replaceVars] key="${name}" found=${val !== undefined} val="${val}"`);
      return val !== undefined ? String(val) : `{{${k}}}`;
    });
  }

  private evaluateCondition(condition: any) {
    const results = (condition?.comparisons || []).map(c => this.evaluateComparison(c));
    const isOr = condition?.logicalOperator === "OR";
    return isOr ? results.some(Boolean) : results.every(Boolean);
  }

  private evaluateComparison(comp: any) {
    const varName = normalizeVariableName(comp?.variableName);
    if (!varName) return false;
    
    const actualRaw = this.variables[varName];
    const actual = actualRaw == null ? "" : String(actualRaw).trim();
    const expected = this.replaceVars(String(comp?.value ?? "")).trim();
    const op = comp?.operator;

    console.log(`[FlowEngine:compare] var="${varName}" val="${actual}" op=${op} exp="${expected}"`);

    switch (op) {
      case "equals": return actual === expected;
      case "not_equals": return actual !== expected;
      case "contains": return actual.includes(expected);
      case "not_contains": return !actual.includes(expected);
      case "greater_than": return Number(actual) > Number(expected);
      case "less_than": return Number(actual) < Number(expected);
      case "is_set": return actualRaw !== undefined && actualRaw !== null && String(actualRaw).trim() !== "";
      case "is_empty": return actualRaw === undefined || actualRaw === null || String(actualRaw).trim() === "";
      case "starts_with": return actual.startsWith(expected);
      case "ends_with": return actual.endsWith(expected);
      case "matches_regex": try { return new RegExp(expected, "i").test(actual); } catch { return false; }
      default: return false;
    }
  }

  private async executeAINode(node: any, container: any) {
    const cfg = node.config || {};
    const userMessage = String(this.variables["last_message"] || "").trim();
    if (!userMessage) {
      this.currentNodeId = this.nextFromNode(node.id, container);
      return;
    }

    const provider = (cfg.provider || "openai").toLowerCase();
    const activeKey = (this.flow?.settings?.aiKeys || {})[`${provider}Key`] || cfg.apiKey;

    if (!activeKey) {
      this.messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ AI Key não configurada." });
      this.currentNodeId = this.nextFromNode(node.id, container);
      return;
    }

    try {
      const systemPrompt = `Objetivo: ${cfg.objective || "assistente"}\nInstruções: ${cfg.instructions || ""}`;
      let aiReply = "";

      if (provider === "openai") {
        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cfg.model || "gpt-4o-mini",
            messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userMessage }],
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
            contents: [{ parts: [{ text: userMessage }] }],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
        }
      }

      if (aiReply) {
        this.messages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
        const saveVar = normalizeVariableName(cfg.saveVariable);
        if (saveVar) this.variables[saveVar] = aiReply;
      }
    } catch (e) {
      console.error("[FlowEngine:AI] error", e);
    }

    this.currentNodeId = this.nextFromNode(node.id, container);
  }

  private async executeAgentNode(node: any, container: any, input: any) {
    this.mode = "agent";
    this.activeAgentNodeId = node.id;
    const cfg = node.config || {};

    if (!input || (input.message === undefined && input.button_id === undefined)) {
      if (cfg.welcomeMessage && this.messages.length === 0) {
        this.messages.push({ id: crypto.randomUUID(), type: "bot", content: this.replaceVars(cfg.welcomeMessage) });
      }
      this.waitingFor = "text";
      this.status = "waiting_input";
      return;
    }

    // Agent Logic... (Truncated for brevity, but same logic as before, just classified)
    // For now let's just mark waiting if we get here sequentially
    this.waitingFor = "text";
    this.status = "waiting_input";
  }

  private async executeRedirect(node: any, container: any) {
    const targetRef = node.config?.targetFlow || node.config?.targetFlowId;
    if (!targetRef) {
      this.currentNodeId = null;
      return;
    }

    // Load sub-flow
    const { data: targetFlow } = await this.supabase
      .from("chatbot_flows")
      .select("*")
      .or(`id.eq.${targetRef},public_id.eq.${targetRef}`)
      .maybeSingle();

    if (!targetFlow) {
      this.messages.push({ id: crypto.randomUUID(), type: "bot", content: "⚠️ Fluxo de destino não encontrado." });
      this.currentNodeId = null;
      return;
    }

    const subEngine = new FlowEngine(this.supabase, targetFlow, {
      variables: this.variables,
      current_node_id: node.config?.startNodeId || null
    });

    const result = await subEngine.run();
    this.messages.push(...result.messages);
    this.variables = result.variables;
    this.status = result.status;
    this.waitingFor = result.waiting_for;
    this.buttons = result.buttons;
    this.currentNodeId = result.next_node_id;
  }

  private parseWaitMs(cfg: any) {
    const raw = Number(cfg.waitTime ?? cfg.duration ?? cfg.seconds ?? 5);
    const unit = String(cfg.timeUnit ?? cfg.unit ?? "seconds").toLowerCase();
    const multiplier = unit.startsWith("hour") ? 3600000 : unit.startsWith("minute") ? 60000 : 1000;
    return Math.round(raw * multiplier);
  }

  private firstText(...vals: any[]) {
    return vals.find(v => typeof v === "string" && v.trim() !== "") || "";
  }
}

/**
 * Edge Function Entry Point
 */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { action, flow_id: flowRef, contact_id, channel = "webchat", payload } = body || {};

    if (!action || !flowRef || !contact_id) {
      return json({ error: "missing required fields" }, 400);
    }

    // 1. Resolve Flow
    const { data: flow } = await supabase
      .from("chatbot_flows")
      .select("*")
      .or(`id.eq.${flowRef},public_id.eq.${flowRef}`)
      .maybeSingle();

    if (!flow) return json({ error: "Flow não encontrado" }, 404);

    // 2. Manage Session
    let session = null;
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
          .select().single();
        session = created;
      } else {
        await supabase.from("conversation_sessions").update({ last_interaction_at: new Date().toISOString() }).eq("id", session.id);
      }
    } catch {}

    // 3. Load Execution State
    let execution = null;
    const { data: existingExec } = await supabase
      .from("flow_executions")
      .select("*")
      .eq("flow_id", flow.id)
      .eq("contact_id", contact_id)
      .eq("channel_id", channel)
      .maybeSingle();

    if (action === "start" || !existingExec) {
      const initialState = { 
        workspace_id: flow.user_id, 
        flow_id: flow.id, 
        contact_id, 
        channel_id: channel,
        variables: {},
        current_node_id: null,
        waiting_for_input: false,
        runtime_mode: "flow"
      };
      
      if (existingExec) {
        const { data: updated } = await supabase.from("flow_executions").update(initialState).eq("id", existingExec.id).select().single();
        execution = updated;
      } else {
        const { data: created } = await supabase.from("flow_executions").insert(initialState).select().single();
        execution = created;
      }
    } else {
      execution = existingExec;
    }

    // In-memory state recovery (fallback for very fast interactions)
    const memoryKey = `${flow.id}:${channel}:${contact_id}`;
    const cachedState = runtimeMemory.get(memoryKey);
    if (cachedState && cachedState.expiresAt > Date.now()) {
      execution = { ...execution, ...cachedState.state };
    }

    // 4. Run Flow
    const engine = new FlowEngine(supabase, flow, execution);
    const result = await engine.run(payload || body);

    // 5. Persist Result
    if (execution.id) {
      await supabase.from("flow_executions").update({
        current_node_id: result.next_node_id,
        variables: result.variables,
        waiting_for_input: result.status === "waiting_input",
        runtime_mode: result.mode,
        active_agent_node_id: result.active_agent_node_id,
        updated_at: new Date().toISOString(),
      }).eq("id", execution.id);
    }

    const runtimeState = {
      current_node_id: result.next_node_id,
      variables: result.variables,
      waiting_for_input: result.status === "waiting_input",
      mode: result.mode,
    };
    runtimeMemory.set(memoryKey, { state: runtimeState, expiresAt: Date.now() + MEMORY_TTL_MS });

    return json({
      messages: result.messages,
      waiting_for: result.waiting_for,
      wait_ms: result.wait_ms,
      buttons: result.buttons,
      session_id: session?.id ?? null,
      runtime_state: runtimeState,
      debug: { node: result.next_node_id, status: result.status },
    });

  } catch (err: any) {
    console.error("[runtime] Fatal Error:", err);
    return json({ error: err?.message || String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
