// =============================================================================
// TalkMap — Sistema de banco de dados em duas camadas
// =============================================================================
//
// 1) SYSTEM DB (este arquivo, default export): banco do TalkMap, administrado
//    pelo desenvolvedor via .env.local. Usado para auth, profiles, e qualquer
//    dado interno do sistema. Cliente final NUNCA configura isso.
//
// 2) CLIENT DB (BYO — Bring Your Own): banco opcional do próprio cliente,
//    configurado via UI em /workspace/configs → Integrações. Salvo em
//    localStorage. Usado quando o cliente quer guardar bots/variáveis no
//    Supabase dele. Funções: getClientSupabaseConfig / saveClientSupabaseConfig
//    / clearClientSupabaseConfig / getClientSupabase.
// =============================================================================

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// -----------------------------------------------------------------------------
// SYSTEM DB (TalkMap interno — via env)
// -----------------------------------------------------------------------------

const SYSTEM_URL = import.meta.env.VITE_TALKMAP_SUPABASE_URL as
  | string
  | undefined;
const SYSTEM_KEY = import.meta.env.VITE_TALKMAP_SUPABASE_ANON_KEY as
  | string
  | undefined;

let systemClient: SupabaseClient | null = null;

function buildSystemClient(): SupabaseClient | null {
  if (!SYSTEM_URL || !SYSTEM_KEY) return null;
  if (systemClient) return systemClient;
  systemClient = createClient(SYSTEM_URL, SYSTEM_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: "talkmap-system-auth",
    },
  });
  return systemClient;
}

/** Retorna o client do banco do sistema TalkMap. Null se .env.local não estiver configurado. */
export function getSupabase(): SupabaseClient | null {
  return buildSystemClient();
}

/** True se as envs VITE_TALKMAP_SUPABASE_* estiverem definidas no build. */
export function isSupabaseConfigured(): boolean {
  return Boolean(SYSTEM_URL && SYSTEM_KEY);
}

/**
 * Proxy retrocompatível usado pelos componentes legados do chatbot.
 * Resolve preguiçosamente para o client do SYSTEM DB. Se o desenvolvedor
 * esqueceu de configurar o .env.local, lança erro descritivo.
 */
export const supabaseClient: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_t, prop, receiver) {
    const client = buildSystemClient();
    if (!client) {
      throw new Error(
        "TalkMap System DB não configurado. Defina VITE_TALKMAP_SUPABASE_URL e VITE_TALKMAP_SUPABASE_ANON_KEY em .env.local."
      );
    }
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
