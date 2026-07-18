import { useEffect, useState } from "react";
import { adminApi } from "@/lib/adminApi";
import {
  Building2, Users, Bot, Zap, ShieldAlert, Link2, Activity,
} from "lucide-react";

type Stats = {
  total_workspaces: number;
  embed_workspaces: number;
  standalone_workspaces: number;
  suspended_workspaces: number;
  total_bots: number;
  published_bots: number;
  total_users: number;
  active_sessions_24h: number;
  plan_distribution: Record<string, number>;
};

function Card({ icon: Icon, label, value, hint, tone = "default" }: any) {
  const tones: Record<string, string> = {
    default: "from-white/5 to-white/[0.02] border-white/10",
    warning: "from-amber-500/10 to-amber-500/5 border-amber-500/20",
    danger: "from-red-500/10 to-red-500/5 border-red-500/20",
    success: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20",
    info: "from-sky-500/10 to-sky-500/5 border-sky-500/20",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-br p-5 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-white/60 text-xs uppercase tracking-wider">
        <Icon className="w-4 h-4" />
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold">{value ?? "—"}</div>
      {hint && <div className="text-xs text-white/50 mt-1">{hint}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    adminApi.stats().then(setStats).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Visão geral</h1>
        <p className="text-sm text-white/50">Métricas em tempo real da plataforma</p>
      </div>

      {err && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {err}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card icon={Building2} label="Workspaces" value={stats?.total_workspaces} />
        <Card icon={Users} label="Usuários" value={stats?.total_users} tone="info" />
        <Card icon={Bot} label="Bots totais" value={stats?.total_bots} />
        <Card icon={Zap} label="Bots publicados" value={stats?.published_bots} tone="success" />
        <Card icon={Link2} label="Contas embed (Booking)" value={stats?.embed_workspaces} tone="info"
              hint="Provenientes do Zailom Booking" />
        <Card icon={Building2} label="Contas standalone" value={stats?.standalone_workspaces} />
        <Card icon={ShieldAlert} label="Suspensas" value={stats?.suspended_workspaces} tone="danger" />
        <Card icon={Activity} label="Sessões ativas 24h" value={stats?.active_sessions_24h} tone="success" />
      </div>

      <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h2 className="text-sm font-medium text-white/80 mb-3">Distribuição de planos</h2>
        <div className="flex flex-wrap gap-2">
          {stats && Object.entries(stats.plan_distribution ?? {}).map(([plan, count]) => (
            <div key={plan}
              className="px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm">
              <span className="text-white/60 capitalize mr-2">{plan}</span>
              <span className="font-semibold">{count}</span>
            </div>
          ))}
          {!stats && <div className="text-sm text-white/40">Carregando…</div>}
        </div>
      </div>
    </div>
  );
}
