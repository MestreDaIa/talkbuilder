import { getSupabase } from "@/lib/supabaseClient";
const supabase = getSupabase();

const SUPABASE_URL =
  import.meta.env.VITE_EXTERNAL_SUPABASE_URL ||
  "https://fwoescubnnagdvwasbjl.supabase.co";

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sem sessão ativa");
  return { Authorization: `Bearer ${token}` };
}

async function call<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await authHeader()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api${path}`, {
    ...init,
    headers,
  });
  const text = await res.text();
  let payload: any = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = { raw: text }; }
  if (!res.ok) {
    const msg = payload?.detail || payload?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return payload as T;
}

export const adminApi = {
  stats: () => call("/stats"),
  listWorkspaces: (params: { search?: string; embed?: "true" | "false" } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.embed) q.set("embed", params.embed);
    const qs = q.toString();
    return call(`/workspaces${qs ? `?${qs}` : ""}`);
  },
  suspendWorkspace: (id: string, reason?: string) =>
    call(`/workspaces/${id}/suspend`, { method: "POST", body: JSON.stringify({ reason }) }),
  unsuspendWorkspace: (id: string) =>
    call(`/workspaces/${id}/unsuspend`, { method: "POST", body: "{}" }),
  deleteWorkspace: (id: string) => call(`/workspaces/${id}`, { method: "DELETE" }),

  listUsers: (page = 1, perPage = 50) => call(`/users?page=${page}&perPage=${perPage}`),
  resetPassword: (uid: string) =>
    call(`/users/${uid}/reset-password`, { method: "POST", body: "{}" }),
  banUser: (uid: string, duration?: string) =>
    call(`/users/${uid}/ban`, { method: "POST", body: JSON.stringify({ duration }) }),
  unbanUser: (uid: string) =>
    call(`/users/${uid}/unban`, { method: "POST", body: "{}" }),
  deleteUser: (uid: string) => call(`/users/${uid}`, { method: "DELETE" }),


  updatePlan: (
    workspaceId: string,
    payload: {
      plan?: "starter" | "pro" | "business";
      custom_bots_limit?: number | null;
      custom_messages_limit?: number | null;
      custom_integrations_limit?: number | null;
      reason?: string;
    },
  ) => call(`/plans/${workspaceId}`, { method: "POST", body: JSON.stringify(payload) }),

  createWorkspace: (payload: {
    name: string; slug: string; owner_email: string;
    owner_name?: string; owner_password?: string;
    plan?: "starter" | "pro" | "business";
  }) => call("/workspaces", { method: "POST", body: JSON.stringify(payload) }),

  listNotifications: () => call("/notifications"),
  createNotification: (payload: {
    title: string;
    body: string;
    level?: "info" | "success" | "warning" | "critical";
    target_type: "global" | "plan" | "workspace" | "user";
    target_value?: string | null;
    expires_at?: string | null;
    is_clickable?: boolean;
    preview?: string | null;
    image_url?: string | null;
    video_url?: string | null;
    link_url?: string | null;
  }) => call("/notifications", { method: "POST", body: JSON.stringify(payload) }),
  deleteNotification: (id: string) => call(`/notifications/${id}`, { method: "DELETE" }),

  // Bots
  listBots: (params: { search?: string; status?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set("search", params.search);
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return call(`/bots${qs ? `?${qs}` : ""}`);
  },
  botAction: (id: string, action: "publish" | "unpublish" | "block" | "unblock" | "ban" | "unban", reason?: string) =>
    call(`/bots/${id}/${action}`, { method: "POST", body: JSON.stringify({ reason }) }),
  deleteBot: (id: string) => call(`/bots/${id}`, { method: "DELETE" }),
  exportBotUrl: (id: string) => `${SUPABASE_URL}/functions/v1/admin-api/bots/${id}/export`,
  exportBot: async (id: string) => {
    const headers = await authHeader();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/admin-api/bots/${id}/export`, { headers });
    if (!res.ok) throw new Error(`Falha ao exportar: HTTP ${res.status}`);
    return res.blob();
  },

  // Billing
  billing: () => call("/billing"),
  updatePrice: (plan: string, price_brl: number) =>
    call("/billing/prices", { method: "POST", body: JSON.stringify({ plan, price_brl }) }),

  audit: (limit = 200) => call(`/audit?limit=${limit}`),
};
