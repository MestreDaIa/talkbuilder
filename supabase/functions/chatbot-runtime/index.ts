import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RuntimeRequest {
  action: "start" | "message";
  flow_id: string; // public_id or UUID
  contact_id: string;
  channel: "webchat" | "whatsapp" | "instagram" | "telegram";
  workspace_id?: string;
  payload?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: RuntimeRequest = await req.json();
    const { action, flow_id: flowRef, contact_id, channel, payload } = body;

    // 1. Resolve Flow
    const { data: flow, error: flowErr } = await resolveFlow(supabase, flowRef, body.workspace_id);
    if (flowErr || !flow) throw new Error("Flow não encontrado");

    // 2. Get/Create Session (24h Window)
    const { data: session, error: sessErr } = await getOrCreateSession(supabase, flow, contact_id, channel);
    if (sessErr) throw sessErr;

    // 3. Get/Create Execution State
    const { data: execution, error: execErr } = await getOrCreateExecution(supabase, flow, contact_id, channel);
    if (execErr) throw execErr;

    // 4. Runtime Logic
    const containers = flow.published_containers || flow.draft_containers || [];
    const edges = flow.published_edges || flow.draft_edges || [];
    
    let result;
    if (action === "start") {
      result = await runFlow(supabase, session, execution, containers, edges, null);
    } else {
      result = await runFlow(supabase, session, execution, containers, edges, payload);
    }

    // 5. Analytics
    await supabase.from("conversation_events").insert({
      session_id: session.id,
      execution_id: execution.id,
      workspace_id: flow.user_id,
      event_type: action === "start" ? "FLOW_STARTED" : "MESSAGE_RECEIVED",
      payload: { input: payload, output: result }
    });

    return new Response(JSON.stringify({ ...result, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[Runtime Error]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function resolveFlow(supabase: any, ref: string, workspaceId?: string) {
  let query = supabase.from("chatbot_flows").select("*");
  if (ref.includes("-") && ref.length > 20) query = query.eq("id", ref);
  else query = query.eq("public_id", ref);
  if (workspaceId) query = query.eq("user_id", workspaceId);
  return query.maybeSingle();
}

async function getOrCreateSession(supabase: any, flow: any, contact_id: string, channel: string) {
  const windowLimit = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let { data: session } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("flow_id", flow.id)
    .eq("contact_id", contact_id)
    .eq("channel_id", channel)
    .eq("status", "active")
    .gt("last_interaction_at", windowLimit)
    .maybeSingle();

  if (!session) {
    const { data, error } = await supabase.from("conversation_sessions").insert({
      workspace_id: flow.user_id,
      flow_id: flow.id,
      contact_id,
      channel_id: channel
    }).select().single();
    if (!error) await supabase.rpc("increment_usage_counter", { w_id: flow.user_id, field: "conversations_started" });
    return { data, error };
  }
  
  await supabase.from("conversation_sessions")
    .update({ last_interaction_at: new Date().toISOString(), message_count: (session.message_count || 0) + 1 })
    .eq("id", session.id);
    
  return { data: session };
}

async function getOrCreateExecution(supabase: any, flow: any, contact_id: string, channel: string) {
  let { data: exec } = await supabase.from("flow_executions")
    .select("*")
    .eq("workspace_id", flow.user_id)
    .eq("flow_id", flow.id)
    .eq("contact_id", contact_id)
    .eq("channel_id", channel)
    .maybeSingle();

  if (!exec) {
    return supabase.from("flow_executions").insert({
      workspace_id: flow.user_id,
      flow_id: flow.id,
      contact_id,
      channel_id: channel
    }).select().single();
  }
  return { data: exec };
}

async function runFlow(supabase: any, session: any, execution: any, containers: any[], edges: any[], input: any) {
  let currentNodeId = execution.current_node_id;
  let variables = execution.variables || {};
  let messages: any[] = [];
  let waiting_for: string | null = null;
  let buttons: any[] = [];

  // Helper to find node by ID across containers
  const findNode = (id: string) => {
    for (const c of containers) {
      const n = c.nodes.find((node: any) => node.id === id);
      if (n) return { node: n, container: c };
    }
    return null;
  };

  // If starting fresh
  if (!currentNodeId) {
    const startContainer = containers.find(c => c.nodes.some((n: any) => n.type === "start"));
    if (!startContainer) throw new Error("Nó de início não encontrado");
    const startNode = startContainer.nodes.find((n: any) => n.type === "start");
    currentNodeId = startNode.id;
  }

  // If we were waiting for input, process it
  if (execution.waiting_for_input && input) {
    const lastNodeInfo = findNode(currentNodeId);
    if (lastNodeInfo?.node.type.startsWith("input-")) {
      const varName = lastNodeInfo.node.config?.variableName;
      if (varName) variables[varName] = input.message || input.button_id;
      
      // Find next node from input node
      const edge = edges.find(e => e.source === currentNodeId && (!e.sourceHandle || e.sourceHandle === input.button_id));
      if (edge) currentNodeId = edge.target;
      else {
        // Fallback to container edge
        const cEdge = edges.find(e => e.source === lastNodeInfo.container.id);
        if (cEdge) currentNodeId = findNodeInContainer(containers, cEdge.target);
      }
    }
  }

  // Execution Loop
  let steps = 0;
  while (currentNodeId && steps < 50) {
    steps++;
    const info = findNode(currentNodeId);
    if (!info) break;
    const { node, container } = info;

    if (node.type === "bubble-text") {
      messages.push({ id: crypto.randomUUID(), type: "bot", content: node.config?.content });
    } else if (node.type === "input-text") {
      waiting_for = "text";
      break;
    } else if (node.type === "input-buttons") {
      waiting_for = "buttons";
      buttons = node.config?.buttons || [];
      break;
    }
    
    // Move to next node
    const edge = edges.find(e => e.source === node.id);
    if (edge) currentNodeId = edge.target;
    else {
      // End of container, check container edge
      const cEdge = edges.find(e => e.source === container.id);
      if (cEdge) currentNodeId = findNodeInContainer(containers, cEdge.target);
      else break;
    }
  }

  // Update Execution State
  await supabase.from("flow_executions").update({
    current_node_id: currentNodeId,
    variables,
    waiting_for_input: !!waiting_for,
    updated_at: new Date().toISOString()
  }).eq("id", execution.id);

  return { messages, waiting_for, buttons };
}

function findNodeInContainer(containers: any[], containerId: string) {
  const c = containers.find(cont => cont.id === containerId);
  return c?.nodes[0]?.id;
}
