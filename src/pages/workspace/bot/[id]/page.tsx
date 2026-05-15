import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Settings,
  Plus,
  Play,
  Eye,
  Save,
  Send,
  Check,
  Loader2,
} from "lucide-react";
import { CanvasEditor } from "@/components/chatbot/CanvasEditor";
import { NodesSidebar } from "@/components/chatbot/NodesSidebar";
import { TestPanel } from "@/components/chatbot/TestPanel";
import { BotSettingsDialog } from "@/components/chatbot/BotSettingsDialog";
import { PublishDialog } from "@/components/chatbot/PublishDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { VariablesProvider } from "@/context/VariablesContext";
import { folderRoute, hardReloadToRoute, rememberedBotBackRoute, workspaceRoot } from "@/lib/workspaceRoutes";
import {
  ensureFlow,
  saveDraft,
  updateFlowMeta,
  deriveStatus,
  type ChatbotFlowRow,
  type FlowStatus,
} from "@/lib/flowsApi";
import { getSupabase } from "@/lib/supabaseClient";
import type { Container, Edge, Node, NodeType } from "@/types/chatbot";
import { toast } from "sonner";

const STORAGE_PREFIX = "bot_flow_";

/** Cache local — fallback enquanto o flow não carrega ou Supabase está offline. */
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

function saveLocal(botId: string, data: { containers: Container[]; edges: Edge[] }) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${botId}`, JSON.stringify(data));
}

function statusLabel(status: FlowStatus): { text: string; className: string } {
  switch (status) {
    case "published":
      return { text: "PUBLICADO", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" };
    case "draft_changes":
      return { text: "RASCUNHO • PUBLICADO", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" };
    default:
      return { text: "RASCUNHO", className: "bg-muted text-muted-foreground border-border" };
  }
}

export default function BotPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const botId = (params.id as string) ?? "default";
  const { items, setItems } = useWorkspace();
  const { profile } = useAuth();

  const bot = useMemo(() => items.find((i) => i.id === botId && i.type === "bot"), [items, botId]);

  const [flow, setFlow] = useState<ChatbotFlowRow | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [getCenter, setGetCenter] = useState<(() => { x: number; y: number }) | null>(null);
  const [testContainer, setTestContainer] = useState<Container | null>(null);
  const lastSavedAtRef = useRef<number>(0);

  // Dark theme global enquanto edita
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!hadDark) root.classList.remove("dark");
    };
  }, []);

  // Carrega flow do Supabase + fallback local
  useEffect(() => {
    let cancelled = false;
    async function load() {
      // Sempre hidrata cache local primeiro pra não piscar tela vazia
      const local = loadLocal(botId);
      setContainers(local.containers);
      setEdges(local.edges);

      const supabase = getSupabase();
      if (!supabase || !bot) {
        setHydrated(true);
        return;
      }
      try {
        const row = await ensureFlow(botId, bot.title || "Novo bot");
        if (cancelled) return;
        setFlow(row);
        // Se o servidor tem dados mais recentes, prefere ele
        if (row.draft_containers?.length || row.draft_edges?.length) {
          setContainers(row.draft_containers);
          setEdges(row.draft_edges);
        }
      } catch (err) {
        console.error("Erro carregando flow:", err);
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [botId, bot]);

  // Persiste cache local em toda alteração
  useEffect(() => {
    if (!hydrated) return;
    saveLocal(botId, { containers, edges });
  }, [botId, containers, edges, hydrated]);

  const status: FlowStatus = useMemo(() => {
    if (!flow) return "draft";
    return deriveStatus(flow);
  }, [flow]);

  const handleAddBlock = () => {
    const position = getCenter
      ? getCenter()
      : { x: 200 + containers.length * 40, y: 160 + containers.length * 40 };
    const newContainer: Container = {
      id: `container-${Date.now()}`,
      nodes: [],
      position,
    };
    setContainers([...containers, newContainer]);
    toast.success("Bloco adicionado!");
  };

  const handleAddNode = (type: NodeType) => {
    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      config: {},
    };
    setContainers((prev) => {
      const basePosition = getCenter ? getCenter() : { x: 300, y: 200 };
      const offset = prev.length * 40;
      const position = { x: basePosition.x + offset, y: basePosition.y + offset };
      const newContainer: Container = {
        id: `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nodes: [newNode],
        position,
      };
      return [...prev, newContainer];
    });
    toast.success("Node adicionado!");
  };

  const handleSave = async () => {
    if (!flow) {
      // sem Supabase — só salva local
      saveLocal(botId, { containers, edges });
      toast.success("Fluxo salvo localmente");
      return;
    }
    setIsSaving(true);
    try {
      const updated = await saveDraft(flow.id, containers, edges);
      setFlow(updated);
      lastSavedAtRef.current = Date.now();
      toast.success("Fluxo salvo!");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao salvar: " + (err.message ?? "tente novamente"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    const first = containers[0];
    if (!first) {
      toast.error("Adicione pelo menos um bloco para testar");
      return;
    }
    setTestContainer(first);
  };

  const handlePreview = () => {
    navigate(`/preview/${botId}`);
  };

  const startNameEdit = () => {
    setNameDraft(flow?.name ?? bot?.title ?? "");
    setIsEditingName(true);
  };

  const commitName = async () => {
    const newName = nameDraft.trim();
    setIsEditingName(false);
    if (!newName || newName === (flow?.name ?? bot?.title)) return;

    // setItems já propaga title pro Supabase via WorkspaceContext
    setItems((prev) => prev.map((it) => (it.id === botId ? { ...it, title: newName } : it)));

    if (flow) {
      try {
        const updated = await updateFlowMeta(flow.id, { name: newName });
        setFlow(updated);
      } catch (err: any) {
        console.error(err);
        toast.error("Não consegui sincronizar nome do flow: " + (err.message ?? "erro"));
      }
    }
  };

  const handleSettingsUpdate = (newSettings: Record<string, any>) => {
    if (flow) setFlow({ ...flow, settings: newSettings });
  };

  const handlePublishSuccess = (publicId: string, isPublished: boolean) => {
    if (!flow) return;
    setFlow({
      ...flow,
      public_id: publicId || null,
      is_published: isPublished,
      is_active: isPublished,
      published_at: isPublished ? new Date().toISOString() : flow.published_at,
      published_containers: isPublished ? containers : flow.published_containers,
      published_edges: isPublished ? edges : flow.published_edges,
    });
  };

  const lbl = statusLabel(status);
  const displayName = flow?.name ?? bot?.title ?? `Bot: ${botId}`;
  const slug = (params.slug as string | undefined) ?? profile?.slug;

  const handleBack = async () => {
    // 1) Persiste rascunho pendente antes de sair.
    try {
      saveLocal(botId, { containers, edges });
      if (flow) {
        void saveDraft(flow.id, containers, edges).catch((err) =>
          console.warn("[BotPage] saveDraft on back failed:", err),
        );
      }
    } catch (err) {
      console.warn("[BotPage] flush on back failed:", err);
    }

    // 2) Determina o destino (pasta pai ou workspace main).
    const parentId = bot?.parentId;
    const remembered = rememberedBotBackRoute(botId);
    
    // Prioridade: Rota lembrada > Pasta Pai > Workspace Root
    let target = remembered;
    if (!target) {
      if (parentId) {
        target = folderRoute(slug, parentId);
      } else {
        target = workspaceRoot(slug);
      }
    }

    console.log("[BotPage] Back clicked. Target:", target, "Remembered:", remembered, "ParentId:", parentId);

    // 3) Troca a rota e recarrega a SPA. Só mudar o hash/URL não estava desmontando
    // o overlay fixed do editor no site publicado.
    if (typeof window !== "undefined") {
      hardReloadToRoute(target);
    } else {
      navigate(target);
    }
  };

  // Defesa extra: se a URL já saiu da rota do bot, o editor não pode continuar
  // montado na tela, mesmo se algum render atrasado reaproveitar este componente.
  if (!/\/workspace\/bot\/[^/]+\/?$/.test(location.pathname)) {
    return null;
  }

  return (
    <VariablesProvider>
      <div className="bot-editor fixed inset-0 flex flex-col bg-background z-50 text-foreground">
        {/* Header */}
        <header className="flex items-center gap-2 px-3 py-2 bg-card border-b border-border text-foreground shadow-sm">
          <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1" title="Voltar">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Button>

          <div className="h-6 w-px bg-border mx-1" />

          <div className="flex items-center gap-2 mr-2 min-w-0">
            {bot?.emoji && <span className="text-base shrink-0">{bot.emoji}</span>}

            {isEditingName ? (
              <Input
                autoFocus
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") setIsEditingName(false);
                }}
                className="h-7 text-sm font-semibold w-[200px]"
              />
            ) : (
              <button
                type="button"
                onClick={startNameEdit}
                className="text-sm font-semibold truncate max-w-[180px] hover:underline underline-offset-4 decoration-dotted decoration-muted-foreground"
                title="Clique para renomear"
              >
                {displayName}
              </button>
            )}

            <span
              className={`text-[10px] uppercase tracking-wide rounded px-2 py-0.5 border whitespace-nowrap ${lbl.className}`}
            >
              {lbl.text}
            </span>
          </div>

          <div className="flex-1" />

          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Configurações</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleAddBlock}>
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Bloco</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleTest}>
            <Play className="w-4 h-4" /> <span className="hidden sm:inline">Testar</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handlePreview}>
            <Eye className="w-4 h-4" /> <span className="hidden sm:inline">Visualizar</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Salvar</span>
          </Button>

          <Button size="sm" className="gap-1 ml-1" onClick={() => setShowPublish(true)}>
            {status === "published" ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">{status === "draft" ? "Publicar" : "Atualizar"}</span>
          </Button>
        </header>

        {/* Sidebar + canvas */}
        <div className="flex-1 flex w-full overflow-hidden">
          <NodesSidebar onAddNode={handleAddNode} />
          <div className="flex-1 h-full">
            <CanvasEditor
              containers={containers}
              onContainersChange={setContainers}
              edges={edges}
              onEdgesChange={setEdges}
              onTest={(container) => setTestContainer(container)}
              onGetCenterPosition={(getter) => setGetCenter(() => getter)}
            />
          </div>
        </div>

        {/* Test panel */}
        <TestPanel
          isOpen={testContainer !== null}
          onClose={() => setTestContainer(null)}
          startContainer={testContainer}
          allContainers={containers}
          edges={edges}
          flowId={flow?.id}
        />

        {/* Settings */}
        {flow && (
          <BotSettingsDialog
            open={showSettings}
            onOpenChange={setShowSettings}
            flowId={flow.id}
            flowName={flow.name}
            flowDescription={flow.description}
            settings={flow.settings ?? {}}
            onUpdate={handleSettingsUpdate}
          />
        )}

        {/* Publish */}
        {flow && (
          <PublishDialog
            open={showPublish}
            onOpenChange={setShowPublish}
            flowId={flow.id}
            currentPublicId={flow.public_id}
            isPublished={flow.is_published}
            companyId={flow.user_id}
            companySlug={profile?.slug ?? "user"}
            containers={containers}
            edges={edges}
            onPublishSuccess={handlePublishSuccess}
          />
        )}
      </div>
    </VariablesProvider>
  );
}
