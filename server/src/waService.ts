/**
 * zailom-wa-service client + HMAC verification.
 *
 * O Flow NUNCA mais fala com a Evolution direto: toda operação (criar
 * instância, ler QR, enviar texto, configurar webhook) passa por
 * https://wa.zailom.com com uma chave `zwa_live_...` por workspace.
 *
 * Provisionamento é lazy: na primeira chamada de qualquer workspace o
 * backend cria o tenant (product=flow, product_tenant_id=workspace.id) e a
 * key via /v1/admin/tenants + /v1/admin/api-keys usando WA_SERVICE_ADMIN_TOKEN.
 */
import crypto from "crypto";
import { supabase } from "./supabase.js";

export const WA_SERVICE_URL: string =
  process.env.WA_SERVICE_URL || "https://wa.zailom.com";
const WA_ADMIN_TOKEN: string = process.env.WA_SERVICE_ADMIN_TOKEN || "";
const WA_WEBHOOK_SECRET: string = process.env.WA_WEBHOOK_SIGNING_SECRET || "";
const WA_PRODUCT = "flow";

// ----------------------------------------------------------------------------
// HMAC
// ----------------------------------------------------------------------------

/** Verifica assinatura `X-Zailom-Signature: sha256=<hex>` sobre o corpo cru. */
export function verifyWebhookSignature(rawBody: Buffer | string, signatureHeader: string | undefined): boolean {
  if (!WA_WEBHOOK_SECRET) {
    console.error("[wa-service] WA_WEBHOOK_SIGNING_SECRET não configurado; webhook será rejeitado.");
    return false;
  }
  if (!signatureHeader) return false;
  const provided = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  const body = typeof rawBody === "string" ? Buffer.from(rawBody) : rawBody;
  const expected = crypto.createHmac("sha256", WA_WEBHOOK_SECRET).update(body).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(provided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

// ----------------------------------------------------------------------------
// HTTP helpers
// ----------------------------------------------------------------------------

async function waFetch<T = any>(
  path: string,
  init: { method?: string; body?: any; apiKey?: string; admin?: boolean; query?: Record<string, any> } = {}
): Promise<T> {
  const url = new URL(path.replace(/^\//, ""), WA_SERVICE_URL.replace(/\/?$/, "/"));
  if (init.query) for (const [k, v] of Object.entries(init.query)) if (v != null) url.searchParams.set(k, String(v));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init.admin) {
    if (!WA_ADMIN_TOKEN) throw new Error("WA_SERVICE_ADMIN_TOKEN missing");
    headers["X-Admin-Token"] = WA_ADMIN_TOKEN;
    headers["Authorization"] = `Bearer ${WA_ADMIN_TOKEN}`;
  } else if (init.apiKey) {
    headers["Authorization"] = `Bearer ${init.apiKey}`;
  }

  const res = await fetch(url.toString(), {
    method: init.method || "GET",
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || `wa-service ${res.status}`;
    const err: any = new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data as T;
}

// ----------------------------------------------------------------------------
// Tenant provisioning (workspace -> tenant + key)
// ----------------------------------------------------------------------------

interface WorkspaceCreds {
  tenantId: string;
  apiKey: string;
  workspaceId: string;
}

const credsCache = new Map<string, WorkspaceCreds>();

export async function getWorkspaceCredentials(workspaceId: string): Promise<WorkspaceCreds> {
  const cached = credsCache.get(workspaceId);
  if (cached) return cached;

  const { data: ws, error } = await supabase
    .from("workspaces")
    .select("id, name, slug, wa_service_tenant_id, wa_service_api_key")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error || !ws) throw new Error(`workspace ${workspaceId} não encontrado`);

  if (ws.wa_service_tenant_id && ws.wa_service_api_key) {
    const creds = { tenantId: ws.wa_service_tenant_id, apiKey: ws.wa_service_api_key, workspaceId };
    credsCache.set(workspaceId, creds);
    return creds;
  }

  // Lazy provisioning
  console.log(`[wa-service] provisionando tenant para workspace ${workspaceId}`);
  const tenant = await waFetch<any>("/v1/admin/tenants", {
    admin: true,
    method: "POST",
    body: {
      product: WA_PRODUCT,
      product_tenant_id: workspaceId,
      name: ws.name || ws.slug || workspaceId,
    },
  });
  const tenantId: string = tenant.id || tenant.tenant_id || tenant.tenant?.id;
  if (!tenantId) throw new Error("wa-service não retornou tenant_id");

  const keyResp = await waFetch<any>("/v1/admin/api-keys", {
    admin: true,
    method: "POST",
    body: {
      tenant_id: tenantId,
      name: `flow-workspace-${workspaceId}`,
      scopes: ["instances:read", "instances:write", "messages:write", "webhooks:write"],
    },
  });
  const plaintext: string = keyResp.plaintext || keyResp.key || keyResp.api_key;
  if (!plaintext) throw new Error("wa-service não retornou plaintext da api-key");

  await supabase
    .from("workspaces")
    .update({
      wa_service_tenant_id: tenantId,
      wa_service_api_key: plaintext,
      wa_service_provisioned_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  const creds = { tenantId, apiKey: plaintext, workspaceId };
  credsCache.set(workspaceId, creds);
  return creds;
}

/** Cache reverso instance_name -> workspace_id (para o webhook resolver a key). */
export async function findWorkspaceByInstance(instanceName: string): Promise<WorkspaceCreds | null> {
  const { data: binding } = await supabase
    .from("whatsapp_bindings")
    .select("workspace_id")
    .eq("instance_name", instanceName)
    .maybeSingle();
  const wsId = binding?.workspace_id;
  if (!wsId) {
    // fallback: procura pela conexão
    const { data: conn } = await supabase
      .from("whatsapp_connections")
      .select("workspace_id")
      .eq("instance_name", instanceName)
      .maybeSingle();
    if (!conn?.workspace_id) return null;
    return getWorkspaceCredentials(conn.workspace_id).catch(() => null);
  }
  return getWorkspaceCredentials(wsId).catch(() => null);
}

// ----------------------------------------------------------------------------
// High-level API (por workspace)
// ----------------------------------------------------------------------------

export function waApi(apiKey: string) {
  const call = <T = any>(path: string, init: { method?: string; body?: any; query?: Record<string, any> } = {}) =>
    waFetch<T>(path, { ...init, apiKey });

  return {
    // Instâncias
    listInstances: () => call<any[]>("/v1/instances"),
    getInstance: (name: string) => call<any>(`/v1/instances/${encodeURIComponent(name)}`),
    createInstance: (name: string) =>
      call<any>("/v1/instances", { method: "POST", body: { name } }),
    deleteInstance: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}`, { method: "DELETE" }),
    logoutInstance: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/logout`, { method: "POST" }),
    getQrCode: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/qr`),
    getStatus: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/status`),

    // Config
    setWebhook: (name: string, data: { url: string; events?: string[]; base64?: boolean; byEvents?: boolean; enabled?: boolean }) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/webhook`, { method: "POST", body: data }),
    getWebhook: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/webhook`),
    setSettings: (name: string, settings: Record<string, any>) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/settings`, { method: "POST", body: settings }),
    getSettings: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/settings`),

    // Bot pass-through (opcional)
    setBot: (name: string, data: Record<string, any>) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/bot`, { method: "POST", body: data }),
    getBot: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/bot`),
    deleteBot: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/bot`, { method: "DELETE" }),

    // Mensagens
    sendText: (instance: string, to: string, text: string) =>
      call<any>("/v1/messages/text", { method: "POST", body: { instance, to, text, linkPreview: false } }),
    sendButtons: (instance: string, to: string, text: string, buttons: Array<{ id: string; label: string }>) =>
      call<any>("/v1/messages/buttons", {
        method: "POST",
        body: { instance, to, text, footer: "Bot", buttons },
      }),
  };
}
