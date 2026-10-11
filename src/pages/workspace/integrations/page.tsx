import { KeyRound, Plug } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import FlowApiKeys from "../configs/tabsListUI/FlowApiKeys";
import KeysApi from "../configs/tabsListUI/KeysApi";
import IntegrationsSettings from "../configs/tabsListUI/IntegrationsSettings";

export default function WorkspaceIntegrationsPage() {
  return (
    <div className="min-h-full bg-muted/20 p-6 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header>
          <p className="text-sm font-medium text-primary">Workspace</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Integrações</h1>
          <p className="mt-2 text-muted-foreground">Gerencie conexões, instâncias e chaves de API do seu workspace.</p>
        </header>

        <Tabs defaultValue="connections" className="w-full">
          <TabsList className="flex h-auto w-fit flex-wrap gap-1">
            <TabsTrigger value="connections" className="gap-2"><Plug className="h-4 w-4" />Conexões</TabsTrigger>
            <TabsTrigger value="api-keys" className="gap-2"><KeyRound className="h-4 w-4" />Chaves API</TabsTrigger>
          </TabsList>
          <TabsContent value="connections" className="mt-6">
            <IntegrationsSettings />
          </TabsContent>
          <TabsContent value="api-keys" className="mt-6 space-y-6">
            <FlowApiKeys />
            <KeysApi />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
