export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          key_value: string
          last_used_at: string | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_value: string
          last_used_at?: string | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          key_value?: string
          last_used_at?: string | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      chatbot_flows: {
        Row: {
          created_at: string
          description: string | null
          draft_containers: Json
          draft_edges: Json
          draft_updated_at: string
          id: string
          is_active: boolean
          is_published: boolean
          name: string
          public_id: string | null
          published_at: string | null
          published_containers: Json | null
          published_edges: Json | null
          settings: Json
          updated_at: string
          user_id: string | null
          workspace_id: string | null
          workspace_item_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          draft_containers?: Json
          draft_edges?: Json
          draft_updated_at?: string
          id?: string
          is_active?: boolean
          is_published?: boolean
          name: string
          public_id?: string | null
          published_at?: string | null
          published_containers?: Json | null
          published_edges?: Json | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
          workspace_item_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          draft_containers?: Json
          draft_edges?: Json
          draft_updated_at?: string
          id?: string
          is_active?: boolean
          is_published?: boolean
          name?: string
          public_id?: string | null
          published_at?: string | null
          published_containers?: Json | null
          published_edges?: Json | null
          settings?: Json
          updated_at?: string
          user_id?: string | null
          workspace_id?: string | null
          workspace_item_id?: string | null
        }
        Relationships: []
      }
      conversation_sessions: {
        Row: {
          channel_id: string
          contact_id: string
          created_at: string
          flow_id: string
          id: string
          last_interaction_at: string
          started_at: string
          status: string
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          channel_id?: string
          contact_id: string
          created_at?: string
          flow_id: string
          id?: string
          last_interaction_at?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          channel_id?: string
          contact_id?: string
          created_at?: string
          flow_id?: string
          id?: string
          last_interaction_at?: string
          started_at?: string
          status?: string
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sessions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_executions: {
        Row: {
          channel_id: string
          contact_id: string
          created_at: string
          current_node_id: string | null
          flow_id: string
          id: string
          updated_at: string
          variables: Json
          waiting_for_input: boolean
          workspace_id: string | null
        }
        Insert: {
          channel_id?: string
          contact_id: string
          created_at?: string
          current_node_id?: string | null
          flow_id: string
          id?: string
          updated_at?: string
          variables?: Json
          waiting_for_input?: boolean
          workspace_id?: string | null
        }
        Update: {
          channel_id?: string
          contact_id?: string
          created_at?: string
          current_node_id?: string | null
          flow_id?: string
          id?: string
          updated_at?: string
          variables?: Json
          waiting_for_input?: boolean
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "flow_executions_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          embed_company_id: string | null
          embed_max_chatbots: number | null
          embed_max_integrations: number | null
          embed_max_messages: number | null
          embed_plan_synced_at: string | null
          embed_plan_tier: string | null
          embed_source: string | null
          full_name: string | null
          id: string
          plan: string | null
          slug: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          embed_company_id?: string | null
          embed_max_chatbots?: number | null
          embed_max_integrations?: number | null
          embed_max_messages?: number | null
          embed_plan_synced_at?: string | null
          embed_plan_tier?: string | null
          embed_source?: string | null
          full_name?: string | null
          id: string
          plan?: string | null
          slug?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          embed_company_id?: string | null
          embed_max_chatbots?: number | null
          embed_max_integrations?: number | null
          embed_max_messages?: number | null
          embed_plan_synced_at?: string | null
          embed_plan_tier?: string | null
          embed_source?: string | null
          full_name?: string | null
          id?: string
          plan?: string | null
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_bindings: {
        Row: {
          bot_public_id: string
          created_at: string
          instance_name: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          bot_public_id: string
          created_at?: string
          instance_name: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          bot_public_id?: string
          created_at?: string
          instance_name?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      whatsapp_connections: {
        Row: {
          created_at: string
          id: string
          instance_name: string
          name: string | null
          settings: Json | null
          status: string | null
          updated_at: string
          workspace_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          instance_name: string
          name?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          instance_name?: string
          name?: string | null
          settings?: Json | null
          status?: string | null
          updated_at?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_api_key: { Args: never; Returns: string }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
