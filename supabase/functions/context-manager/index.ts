// =============================================================================
// Edge Function: context-manager
// Deploy manual no Supabase externo.
// verify_jwt = FALSE  (chamada pelo Runtime; validar token internamente se quiser)
// =============================================================================
// Camada única de infraestrutura para o Runtime gerenciar:
//   • context_schema  (catálogo POR bot)
//   • session_memory  (valores POR conversation)
//   • skill_execution_log (histórico p/ revalidação Live Data)
//
// Nenhuma regra de negócio aqui. O Agente IA nunca fala com esta função
// diretamente — quem fala é o Runtime.
// =============================================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

type Op =
  | "schema.list" | "schema.register"
  | "memory.get" | "memory.list" | "memory.set" | "memory.delete"
  | "skill.log" | "skill.last" | "skill.livePending";

interface Req {
  op: Op;
  bot_id: string;
  conversation_id?: string;
  key?: string;
  value?: unknown;
  description?: string;
  skill_id?: string;
  skill_name?: string;
  result_type?: "context" | "live";
  input?: unknown;
  output?: unknown;
  // for skill.livePending: skills usadas recentemente cujo resultado precisa ser revalidado
  since_seconds?: number;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: Req;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  if (!body?.op || !body?.bot_id) return json({ error: "missing_op_or_bot_id" }, 400);

  try {
    switch (body.op) {
      // -------- Context Schema (catálogo do bot) --------------------------
      case "schema.list": {
        const { data, error } = await supabase
          .from("context_schema")
          .select("key,description,created_at,updated_at")
          .eq("bot_id", body.bot_id)
          .order("key");
        if (error) throw error;
        return json({ items: data ?? [] });
      }

      case "schema.register": {
        if (!body.key) return json({ error: "missing_key" }, 400);
        const { data, error } = await supabase
          .from("context_schema")
          .upsert(
            { bot_id: body.bot_id, key: body.key, description: body.description ?? null },
            { onConflict: "bot_id,key" },
          )
          .select()
          .single();
        if (error) throw error;
        return json({ item: data });
      }

      // -------- Session Memory (por conversation) -------------------------
      case "memory.list": {
        if (!body.conversation_id) return json({ error: "missing_conversation_id" }, 400);
        const { data, error } = await supabase
          .from("session_memory")
          .select("key,value,updated_at")
          .eq("conversation_id", body.conversation_id);
        if (error) throw error;
        const dict: Record<string, unknown> = {};
        (data ?? []).forEach((r: any) => { dict[r.key] = r.value; });
        return json({ memory: dict, items: data ?? [] });
      }

      case "memory.get": {
        if (!body.conversation_id || !body.key) return json({ error: "missing_params" }, 400);
        const { data, error } = await supabase
          .from("session_memory")
          .select("value")
          .eq("conversation_id", body.conversation_id)
          .eq("key", body.key)
          .maybeSingle();
        if (error) throw error;
        return json({ value: data?.value ?? null });
      }

      case "memory.set": {
        if (!body.conversation_id || !body.key) return json({ error: "missing_params" }, 400);
        // garante que a key exista no schema; se não existir, cria automaticamente
        await supabase.from("context_schema").upsert(
          { bot_id: body.bot_id, key: body.key, description: body.description ?? null },
          { onConflict: "bot_id,key", ignoreDuplicates: true },
        );
        const { data, error } = await supabase
          .from("session_memory")
          .upsert(
            {
              conversation_id: body.conversation_id,
              bot_id: body.bot_id,
              key: body.key,
              value: body.value ?? null,
            },
            { onConflict: "conversation_id,key" },
          )
          .select()
          .single();
        if (error) throw error;
        return json({ item: data });
      }

      case "memory.delete": {
        if (!body.conversation_id || !body.key) return json({ error: "missing_params" }, 400);
        const { error } = await supabase
          .from("session_memory")
          .delete()
          .eq("conversation_id", body.conversation_id)
          .eq("key", body.key);
        if (error) throw error;
        return json({ ok: true });
      }

      // -------- Skill execution log (p/ Live Data) ------------------------
      case "skill.log": {
        if (!body.conversation_id || !body.skill_id) return json({ error: "missing_params" }, 400);
        const { data, error } = await supabase
          .from("skill_execution_log")
          .insert({
            conversation_id: body.conversation_id,
            bot_id: body.bot_id,
            skill_id: body.skill_id,
            skill_name: body.skill_name ?? null,
            result_type: body.result_type ?? "context",
            input: body.input ?? null,
            output: body.output ?? null,
          })
          .select()
          .single();
        if (error) throw error;
        return json({ item: data });
      }

      case "skill.last": {
        if (!body.conversation_id || !body.skill_id) return json({ error: "missing_params" }, 400);
        const { data, error } = await supabase
          .from("skill_execution_log")
          .select("*")
          .eq("conversation_id", body.conversation_id)
          .eq("skill_id", body.skill_id)
          .order("executed_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return json({ item: data });
      }

      // Retorna as skills Live Data executadas recentemente cujo resultado
      // não pode ser reutilizado — o Runtime chama isso antes de operações
      // críticas para saber quais reexecutar.
      case "skill.livePending": {
        if (!body.conversation_id) return json({ error: "missing_conversation_id" }, 400);
        const since = new Date(Date.now() - 1000 * (body.since_seconds ?? 3600)).toISOString();
        const { data, error } = await supabase
          .from("skill_execution_log")
          .select("skill_id, skill_name, output, executed_at")
          .eq("conversation_id", body.conversation_id)
          .eq("result_type", "live")
          .gte("executed_at", since)
          .order("executed_at", { ascending: false });
        if (error) throw error;
        // dedupe por skill_id (última execução)
        const seen = new Set<string>();
        const items = (data ?? []).filter((r: any) => {
          if (seen.has(r.skill_id)) return false;
          seen.add(r.skill_id); return true;
        });
        return json({ items });
      }

      default:
        return json({ error: "unknown_op" }, 400);
    }
  } catch (err: any) {
    console.error("[context-manager]", err);
    return json({ error: err?.message ?? String(err) }, 500);
  }
});
