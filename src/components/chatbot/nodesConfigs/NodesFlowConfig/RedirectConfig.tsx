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
  const [targetFlow, setTargetFlow] = useState(config.targetFlow || "");
  const [publishedBots, setPublishedBots] = useState<PublishedBot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { currentWorkspace } = useAuth();

  useEffect(() => {
    async function fetchPublishedBots() {
      if (!currentWorkspace?.id) {
        setIsLoading(false);
        return;
      }

      try {
        const { data, error } = await (supabase as any)
          .from("chatbot_flows")
          .select("id, name")
          .eq("is_published", true);

        if (error) throw error;

        if (data) {
          setPublishedBots(data.map((bot: any) => ({
            id: bot.id,
            name: bot.name
          })));
        }
      } catch (error) {
        console.error("Erro ao buscar bots publicados:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchPublishedBots();
  }, [currentWorkspace?.id]);

  useEffect(() => {
    setConfig({ ...config, targetFlow });
  }, [targetFlow]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Fluxo de Destino</Label>
        <Select value={targetFlow} onValueChange={setTargetFlow} disabled={isLoading}>
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
