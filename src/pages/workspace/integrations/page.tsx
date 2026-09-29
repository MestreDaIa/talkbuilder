"use client";

import { Plug } from "lucide-react";

export default function WorkspaceIntegrationsPage() {
  return (
    <div className="min-h-full bg-[#F8F9FA] px-6 py-8 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Workspace</div>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Integrações</h1>
        <p className="mt-2 text-sm text-slate-500">
          Conecte serviços e sistemas externos aos seus fluxos de automação.
        </p>
        <div className="mt-8 rounded-xl border bg-white p-10 text-center">
          <Plug className="mx-auto h-9 w-9 text-slate-300" />
          <h2 className="mt-4 text-sm font-semibold text-slate-800">Central de integrações</h2>
          <p className="mt-1 text-xs text-slate-500">
            Esta área está preparada para receber as integrações disponíveis no workspace.
          </p>
        </div>
      </div>
    </div>
  );
}
