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
  flow_id: string;
  contact_id: string;
  channel: "webchat" | "whatsapp" | "instagram" | "telegram";
  workspace_id: string;
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
    const { action, flow_id, contact_id, channel, workspace_id, payload } = body;

    // 1. Find or Create Conversation Session (24h Window)
    const { data: session, error: sessionErr } = await getOrCreateSession(
      supabase,
      workspace_id,
      flow_id,
      contact_id,
      channel
    );
    if (sessionErr) throw sessionErr;

    // 2. Load or Initialize Flow Execution (Persistent)
    const { data: execution, error: execErr } = await getOrCreateExecution(
      supabase,
      workspace_id,
      flow_id,
      contact_id,
      channel
    );
    if (execErr) throw execErr;

    // 3. Process Logic
    let response;
    if (action === "start") {
      response = await startFlow(supabase, session, execution, flow_id);
    } else {
      response = await continueFlow(supabase, session, execution, payload);
    }

    // 4. Record Event
    await recordEvent(supabase, {
      session_id: session.id,
      execution_id: execution.id,
      workspace_id,
      event_type: action === "start" ? "FLOW_STARTED" : "MESSAGE_RECEIVED",
      payload: body,
    });

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getOrCreateSession(supabase: any, workspace_id: string, flow_id: string, contact_id: string, channel: string) {
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  // Try to find active session within 24h
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

    // Increment usage counter here
    const period = new Date().toISOString().slice(0, 7);
    await supabase.rpc("increment_usage_counter", { 
      w_id: workspace_id, 
      p: period,
      field: "conversations_started"
    });
  } else {
    // Update last interaction
    await supabase
      .from("conversation_sessions")
      .update({ last_interaction_at: new Date().toISOString() })
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

async function startFlow(supabase: any, session: any, execution: any, flow_id: string) {
  // Logic to fetch the flow JSON, find Start node, and execute until first input
  // ... to be implemented ...
  return { ok: true, session_id: session.id, execution_id: execution.id };
}

async function continueFlow(supabase: any, session: any, execution: any, payload: any) {
  // Logic to process user input, advance state, and execute until next input
  // ... to be implemented ...
  return { ok: true };
}

async function recordEvent(supabase: any, event: any) {
  await supabase.from("conversation_events").insert(event);
}
