// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-embed-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const clientState = payload?.runtime_state || body?.runtime_state || null;
    if (!execution) {
      // Fallback para ambientes onde as tabelas de runtime ainda não existem.
      // O cliente devolve o último estado recebido para a próxima mensagem,
      // evitando que o fluxo reinicie do primeiro nó a cada interação.
      execution = normalizeClientState(clientState);
    } else if (action !== "start" && !execution.current_node_id && clientState?.current_node_id) {
      execution = { ...execution, ...normalizeClientState(clientState), id: execution.id };
    }

    const result = runFlow(execution, containers, edges, payload);

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

    return json({
      messages: result.messages,
      waiting_for: result.waiting_for,
      buttons: result.buttons,
      session_id: session?.id ?? null,
      runtime_state: {
        current_node_id: result.next_node_id,
        variables: result.variables,
        waiting_for_input: !!result.waiting_for,
      },
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
  };
}

function runFlow(execution: any, containers: any[], edges: any[], input: any) {
  let currentNodeId: string | null = execution.current_node_id;
  const variables: Record<string, any> = { ...(execution.variables || {}) };
  const messages: any[] = [];
  let waiting_for: string | null = null;
  let buttons: any[] = [];
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

  const normalizeHandle = (value?: string | null) => {
    if (!value) return "";
    const raw = String(value);
    const buttonMatch = raw.match(/-btn-(.+)$/);
    if (buttonMatch?.[1]) return buttonMatch[1];
    if (raw.endsWith("-default")) return "default";
    return raw;
  };

  const nextFromNode = (nodeId: string, container: any, handle?: string): string | null => {
    const wantedHandle = normalizeHandle(handle);
    let edge = edges.find((e: any) => e.source === nodeId && wantedHandle && normalizeHandle(e.sourceHandle) === wantedHandle);
    if (!edge && wantedHandle) edge = edges.find((e: any) => e.source === nodeId && normalizeHandle(e.sourceHandle) === "default");
    if (!edge) edge = edges.find((e: any) => e.source === nodeId && !e.sourceHandle);
    if (!edge) edge = edges.find((e: any) => e.source === nodeId);
    if (edge) {
      // edge target may be a node id OR a container id
      if (findNode(edge.target)) return edge.target;
      const first = firstNodeOfContainer(edge.target);
      if (first) return first;
      return edge.target;
    }
    // fallback: container-level edge
    const cEdge = edges.find((e: any) => e.source === container.id);
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

  // If we were waiting and got input -> capture and advance
  if (execution.waiting_for_input && input && currentNodeId) {
    const info = findNode(currentNodeId);
    if (info) {
      const cfg = info.node.config || {};
      const varName = cfg.variableName || cfg.saveVariable;
      const value = input.message ?? input.button_id;
      if (varName && value !== undefined) variables[varName] = value;
      currentNodeId = nextFromNode(info.node.id, info.container, input.button_id);
    }
  }

  // No current node => find start
  if (!currentNodeId) {
    for (const c of containers) {
      const startNode = (c.nodes || []).find((n: any) => n.type === "start");
      if (startNode) {
        currentNodeId = startNode.id;
        break;
      }
    }
    // If no explicit start node, use first node of first container
    if (!currentNodeId && containers[0]?.nodes?.[0]) {
      currentNodeId = containers[0].nodes[0].id;
    }
  }

  while (currentNodeId && steps < 100) {
    steps++;
    const info = findNode(currentNodeId);
    if (!info) {
      // Maybe it's a container id
      const first = firstNodeOfContainer(currentNodeId);
      if (first) {
        currentNodeId = first;
        continue;
      }
      break;
    }
    const { node, container } = info;
    const cfg = node.config || {};

    switch (node.type) {
      case "start":
        break;
      case "bubble-text":
      case "bubble-number": {
        const content = replaceVars(firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value));
        if (content) {
          messages.push({
            id: crypto.randomUUID(),
            type: "bot",
            content,
          });
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
        if (cfg.variableName) variables[cfg.variableName] = replaceVars(cfg.value || "");
        break;
      default:
        // unknown node -> skip
        break;
    }

    if (waiting_for) break;

    currentNodeId = nextFromNode(node.id, container);
  }

  return {
    messages,
    waiting_for,
    buttons,
    variables,
    next_node_id: currentNodeId,
    steps,
  };
}
