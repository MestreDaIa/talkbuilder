import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Search, ShieldAlert, ShieldCheck, Trash2, Link2, ExternalLink, Plus, X } from "lucide-react";

type Ws = {
  id: string; name: string; slug: string;
  owner_email: string | null; owner_name: string | null;
  is_embed: boolean; embed_company_id: string | null;
  effective_plan: string;
  is_suspended: boolean; suspended_reason: string | null;
  bots_count: number; members_count: number;
  created_at: string;
};

const planColor: Record<string, string> = {
  starter: "bg-slate-500/20 text-slate-200 border-slate-500/30",
  pro: "bg-sky-500/20 text-sky-200 border-sky-500/30",
  business: "bg-purple-500/20 text-purple-200 border-purple-500/30",
  suspended: "bg-red-500/20 text-red-200 border-red-500/30",
};

export default function AdminWorkspaces() {
  const [rows, setRows] = useState<Ws[]>([]);
  const [search, setSearch] = useState("");
  const [embed, setEmbed] = useState<"" | "true" | "false">("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await adminApi.listWorkspaces({
        search: search || undefined,
        embed: embed || undefined,
      });
      setRows(r.workspaces ?? []);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function suspend(w: Ws) {
    const reason = window.prompt(`Suspender "${w.name}". Motivo:`) ?? "";
    if (!reason && !confirm("Confirmar suspensão sem motivo?")) return;
    try { await adminApi.suspendWorkspace(w.id, reason); await load(); }
    catch (e: any) { alert(e.message); }
  }
  async function unsuspend(w: Ws) {
    try { await adminApi.unsuspendWorkspace(w.id); await load(); }
    catch (e: any) { alert(e.message); }
  }
  async function del(w: Ws) {
    if (!confirm(`EXCLUIR workspace "${w.name}" (${w.slug})?\n\nEssa ação é irreversível.`)) return;
    try { await adminApi.deleteWorkspace(w.id); await load(); }
    catch (e: any) { alert(e.message); }
  }

  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="text-sm text-white/50">Gestão de todas as contas da plataforma</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90">
          <Plus className="w-4 h-4" /> Criar workspace
        </button>
      </div>

      {showCreate && <CreateWorkspaceModal onClose={() => setShowCreate(false)} onCreated={load} />}


      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && load()}
            placeholder="Buscar por nome, slug ou email…"
            className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm outline-none focus:border-white/30"
          />
        </div>
        <select
          value={embed}
          onChange={(e) => setEmbed(e.target.value as any)}
          className="bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
        >
          <option value="">Todos</option>
          <option value="true">Só embed (Booking)</option>
          <option value="false">Só standalone</option>
        </select>
        <button
          onClick={load}
          className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90"
        >
          Aplicar
        </button>
      </div>

      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Workspace</th>
              <th className="text-left px-4 py-2">Owner</th>
              <th className="text-left px-4 py-2">Origem</th>
              <th className="text-left px-4 py-2">Plano</th>
              <th className="text-left px-4 py-2">Bots</th>
              <th className="text-left px-4 py-2">Membros</th>
              <th className="text-left px-4 py-2">Criado</th>
              <th className="text-right px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">Carregando…</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-white/40">Nenhum workspace</td></tr>
            )}
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                <td className="px-4 py-3">
                  <div className="font-medium">{w.name}</div>
                  <div className="text-white/40 text-xs">@{w.slug}</div>
                </td>
                <td className="px-4 py-3">
                  <div>{w.owner_name || "—"}</div>
                  <div className="text-white/40 text-xs">{w.owner_email}</div>
                </td>
                <td className="px-4 py-3">
                  {w.is_embed ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-200 text-xs">
                      <Link2 className="w-3 h-3" /> Booking
                    </span>
                  ) : (
                    <span className="text-xs text-white/50">Standalone</span>
                  )}
                  {w.embed_company_id && (
                    <div className="text-[10px] text-white/30 mt-0.5 font-mono truncate max-w-[140px]">
                      {w.embed_company_id}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full border text-xs capitalize ${planColor[w.effective_plan] ?? planColor.starter}`}>
                    {w.effective_plan}
                  </span>
                </td>
                <td className="px-4 py-3">{w.bots_count}</td>
                <td className="px-4 py-3">{w.members_count}</td>
                <td className="px-4 py-3 text-white/60 text-xs">
                  {new Date(w.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1 justify-end">
                    <a href={`/${w.slug}/workspace`} target="_blank" rel="noreferrer"
                      title="Abrir workspace" className="p-1.5 rounded hover:bg-white/10">
                      <ExternalLink className="w-4 h-4 text-white/60" />
                    </a>
                    {w.is_suspended ? (
                      <button onClick={() => unsuspend(w)} title="Reativar"
                        className="p-1.5 rounded hover:bg-emerald-500/20">
                        <ShieldCheck className="w-4 h-4 text-emerald-300" />
                      </button>
                    ) : (
                      <button onClick={() => suspend(w)} title="Suspender"
                        className="p-1.5 rounded hover:bg-amber-500/20">
                        <ShieldAlert className="w-4 h-4 text-amber-300" />
                      </button>
                    )}
                    <button onClick={() => del(w)} title="Excluir"
                      className="p-1.5 rounded hover:bg-red-500/20">
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

function CreateWorkspaceModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerPassword, setOwnerPassword] = useState("");
  const [plan, setPlan] = useState<"starter" | "pro" | "business">("starter");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    try {
      await adminApi.createWorkspace({
        name, slug, owner_email: ownerEmail,
        owner_name: ownerName || undefined,
        owner_password: ownerPassword || undefined,
        plan,
      });
      onClose(); onCreated();
    } catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={submit}
        className="w-full max-w-lg rounded-xl border border-white/10 bg-[#12101a] text-white p-6 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Criar workspace</h2>
            <p className="text-xs text-white/50">Cria (ou vincula) o owner e o workspace correspondente.</p>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-white/10">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-white/60 mb-1 block">Nome do workspace</label>
            <input required value={name} onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-white/60 mb-1 block">Slug (aparece na URL)</label>
            <input required value={slug} onChange={(e) => setSlug(e.target.value)}
              placeholder="minha-empresa"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm font-mono" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Email do owner</label>
            <input required type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Nome do owner</label>
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Senha inicial (opcional)</label>
            <input value={ownerPassword} onChange={(e) => setOwnerPassword(e.target.value)}
              type="text" placeholder="Deixe em branco = aleatória"
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-white/60 mb-1 block">Plano</label>
            <select value={plan} onChange={(e) => setPlan(e.target.value as any)}
              className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm">
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="business">Business</option>
            </select>
          </div>
        </div>

        {err && <div className="text-sm text-red-300">{err}</div>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/10 hover:bg-white/20 text-sm">Cancelar</button>
          <button disabled={busy}
            className="px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50">
            {busy ? "Criando…" : "Criar workspace"}
          </button>
        </div>
      </form>
    </div>
  );
}
