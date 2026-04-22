import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Settings,
  Plus,
  Play,
  Eye,
  Save,
  Send,
} from "lucide-react";
import { CanvasEditor } from "@/components/chatbot/CanvasEditor";
import { NodesSidebar } from "@/components/chatbot/NodesSidebar";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/context/WorkspaceContext";
import type { Container, Edge, Node, NodeType } from "@/types/chatbot";
import { toast } from "sonner";

const STORAGE_PREFIX = "bot_flow_";

interface StoredFlow {
  containers: Container[];
  edges: Edge[];
}

function loadFlow(botId: string): StoredFlow {
  if (typeof window === "undefined") return { containers: [], edges: [] };
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${botId}`);
    if (!raw) return { containers: [], edges: [] };
    const parsed = JSON.parse(raw) as Partial<StoredFlow>;
    return {
      containers: parsed.containers ?? [],
      edges: parsed.edges ?? [],
    };
  } catch {
    return { containers: [], edges: [] };
  }
}

function saveFlow(botId: string, flow: StoredFlow) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    `${STORAGE_PREFIX}${botId}`,
    JSON.stringify(flow)
  );
}

export default function BotPage() {
  const params = useParams();
  const navigate = useNavigate();
  const botId = (params.id as string) ?? "default";
  const { items } = useWorkspace();

  const bot = useMemo(
    () => items.find((i) => i.id === botId && i.type === "bot"),
    [items, botId]
  );

  const [containers, setContainers] = useState<Container[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [getCenter, setGetCenter] = useState<
    (() => { x: number; y: number }) | null
  >(null);

  useEffect(() => {
    const flow = loadFlow(botId);
    setContainers(flow.containers);
    setEdges(flow.edges);
    setHydrated(true);
  }, [botId]);

  useEffect(() => {
    if (!hydrated) return;
    saveFlow(botId, { containers, edges });
  }, [botId, containers, edges, hydrated]);

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

    if (containers.length === 0) {
      const position = getCenter ? getCenter() : { x: 300, y: 200 };
      setContainers([
        {
          id: `container-${Date.now()}`,
          nodes: [newNode],
          position,
        },
      ]);
    } else {
      // append to last container
      const updated = [...containers];
      const last = updated[updated.length - 1];
      updated[updated.length - 1] = {
        ...last,
        nodes: [...last.nodes, newNode],
      };
      setContainers(updated);
    }
    toast.success("Node adicionado!");
  };

  const handleSave = () => {
    saveFlow(botId, { containers, edges });
    toast.success("Fluxo salvo!");
  };

  return (
    <div className="fixed inset-0 flex flex-col bg-gray-950 z-50">
      {/* Header customizado do editor */}
      <header className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800 text-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="text-white hover:bg-gray-800 gap-1"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Button>

        <div className="h-6 w-px bg-gray-700 mx-1" />

        <div className="flex items-center gap-2 mr-2">
          {bot?.emoji && <span className="text-base">{bot.emoji}</span>}
          <span className="text-sm font-semibold truncate max-w-[180px]">
            {bot?.title ?? `Bot: ${botId}`}
          </span>
          <span className="text-[10px] uppercase tracking-wide bg-gray-700/70 text-gray-300 rounded px-2 py-0.5">
            Rascunho
          </span>
        </div>

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800 gap-1"
          onClick={() => toast.info("Configurações em breve")}
        >
          <Settings className="w-4 h-4" /> Configurações
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800 gap-1"
          onClick={handleAddBlock}
        >
          <Plus className="w-4 h-4" /> Bloco
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800 gap-1"
          onClick={() => toast.info("Teste em breve")}
        >
          <Play className="w-4 h-4" /> Testar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800 gap-1"
          onClick={() => toast.info("Visualizar em breve")}
        >
          <Eye className="w-4 h-4" /> Visualizar
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-white hover:bg-gray-800 gap-1"
          onClick={handleSave}
        >
          <Save className="w-4 h-4" /> Salvar
        </Button>

        <Button
          size="sm"
          className="bg-violet-600 hover:bg-violet-500 text-white gap-1 ml-1"
          onClick={() => toast.info("Publicação em breve")}
        >
          <Send className="w-4 h-4" />
        </Button>
      </header>

      {/* Sidebar de nodes + canvas */}
      <div className="flex-1 flex w-full overflow-hidden">
        <NodesSidebar onAddNode={handleAddNode} />
        <div className="flex-1 h-full">
          <CanvasEditor
            containers={containers}
            onContainersChange={setContainers}
            edges={edges}
            onEdgesChange={setEdges}
            onTest={() => {}}
            onGetCenterPosition={(getter) => setGetCenter(() => getter)}
          />
        </div>
      </div>
    </div>
  );
}
