import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";

type Entry = {
  id: string; actor_email: string | null; action: string;
  target_type: string | null; target_id: string | null;
  payload: any; created_at: string;
};

export default function AdminAudit() {
  const [rows, setRows] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.audit(500)
      .then((r) => setRows(r.entries ?? []))
      .catch((e) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Auditoria</h1>
        <p className="text-sm text-white/50">Registro de todas as ações administrativas</p>
      </div>
      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Quando</th>
              <th className="text-left px-4 py-2">Ator</th>
              <th className="text-left px-4 py-2">Ação</th>
              <th className="text-left px-4 py-2">Alvo</th>
              <th className="text-left px-4 py-2">Payload</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">Carregando…</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="border-t border-white/5 align-top">
                <td className="px-4 py-3 text-xs text-white/60 whitespace-nowrap">
                  {new Date(e.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-xs">{e.actor_email ?? "—"}</td>
                <td className="px-4 py-3 text-xs font-mono">{e.action}</td>
                <td className="px-4 py-3 text-xs">
                  <div>{e.target_type ?? "—"}</div>
                  {e.target_id && <div className="text-white/40 font-mono truncate max-w-[220px]">{e.target_id}</div>}
                </td>
                <td className="px-4 py-3 text-[11px] text-white/50 font-mono">
                  <pre className="max-w-[420px] whitespace-pre-wrap break-all">
                    {e.payload ? JSON.stringify(e.payload, null, 2) : "—"}
                  </pre>
                </td>
              </tr>
            ))}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-white/40">Sem registros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
