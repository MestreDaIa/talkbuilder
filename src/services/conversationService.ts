import { getSupabase } from "../lib/supabaseClient";
import { Conversation, Message } from "../types/runtime";

export const conversationService = {
  async getOrCreateConversation(visitorId: string, botId: string, workspaceId: string): Promise<Conversation> {
    const supabase = getSupabase();
    if (!supabase) {
      return {
        id: `local-conv-${Date.now()}`,
        visitor_id: visitorId,
        bot_id: botId,
        workspace_id: workspaceId,
        channel: "webchat",
        runtime_mode: "flow",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }
    
    // Tenta encontrar uma conversa ativa recente para este visitante
    const { data: existing, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("visitor_id", visitorId)
      .eq("bot_id", botId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && !error) {
      return existing;
    }

    // Cria nova conversa
    const newConversation = {
      visitor_id: visitorId,
      bot_id: botId,
      workspace_id: workspaceId,
      channel: "webchat" as const,
      runtime_mode: "flow" as const
    };

    const { data, error: createError } = await supabase!
      .from("conversations")
      .insert(newConversation)
      .select()
      .single();

    if (createError) {
      console.error("Erro ao criar conversa:", createError);
      // Fallback local se o banco falhar (tabelas podem não existir ainda)
      return {
        id: `local-${Date.now()}`,
        ...newConversation,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    return data;
  },

  async saveMessage(message: Partial<Message>): Promise<Message> {
    const supabase = getSupabase();
    if (!supabase) {
       return {
        id: `msg-${Date.now()}`,
        ...message,
        created_at: new Date().toISOString()
      } as Message;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert(message)
      .select()
      .single();

    if (error) {
      console.warn("Erro ao salvar mensagem no banco, usando ID local:", error);
      return {
        id: `msg-${Date.now()}`,
        ...message,
        created_at: new Date().toISOString()
      } as Message;
    }

    return data;
  },

  async getMessages(conversationId: string, limit = 50): Promise<Message[]> {
    const supabase = getSupabase();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) {
      console.error("Erro ao buscar mensagens:", error);
      return [];
    }

    return data || [];
  }
};
