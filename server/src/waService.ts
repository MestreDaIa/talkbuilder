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
/** Produto usado pelo Zailom Booking no wa-service (tenant compartilhado). */
const WA_SHARED_PRODUCT = process.env.WA_SHARED_TENANT_PRODUCT || "booking";


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

/**
 * Descobre o company_id do Booking associado a este workspace (contas embedadas).
 * Se existir, o Flow COMPARTILHA o tenant do Booking no wa-service — é assim que
 * as instâncias criadas em qualquer um dos dois produtos aparecem nos dois.
 */
async function findBookingCompanyId(workspaceId: string): Promise<string | null> {
  if (String(process.env.WA_SHARED_TENANT || "true").toLowerCase() === "false") return null;

  // 1) workspaceId pode ser o próprio user_id (1 usuário = 1 workspace lógico)
  const { data: self } = await supabase
    .from("profiles")
    .select("embed_company_id")
    .eq("id", workspaceId)
    .maybeSingle();
  if ((self as any)?.embed_company_id) return String((self as any).embed_company_id);

  // 2) workspace real com membros
  const { data: members } = await supabase
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId);
  const ids = (members || []).map((m: any) => m.user_id).filter(Boolean);
  if (!ids.length) return null;
  const { data: profs } = await supabase
    .from("profiles")
    .select("embed_company_id")
    .in("id", ids);
  const hit = (profs || []).find((p: any) => p?.embed_company_id);
  return hit?.embed_company_id ? String(hit.embed_company_id) : null;
}


/** Cria (ou recupera) o tenant no wa-service — idempotente. */
async function ensureTenant(product: string, productTenantId: string, name: string): Promise<string> {
  try {
    const tenant = await waFetch<any>("/v1/admin/tenants", {
      admin: true,
      method: "POST",
      body: { product, product_tenant_id: productTenantId, name },
    });
    const id = tenant?.id || tenant?.tenant_id || tenant?.tenant?.id;
    if (id) return String(id);
  } catch (err: any) {
    if (err?.status !== 409 && err?.status !== 400) throw err;
  }
  // Já existe → procura na listagem
  const list = await waFetch<any>("/v1/admin/tenants", {
    admin: true,
    query: { product, product_tenant_id: productTenantId },
  });
  const arr: any[] = Array.isArray(list) ? list : list?.data || list?.tenants || [];
  const found = arr.find(
    (t) => String(t?.product_tenant_id ?? "") === String(productTenantId) && (!t?.product || t.product === product)
  );
  const id = found?.id || found?.tenant_id;
  if (!id) throw new Error(`wa-service: tenant ${product}/${productTenantId} não encontrado nem criado`);
  return String(id);
}

export async function getWorkspaceCredentials(workspaceId: string): Promise<WorkspaceCreds> {
  const cached = credsCache.get(workspaceId);
  if (cached) return cached;

  const { data: ws } = await supabase
    .from("workspaces")
    .select("id, name, slug, wa_service_tenant_id, wa_service_api_key")
    .eq("id", workspaceId)
    .maybeSingle();

  // Fallback: contas onde 1 usuário = 1 workspace lógico (não existe linha em `workspaces`)
  let profile: any = null;
  if (!ws) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, full_name, slug, email")
      .eq("id", workspaceId)
      .maybeSingle();
    profile = prof;
    if (!prof) throw new Error(`workspace ${workspaceId} não encontrado`);
  }

  if (ws?.wa_service_tenant_id && ws?.wa_service_api_key) {
    const creds = { tenantId: ws.wa_service_tenant_id, apiKey: ws.wa_service_api_key, workspaceId };
    credsCache.set(workspaceId, creds);
    return creds;
  }

  // Lazy provisioning — tenant compartilhado com o Booking quando a conta é embedada
  const companyId = await findBookingCompanyId(workspaceId);
  const product = companyId ? WA_SHARED_PRODUCT : WA_PRODUCT;
  const productTenantId = companyId || workspaceId;
  const displayName =
    (ws as any)?.name || (ws as any)?.slug || profile?.full_name || profile?.slug || profile?.email || workspaceId;
  console.log(
    `[wa-service] provisionando tenant ${product}/${productTenantId} para workspace ${workspaceId}` +
      (companyId ? " (compartilhado com o Booking)" : "")
  );
  const tenantId = await ensureTenant(product, productTenantId, displayName);


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

  if (ws) {
    await supabase
      .from("workspaces")
      .update({
        wa_service_tenant_id: tenantId,
        wa_service_api_key: plaintext,
        wa_service_provisioned_at: new Date().toISOString(),
      })
      .eq("id", workspaceId);
  }

  const creds = { tenantId, apiKey: plaintext, workspaceId };
  credsCache.set(workspaceId, creds);
  return creds;
}


/**
 * Esquece a key/tenant atual do workspace e força novo provisionamento na
 * próxima chamada. Usado para migrar um workspace que já tinha tenant próprio
 * `flow/<workspace_id>` para o tenant compartilhado do Booking.
 */
export async function reprovisionWorkspace(workspaceId: string): Promise<WorkspaceCreds> {
  credsCache.delete(workspaceId);
  await supabase
    .from("workspaces")
    .update({ wa_service_tenant_id: null, wa_service_api_key: null })
    .eq("id", workspaceId);
  return getWorkspaceCredentials(workspaceId);
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
