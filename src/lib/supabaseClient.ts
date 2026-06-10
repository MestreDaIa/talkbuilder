// =============================================================================
// ZailomFlow — Sistema de banco de dados
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// PROJECT DB (Supabase principal do projeto — via env)
// -----------------------------------------------------------------------------

const SYSTEM_SUPABASE_REF = "fwoescubnnagdvwasbjl";
const SYSTEM_SUPABASE_URL = `https://${SYSTEM_SUPABASE_REF}.supabase.co`;
const SYSTEM_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3b2VzY3Vibm5hZ2R2d2FzYmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzA1OTYsImV4cCI6MjA5MjU0NjU5Nn0.IetF2dz-c_D8gY_KWkhTXBO3wuQz4fm4h_kAhfUOxJA";
const BLOCKED_INTERNAL_REFS: string[] = [];



// Fallback manual via localStorage para o sistema
const SYSTEM_FALLBACK_KEY = "talkmap_system_supabase";

interface SystemCreds {
  url: string;
  anonKey: string;
}

function isBlockedInternalUrl(url?: string): boolean {
  return Boolean(url && BLOCKED_INTERNAL_REFS.some((ref) => url.includes(ref)));
}

function safeCreds(url?: string, anonKey?: string): SystemCreds | null {
  if (!url || !anonKey) return null;
  if (isBlockedInternalUrl(url)) return null;
  return { url, anonKey };
}

function readSystemCreds(): SystemCreds | null {
  // Prioriza VITE_EXTERNAL_SUPABASE_URL e VITE_EXTERNAL_SUPABASE_ANON_KEY (banco fwoes...)
  const extUrl = import.meta.env.VITE_EXTERNAL_SUPABASE_URL;
  const extKey = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY;

  if (extUrl && extKey) {
    return { url: extUrl, anonKey: extKey };
  }

  // Fallback para as envs padrão se as externas não existirem
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey };
  }

  return { url: SYSTEM_SUPABASE_URL, anonKey: SYSTEM_SUPABASE_ANON_KEY };
}




export function saveSystemSupabaseCreds(creds: SystemCreds): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SYSTEM_FALLBACK_KEY, JSON.stringify(creds));
  systemClient = null;
}

let systemClient: SupabaseClient | null = null;

function buildSystemClient(): SupabaseClient {
  if (systemClient) return systemClient;
  
  const creds = readSystemCreds()!; // Sempre retorna algo por causa do fallback interno
  
  systemClient = createClient(creds.url, creds.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "talkmap-auth-v3", // Alterado para talkmap-auth-v3 para forçar limpeza de sessões residuais de outros bancos

    },
  });
  return systemClient;
}

/** Retorna o client do banco do sistema Zailom Flow. */
export function getSupabase(): SupabaseClient {
  return buildSystemClient();
}

/** True se há credenciais (env OU localStorage OU fallback interno). */
export function isSupabaseConfigured(): boolean {
  return true; // Sempre configurado devido ao fallback interno
}

/** True somente se veio de variável de ambiente (modo "produção"). */
export function isSupabaseFromEnv(): boolean {
  const extUrl = import.meta.env.VITE_EXTERNAL_SUPABASE_URL;
  const extKey = import.meta.env.VITE_EXTERNAL_SUPABASE_ANON_KEY;
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return Boolean((extUrl && extKey) || (envUrl && envKey));


}

/**
 * Proxy retrocompatível usado pelos componentes legados.
 */
export const supabaseClient: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const client = buildSystemClient();
    const value = Reflect.get(client as object, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

// -----------------------------------------------------------------------------
// CLIENT DB (BYO — opcional, configurado pelo cliente final via UI)
// -----------------------------------------------------------------------------

const CLIENT_STORAGE_KEY = "supabase_config";

export interface SupabaseConfig {
  url: string;
  anonKey: string;
}

let clientClient: SupabaseClient | null = null;
let clientCacheKey: string | null = null;

export function getClientSupabaseConfig(): SupabaseConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CLIENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SupabaseConfig>;
    if (!parsed.url || !parsed.anonKey) return null;
    return { url: parsed.url, anonKey: parsed.anonKey };
  } catch {
    return null;
  }
}

export function saveClientSupabaseConfig(config: SupabaseConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(config));
  clientClient = null;
  clientCacheKey = null;
}

export function clearClientSupabaseConfig(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CLIENT_STORAGE_KEY);
  clientClient = null;
  clientCacheKey = null;
}

export function getClientSupabase(): SupabaseClient | null {
  const cfg = getClientSupabaseConfig();
  if (!cfg) return null;
  const key = `${cfg.url}::${cfg.anonKey}`;
  if (clientClient && clientCacheKey === key) return clientClient;
  clientClient = createClient(cfg.url, cfg.anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "talkmap-client-auth",
    },
  });
  clientCacheKey = key;
  return clientClient;
}

export function isClientSupabaseConfigured(): boolean {
  return getClientSupabaseConfig() !== null;
}

// -----------------------------------------------------------------------------
// Aliases retrocompatíveis (DEPRECATED — manter até refatorar callers)
// -----------------------------------------------------------------------------
// Antes desse refactor as funções abaixo apontavam para o "único" Supabase
// (que na prática era o do cliente via localStorage). Hoje elas apontam para
// o CLIENT DB para não quebrar a tela de Integrações enquanto migramos.

export const getSupabaseConfig = getClientSupabaseConfig;
export const saveSupabaseConfig = saveClientSupabaseConfig;
export const clearSupabaseConfig = clearClientSupabaseConfig;
