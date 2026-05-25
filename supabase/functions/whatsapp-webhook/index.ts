// @ts-nocheck
// Recebe eventos da Evolution API e roda o bot vinculado
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const EVO_BASE_URL = "https://evo.zailom.com";
const EVO_GLOBAL_KEY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    console.log("WA webhook event:", JSON.stringify(body).slice(0, 500));

    const event = body?.event || body?.eventType;
    const instanceName = body?.instance || body?.instanceName;
    const data = body?.data;

    if (!instanceName) return json({ ok: true, skip: "no instance" });
    if (event && !String(event).toLowerCase().includes("messages.upsert") && !String(event).toLowerCase().includes("messages_upsert")) {
      return json({ ok: true, skip: "not a message event", event });
    }

    // Ignora mensagens enviadas pelo próprio bot
    if (data?.key?.fromMe) return json({ ok: true, skip: "fromMe" });

    const remoteJid: string = data?.key?.remoteJid || "";
    if (!remoteJid || remoteJid.endsWith("@g.us")) {
      // Por enquanto, ignora grupos
      return json({ ok: true, skip: "group or no jid" });
    }

    const text: string =
      data?.message?.conversation ||
      data?.message?.extendedTextMessage?.text ||
      data?.message?.imageMessage?.caption ||
      "";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: binding } = await supabase
      .from("whatsapp_bindings")
      .select("bot_public_id")
      .eq("instance_name", instanceName)
      .maybeSingle();

    if (!binding?.bot_public_id) {
      console.log("Nenhum bot vinculado para a instância", instanceName);
      return json({ ok: true, skip: "no binding" });
    }

    const number = remoteJid.replace(/@s\.whatsapp\.net$/, "");
    const contactId = `wa:${number}`;

    // Decide se é primeira mensagem (start) ou continuação
    const { data: existingSession } = await supabase
      .from("conversation_sessions")
      .select("id")
      .eq("contact_id", contactId)
      .eq("channel_id", "whatsapp")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    const action = existingSession ? "message" : "start";

    const runtimeRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/chatbot-runtime`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          action,
          flow_id: binding.bot_public_id,
          contact_id: contactId,
          channel: "whatsapp",
          payload: { text },
        }),
      }
    );

    const runtimeData = await runtimeRes.json();
    const messages: any[] = runtimeData?.messages || [];

    for (const m of messages) {
      const content = m?.content;
      if (!content) continue;
      if (m.isImage) {
        await fetch(`${EVO_BASE_URL}/message/sendMedia/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVO_GLOBAL_KEY },
          body: JSON.stringify({ number, mediatype: "image", media: content, caption: m.alt || "" }),
        }).catch((e) => console.error("send image err", e));
      } else {
        await fetch(`${EVO_BASE_URL}/message/sendText/${instanceName}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: EVO_GLOBAL_KEY },
          body: JSON.stringify({ number, text: String(content) }),
        }).catch((e) => console.error("send text err", e));
      }
      // pequeno delay para ordem
      await new Promise((r) => setTimeout(r, 400));
    }

    return json({ ok: true, sent: messages.length });
  } catch (err: any) {
    console.error("whatsapp-webhook error", err);
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
