import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { DollarSign, Save } from "lucide-react";

type Row = { plan: string; active_workspaces: number; unit_price_brl: number; mrr_brl: number };
type PriceRow = { plan: string; price_brl: number };

const fmt = (n: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(n) || 0);

export default function AdminBilling() {
  const [rows, setRows] = useState<Row[]>([]);
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true); setErr(null);
    try {
      const r = await adminApi.billing();
      setRows(r.rows ?? []);
      setPrices(r.prices ?? []);
      setTotal(Number(r.mrr_brl_total || 0));
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function savePrice(plan: string) {
    const raw = edits[plan];
    if (raw == null) return;
    const price = Number(raw.replace(",", "."));
    if (Number.isNaN(price) || price < 0) { alert("Preço inválido"); return; }
    try {
      await adminApi.updatePrice(plan, price);
      setEdits((e) => { const c = { ...e }; delete c[plan]; return c; });
      await load();
    } catch (e: any) { alert(e.message); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Faturamento</h1>
        <p className="text-sm text-white/50">
          MRR calculado apenas sobre workspaces <strong>standalone</strong> (não gerenciados pelo Booking).
        </p>
      </div>

      {err && <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">{err}</div>}

      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-emerald-500/20 flex items-center justify-center">
          <DollarSign className="w-6 h-6 text-emerald-300" />
        </div>
        <div>
          <div className="text-xs uppercase text-white/40 tracking-widest">MRR standalone</div>
          <div className="text-2xl font-semibold">{fmt(total)}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold">Receita por plano</div>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Plano</th>
              <th className="text-left px-4 py-2">Workspaces ativos</th>
              <th className="text-left px-4 py-2">Preço unitário</th>
              <th className="text-left px-4 py-2">MRR</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={4} className="px-4 py-8 text-center text-white/40">Carregando…</td></tr>}
            {rows.map((r) => (
              <tr key={r.plan} className="border-t border-white/5">
                <td className="px-4 py-3 capitalize">{r.plan}</td>
                <td className="px-4 py-3">{r.active_workspaces}</td>
                <td className="px-4 py-3">{fmt(r.unit_price_brl)}</td>
                <td className="px-4 py-3 font-medium">{fmt(r.mrr_brl)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <div className="px-4 py-3 border-b border-white/10 text-sm font-semibold">Tabela de preços</div>
        <table className="w-full text-sm">
          <thead className="bg-white/[0.04] text-white/50 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2">Plano</th>
              <th className="text-left px-4 py-2">Preço (BRL)</th>
              <th className="text-right px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {prices.map((p) => (
              <tr key={p.plan} className="border-t border-white/5">
                <td className="px-4 py-3 capitalize">{p.plan}</td>
                <td className="px-4 py-3">
                  <input
                    value={edits[p.plan] ?? String(p.price_brl)}
                    onChange={(e) => setEdits((s) => ({ ...s, [p.plan]: e.target.value }))}
                    className="w-32 bg-white/5 border border-white/10 rounded-md px-3 py-1.5 text-sm"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => savePrice(p.plan)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white text-black text-xs font-medium hover:bg-white/90">
                    <Save className="w-3.5 h-3.5" /> Salvar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
