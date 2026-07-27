/**
 * WhatsApp API — proxy do Zailom Flow para o zailom-wa-service.
 *
 * IMPORTANTE: o frontend NÃO fala mais com a Evolution direto.
 * Todas as chamadas vão para `${VITE_BACKEND_URL}/api/wa/*`, que autentica
 * o usuário pela sessão do Supabase e usa a `zwa_live_` do workspace.
 *
 * O nome `evoApi` foi mantido por compatibilidade com os call sites
 * existentes (WhatsAppInstanceSettings, IntegrationsSettings, EmbedSnippets,
 * BotSettingsDialog, whatsappRuntimeService).
 */
import { supabase } from "@/integrations/supabase/client";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL as string) || "https://api-flowbuilder.zailom.com";

async function currentWorkspaceContext(): Promise<{ token: string; workspaceId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const userId = session?.user?.id;
  if (!token || !userId) throw new Error("Sessão expirada. Faça login novamente.");

  // 1 usuário = 1 workspace lógico. O backend usa esse workspaceId
  // para resolver/provisionar a zwa_live_ do tenant no wa-service.
  const workspaceId = userId;
  return { token, workspaceId };
}

async function waRequest<T = any>(
  path: string,
  init: { method?: string; body?: any } = {}
): Promise<T> {
  const { token, workspaceId } = await currentWorkspaceContext();
  const res = await fetch(`${BACKEND_URL}${path}`, {
    method: init.method || "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "x-workspace-id": workspaceId,
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!res.ok) {
    const msg = data?.error || data?.message || `wa-service ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }
  return data as T;
}

const enc = encodeURIComponent;

export const evoApi = {
  /** Refaz o vínculo do workspace com o wa-service (tenant compartilhado). */
  async reprovision() {
    return waRequest<any>("/api/wa/reprovision", { method: "POST" });
  },
  // --- Instâncias -----------------------------------------------------------
  async fetchInstances() {
    try { return await waRequest<any[]>("/api/wa/instances"); } catch { return []; }
  },

    try { return await waRequest<any[]>("/api/wa/instances"); } catch { return []; }
  },
  async fetchInstance(instanceName: string) {
    try { return await waRequest<any>(`/api/wa/instances/${enc(instanceName)}`); } catch { return null; }
  },
  async createInstance(instanceName: string) {
    try {
      return await waRequest<any>("/api/wa/instances", { method: "POST", body: { name: instanceName } });
    } catch (err: any) {
      const msg = String(err?.message || "");
      if (/exist|already/i.test(msg)) {
        return { instance: { instanceName }, alreadyExists: true };
      }
      throw err;
    }
  },
  async deleteInstance(instanceName: string) {
    try { await waRequest(`/api/wa/instances/${enc(instanceName)}`, { method: "DELETE" }); return true; }
    catch { return false; }
  },
  async logoutInstance(instanceName: string) {
    try { await waRequest(`/api/wa/instances/${enc(instanceName)}/logout`, { method: "POST" }); return true; }
    catch { return false; }
  },
  async getQrCode(instanceName: string) {
    try { return await waRequest<any>(`/api/wa/instances/${enc(instanceName)}/qr`); } catch { return null; }
  },
  async getInstanceStatus(instanceName: string) {
    try { return await waRequest<any>(`/api/wa/instances/${enc(instanceName)}/status`); } catch { return null; }
  },

  // --- Webhook / Settings ---------------------------------------------------
  async fetchWebhook(instanceName: string) {
    try { return await waRequest<any>(`/api/wa/instances/${enc(instanceName)}/webhook`); } catch { return null; }
  },
  async setWebhook(
    instanceName: string,
    webhookData: { enabled: boolean; url: string; byEvents?: boolean; base64?: boolean; events?: string[] }
  ) {
    return waRequest<any>(`/api/wa/instances/${enc(instanceName)}/webhook`, {
      method: "POST",
      body: webhookData,
    });
  },
  async fetchSettings(instanceName: string) {
    try { return await waRequest<any>(`/api/wa/instances/${enc(instanceName)}/settings`); } catch { return null; }
  },
  async setSettings(instanceName: string, settings: Record<string, any>) {
    return waRequest<any>(`/api/wa/instances/${enc(instanceName)}/settings`, {
      method: "POST",
      body: settings,
    });
  },

  // --- Bot (pass-through) ---------------------------------------------------
  async fetchEvolutionBot(instanceName: string) {
    try { return await waRequest<any>(`/api/wa/instances/${enc(instanceName)}/bot`); } catch { return null; }
  },
  async setEvolutionBot(instanceName: string, data: any) {
    return waRequest<any>(`/api/wa/instances/${enc(instanceName)}/bot`, {
      method: "POST",
      body: data,
    });
  },
  async deleteEvolutionBot(instanceName: string) {
    try { await waRequest(`/api/wa/instances/${enc(instanceName)}/bot`, { method: "DELETE" }); return true; }
    catch { return false; }
  },

  // --- Envio ----------------------------------------------------------------
  async sendText(instanceName: string, number: string, text: string) {
    return waRequest<any>("/api/wa/messages/text", {
      method: "POST",
      body: { instance: instanceName, to: number, text },
    });
  },
  async sendButtons(instanceName: string, number: string, text: string, buttons: any[]) {
    return waRequest<any>("/api/wa/messages/buttons", {
      method: "POST",
      body: {
        instance: instanceName,
        to: number,
        text,
        buttons: (buttons || []).map((b) => ({ id: b.id, label: b.label })),
      },
    });
  },
};
