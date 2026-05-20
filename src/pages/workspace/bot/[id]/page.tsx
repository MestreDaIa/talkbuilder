import { useEffect, useMemo, useRef, useState, useCallback, useContext } from "react";
import { useVariables, VariablesProvider } from "@/context/VariablesContext";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Settings,
  Plus,
  Play,
  Save,
  Send,
  Check,
  Loader2,
  Undo2,
  Redo2,
} from "lucide-react";
import { CanvasEditor } from "@/components/chatbot/CanvasEditor";
import { NodesSidebar } from "@/components/chatbot/NodesSidebar";
import { TestPanel } from "@/components/chatbot/TestPanel";
// ChatWidget removed
import { BotSettingsDialog } from "@/components/chatbot/BotSettingsDialog";
import { PublishDialog } from "@/components/chatbot/PublishDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
// VariablesProvider removed from here to be imported from @/context/VariablesContext
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

function BotEditorInner({
  botId,
  bot,
  flow,
  setFlow,
  containers,
  setContainers,
  edges,
  setEdges,
  status,
  profile,
  isSaving,
  setIsSaving,
  handleBack,
  showSettings,
  setShowSettings,
  handleSettingsUpdate,
  handleTest,
  testContainer,
  setTestContainer,
  handleUndo,
  handleRedo,
  historyIndex,
  history,
  showPublish,
  setShowPublish,
  handlePublishSuccess,
  isEditingName,
  setIsEditingName,
  nameDraft,
  setNameDraft,
  commitName,
  startNameEdit,
  displayName,
  lbl,
  handleAddNode,
  setGetCenter,
  botVariables
}: any) {
  const { variables } = useVariables();
  const lastVariablesRef = useRef(variables);

  // Sincroniza variáveis do contexto para o estado do BotPage quando mudam
  useEffect(() => {
    if (JSON.stringify(variables) !== JSON.stringify(lastVariablesRef.current)) {
      lastVariablesRef.current = variables;
      // Adicionamos um pequeno delay ou verificação para evitar loops se necessário,
      // mas aqui deve estar ok pois o BotPage apenas guarda para o saveDraft
    }
  }, [variables]);

  // Função de salvar que inclui variáveis
  const handleSaveWithVariables = async () => {
    if (!flow) {
      saveLocal(botId, { containers, edges });
      toast.success("Fluxo salvo localmente (aguardando conexão)");
      return;
    }
    
    setIsSaving(true);
    try {
      const containersToSave = JSON.parse(JSON.stringify(containers));
      const edgesToSave = JSON.parse(JSON.stringify(edges));
      
      // Incluímos as variáveis atuais no settings
      const updatedSettings = {
        ...(flow.settings || {}),
        variables: variables
      };

      console.log("[BotPage] Salvando rascunho com variáveis...", {
        variablesCount: Object.keys(variables).length
      });

      const updated = await saveDraft(flow.id, containersToSave, edgesToSave);
      
      // Atualizamos também o settings via updateFlowMeta para garantir que as variáveis persistam
      const finalUpdated = await updateFlowMeta(flow.id, { settings: updatedSettings });
      
      setFlow(finalUpdated);
      toast.success("Fluxo e variáveis salvos com sucesso!");
    } catch (err: any) {
      console.error("[BotPage] Erro ao salvar:", err);
      toast.error("Erro ao salvar no servidor");
    } finally {
      setIsSaving(false);
    }
  };

  return (
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

          <div className="flex-1 flex items-center justify-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleUndo} 
              disabled={historyIndex <= 0}
              title="Desfazer (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8" 
              onClick={handleRedo} 
              disabled={historyIndex >= history.length - 1}
              title="Refazer (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setShowSettings(true)}>
            <Settings className="w-4 h-4" /> <span className="hidden sm:inline">Configurações</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleTest}>
            <Play className="w-4 h-4" /> <span className="hidden sm:inline">Testar</span>
          </Button>
          <Button variant="ghost" size="sm" className="gap-1" onClick={handleSaveWithVariables} disabled={isSaving}>
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span className="hidden sm:inline">Salvar</span>
          </Button>

          <Button size="sm" className="gap-1 ml-1" onClick={() => setShowPublish(true)}>
            {status === "published" ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            <span className="hidden sm:inline">{status === "draft" ? "Publicar" : "Atualizar"}</span>
          </Button>
        </header>

        {/* Sidebar + canvas */}
        <div className="flex-1 flex w-full overflow-hidden relative">
          <NodesSidebar onAddNode={handleAddNode} />
          <div className="flex-1 h-full">
            <CanvasEditor
              containers={containers}
              onContainersChange={setContainers}
              edges={edges}
              onEdgesChange={setEdges}
              onTest={(container: any) => setTestContainer(container)}
              onGetCenterPosition={(getter: any) => setGetCenter(() => getter)}
            />
          </div>

          {/* Test panel */}
          <TestPanel
            isOpen={testContainer !== null}
            onClose={() => setTestContainer(null)}
            startContainer={testContainer}
            allContainers={containers}
            edges={edges}
            flowId={flow?.id}
            settings={flow?.settings}
          />
        </div>

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
  );
}

export default function BotPage() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const botId = (params.id as string) ?? "default";
  const { items, setItems } = useWorkspace();
  const { profile, currentWorkspace } = useAuth();

  const bot = useMemo(() => items.find((i) => i.id === botId && i.type === "bot"), [items, botId]);

  const [flow, setFlow] = useState<ChatbotFlowRow | null>(null);
  const [containers, setContainers] = useState<Container[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [botVariables, setBotVariables] = useState<Record<string, any>>({});
  const [hydrated, setHydrated] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [getCenter, setGetCenter] = useState<(() => { x: number; y: number }) | null>(null);
  const [testContainer, setTestContainer] = useState<Container | null>(null);
  
  // Undo/Redo history
  const [history, setHistory] = useState<{ containers: Container[]; edges: Edge[] }[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const isInternalChangeRef = useRef(false);

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
      // Esperamos o currentWorkspace.id estar presente para garantir que o flow 
      // seja criado/carregado com o workspace_id correto para permissões RLS.
      if (!supabase || !bot || !currentWorkspace?.id) {
        if (!currentWorkspace?.id && bot) {
           console.log("[BotPage] Aguardando currentWorkspace.id...");
        }
        setHydrated(true);
        return;
      }

      try {
        console.log("[BotPage] Carregando flow para bot:", botId, "Workspace:", currentWorkspace.id);
        const row = await ensureFlow(botId, bot.title || "Novo bot", currentWorkspace.id);
        if (cancelled) return;
        setFlow(row);
        
        // Carrega as variáveis se existirem no settings
        if (row.settings?.variables) {
          setBotVariables(row.settings.variables);
        }

        // Se o servidor tem dados, e eles parecem ser mais novos ou o local está vazio, prefere o servidor
        const hasServerData = row.draft_containers?.length || row.draft_edges?.length;
        if (hasServerData) {
          setContainers(row.draft_containers || []);
          setEdges(row.draft_edges || []);
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
  }, [botId, bot, currentWorkspace?.id]); // Adicionado currentWorkspace?.id como dependência

  // Persiste cache local em toda alteração e gerencia histórico
  useEffect(() => {
    if (!hydrated) return;
    saveLocal(botId, { containers, edges });

    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false;
      return;
    }

    const currentState = { 
      containers: JSON.parse(JSON.stringify(containers)), 
      edges: JSON.parse(JSON.stringify(edges)) 
    };
    
    // Adiciona ao histórico apenas se for diferente do último estado
    setHistory(prev => {
      const lastState = prev[historyIndex];
      
      // Se já temos um estado no índice atual e é igual ao novo, não faz nada
      // Comparamos stringify para detectar mudanças profundas em nodes/config/posição
      if (lastState && JSON.stringify(lastState) === JSON.stringify(currentState)) {
        return prev;
      }

      // Ao fazer uma nova alteração, o refazer deve ser limpo a partir deste ponto
      const newHistory = prev.slice(0, historyIndex + 1);
      newHistory.push(currentState);
      
      // Mantemos um limite de 50 para não sobrecarregar
      if (newHistory.length > 50) {
        const sliced = newHistory.slice(-50);
        setHistoryIndex(sliced.length - 1);
        return sliced;
      }
      
      setHistoryIndex(newHistory.length - 1);
      return newHistory;
    });
  }, [botId, containers, edges, hydrated]); // Removido historyIndex da dependência para evitar loops

  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const prevState = history[prevIndex];
      isInternalChangeRef.current = true;
      setContainers(JSON.parse(JSON.stringify(prevState.containers)));
      setEdges(JSON.parse(JSON.stringify(prevState.edges)));
      setHistoryIndex(prevIndex);
      toast.info("Desfeito");
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const nextState = history[nextIndex];
      isInternalChangeRef.current = true;
      setContainers(JSON.parse(JSON.stringify(nextState.containers)));
      setEdges(JSON.parse(JSON.stringify(nextState.edges)));
      setHistoryIndex(nextIndex);
      toast.info("Refeito");
    }
  }, [history, historyIndex]);

  // Atalhos de teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        e.preventDefault();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        handleRedo();
        e.preventDefault();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo]);

  const status: FlowStatus = useMemo(() => {
    if (!flow) return "draft";
    return deriveStatus(flow);
  }, [flow]);

  // Centraliza um novo bloco no centro do viewport atual do canvas.
  const getCenteredPosition = () => {
    const base = getCenter ? getCenter() : { x: 300, y: 200 };
    
    // Tenta obter as dimensões reais do container se houver algum no DOM, 
    // caso contrário usa valores padrão baseados no CSS (max-w-[305px])
    const containerElement = document.querySelector('.react-flow__node-container');
    const rect = containerElement?.getBoundingClientRect();
    
    const width = rect?.width || 305;
    const height = rect?.height || 150;

    return { 
      x: base.x - (width / 2), 
      y: base.y - (height / 2) 
    };
  };

  const handleAddBlock = () => {
    const newContainer: Container = {
      id: `container-${Date.now()}`,
      nodes: [],
      position: getCenteredPosition(),
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
      const newContainer: Container = {
        id: `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        nodes: [newNode],
        position: getCenteredPosition(),
      };
      return [...prev, newContainer];
    });
    toast.success("Node adicionado!");
  };

  const handleSave = async () => {
    if (!flow) {
      // sem Supabase — só salva local
      saveLocal(botId, { containers, edges });
      toast.success("Fluxo salvo localmente (aguardando conexão)");
      return;
    }
    
    setIsSaving(true);
    try {
      // Criamos uma cópia profunda para garantir consistência no que é enviado
      const containersToSave = JSON.parse(JSON.stringify(containers));
      const edgesToSave = JSON.parse(JSON.stringify(edges));
      
      console.log("[BotPage] Iniciando salvamento no Supabase...", {
        flowId: flow.id,
        nodesCount: containersToSave.length,
        edgesCount: edgesToSave.length
      });

      const updated = await saveDraft(flow.id, containersToSave, edgesToSave);
      
      setFlow(updated);
      lastSavedAtRef.current = Date.now();
      
      // Limpa o histórico após salvar com sucesso para economizar memória
      setHistory([{ containers: containersToSave, edges: edgesToSave }]);
      setHistoryIndex(0);
      
      toast.success("Fluxo salvo com sucesso!");
    } catch (err: any) {
      console.error("[BotPage] Erro ao salvar:", err);
      toast.error("Erro ao salvar no servidor: " + (err.message ?? "tente novamente"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleTest = () => {
    if (!containers.length) {
      toast.error("Adicione pelo menos um bloco para testar");
      return;
    }
    // Encontrar container de entrada (com nó "start" ou sem arestas de entrada)
    const withStart = containers.find((c) =>
      (c.nodes || []).some((n: any) => String(n.type || "").toLowerCase() === "start")
    );
    let entry: Container | undefined = withStart;
    if (!entry) {
      const incoming = new Set<string>();
      edges.forEach((e: any) => {
        if (!e?.target) return;
        const cont = containers.find((c) => (c.nodes || []).some((n: any) => n.id === e.target));
        if (cont) incoming.add(cont.id);
        else incoming.add(e.target);
      });
      entry = containers.find((c) => !incoming.has(c.id));
    }
    setTestContainer(entry || containers[0]);
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
        // Usamos await aqui para garantir que o save complete antes do reload/navegação
        await saveDraft(flow.id, containers, edges);
      }
    } catch (err) {
      console.warn("[BotPage] Save on back failed:", err);
    }

    // 2) Determina o destino (pasta pai ou workspace main).
    const parentId = bot?.parentId;
    const remembered = rememberedBotBackRoute(botId);
    
    let target = remembered;
    if (!target) {
      if (parentId) {
        target = folderRoute(slug, parentId);
      } else {
        target = workspaceRoot(slug);
      }
    }

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
    <VariablesProvider initialVariables={botVariables}>
      <BotEditorInner
        botId={botId}
        bot={bot}
        flow={flow}
        setFlow={setFlow}
        containers={containers}
        setContainers={setContainers}
        edges={edges}
        setEdges={setEdges}
        status={status}
        profile={profile}
        isSaving={isSaving}
        setIsSaving={setIsSaving}
        handleBack={handleBack}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
        handleSettingsUpdate={handleSettingsUpdate}
        handleTest={handleTest}
        testContainer={testContainer}
        setTestContainer={setTestContainer}
        handleUndo={handleUndo}
        handleRedo={handleRedo}
        historyIndex={historyIndex}
        history={history}
        showPublish={showPublish}
        setShowPublish={setShowPublish}
        handlePublishSuccess={handlePublishSuccess}
        isEditingName={isEditingName}
        setIsEditingName={setIsEditingName}
        nameDraft={nameDraft}
        setNameDraft={setNameDraft}
        commitName={commitName}
        startNameEdit={startNameEdit}
        displayName={displayName}
        lbl={lbl}
        handleAddNode={handleAddNode}
        setGetCenter={setGetCenter}
        botVariables={botVariables}
      />
    </VariablesProvider>
  );
}
