// =============================================================================
// Cliente do Runtime para a edge function `context-manager`.
// O Agente IA NUNCA chama isto diretamente — apenas o Runtime chama.
// =============================================================================
import { getEdgeFunctionUrl } from "./supabaseHelpers";

async function call(op: string, payload: Record<string, unknown>) {
  const url = getEdgeFunctionUrl("context-manager");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `context-manager ${res.status}`);
  return data;
}

export const ContextManager = {
  // --- catálogo (por bot) ---
  listSchema:    (bot_id: string) => call("schema.list", { bot_id }),
  registerKey:   (bot_id: string, key: string, description?: string) =>
    call("schema.register", { bot_id, key, description }),

  // --- memória (por conversation) ---
  listMemory:    (bot_id: string, conversation_id: string) =>
    call("memory.list", { bot_id, conversation_id }),
  getValue:      (bot_id: string, conversation_id: string, key: string) =>
    call("memory.get", { bot_id, conversation_id, key }),
  setValue:      (bot_id: string, conversation_id: string, key: string, value: unknown, description?: string) =>
    call("memory.set", { bot_id, conversation_id, key, value, description }),
  deleteValue:   (bot_id: string, conversation_id: string, key: string) =>
    call("memory.delete", { bot_id, conversation_id, key }),

  // --- skills / Live Data ---
  logSkill:      (args: {
    bot_id: string; conversation_id: string; skill_id: string;
    skill_name?: string; result_type: "context" | "live";
    input?: unknown; output?: unknown;
  }) => call("skill.log", args),
  lastSkillResult: (bot_id: string, conversation_id: string, skill_id: string) =>
    call("skill.last", { bot_id, conversation_id, skill_id }),
  liveSkillsPending: (bot_id: string, conversation_id: string, since_seconds = 3600) =>
    call("skill.livePending", { bot_id, conversation_id, since_seconds }),
};

export type ResultType = "context" | "live";
