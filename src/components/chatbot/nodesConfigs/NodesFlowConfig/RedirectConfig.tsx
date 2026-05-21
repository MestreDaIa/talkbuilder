import { useEffect, useMemo, useState } from "react";
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
import { getSupabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";
import { useParams } from "react-router-dom";

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
  const params = useParams();

  const workspaceId = currentWorkspace?.id ?? null;
  const currentBotItemId = (params.id as string | undefined) ?? null;

  const targetFlow = config.targetFlow || "";

  useEffect(() => {
    let isMounted = true;
    
    async function fetchPublishedBots() {
      if (!workspaceId || !currentBotItemId) {
        if (isMounted) {
          setPublishedBots([]);
          setIsLoading(false);
        }
        return;
      }

      try {
        setIsLoading(true);

        const supabase = getSupabase();
        const [currentFlowResult, publishedResult] = await Promise.all([
          supabase
            .from("chatbot_flows")
            .select("id")
            .eq("workspace_id", workspaceId)
            .eq("workspace_item_id", currentBotItemId)
            .maybeSingle(),
          supabase
            .from("chatbot_flows")
            .select("id, name, workspace_item_id")
            .eq("workspace_id", workspaceId)
            .eq("is_published", true)
            .neq("workspace_item_id", currentBotItemId)
            .order("name", { ascending: true }),
        ]);

        if (currentFlowResult.error) throw currentFlowResult.error;
        if (publishedResult.error) throw publishedResult.error;

        if (!currentFlowResult.data) {
          setPublishedBots([]);
          return;
        }

        const bots = (publishedResult.data ?? [])
          .filter((bot: any) => bot.workspace_item_id !== currentBotItemId)
          .map((bot: any) => ({ id: bot.id, name: bot.name }));

        if (isMounted) setPublishedBots(bots);
      } catch (err) {
        console.error("[RedirectConfig] Error fetching bots:", err);
        if (isMounted) setPublishedBots([]);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    fetchPublishedBots();
    
    return () => { isMounted = false; };
  }, [workspaceId, currentBotItemId]);

  useEffect(() => {
    if (targetFlow && !isLoading && !publishedBots.some((bot) => bot.id === targetFlow)) {
      setConfig({ ...config, targetFlow: "" });
    }
  }, [targetFlow, isLoading, publishedBots, config, setConfig]);

  const botOptions = useMemo(() => publishedBots, [publishedBots]);

  const handleValueChange = (value: string) => {
    if (value !== targetFlow) {
      setConfig({ ...config, targetFlow: value });
    }
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
            {botOptions.length > 0 ? (
              botOptions.map((bot) => (
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
                    <p className="text-[10px] mt-1 opacity-70">Só aparecem outros bots publicados neste workspace.</p>
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
