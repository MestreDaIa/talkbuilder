/**
 * DEPRECADO — o Flow não fala mais com a Evolution direto.
 *
 * Este módulo agora é apenas um shim de compatibilidade que delega para o
 * zailom-wa-service (https://wa.zailom.com) via `waService.ts`.
 *
 * `sendText`/`sendButtons` aceitam um `apiKeyOverride` que — no novo mundo —
 * DEVE ser a `zwa_live_...` do workspace dono da instância. Se não vier,
 * cai no `findWorkspaceByInstance` para resolver automaticamente.
 */
import dotenv from "dotenv";
import { waApi, findWorkspaceByInstance, WA_SERVICE_URL } from "./waService.js";

dotenv.config();

// Mantidos para compat com código antigo (logs, contexto do runtime).
export const EVO_BASE_URL: string = WA_SERVICE_URL;
export const EVO_GLOBAL_KEY: string = ""; // NUNCA mais expor a global key da Evolution.

async function resolveKey(instanceName: string, override?: string): Promise<string | null> {
  if (override && override.startsWith("zwa_")) return override;
  const creds = await findWorkspaceByInstance(instanceName);
  return creds?.apiKey || null;
}

export const evolutionApi = {
  async sendText(instanceName: string, number: string, text: string, apiKeyOverride?: string) {
    const key = await resolveKey(instanceName, apiKeyOverride);
    if (!key) {
      console.error(`[wa-service] chave não encontrada para instância ${instanceName}`);
      return { error: "wa_service_key_missing", instance: instanceName };
    }
    try {
      const data = await waApi(key).sendText(instanceName, number, text);
      console.log(`[wa-service] sendText -> ${number} @ ${instanceName}`);
      return data;
    } catch (error: any) {
      console.error(`[wa-service] sendText falhou:`, error?.message || error);
      return { error: error?.message || String(error) };
    }
  },

  async sendButtons(instanceName: string, number: string, text: string, buttons: any[], apiKeyOverride?: string) {
    const key = await resolveKey(instanceName, apiKeyOverride);
    if (!key) {
      console.error(`[wa-service] chave não encontrada para instância ${instanceName}`);
      return { error: "wa_service_key_missing", instance: instanceName };
    }
    try {
      const normalized = (buttons || []).map((b: any) => ({ id: b.id, label: b.label }));
      const data = await waApi(key).sendButtons(instanceName, number, text, normalized);
      console.log(`[wa-service] sendButtons -> ${number} @ ${instanceName}`);
      return data;
    } catch (error: any) {
      console.error(`[wa-service] sendButtons falhou:`, error?.message || error);
      return { error: error?.message || String(error) };
    }
  },
};
