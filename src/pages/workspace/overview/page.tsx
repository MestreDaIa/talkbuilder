"use client";

import { Activity, ArrowRight, Boxes, Plug, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { useWorkspace } from "../../../context/WorkspaceContext";
import { botRoute, workspaceRoot } from "../../../lib/workspaceRoutes";
import { getSupabase } from "../../../lib/supabaseClient";

export default function WorkspaceOverviewPage() {
  const { profile, currentWorkspace } = useAuth();
  const { items, loading } = useWorkspace();
  const navigate = useNavigate();
  const slug = currentWorkspace?.slug ?? profile?.slug;
  const flows = items.filter((item) => item.type === "bot");
  const [executionCount, setExecutionCount] = useState<number | null>(null);
  const [recentExecutions, setRecentExecutions] = useState<Array<{
    id: string;
    flow_id: string;
    contact_id: string;
    channel_id: string;
    action: string;
    created_at: string;
    flow_name: string;
  }>>([]);

  const relativeTime = (value: string) => {
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return "agora";
    if (minutes < 60) return `há ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `há ${days}d`;
    return new Date(value).toLocaleDateString("pt-BR");
  };

  const loadExecutionCount = useCallback(async () => {
    if (!flows.length) {
      setExecutionCount(0);
      return;
    }

    try {
      const supabase = getSupabase();
      if (!currentWorkspace?.id) {
        setExecutionCount(0);
        return;
      }

      const { count: eventCount, error: eventError } = await supabase
        .from("flow_execution_events")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", currentWorkspace.id);

      if (eventError) throw eventError;

      const { data: events, error: recentError } = await supabase
        .from("flow_execution_events")
        .select("id,flow_id,contact_id,channel_id,action,created_at")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(6);

      if (recentError) throw recentError;

      const flowIds = [...new Set((events ?? []).map((event) => event.flow_id))];
      let flowNames = new Map<string, string>();

      if (flowIds.length) {
        const { data: flowRows, error: flowsError } = await supabase
          .from("chatbot_flows")
          .select("id,name")
          .in("id", flowIds);

        if (flowsError) throw flowsError;
        flowNames = new Map((flowRows ?? []).map((flow) => [flow.id, flow.name]));
      }

      setExecutionCount(eventCount ?? 0);
      setRecentExecutions(
        (events ?? []).map((event) => ({
          ...event,
          flow_name: flowNames.get(event.flow_id) ?? "Fluxo",
        })),
      );
    } catch (error) {
      console.error("[WorkspaceOverview] erro ao carregar execuções:", error);
      setExecutionCount(null);
      setRecentExecutions([]);
    }
  }, [flows.map((flow) => flow.id).join(","), currentWorkspace?.id]);

  useEffect(() => {
    if (loading) return;
    void loadExecutionCount();
    const interval = window.setInterval(() => void loadExecutionCount(), 5000);
    return () => window.clearInterval(interval);
  }, [loading, loadExecutionCount]);

  const stats = [
    { label: "Fluxos", value: loading ? "…" : String(flows.length), icon: Boxes },
    { label: "Execuções", value: executionCount === null ? "—" : String(executionCount), icon: Activity },
    { label: "Sucesso", value: "—", icon: CheckCircle2 },
    { label: "Integrações", value: "—", icon: Plug },
  ];

  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="text-sm font-medium text-primary">Command Center</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Visão geral</h1>
          <p className="mt-2 text-muted-foreground">
            Um panorama do seu ambiente de automações.
          </p>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="rounded-xl border bg-background p-5">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <div className="mt-4 text-2xl font-bold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.4fr_.8fr]">
          <div className="rounded-xl border bg-background">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h2 className="font-semibold">Fluxos recentes</h2>
                <p className="text-sm text-muted-foreground">Seus fluxos disponíveis neste workspace.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate(workspaceRoot(slug))}
                className="text-sm font-medium text-primary hover:underline"
              >
                Ver fluxos
              </button>
            </div>

            <div className="divide-y">
              {flows.slice(0, 6).map((flow) => (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => navigate(botRoute(slug, flow.id))}
                  className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/40"
                >
                  <span className="text-xl">{flow.emoji || "🤖"}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{flow.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{flow.description || "Sem descrição"}</span>
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
              {!loading && flows.length === 0 && (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Nenhum fluxo criado ainda.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b p-5">
              <h2 className="font-semibold">Atividade recente</h2>
              <p className="mt-1 text-sm text-muted-foreground">Últimas execuções reais dos seus fluxos.</p>
            </div>

            <div className="divide-y">
              {recentExecutions.map((execution) => (
                <div key={execution.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{execution.flow_name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {execution.channel_id} · {relativeTime(execution.created_at)}
                    </p>
                  </div>
                </div>
              ))}

              {!recentExecutions.length && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  Nenhuma execução registrada ainda.
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
