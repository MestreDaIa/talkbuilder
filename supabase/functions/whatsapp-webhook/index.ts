// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EVO_BASE_URL = "https://evo.zailom.com";
const EVO_GLOBAL_KEY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("[whatsapp-webhook] Received event:", body.event);

    if (body.event !== "MESSAGES_UPSERT") {
      return new Response(JSON.stringify({ status: "ignored_event" }), { headers: { "Content-Type": "application/json" } });
    }

    const messageData = body.data;
    const instanceName = body.instance;
    const isGroup = messageData.key.remoteJid.endsWith("@g.us");
    const sender = messageData.key.remoteJid;
    const fromMe = messageData.key.fromMe;

    if (fromMe || isGroup) {
      return new Response(JSON.stringify({ status: "ignored_message" }), { headers: { "Content-Type": "application/json" } });
    }

    // Extract text from Evolution API payload
    const text = messageData.message?.conversation || 
                 messageData.message?.extendedTextMessage?.text || 
                 messageData.message?.buttonsResponseMessage?.selectedButtonId ||
                 "";

    if (!text && !messageData.message?.buttonsResponseMessage) {
      return new Response(JSON.stringify({ status: "no_text" }), { headers: { "Content-Type": "application/json" } });
    }

    // Initialize Supabase Client (External)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Find Bot linked to this instance
    const { data: binding, error: bindingError } = await supabase
      .from("whatsapp_bindings")
      .select("bot_public_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (bindingError || !binding) {
      console.error("[whatsapp-webhook] No binding found for instance:", instanceName, bindingError);
      return new Response(JSON.stringify({ status: "no_binding" }), { headers: { "Content-Type": "application/json" } });
    }

    // 2. Call Chatbot Runtime
    const runtimeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatbot-runtime`;
    const runtimeResponse = await fetch(runtimeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
      },
      body: JSON.stringify({
        action: "message",
        flow_id: binding.bot_public_id,
        contact_id: sender,
        channel: "whatsapp",
        payload: {
          message: text,
          button_id: messageData.message?.buttonsResponseMessage?.selectedButtonId
        }
      })
    });

    if (!runtimeResponse.ok) {
      const errorText = await runtimeResponse.text();
      console.error("[whatsapp-webhook] Runtime error:", errorText);
      return new Response(JSON.stringify({ status: "runtime_error" }), { status: 500 });
    }

    const runtimeData = await runtimeResponse.json();
    console.log("[whatsapp-webhook] Runtime responded with messages:", runtimeData.messages?.length);

    // 3. Send messages back via Evolution API
    for (const msg of (runtimeData.messages || [])) {
      if (!msg.text) continue;

      const buttons = runtimeData.buttons || [];
      const hasButtons = buttons.length > 0;

      const endpoint = hasButtons ? "message/sendButtons" : "message/sendText";
      const payload = hasButtons 
        ? {
            number: sender,
            title: "Escolha uma opção:",
            description: msg.text,
            footer: "Bot",
            buttons: buttons.map(b => ({
              buttonId: b.id,
              buttonText: { displayText: b.label },
              type: 1
            }))
          }
        : {
            number: sender,
            text: msg.text
          };

      await fetch(`${EVO_BASE_URL}/${endpoint}/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": EVO_GLOBAL_KEY
        },
        body: JSON.stringify(payload)
      });
    }

    return new Response(JSON.stringify({ status: "success" }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[whatsapp-webhook] Fatal error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
