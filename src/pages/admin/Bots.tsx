import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Search, Download, ShieldAlert, ShieldCheck, Ban, Play, Pause, Trash2, ExternalLink } from "lucide-react";

type BotRow = {
  id: string; title: string; public_id: string | null;
  workspace_id: string; workspace_name: string | null; workspace_slug: string | null;
  owner_email: string | null; owner_embed_source: string | null;
  is_published: boolean; is_blocked: boolean; is_banned: boolean;
  blocked_reason: string | null; banned_reason: string | null;
  created_at: string;
};

export default function AdminBots() {
  const [rows, setRows] = useState<BotRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await adminApi.listBots({ search: search || undefined, status: status || undefined });
      setRows(r.bots ?? []);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function act(b: BotRow, action: "publish" | "unpublish" | "block" | "unblock" | "ban" | "unban") {
    let reason: string | undefined;
    if (action === "block" || action === "ban") {
      reason = window.prompt(`Motivo (${action}):`) ?? undefined;
    } else if (action === "ban") {
      if (!confirm(`Banir "${b.title}"? Isso impede o bot de ser publicado novamente.`)) return;
    }
    try { await adminApi.botAction(b.id, action, reason); await load(); }
    catch (e: any) { alert(e.message); }
  }

  async function del(b: BotRow) {
    if (!confirm(`EXCLUIR bot "${b.title}"? Ação irreversível.`)) return;
    try { await adminApi.deleteBot(b.id); await load(); }
    catch (e: any) { alert(e.message); }
  }

  async function download(b: BotRow) {
    try {
      const blob = await adminApi.exportBot(b.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `bot-${b.public_id ?? b.id}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Bots</h1>
        <p className="text-sm text-white/50">Todos os bots da plataforma — moderação e controle.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Buscar por título, workspace ou email…"
            className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
          <option value="">Todos</option>
          <option value="published">Publicados</option>
          <option value="unpublished">Não publicados</option>
          <option value="blocked">Bloqueados</option>
          <option value="banned">Banidos</option>
        </select>
        <button onClick={load} className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90">
          Aplicar
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Bot</th>
              <th className="text-left px-4 py-2">Workspace</th>
              <th className="text-left px-4 py-2">Origem</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Criado</th>
              <th className="text-right px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Carregando…</td></tr>}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-white/40">Nenhum bot.</td></tr>
            )}
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-medium">{b.title}</div>
                  <div className="text-xs text-white/40 font-mono">{b.public_id ?? b.id.slice(0, 8)}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{b.workspace_name || "—"}</div>
                  <div className="text-xs text-white/40">@{b.workspace_slug} · {b.owner_email}</div>
                </td>
                <td className="px-4 py-3 text-xs">
                  {b.owner_embed_source === "booking"
                    ? <span className="px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-200">Booking</span>
                    : <span className="text-white/50">Standalone</span>}
                </td>
                <td className="px-4 py-3 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className={b.is_published ? "text-emerald-300" : "text-white/40"}>
                      {b.is_published ? "Publicado" : "Não publicado"}
                    </span>
                    {b.is_blocked && <span className="text-amber-300">Bloqueado</span>}
                    {b.is_banned && <span className="text-red-300">Banido</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-white/60">
                  {new Date(b.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    {b.workspace_slug && (
                      <a href={`/${b.workspace_slug}/workspace/bot/${b.id}`} target="_blank" rel="noreferrer"
                        title="Abrir editor" className="p-1.5 rounded hover:bg-white/10">
                        <ExternalLink className="w-4 h-4 text-white/60" />
                      </a>
                    )}
                    <button onClick={() => download(b)} title="Baixar JSON" className="p-1.5 rounded hover:bg-white/10">
                      <Download className="w-4 h-4 text-white/60" />
                    </button>
                    {b.is_published
                      ? <button onClick={() => act(b, "unpublish")} title="Despublicar" className="p-1.5 rounded hover:bg-white/10">
                          <Pause className="w-4 h-4 text-white/60" />
                        </button>
                      : <button onClick={() => act(b, "publish")} title="Publicar" className="p-1.5 rounded hover:bg-emerald-500/20">
                          <Play className="w-4 h-4 text-emerald-300" />
                        </button>}
                    {b.is_blocked
                      ? <button onClick={() => act(b, "unblock")} title="Desbloquear" className="p-1.5 rounded hover:bg-emerald-500/20">
                          <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        </button>
                      : <button onClick={() => act(b, "block")} title="Bloquear" className="p-1.5 rounded hover:bg-amber-500/20">
                          <ShieldAlert className="w-4 h-4 text-amber-300" />
                        </button>}
                    {b.is_banned
                      ? <button onClick={() => act(b, "unban")} title="Desbanir" className="p-1.5 rounded hover:bg-emerald-500/20">
                          <ShieldCheck className="w-4 h-4 text-emerald-300" />
                        </button>
                      : <button onClick={() => act(b, "ban")} title="Banir" className="p-1.5 rounded hover:bg-red-500/20">
                          <Ban className="w-4 h-4 text-red-300" />
                        </button>}
                    <button onClick={() => del(b)} title="Excluir" className="p-1.5 rounded hover:bg-red-500/20">
                      <Trash2 className="w-4 h-4 text-red-300" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
