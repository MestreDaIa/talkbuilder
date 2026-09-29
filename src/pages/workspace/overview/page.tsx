"use client";

import { Activity, ArrowRight, Boxes, Plug, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useWorkspace } from "../../../context/WorkspaceContext";
import { botRoute, workspaceRoot } from "../../../lib/workspaceRoutes";

export default function WorkspaceOverviewPage() {
  const { profile, currentWorkspace } = useAuth();
  const { items, loading } = useWorkspace();
  const navigate = useNavigate();
  const slug = currentWorkspace?.slug ?? profile?.slug;
  const flows = items.filter((item) => item.type === "bot");

  const stats = [
    { label: "Fluxos", value: loading ? "…" : String(flows.length), icon: Boxes },
    { label: "Execuções", value: "—", icon: Activity },
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

          <div className="rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Atividade recente</h2>
            <p className="mt-1 text-sm text-muted-foreground">Execuções e eventos aparecerão aqui quando o histórico estiver disponível.</p>
            <div className="mt-6 rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma execução registrada ainda.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
