"use client";

import { Activity } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getSupabase } from "../../../lib/supabaseClient";
import { botRoute } from "../../../lib/workspaceRoutes";

type Execution = {
  id: string;
  flow_id: string;
  contact_id: string;
  channel_id: string;
  action: string;
  created_at: string;
  flow_name: string;
  flow_public_id: string | null;
};

export default function WorkspaceExecutionsPage() {
  const { currentWorkspace, profile } = useAuth();
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!currentWorkspace?.id) {
      setExecutions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadExecutions = async () => {
      try {
        const supabase = getSupabase();
        if (!supabase) throw new Error("Supabase não configurado");

        const { data: events, error: eventsError } = await supabase
          .from("flow_execution_events")
          .select("id,flow_id,contact_id,channel_id,action,created_at")
          .eq("workspace_id", currentWorkspace.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (eventsError) throw eventsError;

        const flowIds = [...new Set((events ?? []).map((event) => event.flow_id))];
        let flowMap = new Map<string, { name: string; public_id: string | null }>();

        if (flowIds.length) {
          const { data: flowRows, error: flowsError } = await supabase
            .from("chatbot_flows")
            .select("id,name,public_id")
            .in("id", flowIds);

          if (flowsError) throw flowsError;
          flowMap = new Map(
            (flowRows ?? []).map((flow) => [
              flow.id,
              { name: flow.name, public_id: flow.public_id },
            ]),
          );
        }

        if (cancelled) return;

        setExecutions(
          (events ?? []).map((event) => ({
            ...event,
            flow_name: flowMap.get(event.flow_id)?.name ?? "Fluxo",
            flow_public_id: flowMap.get(event.flow_id)?.public_id ?? null,
          })),
        );
        setError(null);
      } catch (loadError) {
        console.error("[WorkspaceExecutions] erro ao carregar execuções:", loadError);
        if (!cancelled) {
          setExecutions([]);
          setError("Não foi possível carregar o histórico de execuções.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadExecutions();
    const interval = window.setInterval(() => void loadExecutions(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentWorkspace?.id]);

  const slug = currentWorkspace?.slug ?? profile?.slug;

  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Execuções</h1>
        <p className="mt-2 text-muted-foreground">Histórico das execuções reais dos seus fluxos.</p>

        {error && (
          <div className="mt-8 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-xl border bg-background">
          <div className="grid grid-cols-[1fr_140px_180px_120px] gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-medium text-muted-foreground">
            <span>Fluxo</span>
            <span>Canal</span>
            <span>Contato</span>
            <span>Quando</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Carregando execuções…</div>
          ) : executions.length ? (
            <div className="divide-y">
              {executions.map((execution) => (
                <div key={execution.id} className="grid grid-cols-[1fr_140px_180px_120px] items-center gap-4 px-5 py-4">
                  <button
                    type="button"
                    onClick={() => navigate(botRoute(slug, execution.flow_id))}
                    className="flex min-w-0 items-center gap-3 text-left hover:underline"
                  >
                    <Activity className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate font-medium">{execution.flow_name}</span>
                  </button>
                  <span className="text-sm text-muted-foreground">{execution.channel_id}</span>
                  <span className="truncate text-sm text-muted-foreground" title={execution.contact_id}>
                    {execution.contact_id}
                  </span>
                  <span className="text-sm text-muted-foreground" title={new Date(execution.created_at).toLocaleString("pt-BR")}>
                    {relativeTime(execution.created_at)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 font-semibold">Nenhuma execução registrada</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                As execuções reais do runtime aparecerão aqui quando ocorrerem.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
