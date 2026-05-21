import { useState, useEffect } from "react";
import { NodeConfig, Container, Node } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info, Loader2 } from "lucide-react";
import { SkillConfig } from "../SkillConfig";
import { getSupabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface RedirectConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
  containers: Container[];
}

interface PublishedBot {
  id: string;
  name: string;
}

// Module-level caches: persistem entre aberturas do diálogo de configuração
const botsCache = new Map<string, PublishedBot[]>();
const containersCache = new Map<string, Container[]>();
const inflight = new Map<string, Promise<any>>();

export const RedirectConfig = ({ config, setConfig }: RedirectConfigProps) => {
  const { currentWorkspace } = useAuth();
  const wsId = currentWorkspace?.id;

  const [publishedBots, setPublishedBots] = useState<PublishedBot[]>(
    () => (wsId && botsCache.get(wsId)) || []
  );
  const [targetFlowContainers, setTargetFlowContainers] = useState<Container[]>(
    () => (config.targetFlow && containersCache.get(config.targetFlow)) || []
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingNodes, setIsLoadingNodes] = useState(false);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(
    wsId && botsCache.has(wsId) ? wsId : null
  );

  const selectedBotFallback = config.targetFlow
    ? [{ id: config.targetFlow, name: config.targetFlowName || config.targetFlow }]
    : [];

  const botOptions = publishedBots.some((bot) => bot.id === config.targetFlow)
    ? publishedBots
    : [...selectedBotFallback, ...publishedBots];

  const fetchPublishedBots = async () => {
    if (!currentWorkspace?.id || isLoading || loadedWorkspaceId === currentWorkspace.id) {
      return;
    }

    setIsLoading(true);

    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_published", true)
        .order("name", { ascending: true });

      if (error) throw error;

      const bots = (data || []).map((bot: any) => ({
        id: bot.id,
        name: bot.name,
      }));
      setPublishedBots(bots);
      setLoadedWorkspaceId(currentWorkspace.id);

      // Sincroniza nome do bot já selecionado (sem useEffect) para corrigir
      // configurações antigas que só guardaram o ID.
      if (config.targetFlow) {
        const match = bots.find((b) => b.id === config.targetFlow);
        if (match && match.name !== config.targetFlowName) {
          setConfig({ ...config, targetFlowName: match.name });
        }
      }
    } catch (error) {
      console.error("Erro ao buscar bots publicados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFlowNodes = async (flowId: string) => {
    if (!flowId) return;
    setIsLoadingNodes(true);
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("published_containers, draft_containers")
        .eq("id", flowId)
        .maybeSingle();

      if (error) throw error;
      if (data) {
        const containers = data.published_containers || data.draft_containers || [];
        const allNodes: Node[] = [];
        containers.forEach((c: any) => {
          if (c.nodes) {
            c.nodes.forEach((n: any) => {
              allNodes.push(n);
            });
          }
        });
        setTargetFlowNodes(allNodes);
      }
    } catch (error) {
      console.error("Erro ao buscar nodes do fluxo:", error);
    } finally {
      setIsLoadingNodes(false);
    }
  };

  useEffect(() => {
    if (config.targetFlow) {
      fetchFlowNodes(config.targetFlow);
    }
  }, [config.targetFlow]);

  const handleFlowChange = (value: string) => {
    const selectedBot = botOptions.find((bot) => bot.id === value);

    setConfig({ 
      ...config, 
      targetFlow: value,
      targetFlowName: selectedBot?.name || value,
      startNodeId: undefined, // Reset start node when flow changes
    });
  };

  const handleStartNodeChange = (value: string) => {
    setConfig({
      ...config,
      startNodeId: value === "default" ? undefined : value
    });
  };

  const getNodeLabel = (node: Node) => {
    const type = node.type || "node";
    const label = node.config?.label || node.config?.message || node.config?.text || node.id;
    return `[${type}] ${String(label).length > 30 ? String(label).substring(0, 30) + "..." : String(label)}`;
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Fluxo de Destino</Label>
        <Select 
          value={config.targetFlow || ""} 
          onValueChange={handleFlowChange} 
          onOpenChange={(open) => {
            if (open) fetchPublishedBots();
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Carregando fluxos..." : "Selecione um bot/fluxo"} />
          </SelectTrigger>
          <SelectContent>
            {botOptions.length > 0 ? (
              botOptions.map((bot) => (
                <SelectItem key={bot.id} value={bot.id}>
                  {bot.name}
                </SelectItem>
              ))
            ) : (
              <div className="p-2 text-xs text-muted-foreground text-center">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  "Nenhum bot publicado encontrado"
                )}
              </div>
            )}
          </SelectContent>
        </Select>
      </div>

      {config.targetFlow && (
        <div className="space-y-2">
          <Label>Iniciar a partir do Nó (Opcional)</Label>
          <Select 
            value={config.startNodeId || "default"} 
            onValueChange={handleStartNodeChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingNodes ? "Carregando nós..." : "Início padrão"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Início padrão (Nó Start)</SelectItem>
              {targetFlowNodes.map((node) => (
                <SelectItem key={node.id} value={node.id}>
                  {getNodeLabel(node)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se não selecionado, o fluxo iniciará normalmente pelo nó de "Start".
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Direciona o fluxo atual para outro bot publicado.
        </p>
      </div>
      
      <SkillConfig config={config} setConfig={setConfig} />
    </div>
  );
};
