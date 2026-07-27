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

/** Diagnóstico: mostra como este workspace está mapeado no wa-service. */
export async function diagnoseWorkspace(workspaceId: string): Promise<any> {
  const out: any = { workspace_id: workspaceId, wa_service_url: WA_SERVICE_URL };
  try {
    out.booking_company_id = await findBookingCompanyId(workspaceId);
    out.product = out.booking_company_id ? WA_SHARED_PRODUCT : WA_PRODUCT;
    out.product_tenant_id = out.booking_company_id || workspaceId;
    const creds = await getWorkspaceCredentials(workspaceId);
    out.tenant_id = creds.tenantId;
    out.api_key_prefix = String(creds.apiKey || "").slice(0, 12);
    const list = await waApi(creds.apiKey).listInstances();
    const arr: any[] = Array.isArray(list) ? list : (list as any)?.data || (list as any)?.instances || [];
    out.instances_count = arr.length;
    out.instances = arr.map((i: any) => i?.name || i?.instanceName || i?.instance?.instanceName).filter(Boolean);
  } catch (err: any) {
    out.error = err?.message || String(err);
    out.details = err?.body;
  }
  return out;
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

function readInstanceName(item: any): string | null {
  const value =
    item?.name ||
    item?.label ||
    item?.display_name ||
    item?.evoName ||
    item?.evo_name ||
    item?.evolutionName ||
    item?.evolution_name ||
    item?.instanceName ||
    item?.instance_name ||
    item?.instance?.name ||
    item?.instance?.label ||
    item?.instance?.display_name ||
    item?.instance?.evoName ||
    item?.instance?.evo_name ||
    item?.instance?.evolutionName ||
    item?.instance?.evolution_name ||
    item?.instance?.instanceName ||
    item?.instance?.instance_name;
  return value ? String(value) : null;
}

function readInstanceId(item: any): string | null {
  const value =
    item?.id ||
    item?._id ||
    item?.uuid ||
    item?.instanceUuid ||
    item?.instance_uuid ||
    item?.wa_instance_id ||
    item?.waInstanceId ||
    item?.instanceId ||
    item?.instance_id ||
    item?.instance?.id ||
    item?.instance?._id ||
    item?.instance?.uuid ||
    item?.instance?.instanceUuid ||
    item?.instance?.instance_uuid ||
    item?.instance?.wa_instance_id ||
    item?.instance?.waInstanceId ||
    item?.instance?.instanceId ||
    item?.instance?.instance_id;
  return value ? String(value) : null;
}

function instanceListFrom(payload: any): any[] {
  if (Array.isArray(payload)) return payload;
  const candidates = [payload?.data, payload?.instances, payload?.items, payload?.results, payload?.records];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function safeDecode(value: string): string {
  try { return decodeURIComponent(value); } catch { return value; }
}

function sameIdentifier(a: string | null | undefined, b: string): boolean {
  if (!a) return false;
  const left = safeDecode(String(a)).trim();
  const right = safeDecode(String(b)).trim();
  return left === right || left.toLowerCase() === right.toLowerCase();
}

function uniqueNonEmpty(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value ? String(value).trim() : "";
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function deleteCandidatesFrom(item: any, fallback: string): string[] {
  return uniqueNonEmpty([
    readInstanceId(item),
    item?.local_id,
    item?.localId,
    item?.instance?.local_id,
    item?.instance?.localId,
    readInstanceName(item),
    fallback,
  ]);
}

// ----------------------------------------------------------------------------
// High-level API (por workspace)
// ----------------------------------------------------------------------------

export function waApi(apiKey: string) {
  const call = <T = any>(path: string, init: { method?: string; body?: any; query?: Record<string, any> } = {}) =>
    waFetch<T>(path, { ...init, apiKey });

  const resolveInstanceDeleteCandidates = async (name: string): Promise<string[]> => {
    try {
      const list: any = await call<any>("/v1/instances/all-instances");
      const arr = instanceListFrom(list);
      const found = arr.find((item) =>
        sameIdentifier(readInstanceName(item), name) ||
        sameIdentifier(readInstanceId(item), name) ||
        deleteCandidatesFrom(item, name).some((candidate) => sameIdentifier(candidate, name))
      );
      if (!found) return [name];
      return deleteCandidatesFrom(found, name);
    } catch (err: any) {
      console.warn("[wa-service] não foi possível resolver id da instância para delete:", err?.message || err);
      return [name];
    }
  };

  return {
    // Instâncias
    listInstances: () => call<any[]>("/v1/instances/all-instances"),
    getInstance: (name: string) => call<any>(`/v1/instances/${encodeURIComponent(name)}`),
    createInstance: (name: string) =>
      call<any>("/v1/instances/create", { method: "POST", body: { name } }),
    deleteInstance: async (name: string) => {
      const candidates = await resolveInstanceDeleteCandidates(name);
      const failures: Array<{ target: string; status?: number; message: string; body?: any }> = [];
      for (const target of candidates) {
        try {
          const result = await call<any>(`/v1/instances/${encodeURIComponent(target)}/delete`, { method: "DELETE" });
          console.log(`[wa-service] instância ${name} excluída via target ${target}`);
          return result;
        } catch (err: any) {
          failures.push({ target, status: err?.status, message: err?.message || String(err), body: err?.body });
          console.warn(`[wa-service] falha ao excluir ${name} via target ${target}:`, err?.message || err);
        }
      }
      const last = failures[failures.length - 1];
      const error: any = new Error(last?.message || "Falha ao excluir instância no wa-service");
      error.status = last?.status || 500;
      error.body = { attempts: failures };
      throw error;
    },
    logoutInstance: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/logout`, { method: "POST" }),
    getQrCode: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/connect`, { method: "POST" }),
    getStatus: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/connectionState`),
    refreshStatus: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/refresh-status`, { method: "POST" }),

    // Config
    setWebhook: (name: string, data: { url: string; events?: string[]; base64?: boolean; byEvents?: boolean; enabled?: boolean }) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/webhook/set`, { method: "POST", body: data }),
    getWebhook: (name: string) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/webhook/find`),
    setSettings: (name: string, settings: Record<string, any>) =>
      call<any>(`/v1/instances/${encodeURIComponent(name)}/settings/set`, { method: "POST", body: settings }),
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
      call<any>(`/v1/instances/${encodeURIComponent(instance)}/message/sendText`, {
        method: "POST",
        body: { number: to, to, text, linkPreview: false },
      }),
    sendButtons: (instance: string, to: string, text: string, buttons: Array<{ id: string; label: string }>) =>
      call<any>(`/v1/instances/${encodeURIComponent(instance)}/message/sendButtons`, {
        method: "POST",
        body: { number: to, to, text, footer: "Bot", buttons },
      }),
  };
}
