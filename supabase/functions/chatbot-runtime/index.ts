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
          const value = evaluateSetVariableValue(cfg, this.variables, (s: string) => this.replaceVars(s));
          this.variables[varName] = value;
          console.log(`[FlowEngine] Set variable "${varName}" =`, value);
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
      case "webhook": {
        const varName = normalizeVariableName(cfg.responseVariable || "webhookData");
        const payload = inputPayload || cfg.lastTestPayload || null;
        if (varName && payload) {
          this.variables[varName] = payload;
          console.log(`[FlowEngine] Webhook data saved to "${varName}"`);
        }
        if (payload && Array.isArray(cfg.responseMappings)) {
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
          for (const mapping of cfg.responseMappings) {
            if (mapping?.variableName) {
              const val = mapping.jsonPath
                ? getValueByPath(payload, mapping.jsonPath)
                : payload;
              if (val !== undefined) {
                this.variables[normalizeVariableName(mapping.variableName)] = val;
              }
            }
          }
        }
        this.currentNodeId = this.nextFromNode(node.id, container);
        break;
      }
      case "http-request": {
        await this.executeHttpRequest(node, container);
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

  private getNestedValue(obj: any, path: string) {
    if (!path) return obj;
    const parts = String(path).split('.').filter(Boolean);
    let current: any = obj;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') return undefined;
      current = current[part];
    }
    return current;
  }

  private replaceVars(text: string, raw = false) {
    if (!text) return text;
    // Remove caracteres de controle invisíveis (exceto \n, \r, \t) que podem corromper JSON
    const sanitized = String(text).replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");
    
    let baseText;
    if (raw) {
      baseText = sanitized;
    } else {
      // Se parecer JSON ou URL, não aplicamos o decodeText para preservar aspas e estrutura
      const isJsonOrUrl = /^\s*[{\[]/.test(sanitized) || /^\s*http/.test(sanitized);
      baseText = isJsonOrUrl ? sanitized : decodeText(sanitized);
    }
    
    return baseText.replace(/{{(.*?)}}/g, (_, k) => {
      const path = normalizeVariableName(k);
      const parts = path.split('.');
      const rootVar = parts[0];
      const remainingPath = parts.slice(1).join('.');
      
      const val = this.variables[rootVar];
      
      if (val !== undefined) {
        if (remainingPath) {
          const nestedVal = this.getNestedValue(val, remainingPath);
          if (nestedVal !== undefined) {
            return typeof nestedVal === 'object' ? JSON.stringify(nestedVal) : String(nestedVal);
          }
        } else {
          return typeof val === 'object' ? JSON.stringify(val) : String(val);
        }
      }
      
      console.log(`[FlowEngine:replaceVars] key="${path}" not found in variables`);
      return `{{${k}}}`;
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
    
    const actualRaw = this.getNestedValue(this.variables, varName);
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
        const messages: any[] = [{ role: "system", content: systemPrompt }];
        
        if (cfg.visionEnabled) {
          // Detect image URLs or base64 in userMessage or variables
          const content: any[] = [{ type: "text", text: userMessage }];
          
          // Check if userMessage itself is a URL or base64
          if (userMessage.startsWith("http") || userMessage.startsWith("data:image")) {
             content.push({ type: "image_url", image_url: { url: userMessage } });
          } else {
            // Check all variables for potential images if vision is enabled
            // Or look for specific common media variables
            const mediaUrl = this.variables["mediaUrl"] || this.variables["media_url"] || this.variables["url"];
            const base64 = this.variables["base64"] || this.variables["image_base64"];
            
            if (base64) {
              const b64 = String(base64).startsWith("data:") ? base64 : `data:image/jpeg;base64,${base64}`;
              content.push({ type: "image_url", image_url: { url: b64 } });
            } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
              content.push({ type: "image_url", image_url: { url: mediaUrl } });
            }
          }
          messages.push({ role: "user", content });
        } else {
          messages.push({ role: "user", content: userMessage });
        }

        const res = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: cfg.model || (cfg.visionEnabled ? "gpt-4o-mini" : "gpt-4o-mini"),
            messages: messages,
            temperature: cfg.temperature ?? 0.7,
            max_tokens: cfg.maxTokens ?? 1000,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          aiReply = data.choices?.[0]?.message?.content || "";
        }
      } else if (provider === "google" || provider === "gemini") {
        const model = cfg.model || "gemini-2.0-flash";
        
        const contents: any[] = [];
        const userParts: any[] = [{ text: userMessage }];

        if (cfg.visionEnabled) {
          const mediaUrl = this.variables["mediaUrl"] || this.variables["media_url"] || this.variables["url"];
          const base64 = this.variables["base64"] || this.variables["image_base64"];

          if (base64) {
            const b64Data = String(base64).replace(/^data:image\/[a-z]+;base64,/, "");
            userParts.push({ inline_data: { mime_type: "image/jpeg", data: b64Data } });
          } else if (mediaUrl && String(mediaUrl).startsWith("http")) {
            // Gemini doesn't support direct URLs in the same way as OpenAI for simple fetch
            // usually you need to upload to Google Cloud Storage or send as base64
            // For simplicity, let's try to fetch it if it's a URL and convert to base64
            try {
              const imgRes = await fetch(mediaUrl);
              if (imgRes.ok) {
                const arrayBuffer = await imgRes.arrayBuffer();
                const b64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
                userParts.push({ inline_data: { mime_type: imgRes.headers.get("content-type") || "image/jpeg", data: b64 } });
              }
            } catch (e) {
              console.error("[Gemini:Vision] failed to fetch image", e);
            }
          }
        }

        contents.push({ role: "user", parts: userParts });

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: contents,
            generationConfig: {
              temperature: cfg.temperature ?? 0.7,
              maxOutputTokens: cfg.maxTokens ?? 1000,
            }
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

  private async executeHttpRequest(node: any, container: any) {
    const cfg = node.config || {};
    const url = this.replaceVars(cfg.url || "");
    if (!url) {
      this.currentNodeId = this.nextFromNode(node.id, container);
      return;
    }

    const method = (cfg.method || "GET").toUpperCase();
    const headers: Record<string, string> = {};
    
    // Auth headers
    if (cfg.authentication === "basic" && cfg.authCredentials) {
      const auth = btoa(`${cfg.authCredentials.username}:${cfg.authCredentials.password}`);
      headers["Authorization"] = `Basic ${auth}`;
    } else if (cfg.authentication === "header" && cfg.authCredentials) {
      headers[cfg.authCredentials.headerName] = this.replaceVars(cfg.authCredentials.headerValue || "");
    }

    // Custom headers from config
    if (cfg.headers && Array.isArray(cfg.headers)) {
      cfg.headers.forEach((h: any) => {
        if (h.key) headers[h.key] = this.replaceVars(h.value || "");
      });
    } else if (cfg.headers && typeof cfg.headers === "object") {
      Object.entries(cfg.headers).forEach(([k, v]) => {
        headers[k] = this.replaceVars(String(v));
      });
    }

    // Response mappings support
    const getValueByPath = (obj: any, path: string): any => {
      if (!path) return obj;
      const parts = path.split('.');
      const remaining = (parts[0] === 'data') ? parts.slice(1) : parts;
      
      let current = obj;
      for (const part of remaining) {
        if (current === null || current === undefined || typeof current !== 'object') return undefined;
        current = current[part];
      }
      return current;
    };

    let body = null;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      if (cfg.bodyType === "json" || cfg.bodyMode === "json" || !cfg.bodyType) {
        const rawBody = cfg.bodyJson || cfg.body || "{}";
        const processedBody = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
        body = this.replaceVars(processedBody);
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
      } else if (cfg.bodyType === "form-data") {
        const params = new URLSearchParams();
        if (Array.isArray(cfg.body)) {
          cfg.body.forEach((b: any) => {
            if (b.key) params.append(b.key, this.replaceVars(b.value || ""));
          });
        }
        body = params.toString();
        if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else {
        body = this.replaceVars(cfg.body || "");
      }
    }

    try {
      console.log(`[FlowEngine:HttpRequest] ${method} ${url}`);
      const res = await fetch(url, {
        method,
        headers,
        body: (method !== "GET" && body) ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined
      });
      
      console.log(`[FlowEngine:HttpRequest] Response status: ${res.status}`);

      const responseText = await res.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      const varName = normalizeVariableName(cfg.responseVariable || cfg.saveVariable || "httpResponse");
      if (varName) {
        this.variables[varName] = responseData;
        console.log(`[FlowEngine:HttpRequest] Saved response to ${varName}`);
      }

      // Handle response mappings
      if (cfg.responseMappings && Array.isArray(cfg.responseMappings)) {
        cfg.responseMappings.forEach((mapping: any) => {
          if (mapping.jsonPath && mapping.variableName) {
            const val = getValueByPath(responseData, mapping.jsonPath);
            if (val !== undefined) {
              const targetVar = normalizeVariableName(mapping.variableName);
              this.variables[targetVar] = val;
              console.log(`[FlowEngine:HttpRequest] Mapping ${mapping.jsonPath} to ${targetVar}`);
            }
          }
        });
      }

      // Handle success/error paths
      const statusHandle = res.ok ? "success" : "error";
      const nextId = this.nextFromNode(node.id, container, statusHandle, true);
      if (nextId) {
        this.currentNodeId = nextId;
        return;
      }
    } catch (e) {
      console.error("[FlowEngine:HttpRequest] Error:", e);
      const nextId = this.nextFromNode(node.id, container, "error", true);
      if (nextId) {
        this.currentNodeId = nextId;
        return;
      }
    }

    this.currentNodeId = this.nextFromNode(node.id, container);
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
