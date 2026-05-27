import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import ws from "ws";

dotenv.config();

const supabaseUrl: string = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey: string = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("ERRO: SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurados.");
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
  },
  realtime: {
    transport: ws as any,
  },
});
