"use client";

import { Activity } from "lucide-react";

export default function WorkspaceExecutionsPage() {
  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Execuções</h1>
        <p className="mt-2 text-muted-foreground">Histórico das execuções dos seus fluxos.</p>
        <div className="mt-8 rounded-xl border bg-background p-10 text-center">
          <Activity className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">Nenhuma execução registrada</h2>
          <p className="mt-1 text-sm text-muted-foreground">O histórico de execuções será exibido aqui quando estiver disponível.</p>
        </div>
      </div>
    </div>
  );
}
