"use client";

import { Plug } from "lucide-react";

export default function WorkspaceIntegrationsPage() {
  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium text-primary">Workspace</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Integrações</h1>
        <p className="mt-2 text-muted-foreground">Conecte seus fluxos aos serviços que fazem parte da sua operação.</p>
        <div className="mt-8 rounded-xl border bg-background p-10 text-center">
          <Plug className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-4 font-semibold">Central de integrações</h2>
          <p className="mt-1 text-sm text-muted-foreground">A área para gerenciar conexões e integrações do workspace ficará disponível aqui.</p>
        </div>
      </div>
    </div>
  );
}
