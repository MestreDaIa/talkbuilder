import { useState, useEffect, useMemo } from "react";
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
    let isMounted = true;
    const workspaceId = currentWorkspace?.id || localStorage.getItem("currentWorkspaceId");
    
    async function fetchPublishedBots() {
      if (!isMounted) return;
      
      console.log("[RedirectConfig] Fetching bots for WorkspaceId:", workspaceId);

      try {
        setIsLoading(true);
        // We use chatbot_flows which is the actual table name found in code
        let query = supabase
          .from("chatbot_flows")
          .select("id, name, workspace_id, is_published")
          .eq("is_published", true);
        
        if (workspaceId) {
          query = query.eq("workspace_id", workspaceId);
        }
        
        const { data, error } = await query;

        if (error) {
          console.error("[RedirectConfig] Supabase error:", error);
          throw error;
        }

        if (isMounted) {
          if (data && data.length > 0) {
            console.log("[RedirectConfig] Bots found:", data);
            setPublishedBots(data.map((bot: any) => ({ id: bot.id, name: bot.name })));
          } else {
            console.log("[RedirectConfig] No bots found for workspace. Trying fallback search...");
            const { data: fallbackData, error: fallbackError } = await supabase
              .from("chatbot_flows")
              .select("id, name, workspace_id, is_published")
              .eq("is_published", true)
              .limit(20);
            
            if (fallbackError) console.error("[RedirectConfig] Fallback error:", fallbackError);
            console.log("[RedirectConfig] Fallback search result (all published):", fallbackData);
            
            if (fallbackData && fallbackData.length > 0) {
              setPublishedBots(fallbackData.map((bot: any) => ({ id: bot.id, name: bot.name })));
            } else {
              setPublishedBots([]);
            }
          }
        }
      } catch (err) {
        console.error("[RedirectConfig] Error fetching bots:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    if (open) { // Assuming we might want to check if the dialog is open, but this component is usually rendered when open
       fetchPublishedBots();
    }
    
    return () => { isMounted = false; };
  }, [currentWorkspace?.id]);

  const handleValueChange = (value: string) => {
    if (value !== targetFlow) {
      console.log("[RedirectConfig] Updating targetFlow:", value);
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
