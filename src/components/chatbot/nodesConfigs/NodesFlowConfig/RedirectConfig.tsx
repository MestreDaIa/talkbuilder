import { useState } from "react";
import { NodeConfig, Container } from "@/types/chatbot";
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
import { supabase } from "@/integrations/supabase/client";
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

export const RedirectConfig = ({ config, setConfig }: RedirectConfigProps) => {
  const [publishedBots, setPublishedBots] = useState<PublishedBot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadedWorkspaceId, setLoadedWorkspaceId] = useState<string | null>(null);
  const { currentWorkspace } = useAuth();

  const fetchPublishedBots = async () => {
    if (!currentWorkspace?.id || isLoading || loadedWorkspaceId === currentWorkspace.id) {
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from("chatbot_flows")
        .select("id, name")
        .eq("workspace_id", currentWorkspace.id)
        .eq("is_published", true)
        .order("name", { ascending: true });

      if (error) throw error;

      setPublishedBots((data || []).map((bot: any) => ({
        id: bot.id,
        name: bot.name
      })));
      setLoadedWorkspaceId(currentWorkspace.id);
    } catch (error) {
      console.error("Erro ao buscar bots publicados:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFlowChange = (value: string) => {
    // Atualiza a configuração diretamente sem usar useEffect para evitar loops
    setConfig({ 
      ...config, 
      targetFlow: value 
    });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Fluxo de Destino</Label>
        <Select 
          value={config.targetFlow || ""} 
          onValueChange={handleFlowChange} 
          disabled={isLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder={isLoading ? "Carregando fluxos..." : "Selecione um bot/fluxo"} />
          </SelectTrigger>
          <SelectContent>
            {publishedBots.length > 0 ? (
              publishedBots.map((bot) => (
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
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Direciona o fluxo atual para outro bot publicado.
        </p>
      </div>
      <SkillConfig config={config} setConfig={setConfig} />
    </div>
  );
};
