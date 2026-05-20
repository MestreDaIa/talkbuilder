export type RuntimeMode = "flow" | "agent";

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  metadata?: Record<string, any>;
  created_at?: string;
  // UI Specific fields
  type?: "bot" | "user"; // Legacy compatibility
  isHtml?: boolean;
  isImage?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
  isFile?: boolean;
  autoplay?: boolean;
  alt?: string;
}

export interface Conversation {
  id: string;
  workspace_id?: string;
  bot_id?: string;
  visitor_id: string;
  channel: "webchat" | "whatsapp" | "api";
  runtime_mode: RuntimeMode;
  active_node_id?: string | null;
  memory?: PersistentMemory;
  created_at?: string;
  updated_at?: string;
}

export interface PersistentMemory {
  [key: string]: any;
}

export interface RuntimeState {
  mode: RuntimeMode;
  current_node_id: string | null;
  active_agent_node_id: string | null;
  conversation_id: string | null;
  visitor_id: string | null;
  message_history: Message[];
  persistent_memory: PersistentMemory;
  variables: Record<string, any>;
  waiting_for_input: boolean;
  waiting_for_type?: string | null;
  waiting_for_config?: any;
  next_buttons?: any[];
  wait_ms?: number;
}
