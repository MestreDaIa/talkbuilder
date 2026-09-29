"use client";

import { Activity } from "lucide-react";

export default function WorkspaceExecutionsPage() {
  return (
    <div className="min-h-full bg-[#F8F9FA] px-6 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Execuções</h1>
        <p className="mt-2 text-sm text-slate-500">
          Histórico e diagnóstico das execuções dos seus fluxos.
        </p>
        <div className="mt-8 rounded-xl border bg-white p-10 text-center">
          <Activity className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-4 text-sm font-semibold text-slate-800">Nenhuma execução registrada</h2>
          <p className="mt-1 text-xs text-slate-500">
            O histórico real de execuções será exibido aqui quando essa camada estiver conectada ao runtime.
          </p>
        </div>
      </div>
    </div>
  );
}
