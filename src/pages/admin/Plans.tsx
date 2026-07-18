import { useEffect, useMemo, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import { Search, Save, Link2, Lock } from "lucide-react";

type Ws = {
  id: string; name: string; slug: string; owner_email: string | null;
  is_embed: boolean; effective_plan: string;
  internal_plan: string | null; embed_plan_tier: string | null;
  custom_bots_limit: number | null;
  custom_messages_limit: number | null;
  custom_integrations_limit: number | null;
};

export default function AdminPlans() {
  const [rows, setRows] = useState<Ws[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [plan, setPlan] = useState<"starter" | "pro" | "business">("starter");
  const [bots, setBots] = useState<string>("");
  const [msgs, setMsgs] = useState<string>("");
  const [ints, setInts] = useState<string>("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const r = await adminApi.listWorkspaces({ search: search || undefined });
    setRows(r.workspaces ?? []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const selected = useMemo(() => rows.find(r => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selected) return;
    setPlan((selected.internal_plan as any) ?? "starter");
    setBots(selected.custom_bots_limit?.toString() ?? "");
    setMsgs(selected.custom_messages_limit?.toString() ?? "");
    setInts(selected.custom_integrations_limit?.toString() ?? "");
    setReason("");
    setErr(null);
  }, [selected]);

  async function save() {
    if (!selected) return;
    setSaving(true); setErr(null);
    try {
      await adminApi.updatePlan(selected.id, {
        plan,
        custom_bots_limit: bots === "" ? null : Number(bots),
        custom_messages_limit: msgs === "" ? null : Number(msgs),
        custom_integrations_limit: ints === "" ? null : Number(ints),
        reason: reason || undefined,
      });
      await load();
      alert("Plano atualizado.");
    } catch (e: any) { setErr(e.message); }
    finally { setSaving(false); }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Planos & Assinaturas</h1>
        <p className="text-sm text-white/50">
          Contas <span className="text-sky-300">Booking</span> são <b>somente leitura</b> — o plano é gerenciado pelo Zailom Booking.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Buscar workspace…"
              className="w-full bg-white/5 border border-white/10 rounded-md pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <div className="rounded-xl border border-white/10 overflow-hidden max-h-[70vh] overflow-y-auto">
            {rows.map((w) => (
              <button
                key={w.id}
                onClick={() => setSelectedId(w.id)}
                className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] flex items-center justify-between ${selectedId === w.id ? "bg-white/[0.06]" : ""}`}
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{w.name}</div>
                  <div className="text-xs text-white/40 truncate">@{w.slug} · {w.owner_email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {w.is_embed && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-200 text-[10px]">
                      <Link2 className="w-3 h-3" /> Booking
                    </span>
                  )}
                  <span className="text-xs capitalize px-2 py-0.5 rounded-full bg-white/10">{w.effective_plan}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 h-fit">
          {!selected && <div className="text-sm text-white/40">Selecione um workspace</div>}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="text-xs text-white/40 uppercase">Editando</div>
                <div className="font-semibold">{selected.name}</div>
                <div className="text-xs text-white/50">@{selected.slug}</div>
              </div>

              {selected.is_embed ? (
                <div className="flex items-start gap-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 text-sm text-sky-100">
                  <Lock className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    Este workspace é <b>gerenciado pelo Zailom Booking</b>. Plano vigente:{" "}
                    <b className="capitalize">{selected.embed_plan_tier ?? "starter"}</b>.
                    Alterações devem ser feitas no Booking.
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Plano</label>
                    <select
                      value={plan}
                      onChange={(e) => setPlan(e.target.value as any)}
                      className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
                    >
                      <option value="starter">Starter</option>
                      <option value="pro">Pro</option>
                      <option value="business">Business</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Bots custom" value={bots} onChange={setBots} placeholder="padrão" />
                    <Field label="Msgs/mês" value={msgs} onChange={setMsgs} placeholder="padrão" />
                    <Field label="Integrações" value={ints} onChange={setInts} placeholder="padrão" />
                  </div>
                  <p className="text-[11px] text-white/40 -mt-2">Deixe vazio para usar o limite padrão do plano.</p>

                  <div>
                    <label className="text-xs text-white/60 mb-1 block">Motivo (auditoria)</label>
                    <input
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
                      placeholder="ex: acordo comercial trimestral"
                    />
                  </div>

                  {err && <div className="text-sm text-red-300">{err}</div>}

                  <button
                    disabled={saving}
                    onClick={save}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" /> {saving ? "Salvando…" : "Salvar alterações"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: any) {
  return (
    <div>
      <label className="text-xs text-white/60 mb-1 block">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode="numeric"
        className="w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm"
      />
    </div>
  );
}
