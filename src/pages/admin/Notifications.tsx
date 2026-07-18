import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Trash2, Send } from "lucide-react";

type N = {
  id: string; title: string; body: string; level: string;
  target_type: string; target_value: string | null;
  created_at: string; expires_at: string | null;
};

const LEVELS = ["info", "success", "warning", "critical"] as const;
const TARGETS = [
  { value: "global", label: "Todos os usuários" },
  { value: "plan", label: "Por plano (starter/pro/business)" },
  { value: "workspace", label: "Workspace específico (id)" },
  { value: "user", label: "Usuário específico (id)" },
] as const;

export default function AdminNotifications() {
  const [items, setItems] = useState<N[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("info");
  const [target_type, setTargetType] = useState<(typeof TARGETS)[number]["value"]>("global");
  const [target_value, setTargetValue] = useState("");
  const [expires_at, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    const r = await adminApi.listNotifications();
    setItems(r.notifications ?? []);
  }
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await adminApi.createNotification({
        title, body, level, target_type,
        target_value: target_type === "global" ? null : target_value || null,
        expires_at: expires_at ? new Date(expires_at).toISOString() : null,
      });
      setTitle(""); setBody(""); setTargetValue(""); setExpiresAt("");
      await load();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  async function del(id: string) {
    if (!confirm("Excluir notificação?")) return;
    try { await adminApi.deleteNotification(id); await load(); }
    catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Notificações</h1>
        <p className="text-sm text-white/50">Envie avisos para usuários — aparecem no sino do header.</p>
      </div>

      <form onSubmit={submit} className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Título</label>
            <input required value={title} onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Nível</label>
            <select value={level} onChange={(e) => setLevel(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-white/60 mb-1 block">Mensagem</label>
          <textarea required value={body} onChange={(e) => setBody(e.target.value)} rows={3}
            className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-white/60 mb-1 block">Alvo</label>
            <select value={target_type} onChange={(e) => setTargetType(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
              {TARGETS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {target_type !== "global" && (
            <div>
              <label className="text-xs text-white/60 mb-1 block">
                {target_type === "plan" ? "Plano (starter|pro|business|suspended)" : "ID"}
              </label>
              <input required value={target_value} onChange={(e) => setTargetValue(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
            </div>
          )}
          <div>
            <label className="text-xs text-white/60 mb-1 block">Expira em (opcional)</label>
            <input type="datetime-local" value={expires_at} onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>
        {err && <div className="text-sm text-red-300">{err}</div>}
        <button disabled={busy}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50">
          <Send className="w-4 h-4" /> {busy ? "Enviando…" : "Publicar notificação"}
        </button>
      </form>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Título</th>
              <th className="text-left px-4 py-2">Alvo</th>
              <th className="text-left px-4 py-2">Nível</th>
              <th className="text-left px-4 py-2">Criada</th>
              <th className="text-left px-4 py-2">Expira</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((n) => (
              <tr key={n.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-white/50 text-xs line-clamp-2">{n.body}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="capitalize">{n.target_type}</div>
                  {n.target_value && <div className="text-white/40 font-mono">{n.target_value}</div>}
                </td>
                <td className="px-4 py-3 text-xs capitalize">{n.level}</td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {new Date(n.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {n.expires_at ? new Date(n.expires_at).toLocaleString("pt-BR") : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => del(n.id)} className="p-1.5 rounded hover:bg-red-500/20">
                    <Trash2 className="w-4 h-4 text-red-300" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Nenhuma notificação.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
