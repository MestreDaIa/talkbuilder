// =============================================================================
// ZailomFlow — Sistema de banco de dados
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// PROJECT DB (Supabase principal do projeto — via env)
// -----------------------------------------------------------------------------

const ENV_URL = import.meta.env.VITE_SUPABASE_URL;
const ENV_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fallback manual via localStorage para o sistema
const SYSTEM_FALLBACK_KEY = "talkmap_system_supabase";

interface SystemCreds {
  url: string;
  anonKey: string;
}

function readSystemCreds(): SystemCreds | null {
  // 1. Prioridade: Variáveis de Ambiente
  if (ENV_URL && ENV_KEY) {
    console.log("[Supabase] Usando credenciais das variáveis de ambiente:", ENV_URL);
    return { url: ENV_URL, anonKey: ENV_KEY };
  }
  
  // 2. Fallback: LocalStorage (para desenvolvimento/preview)
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(SYSTEM_FALLBACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<SystemCreds>;
        if (parsed.url && parsed.anonKey) {
          console.log("[Supabase] Usando credenciais do LocalStorage:", parsed.url);
          return { url: parsed.url, anonKey: parsed.anonKey };
        }
      }
    } catch (e) {
      console.error("Erro ao ler credenciais do localStorage", e);
    }
  }

  // 3. Fallback final: Banco externo Zailom (fwoe...)
  const INTERNAL_URL = "https://fwoescubnnagdvwasbjl.supabase.co";
  const INTERNAL_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3b2VzY3Vibm5hZ2R2d2FzYmpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY5NzA1OTYsImV4cCI6MjA5MjU0NjU5Nn0.IetF2dz-c_D8gY_KWkhTXBO3wuQz4fm4h_kAhfUOxJA";
  
  console.log("[Supabase] Usando fallback interno (fwoe):", INTERNAL_URL);
  return { url: INTERNAL_URL, anonKey: INTERNAL_KEY };
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
      storageKey: "talkmap-system-auth",
    },
  });
  return systemClient;
}

/** Retorna o client do banco do sistema TalkMap. */
export function getSupabase(): SupabaseClient {
  return buildSystemClient();
}

/** True se há credenciais (env OU localStorage OU fallback interno). */
export function isSupabaseConfigured(): boolean {
  return true; // Sempre configurado devido ao fallback interno
}

/** True somente se veio de variável de ambiente (modo "produção"). */
export function isSupabaseFromEnv(): boolean {
  return Boolean(ENV_URL && ENV_KEY);
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
