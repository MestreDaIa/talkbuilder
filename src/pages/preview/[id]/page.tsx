import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { TestPanel } from "@/components/chatbot/TestPanel";
import { VariablesProvider } from "@/context/VariablesContext";
import { Button } from "@/components/ui/button";
import { ensureFlow, getFlowByWorkspaceItem, type ChatbotFlowRow } from "@/lib/flowsApi";
import { getSupabase } from "@/lib/supabaseClient";
import type { Container, Edge } from "@/types/chatbot";

type BotMeta = { id: string; title: string; emoji: string | null };

const STORAGE_PREFIX = "bot_flow_";

function loadLocal(botId: string): { containers: Container[]; edges: Edge[] } {
  if (typeof window === "undefined") return { containers: [], edges: [] };
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${botId}`);
    if (!raw) return { containers: [], edges: [] };
    const parsed = JSON.parse(raw);
    return { containers: parsed.containers ?? [], edges: parsed.edges ?? [] };
  } catch {
    return { containers: [], edges: [] };
  }
}

/**
 * Pré-visualização do RASCUNHO atual do bot (rota privada).
 * Usa exatamente o mesmo motor de execução do botão "Testar", em tela cheia.
 */
export default function PreviewPage() {
  const params = useParams();
  const navigate = useNavigate();
  const botId = (params.id as string) ?? "";
  const [bot, setBot] = useState<BotMeta | null>(null);

  const [flow, setFlow] = useState<ChatbotFlowRow | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      // 1) localStorage como fallback rápido
      const local = loadLocal(botId);
      setContainers(local.containers);
      setEdges(local.edges);

      const supabase = getSupabase();
      if (!supabase) {
        setLoading(false);
        return;
      }
      try {
        const row = bot
          ? await ensureFlow(botId, bot.title || "Bot")
          : await getFlowByWorkspaceItem(botId);
        if (cancelled || !row) {
          setLoading(false);
          return;
        }
        setFlow(row);
        if (row.draft_containers?.length) setContainers(row.draft_containers);
        if (row.draft_edges?.length) setEdges(row.draft_edges);
      } catch (err) {
        console.error("Erro carregando preview:", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [botId, bot]);

  const startContainer = containers[0] ?? null;
  const theme = (flow?.settings as any)?.theme ?? {};
  const primaryColor = theme.primaryColor as string | undefined;

  return (
    <VariablesProvider>
      <div
        className="fixed inset-0 z-50 flex flex-col bg-background text-foreground"
        style={primaryColor ? ({ ["--preview-primary" as any]: primaryColor } as React.CSSProperties) : undefined}
      >
        <header className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>
          <div className="h-6 w-px bg-border mx-1" />
          <div className="flex items-center gap-2">
            {bot?.emoji && <span>{bot.emoji}</span>}
            <span className="text-sm font-semibold truncate">
              {flow?.name ?? bot?.title ?? "Pré-visualização"}
            </span>
            <span className="text-[10px] uppercase rounded px-2 py-0.5 border border-amber-500/30 bg-amber-500/15 text-amber-400">
              Rascunho
            </span>
          </div>
        </header>

        <div className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando bot…
            </div>
          ) : !startContainer ? (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
              Este bot ainda não tem nenhum bloco para executar.
            </div>
          ) : (
            // TestPanel é um overlay; com isOpen=true ele ocupa tela cheia.
            <TestPanel
              isOpen={true}
              onClose={() => navigate(-1)}
              startContainer={startContainer}
              allContainers={containers}
              edges={edges}
            />
          )}
        </div>
      </div>
    </VariablesProvider>
  );
}
