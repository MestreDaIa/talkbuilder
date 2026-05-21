import { useState, useEffect } from "react";
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
  const [isLoading, setIsLoading] = useState(true);
  const { currentWorkspace } = useAuth();

  const targetFlow = config.targetFlow || "";

  useEffect(() => {
    async function fetchPublishedBots() {
      const { data: { user } } = await supabase.auth.getUser();
      const workspaceId = currentWorkspace?.id || localStorage.getItem("currentWorkspaceId");
      
      console.log("[RedirectConfig] Buscando bots. User:", user?.id, "WorkspaceId:", workspaceId);

      
      try {
        setIsLoading(true);
        // Usamos chatbot_flows que é onde ficam as definições dos bots/fluxos
        // Usamos cast para any pois os tipos do Supabase podem estar desatualizados
        let query = (supabase as any).from("chatbot_flows").select("id, name, workspace_id, is_published");

        
        if (workspaceId) {
          query = query.eq("workspace_id", workspaceId);
        }
        
        const { data, error } = await query.eq("is_published", true);

        if (error) {
          console.error("[RedirectConfig] Erro na query:", error);
          throw error;
        }

        if (data) {
          console.log("[RedirectConfig] Bots encontrados:", data);
          setPublishedBots(data.map((bot: any) => ({
            id: bot.id,
            name: bot.name
          })));
        }
      } catch (error) {
        console.error("[RedirectConfig] Erro ao buscar bots:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPublishedBots();
  }, [currentWorkspace?.id]);

  const handleValueChange = (value: string) => {
    console.log("[RedirectConfig] Alterando targetFlow para:", value);
    setConfig({ ...config, targetFlow: value });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Fluxo de Destino</Label>
        <Select value={targetFlow} onValueChange={handleValueChange} disabled={isLoading}>
          <SelectTrigger className="w-full">
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
              <div className="p-4 text-center">
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">
                    Nenhum bot publicado encontrado
                    <p className="text-[10px] mt-1 opacity-70">Verifique se os bots estão publicados no workspace atual.</p>
                  </div>
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
