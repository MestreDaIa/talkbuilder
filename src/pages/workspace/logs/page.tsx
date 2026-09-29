"use client";

import { AlertTriangle, CheckCircle2, Clock3, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { getSupabase } from "../../../lib/supabaseClient";
import { botRoute } from "../../../lib/workspaceRoutes";

type RuntimeLog = {
  id: string;
  flow_id: string;
  node_id: string | null;
  level: string;
  category: string;
  provider: string | null;
  error_code: string | null;
  http_status: number | null;
  title: string;
  message: string;
  suggestion: string | null;
  created_at: string;
  resolved_at: string | null;
  flow_name?: string;
  workspace_item_id?: string | null;
};

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

const categoryLabel: Record<string, string> = {
  quota: "Quota / limite",
  credentials: "Credenciais",
  billing: "Faturamento",
  model: "Modelo",
  provider: "Provedor",
  connection: "Conexão",
};

export default function WorkspaceLogsPage() {
  const { currentWorkspace, profile } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<RuntimeLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const slug = currentWorkspace?.slug ?? profile?.slug;

  const loadLogs = async (silent = false) => {
    if (!currentWorkspace?.id) {
      setLogs([]);
      setLoading(false);
      return;
    }

    if (silent) setRefreshing(true);
    else setLoading(true);

    try {
      const supabase = getSupabase();
      const { data, error: queryError } = await supabase
        .from("flow_runtime_logs")
        .select("id,flow_id,node_id,level,category,provider,error_code,http_status,title,message,suggestion,created_at,resolved_at")
        .eq("workspace_id", currentWorkspace.id)
        .order("created_at", { ascending: false })
        .limit(100);

      if (queryError) throw queryError;

      const flowIds = [...new Set((data ?? []).map((log) => log.flow_id))];
      let flowNames = new Map<string, string>();

      if (flowIds.length) {
        const { data: flows, error: flowError } = await supabase
          .from("chatbot_flows")
          .select("id,name,workspace_item_id")
          .in("id", flowIds);
        if (flowError) throw flowError;
        flowNames = new Map((flows ?? []).map((flow) => [flow.id, flow.name]));
      }

      setLogs((data ?? []).map((log) => ({
        ...log,
        flow_name: flowNames.get(log.flow_id) ?? "Fluxo",
        workspace_item_id: (flows ?? []).find((flow) => flow.id === log.flow_id)?.workspace_item_id ?? null,
      })));
      setError(null);
    } catch (loadError) {
      console.error("[WorkspaceLogs] erro ao carregar logs:", loadError);
      setError("Não foi possível carregar os logs do workspace.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void loadLogs();
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!currentWorkspace?.id) return;

    const supabase = getSupabase();
    const channel = supabase
      .channel(`workspace-runtime-logs-${currentWorkspace.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "flow_runtime_logs",
          filter: `workspace_id=eq.${currentWorkspace.id}`,
        },
        async (payload) => {
          const incoming = payload.new as RuntimeLog;
          const { data: flow } = await supabase
            .from("chatbot_flows")
            .select("name,workspace_item_id")
            .eq("id", incoming.flow_id)
            .maybeSingle();

          setLogs((current) => [
            { ...incoming, flow_name: flow?.name ?? "Fluxo", workspace_item_id: flow?.workspace_item_id ?? null },
            ...current.filter((item) => item.id !== incoming.id),
          ].slice(0, 100));
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR") {
          console.warn("[WorkspaceLogs] Realtime indisponível; mantendo atualização manual.");
        }
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [currentWorkspace?.id]);

  const activeCount = useMemo(() => logs.filter((log) => !log.resolved_at).length, [logs]);

  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-medium text-primary">Monitoramento</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">Logs</h1>
            <p className="mt-2 text-muted-foreground">
              Erros das chamadas de IA que podem impedir seus fluxos de executar corretamente.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadLogs(true)}
            className="inline-flex items-center justify-center gap-2 rounded-lg border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Atualizar
          </button>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-background p-5">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div className="mt-4 text-2xl font-bold">{activeCount}</div>
            <div className="text-sm text-muted-foreground">Problemas registrados</div>
          </div>
          <div className="rounded-xl border bg-background p-5">
            <Clock3 className="h-5 w-5 text-muted-foreground" />
            <div className="mt-4 text-2xl font-bold">Tempo real</div>
            <div className="text-sm text-muted-foreground">Novos erros aparecem automaticamente</div>
          </div>
          <div className="rounded-xl border bg-background p-5">
            <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
            <div className="mt-4 text-2xl font-bold">Sem dados sensíveis</div>
            <div className="text-sm text-muted-foreground">Chaves e respostas brutas não são armazenadas</div>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-background">
          <div className="border-b px-5 py-4">
            <h2 className="font-semibold">Problemas recentes</h2>
            <p className="mt-1 text-sm text-muted-foreground">Até os últimos 100 registros deste workspace.</p>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Carregando logs…</div>
          ) : logs.length ? (
            <div className="divide-y">
              {logs.map((log) => (
                <div key={log.id} className="p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex min-w-0 gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <AlertTriangle className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{log.title}</h3>
                          {log.http_status && (
                            <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium">{log.http_status}</span>
                          )}
                          <span className="rounded-md bg-muted px-2 py-0.5 text-xs">
                            {categoryLabel[log.category] ?? log.category}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">{log.message}</p>
                        {log.suggestion && (
                          <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                            <span className="font-medium">Como corrigir:</span> {log.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="shrink-0 text-left text-xs text-muted-foreground md:text-right">
                      <div>{relativeTime(log.created_at)}</div>
                      <div className="mt-1">{log.provider || "IA"}{log.error_code ? ` · ${log.error_code}` : ""}</div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3 text-xs text-muted-foreground">
                    <span>Fluxo: {log.flow_name}</span>
                    {log.node_id && <span>Nó: {log.node_id}</span>}
                    <button
                      type="button"
                      disabled={!log.workspace_item_id}
                      onClick={() => log.workspace_item_id && navigate(botRoute(slug, log.workspace_item_id))}
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      Abrir fluxo <ExternalLink className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 font-semibold">Nenhum erro registrado</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Quando uma chamada de IA falhar, o diagnóstico aparecerá aqui automaticamente.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
