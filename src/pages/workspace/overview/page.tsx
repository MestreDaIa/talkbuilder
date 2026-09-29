"use client";

import { Activity, ArrowRight, Boxes, CheckCircle2, Plug, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useWorkspace } from "../../../context/WorkspaceContext";
import { botRoute, workspaceRoot } from "../../../lib/workspaceRoutes";

export default function WorkspaceOverviewPage() {
  const { currentWorkspace, profile } = useAuth();
  const { items, loading } = useWorkspace();
  const navigate = useNavigate();

  const slug = currentWorkspace?.slug ?? profile?.slug;
  const root = workspaceRoot(slug);
  const flows = items.filter((item) => item.type === "bot");
  const folders = items.filter((item) => item.type === "folder");

  return (
    <div className="min-h-full bg-[#F8F9FA] px-6 py-8 md:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <section>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            Command Center
          </div>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Visão geral
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Um panorama da sua operação de automação, sem limitar o workspace a um único tipo de negócio.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate(root)}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" />
              Abrir fluxos
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Metric icon={Boxes} label="Fluxos" value={loading ? "..." : String(flows.length)} />
          <Metric icon={Activity} label="Execuções" value="—" />
          <Metric icon={CheckCircle2} label="Taxa de sucesso" value="—" />
          <Metric icon={Plug} label="Integrações" value="—" />
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold text-slate-900">Fluxos recentes</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Os fluxos que já existem neste workspace.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate(root)}
                className="text-xs font-medium text-slate-600 hover:text-slate-900"
              >
                Ver todos
              </button>
            </div>

            <div className="mt-5 divide-y">
              {flows.slice(0, 6).map((flow) => (
                <button
                  key={flow.id}
                  type="button"
                  onClick={() => navigate(botRoute(slug, flow.id))}
                  className="flex w-full items-center gap-3 py-3 text-left hover:bg-slate-50"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-lg">
                    {flow.emoji || "🤖"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-800">
                      {flow.title}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {flow.description || "Sem descrição"}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                </button>
              ))}

              {!loading && flows.length === 0 && (
                <div className="py-10 text-center">
                  <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-medium text-slate-700">
                    Nenhum fluxo criado ainda
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Crie seu primeiro fluxo para começar a automatizar.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate(root)}
                    className="mt-4 text-xs font-semibold text-slate-800 underline underline-offset-4"
                  >
                    Ir para Fluxos
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-white p-5">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900">Atividade</h2>
            </div>
            <div className="mt-5 rounded-lg border border-dashed p-6 text-center">
              <p className="text-sm font-medium text-slate-700">
                Nenhuma execução registrada ainda.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Quando os fluxos começarem a executar, o histórico aparecerá aqui.
              </p>
            </div>
            <div className="mt-6 text-xs text-slate-400">
              {folders.length} {folders.length === 1 ? "pasta" : "pastas"} no workspace
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</span>
        <Icon className="h-4 w-4 text-slate-400" />
      </div>
      <div className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</div>
    </div>
  );
}
