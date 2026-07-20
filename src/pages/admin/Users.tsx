import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { KeyRound, Ban, CheckCircle2, Link2, Trash2 } from "lucide-react";


type U = {
  id: string; email: string | null; created_at: string;
  last_sign_in_at: string | null; banned_until: string | null;
  profile: { slug: string; display_name: string | null; plan: string; embed_source: string | null; embed_plan_tier: string | null; is_suspended: boolean } | null;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<U[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  async function load(p = page) {
    setLoading(true); setErr(null);
    try {
      const r = await adminApi.listUsers(p, 50);
      setUsers(r.users);
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(1); /* eslint-disable-next-line */ }, []);

  async function reset(u: U) {
    if (!confirm(`Gerar link de reset de senha para ${u.email}?`)) return;
    try {
      const r = await adminApi.resetPassword(u.id);
      if (r?.link) {
        await navigator.clipboard.writeText(r.link).catch(() => {});
        alert("Link copiado para a área de transferência.\n\n" + r.link);
      } else alert("Link enviado por email.");
    } catch (e: any) { alert(e.message); }
  }
  async function toggleBan(u: U) {
    const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
    if (banned) {
      if (!confirm(`Desbanir ${u.email}?`)) return;
      try { await adminApi.unbanUser(u.id); await load(); } catch (e: any) { alert(e.message); }
    } else {
      if (!confirm(`Banir ${u.email} permanentemente?`)) return;
      try { await adminApi.banUser(u.id); await load(); } catch (e: any) { alert(e.message); }
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Usuários</h1>
        <p className="text-sm text-white/50">Contas cadastradas no Supabase Auth</p>
      </div>

      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Email</th>
              <th className="text-left px-4 py-2">Nome / Slug</th>
              <th className="text-left px-4 py-2">Origem</th>
              <th className="text-left px-4 py-2">Plano</th>
              <th className="text-left px-4 py-2">Últ. login</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-right px-4 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="px-4 py-8 text-center text-white/40">Carregando…</td></tr>}
            {!loading && users.map((u) => {
              const banned = !!u.banned_until && new Date(u.banned_until) > new Date();
              const isEmbed = u.profile?.embed_source === "booking";
              return (
                <tr key={u.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3">{u.email}</td>
                  <td className="px-4 py-3">
                    <div>{u.profile?.display_name || "—"}</div>
                    <div className="text-white/40 text-xs">@{u.profile?.slug}</div>
                  </td>
                  <td className="px-4 py-3">
                    {isEmbed ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-200 text-xs">
                        <Link2 className="w-3 h-3" /> Booking
                      </span>
                    ) : <span className="text-xs text-white/50">Standalone</span>}
                  </td>
                  <td className="px-4 py-3 capitalize">
                    {isEmbed ? (u.profile?.embed_plan_tier ?? "—") : (u.profile?.plan ?? "—")}
                  </td>
                  <td className="px-4 py-3 text-white/60 text-xs">
                    {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString("pt-BR") : "nunca"}
                  </td>
                  <td className="px-4 py-3">
                    {banned
                      ? <span className="text-red-300 text-xs">Banido</span>
                      : u.profile?.is_suspended
                        ? <span className="text-amber-300 text-xs">Suspenso</span>
                        : <span className="text-emerald-300 text-xs">Ativo</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => reset(u)} title="Reset senha"
                        className="p-1.5 rounded hover:bg-white/10">
                        <KeyRound className="w-4 h-4 text-white/70" />
                      </button>
                      <button onClick={() => toggleBan(u)} title={banned ? "Desbanir" : "Banir"}
                        className="p-1.5 rounded hover:bg-red-500/20">
                        {banned ? <CheckCircle2 className="w-4 h-4 text-emerald-300" /> : <Ban className="w-4 h-4 text-red-300" />}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2">
        <button
          disabled={page <= 1}
          onClick={() => { const p = page - 1; setPage(p); load(p); }}
          className="px-3 py-1.5 rounded border border-white/10 text-sm disabled:opacity-30"
        >Anterior</button>
        <span className="text-sm text-white/60">Página {page}</span>
        <button
          onClick={() => { const p = page + 1; setPage(p); load(p); }}
          className="px-3 py-1.5 rounded border border-white/10 text-sm"
        >Próxima</button>
      </div>
    </div>
  );
}
