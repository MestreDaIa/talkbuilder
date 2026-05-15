import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

// =============================================================================
// chatbot-runtime — Universal Flow Engine
// =============================================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RuntimeRequest {
  action: "start" | "message";
  flow_id: string; // public_id or UUID
  contact_id: string;
  channel: "webchat" | "whatsapp" | "instagram" | "telegram";
  workspace_id?: string; // Optional if public_id is provided
  payload?: any;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: RuntimeRequest = await req.json();
    const { action, flow_id, contact_id, channel, payload } = body;

    // 1. Resolve Flow and Workspace
    const { data: flow, error: flowErr } = await resolveFlow(supabase, flow_id, body.workspace_id);
    if (flowErr || !flow) throw new Error(flowErr?.message || "Flow not found");
    const workspace_id = flow.user_id;

    // 2. Find or Create Conversation Session (24h Window)
    const { data: session, error: sessionErr } = await getOrCreateSession(
      supabase,
      workspace_id,
      flow.id,
      contact_id,
      channel
    );
    if (sessionErr) throw sessionErr;

    // 3. Load or Initialize Flow Execution (Persistent)
    const { data: execution, error: execErr } = await getOrCreateExecution(
      supabase,
      workspace_id,
      flow.id,
      contact_id,
      channel
    );
    if (execErr) throw execErr;

    // 4. Process Logic
    let response;
    if (action === "start") {
      response = await startFlow(supabase, session, execution, flow);
    } else {
      response = await continueFlow(supabase, session, execution, flow, payload);
    }

    // 5. Record Event
    await recordEvent(supabase, {
      session_id: session.id,
      execution_id: execution.id,
      workspace_id,
      event_type: action === "start" ? "FLOW_STARTED" : "MESSAGE_RECEIVED",
      payload: { ...body, response },
    });

    return new Response(JSON.stringify({ ...response, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[runtime error]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function resolveFlow(supabase: any, flowIdOrPublicId: string, workspaceId?: string) {
  let query = supabase.from("chatbot_flows").select("*");
  
  if (flowIdOrPublicId.includes("-") && flowIdOrPublicId.length > 20) {
    // Looks like UUID
    query = query.eq("id", flowIdOrPublicId);
  } else {
    // Looks like public_id
    query = query.eq("public_id", flowIdOrPublicId);
  }

  if (workspaceId) {
    query = query.eq("user_id", workspaceId);
  }

  return query.maybeSingle();
}

async function getOrCreateSession(supabase: any, workspace_id: string, flow_id: string, contact_id: string, channel: string) {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  let { data: session } = await supabase
    .from("conversation_sessions")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("flow_id", flow_id)
    .eq("contact_id", contact_id)
    .eq("channel_id", channel)
    .eq("status", "active")
    .gt("last_interaction_at", windowStart)
    .maybeSingle();

  if (!session) {
    const { data: newSession, error } = await supabase
      .from("conversation_sessions")
      .insert({
        workspace_id,
        flow_id,
        contact_id,
        channel_id: channel,
      })
      .select()
      .single();
    
    if (error) return { error };
    session = newSession;

    // Increment usage counter here via RPC (to be created)
    await supabase.rpc("increment_usage_counter", { 
      w_id: workspace_id, 
      field: "conversations_started"
    });
  } else {
    await supabase
      .from("conversation_sessions")
      .update({ 
        last_interaction_at: new Date().toISOString(),
        message_count: (session.message_count || 0) + 1
      })
      .eq("id", session.id);
  }

  return { data: session };
}

async function getOrCreateExecution(supabase: any, workspace_id: string, flow_id: string, contact_id: string, channel: string) {
  let { data: execution } = await supabase
    .from("flow_executions")
    .select("*")
    .eq("workspace_id", workspace_id)
    .eq("flow_id", flow_id)
    .eq("contact_id", contact_id)
    .eq("channel_id", channel)
    .maybeSingle();

  if (!execution) {
    const { data: newExec, error } = await supabase
      .from("flow_executions")
      .insert({
        workspace_id,
        flow_id,
        contact_id,
        channel_id: channel,
      })
      .select()
      .single();
    return { data: newExec, error };
  }
  return { data: execution };
}

async function startFlow(supabase: any, session: any, execution: any, flow: any) {
  const containers = flow.published_containers || flow.draft_containers || [];
  const startNode = containers.find((c: any) => c.nodes.some((n: any) => n.type === "start"))
    ?.nodes.find((n: any) => n.type === "start");

  if (!startNode) throw new Error("Start node not found");

  // Reset execution state for a fresh start if needed, or continue
  // For simplicity now, we just start from the node after Start
  return { 
    messages: [{ id: "1", type: "bot", content: "Olá! Como posso ajudar?" }], 
    waiting_for: "text" 
  };
}

async function continueFlow(supabase: any, session: any, execution: any, flow: any, payload: any) {
  // Logic to advance based on payload
  await supabase
    .from("flow_executions")
    .update({ 
      updated_at: new Date().toISOString(),
      execution_history: [...(execution.execution_history || []), { node: execution.current_node_id, input: payload }]
    })
    .eq("id", execution.id);

  return { 
    messages: [{ id: "2", type: "bot", content: `Você disse: ${payload?.message || "nada"}` }], 
    waiting_for: "text" 
  };
}

async function recordEvent(supabase: any, event: any) {
  await supabase.from("conversation_events").insert(event);
}
