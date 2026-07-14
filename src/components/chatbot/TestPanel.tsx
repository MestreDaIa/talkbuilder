import { useState, useEffect, useRef } from "react";
import { X, Send, Headphones, Play, Pause, FileText, Loader2, RefreshCw, Camera, Video, Mic, Image as ImageIcon, Phone, Upload, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Container, type Node, type ButtonConfig, type Edge, type ConditionComparison, type ConditionGroup } from "../../types/chatbot";

interface ResponseMapping {
  jsonPath: string;
  variableName: string;
}

import { ScrollArea } from "../../components/ui/scroll-area";
import { renderTextSegments } from "@/lib/textParser";
import { richHtmlFor, richToPlainText } from "@/lib/richText";
import { normalizeMarkdown } from "@/lib/markdown";

import { type Message as RuntimeMessage, type RuntimeState, type RuntimeMode, type PersistentMemory, type NodeExecutionStatus } from "../../types/runtime";
import { conversationService } from "../../services/conversationService";
import { buildAgentContext } from "../../services/aiContextBuilder";
import { getSupabase } from "@/lib/supabaseClient";

function evaluateSetVariableValue(cfg: any, variables: Record<string, any>, replaceVars: (s: string) => string): any {
  const valueType = cfg.valueType || "expression";
  const raw = String(cfg.value ?? "");
  switch (valueType) {
    case "empty": return "";
    case "now": return new Date().toISOString();
    case "today": return new Date().toLocaleDateString("pt-BR");
    case "yesterday": { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString("pt-BR"); }
    case "tomorrow": { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString("pt-BR"); }
    case "random": return Math.random().toString(36).substring(2, 8);
    case "custom": {
      try {
        const interpolated = replaceVars(raw);
        const varNames = Object.keys(variables);
        const varValues = varNames.map((k) => variables[k]);
        // eslint-disable-next-line no-new-func
        const fn = new Function(...varNames, `"use strict";\n${interpolated}`);
        return fn(...varValues);
      } catch (e) {
        console.error("[set-variable:custom] erro ao avaliar", e);
        return raw;
      }
    }
    case "expression":
    default: {
      if (!raw) return "";
      const interpolated = replaceVars(raw);
      try {
        const hasReturn = /\breturn\b/.test(interpolated);
        const isBlock = interpolated.includes(";") || interpolated.includes("\n") || hasReturn;
        if (isBlock) {
          const body = hasReturn ? interpolated : `return (${interpolated});`;
          // eslint-disable-next-line no-new-func
          const fn = new Function(`"use strict";\n${body}`);
          return fn();
        }
        // eslint-disable-next-line no-new-func
        const fn = new Function(`"use strict"; return (${interpolated});`);
        return fn();
      } catch {
        return interpolated;
      }
    }
  }
}

interface Message extends RuntimeMessage {
  // UI Specific extension
  id: string;
  type: "bot" | "user";
  content: string;
  isVideo?: boolean;
  isImage?: boolean;
  isFile?: boolean;
  isAudio?: boolean;
  isHtml?: boolean;
  alt?: string;
  autoplay?: boolean;
}


interface AudioPlayerProps {
  src: string;
  autoPlay?: boolean;
}

const AudioPlayer = ({ src, autoPlay }: AudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const handleLoadedMetadata = () => setDuration(audio.duration);
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      setProgress((audio.currentTime / audio.duration) * 100);
    };
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("play", handlePlay);
    audio.addEventListener("pause", handlePause);
    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("play", handlePlay);
      audio.removeEventListener("pause", handlePause);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    audio.currentTime = newTime;
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio ref={audioRef} src={src} autoPlay={autoPlay} />
      <button onClick={togglePlay} className="w-8 h-8 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors flex-shrink-0">
        {isPlaying ? <Pause className="h-4 w-4 text-white" /> : <Play className="h-4 w-4 text-white ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div onClick={handleProgressClick} className="h-1.5 bg-white/30 rounded-full cursor-pointer overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all duration-100" style={{ width: `${progress}%` }} />
        </div>
        <div className="flex justify-between text-[10px] text-white/70">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

export interface TestPanelTheme {
  primaryColor?: string;
  backgroundColor?: string;
  backgroundImage?: string;
  headerBackgroundColor?: string;
  headerTextColor?: string;
  inputBackgroundColor?: string;
  inputTextColor?: string;
  textColor?: string;
  botBubbleColor?: string;
  botTextColor?: string;
  userBubbleColor?: string;
  userTextColor?: string;
  fontFamily?: string;
  avatarUrl?: string;
}

interface TestPanelProps {
  isOpen: boolean;
  onClose: () => void;
  startContainer: Container | null;
  allContainers: Container[];
  edges?: Edge[];
  headerTitle?: string;
  headerSubtitle?: string | null;
  hideClose?: boolean;
  fullScreen?: boolean;
  theme?: TestPanelTheme;
  flowId?: string;
  settings?: Record<string, any>;
}

export const TestPanel = ({
  isOpen,
  onClose,
  startContainer,
  allContainers,
  edges = [],
  headerTitle = "Teste do Fluxo",
  headerSubtitle,
  hideClose = false,
  fullScreen = false,
  theme,
  flowId,
  settings,
}: TestPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [waitingForType, setWaitingForType] = useState<string | null>(null);
  const [waitingForConfig, setWaitingForConfig] = useState<any>(null);
  const [waitingForButton, setWaitingForButton] = useState(false);
  const [activeButtons, setActiveButtons] = useState<ButtonConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState<boolean>(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const runtimeStateRef = useRef<RuntimeState | null>(null);
  const hasStartedRef = useRef(false);
  const startedFlowRef = useRef<string | null>(null);
  const lastStartNodeIdRef = useRef<string | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureType, setCaptureType] = useState<'image' | 'video' | 'audio' | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const captureVideoRef = useRef<HTMLVideoElement>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startCapture = async (type: 'image' | 'video' | 'audio') => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: true,
        video: type !== 'audio'
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      captureStreamRef.current = stream;
      setCaptureType(type);
      setIsCapturing(true);
      setRecordedBlob(null);
      setRecordingDuration(0);

      if (type === 'audio' || type === 'video') {
        const recorder = new MediaRecorder(stream);
        mediaRecorderRef.current = recorder;
        chunksRef.current = [];
        
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        
        recorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: type === 'audio' ? 'audio/webm' : 'video/webm' });
          setRecordedBlob(blob);
        };
        
        recorder.start();
        timerRef.current = window.setInterval(() => {
          setRecordingDuration(prev => prev + 1);
        }, 1000);
        
        if (type === 'video' && captureVideoRef.current) {
          captureVideoRef.current.srcObject = stream;
        }
      } else if (type === 'image') {
        // Delay to allow video to start
        setTimeout(() => {
          if (captureVideoRef.current) {
            captureVideoRef.current.srcObject = stream;
          }
        }, 100);
      }
    } catch (err) {
      console.error("Error accessing media devices:", err);
      alert("Não foi possível acessar a câmera ou microfone. Verifique as permissões.");
    }
  };

  const stopCapture = () => {
    if (captureType === 'image') {
      const video = captureVideoRef.current;
      if (video) {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              setRecordedBlob(blob);
              setIsCapturing(false);
            }
          }, 'image/jpeg');
        }
      }
    } else if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsCapturing(false);
    }

    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const cancelCapture = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (captureStreamRef.current) {
      captureStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsCapturing(false);
    setCaptureType(null);
    setRecordedBlob(null);
  };

  const sendCaptured = () => {
    if (recordedBlob && captureType) {
      const url = URL.createObjectURL(recordedBlob);
      sendMessage(undefined, undefined, { type: captureType, url });
      cancelCapture();
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const contactIdRef = useRef<string>(`test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const firstNodeOfContainer = (containerId: string) => {
    const container = allContainers.find((c) => c.id === containerId);
    return container?.nodes?.[0]?.id ?? null;
  };

  const findNodeIn = (nodeId: string | null, containers: Container[]) => {
    if (!nodeId) return null;
    for (const container of containers) {
      const node = container.nodes.find((n) => n.id === nodeId);
      if (node) return { node, container };
    }
    return null;
  };

  const resolveTargetIn = (target: string, containers: Container[]): string | null => {
    if (!target) return null;
    if (findNodeIn(target, containers)) return target;
    const container = containers.find((c) => c.id === target);
    const first = container?.nodes?.[0]?.id ?? null;
    if (first) return first;
    return null;
  };

  const nextFromNodeIn = (nodeId: string, containerId: string, containers: Container[], edgesList: Edge[], handle?: string | null, strictHandle = false): string | null => {
    const normalizeHandle = (value?: string | null) => {
      if (!value) return "";
      const raw = String(value);
      const buttonMatch = raw.match(/-btn-(.+)$/);
      if (buttonMatch?.[1]) return buttonMatch[1];
      if (raw.endsWith("-default")) return "default";
      return raw;
    };
    const isInnerNodeHandle = (value?: string | null) =>
      !!value && String(value).startsWith(`${nodeId}-`);
    const wantedHandle = normalizeHandle(handle);
    // Only consider edges whose target still exists in the current graph.
    const validEdges = edgesList.filter((e) => resolveTargetIn(e.target, containers) !== null);
    const fromNode = validEdges.filter(
      (e) => e.source === nodeId || (e.source === containerId && isInnerNodeHandle(e.sourceHandle))
    );

    let edge = wantedHandle
      ? fromNode.find((e) => normalizeHandle(e.sourceHandle) === wantedHandle)
      : undefined;
    if (!edge && strictHandle) return null;
    if (!edge && wantedHandle) edge = fromNode.find((e) => normalizeHandle(e.sourceHandle) === "default");
    if (!edge) edge = fromNode.find((e) => !e.sourceHandle);
    if (!edge) edge = fromNode[0];
    if (edge) return resolveTargetIn(edge.target, containers);

    // Fallback: avançar para o próximo node dentro do mesmo bloco (ordem do array).
    // Nodes internos de um container não possuem edges entre si — eles são sequenciais.
    const container = containers.find((c) => c.id === containerId);
    if (container) {
      const idx = container.nodes.findIndex((n) => n.id === nodeId);
      if (idx >= 0 && idx < container.nodes.length - 1) {
        return container.nodes[idx + 1].id;
      }
    }

    // Último node do bloco: segue a edge de saída do container (se houver).
    const containerEdge = validEdges.find((e) => e.source === containerId && !e.sourceHandle);
    if (containerEdge) return resolveTargetIn(containerEdge.target, containers);
    return null;
  };

  const getVariableValue = (variables: Record<string, any>, variableName: string) => {
    const key = String(variableName || "").trim().replace(/^{{\s*/, "").replace(/\s*}}$/, "");
    if (!key) return undefined;
    
    // Support dot notation for objects (e.g., user_input.type)
    if (key.includes('.')) {
      const parts = key.split('.');
      let current: any = variables;
      for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') return undefined;
        current = current[part];
      }
      return current;
    }
    
    return variables[key];
  };

  const evaluateComparison = (comparison: ConditionComparison, variables: Record<string, any>, replaceVars: (text: string) => string) => {
    const rawValue = getVariableValue(variables, comparison.variableName);
    const actual = rawValue == null ? "" : String(rawValue).trim();
    const expected = replaceVars(String(comparison.value ?? "")).trim();

    switch (comparison.operator) {
      case "equals": return actual === expected;
      case "not_equals": return actual !== expected;
      case "contains": return actual.includes(expected);
      case "not_contains": return !actual.includes(expected);
      case "greater_than": return Number(actual) > Number(expected);
      case "less_than": return Number(actual) < Number(expected);
      case "is_set": return rawValue !== undefined && rawValue !== null && String(rawValue).trim() !== "";
      case "is_empty": return rawValue === undefined || rawValue === null || String(rawValue).trim() === "";
      case "starts_with": return actual.startsWith(expected);
      case "ends_with": return actual.endsWith(expected);
      case "matches_regex": {
        try { return new RegExp(expected).test(actual); } catch { return false; }
      }
      case "not_matches_regex": {
        try { return !new RegExp(expected).test(actual); } catch { return true; }
      }
      default: return false;
    }
  };

  const evaluateCondition = (condition: ConditionGroup, variables: Record<string, any>, replaceVars: (text: string) => string) => {
    const comparisons = condition.comparisons || [];
    if (!comparisons.length) return false;
    const results = comparisons.map((comparison) => evaluateComparison(comparison, variables, replaceVars));
    return condition.logicalOperator === "OR" ? results.some(Boolean) : results.every(Boolean);
  };

  const collectAgentSkills = (containersToScan: Container[], agentNodeId?: string | null) => {
    const skills: Array<{
      id: string;
      type: string;
      containerId: string;
      containerName: string;
      description: string;
      label: string;
      argsSchema?: any;                 // schema livre p/ o agente preencher
      // meta interna para o dispatcher
      _http?: { nodeId: string; endpointId: string; permissions: any; resultType: "context" | "live"; method: string };
    }> = [];

    for (const container of containersToScan) {
      for (const node of container.nodes || []) {
        if (node.id === agentNodeId) continue;
        if (!node.config?.isSkill) continue;

        const containerName = container.nameContainer || `Bloco #${container.id.slice(-4)}`;
        const cfg: any = node.config || {};

        // HTTP-Request em modo dinâmico → expõe UMA skill por endpoint,
        // cada uma com seu próprio argsSchema para o Agente IA saber o que preencher.
        if (node.type === "http-request" && cfg.operationMode === "dynamic" && Array.isArray(cfg.endpoints)) {
          for (const ep of cfg.endpoints) {
            const epId: string = ep.id || `${ep.method || "GET"} ${ep.url || ""}`;
            skills.push({
              id: `${node.id}::${epId}`,
              type: "http-endpoint",
              containerId: container.id,
              containerName,
              description: String(ep.description || ep.name || "Chame este endpoint quando fizer sentido para atender o usuário."),
              label: `${ep.method || "GET"} ${ep.name || epId}`,
              argsSchema: ep.argsSchema || null,
              _http: {
                nodeId: node.id,
                endpointId: epId,
                permissions: ep.permissions || {},
                resultType: ep.resultType === "live" ? "live" : "context",
                method: String(ep.method || "GET").toUpperCase(),
              },
            });
          }
          continue;
        }

        skills.push({
          id: node.id,
          type: node.type,
          containerId: container.id,
          containerName,
          description: String(cfg.skillDescription || "Use quando esta ação for útil para atender o usuário."),
          label: node.type === "redirect"
            ? `Redirecionar para ${cfg.targetFlowName || cfg.targetFlow || "outro fluxo"}`
            : node.type === "go-to"
              ? `Ir para ${cfg.targetContainerName || cfg.targetContainerId || "outro bloco"}`
              : String(cfg.name || cfg.label || node.type),
        });
      }
    }
    return skills;
  };

  const describeSkillArgs = (skill: ReturnType<typeof collectAgentSkills>[number]) => {
    const s = skill.argsSchema;
    if (!s) return "";
    const lines: string[] = [];
    if (Array.isArray(s.pathParams) && s.pathParams.length) {
      lines.push("  path params:");
      for (const p of s.pathParams) {
        if (!p?.name) continue;
        lines.push(`    - ${p.name}${p.description ? `: ${p.description}` : ""}${p.example ? ` (ex.: ${p.example})` : ""}`);
      }
    }
    if (Array.isArray(s.queryParams) && s.queryParams.length) {
      lines.push("  query params:");
      for (const p of s.queryParams) {
        if (!p?.name) continue;
        lines.push(`    - ${p.name}${p.description ? `: ${p.description}` : ""}${p.example ? ` (ex.: ${p.example})` : ""}`);
      }
    }
    if (s.bodyExample || s.bodyDescription) {
      lines.push(`  body${s.bodyDescription ? ` (${s.bodyDescription})` : ""}:`);
      if (s.bodyExample) lines.push(`    exemplo: ${String(s.bodyExample).replace(/\s+/g, " ").slice(0, 400)}`);
    }
    return lines.length ? `\n  Argumentos esperados:\n${lines.join("\n")}` : "";
  };

  const buildSkillSystemPrompt = (skills: ReturnType<typeof collectAgentSkills>) => {
    if (!skills.length) {
      return "\n\n[SKILLS DISPONÍVEIS]\nNenhuma skill foi habilitada nos outros nodes deste fluxo.";
    }

    const list = skills.map((skill, index) => {
      const resultTypeLine = skill._http
        ? `\nTipo de Resultado: ${skill._http.resultType === "live" ? "Live Data — sempre reconsultar; nunca reutilize resultado antigo" : "Context Data — pode ser usado como contexto"}`
        : "";
      return `${index + 1}. ID: ${skill.id}\nTipo: ${skill.type}${resultTypeLine}\nBloco: ${skill.containerName}\nNome: ${skill.label}\nInstrução da skill: ${skill.description}${describeSkillArgs(skill)}`;
    }).join("\n\n");

    return `\n\n[SKILLS DISPONÍVEIS PARA O AGENTE]\n${list}\n\nQuando a mensagem do usuário combinar com a instrução de uma skill, use a ferramenta use_skill com o ID exato da skill. Sempre que a skill listar "Argumentos esperados", preencha o objeto \`arguments\` com esses campos (use os path params/query params/body descritos, extraindo os valores do contexto da conversa e das variáveis já coletadas). Para path params chamados \`id\`, use sempre o ID real do item escolhido em resultados anteriores (ex.: serviço Barba => id UUID do serviço), nunca o nome do item. Skills marcadas como Live Data são voláteis: sempre chame a skill novamente quando precisar desses dados, ignore resultados antigos no histórico e não use valores antigos para criar/alterar/excluir dados. Se um resultado de skill retornar erro ou parâmetro ausente, não chame a mesma skill de novo com os mesmos argumentos; responda ao usuário ou peça a informação faltante. Se a chamada de ferramenta não estiver disponível, responda apenas com JSON: {"skill_id":"ID","arguments":{...},"message":"opcional"}. Não invente perguntas antes de usar uma skill claramente solicitada.`;
  };

  const buildUseSkillTool = (skills: ReturnType<typeof collectAgentSkills>) => {
    if (!skills.length) return undefined;
    return {
      type: "function",
      function: {
        name: "use_skill",
        description: "Executa uma skill (ferramenta) do fluxo. Inclua os argumentos quando a skill declarar path/query/body.",
        parameters: {
          type: "object",
          properties: {
            skill_id: {
              type: "string",
              enum: skills.map((skill) => skill.id),
              description: "ID exato da skill que deve ser executada."
            },
            arguments: {
              type: "object",
              description: "Valores para preencher path params, query params e body do endpoint (quando aplicável). Use as chaves declaradas em 'Argumentos esperados'.",
              additionalProperties: true,
            },
            message: {
              type: "string",
              description: "Mensagem curta para avisar o usuário antes de executar a skill."
            }
          },
          required: ["skill_id"]
        }
      }
    };
  };


  const parseSkillFromText = (reply: string | null) => {
    if (!reply) return null;
    const jsonMatch = reply.match(/\{[\s\S]*"skill_id"[\s\S]*\}/);
    if (!jsonMatch) return null;
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed?.skill_id ? {
        skill_id: String(parsed.skill_id),
        message: parsed.message ? String(parsed.message) : "",
        arguments: (parsed.arguments && typeof parsed.arguments === "object") ? parsed.arguments : undefined,
      } : null;
    } catch {
      return null;
    }
  };


    const runLocalFlow = async (
      state: RuntimeState | null, 
      input?: { 
        message?: string; 
        button_id?: string;
        type?: string;
        url?: string;
        base64?: string;
        fileName?: string;
        mimetype?: string;
      },
      containersIn?: Container[],
      edgesIn?: Edge[],
      visitedRedirects = new Set<string>()
    ): Promise<any> => {
      const containers = containersIn || allContainers;
      const edgesList = edgesIn || edges;
      let mode: RuntimeMode = state?.mode || "flow";
      let currentNodeId = state?.current_node_id || startContainer?.nodes?.[0]?.id || containers?.[0]?.nodes?.[0]?.id || null;
      let activeAgentNodeId = state?.active_agent_node_id || null;
      const variables = { ...(state?.variables || {}) };

      // Inject system variables (channel identifies where the flow is running)
      variables.channel = "webchat";
      variables.data = {
        ...(variables.data || {}),
        channel: "webchat",
      };
      const persistentMemory: PersistentMemory = { ...(state?.persistent_memory || {}) };
      const messageHistory: RuntimeMessage[] = [...(state?.message_history || [])];
      const nextMessages: Message[] = [];
      
      let waitingFor: string | null = null;
      let waitingForCfg: any = null;
      let nextButtons: ButtonConfig[] = [];
      let waitMs = 0;
      let steps = 0;
      let status: NodeExecutionStatus = "running";
      const skillCallsThisRun: Record<string, number> = {};

      const firstText = (...values: any[]) => String(values.find((v) => typeof v === "string" && v.trim()) || "");
      const cleanText = (text: string) => richToPlainText(text);
      const replaceVars = (text: string) => cleanText(text).replace(/{{(.*?)}}/g, (_, key) => {
        const val = getVariableValue(variables, key.trim());
        if (val === undefined) return `{{${key}}}`;
        return typeof val === 'object' ? JSON.stringify(val) : String(val);
      });
      const isSkillResultHistoryMessage = (msg: RuntimeMessage) => {
        const meta = (msg as any).metadata || {};
        return meta.kind === "skill_result" || String(msg.content || "").startsWith("[Resultado da skill");
      };
      const getAgentHistory = (includeLatestSkillResult: boolean) => {
        const lastIndex = messageHistory.length - 1;
        return messageHistory.filter((msg, index) => {
          if (!isSkillResultHistoryMessage(msg)) return true;
          return includeLatestSkillResult && index === lastIndex;
        });
      };

      const parseWaitMs = (cfg: any) => {
        const amount = Math.max(1, Number(cfg.waitTime ?? cfg.duration ?? cfg.seconds ?? 5) || 5);
        const unit = String(cfg.timeUnit ?? cfg.unit ?? "seconds").toLowerCase();
        return amount * (unit.startsWith("hour") || unit.startsWith("hora") ? 3600000 : unit.startsWith("minute") || unit.startsWith("minuto") ? 60000 : 1000);
      };

      // Identify user/conversation
      let visitorId = state?.visitor_id || localStorage.getItem("chat_visitor_id");
      if (!visitorId) {
        visitorId = `v-${Math.random().toString(36).slice(2, 11)}`;
        localStorage.setItem("chat_visitor_id", visitorId);
      }

      let conversationId = state?.conversation_id || null;
      if (!conversationId && flowId) {
        const conv = await conversationService.getOrCreateConversation(visitorId, flowId, "default-workspace");
        conversationId = conv.id;
      }

      // 1. Process User Input
      if (input && (input.message !== undefined || input.button_id !== undefined)) {
        console.log("[node:input_received]", input);
        const userValue = input.message ?? input.button_id;
        variables["last_message"] = userValue;

        // Save to history
        const userMsg: RuntimeMessage = {
          id: crypto.randomUUID(),
          conversation_id: conversationId || "temp",
          role: "user",
          content: String(userValue),
          created_at: new Date().toISOString()
        };
        messageHistory.push(userMsg);
        if (conversationId) conversationService.saveMessage(userMsg);

        if (mode === "agent" && activeAgentNodeId) {
          currentNodeId = activeAgentNodeId;
        } else if (currentNodeId) {
          const info = findNodeIn(currentNodeId, containers);
          if (info) {
            const cfg = info.node.config || {};
            const varName = cfg.variableName || cfg.saveVariable;
            if (varName && userValue !== undefined) {
              if (info.node.type === 'input-universal') {
                variables[varName] = {
                  type: input.type || 'textInput',
                  content: userValue,
                  metadata: {
                    base64: input.base64,
                    link: input.url,
                    fileName: input.fileName,
                    mimetype: input.mimetype
                  }
                };
              } else {
                variables[varName] = userValue;
              }
            }
            
            if (info.node.type === "go-to" && cfg.targetContainerId) {
              const targetNodeId = resolveTargetIn(cfg.targetContainerId, containers);
              if (targetNodeId && targetNodeId !== info.node.id) {
                currentNodeId = targetNodeId;
              } else {
                currentNodeId = nextFromNodeIn(info.node.id, info.container.id, containers, edgesList, input.button_id);
              }
            } else if (info.node.type !== "ai-agent") {
              currentNodeId = nextFromNodeIn(info.node.id, info.container.id, containers, edgesList, input.button_id);
            }
          }
        }
        // Input já foi consumido pelo node em waiting_for_input — não deve afetar próximos input nodes.
        // Exceção: no modo agente, o input precisa chegar ao handler do ai-agent para gerar a resposta.
        if (!(mode === "agent" && activeAgentNodeId && currentNodeId === activeAgentNodeId)) {
          input = undefined;
        }
      }

      console.log("[Runtime] Loop start", { mode, currentNodeId, steps });

      // 2. Execution Loop
      while (currentNodeId && steps++ < 100) {
        const found = findNodeIn(currentNodeId, containers);
        if (!found) {
          console.warn("[node:not_found]", currentNodeId);
          const first = containers.find(c => c.id === currentNodeId)?.nodes?.[0]?.id;
          if (first) {
            currentNodeId = first;
            continue;
          }
          break;
        }

        const { node, container } = found;
        const cfg = node.config || {};
        const nodeType = String(node.type || "").toLowerCase();
        
        console.log(`[node:start] [${nodeType}] ${node.id}`);

        // Handle initial variables from Start node
        if (nodeType === "start" && cfg.initialVariables) {
          cfg.initialVariables.forEach((v: any) => {
            if (v.name && v.name.trim()) {
              variables[v.name.trim()] = v.defaultValue || "";
            }
          });
        }

        if (nodeType === "wait" || nodeType === "await") {
          waitMs = parseWaitMs(cfg);
          console.log(`[node:paused] Wait ${waitMs}ms`);
          status = "paused";
          currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
          break;
        }

        // Input Nodes
        if (nodeType.startsWith("input-")) {
          if (!input || (input.message === undefined && input.button_id === undefined)) {
            console.log("[node:waiting_input]", node.id);
            waitingFor = nodeType === "input-buttons" ? "buttons" : nodeType;
            waitingForCfg = cfg;
            if (nodeType === "input-buttons") {
              nextButtons = cfg.buttons || [];
            }
            status = "waiting_input";
            break;
          }
        }

        // AI Node (One-off execution)
        if (nodeType === "ai-node") {
          const hasUserInput = !!(variables["last_message"] && String(variables["last_message"]).trim());
          if (!hasUserInput) {
            console.log("[node:ai_skipped] sem input do usuário", node.id);
            currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
            continue;
          }
          console.log("[node:start] AI Node processing", node.id);

          console.log("[node:ai_generating] AI Node", node.id);
          const objective = cfg.objective || cfg.systemPrompt || "assistente";
          const instructions = firstText(cfg.instructions, cfg.prompt, cfg.message, cfg.userMessage) || "Ajude o usuário.";

          
          const nodeKey = (cfg.apiKey || "").trim();
          const nodeProvider = (cfg.provider || "openai").toLowerCase();
          const globalKeys = settings?.aiKeys || {};
          const activeKey = (globalKeys[`${nodeProvider}Key`] || "").trim() || nodeKey;
          const selectedProvider = nodeProvider === "gemini" ? "google" : nodeProvider as "openai" | "anthropic" | "google";

          const { system, messages: contextMessages } = buildAgentContext({
            systemPrompt: `Objetivo: ${objective}\nInstruções: ${instructions}`,
            history: messageHistory,
            persistentMemory,
            variables,
            knowledgeBase: {
              kbFiles: cfg.kbFiles,
              kbFilesEnabled: cfg.kbFilesEnabled,
              kbLinks: cfg.kbLinks,
              kbLinksEnabled: cfg.kbLinksEnabled
            }
          });

          let aiReply: string | null = null;
          if (activeKey) {
            try {
              if (selectedProvider === "openai") {
                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: cfg.model || "gpt-4o-mini",
                    messages: [{ role: "system", content: system }, { role: "user", content: variables["last_message"] || "Olá" }],
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  aiReply = data.choices?.[0]?.message?.content || null;
                }
              } else if (selectedProvider === "google") {
                const model = (cfg.model || "gemini-2.0-flash").trim();
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    system_instruction: { parts: [{ text: system }] },
                    contents: [{ parts: [{ text: variables["last_message"] || "Olá" }] }]
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
                }
              }
            } catch (e) {
              console.error("[ai-node] AI call failed", e);
            }
          }

          if (aiReply) {
            const botMsg: RuntimeMessage = {
              id: crypto.randomUUID(),
              conversation_id: conversationId || "temp",
              role: "assistant",
              content: aiReply,
              created_at: new Date().toISOString()
            };
            messageHistory.push(botMsg);
            if (conversationId) conversationService.saveMessage(botMsg);
            
            if (cfg.saveVariable) {
              variables[cfg.saveVariable] = aiReply;
            } else {
              nextMessages.push({ ...botMsg, type: "bot", content: aiReply, isHtml: false } as Message);
            }
          }


          console.log("[node:ai_completed] AI Node", node.id);
          currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
          continue;
        }

        // Agent AI Node (Continuous)
        if (nodeType === "ai-agent") {
          mode = "agent";
          activeAgentNodeId = node.id;
          
          const startMode = cfg.startMode || "automatic";
          const welcomeMessage = cfg.welcomeMessage || "";

          // Welcome behavior
          if (!input && startMode === "automatic" && welcomeMessage && nextMessages.length === 0) {
            console.log("[node:start] Agent Welcome", node.id);
            const html = richHtmlFor(welcomeMessage, { variables });
            nextMessages.push({
              id: crypto.randomUUID(),
              conversation_id: conversationId || "temp",
              role: "assistant",
              type: "bot",
              content: html,
              isHtml: true,
              created_at: new Date().toISOString()
            });
            waitingFor = "input-text";
            waitingForCfg = { placeholder: "Converse com o agente..." };
            status = "waiting_input";
            break;
          }

          if (!input || (input.message === undefined && input.button_id === undefined)) {
            console.log("[node:waiting_input] Agent", node.id);
            waitingFor = "input-text";
            waitingForCfg = { placeholder: "Converse com o agente..." };
            status = "waiting_input";
            break;
          }

          const userMsgContent = String(input.message || "").toLowerCase();
          const exitPhrases = ["voltar menu", "sair", "parar", "cancelar", "exit", "stop"];
          if (exitPhrases.some(p => userMsgContent.includes(p))) {
            console.log("[node:agent_exit]", node.id);
            mode = "flow";
            activeAgentNodeId = null;
            currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
            continue;
          }

          console.log("[node:ai_generating] Agent", node.id);
          const objective = cfg.objective || "assistente conversacional";
          const instructions = cfg.instructions || "Ajude o usuário de forma natural.";
          const skills = cfg.toolCallingEnabled === false ? [] : collectAgentSkills(containers, node.id);
          const useSkillTool = buildUseSkillTool(skills);
          
          const nodeKey = (cfg.apiKey || "").trim();
          const nodeProvider = (cfg.provider || "openai").toLowerCase();
          const globalKeys = settings?.aiKeys || {};
          const activeKey = (globalKeys[`${nodeProvider}Key`] || "").trim() || nodeKey;
          const selectedProvider = nodeProvider === "gemini" ? "google" : nodeProvider as "openai" | "anthropic" | "google";

          const { system, messages: contextMessages } = buildAgentContext({
            systemPrompt: `Objetivo: ${objective}\nInstruções: ${instructions}${buildSkillSystemPrompt(skills)}`,
            history: getAgentHistory(!!(input as any)?.__fromSkill),
            persistentMemory,
            variables,
            knowledgeBase: {
              kbFiles: cfg.kbFiles,
              kbFilesEnabled: cfg.kbFilesEnabled,
              kbLinks: cfg.kbLinks,
              kbLinksEnabled: cfg.kbLinksEnabled
            }
          });

          let aiReply: string | null = null;
          let skillCall: { skill_id: string; message?: string; arguments?: Record<string, any> } | null = null;
          if (activeKey) {
            try {
              if (selectedProvider === "openai") {
                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: cfg.model || "gpt-4o-mini",
                    messages: [{ role: "system", content: system }, ...contextMessages],
                    ...(useSkillTool ? { tools: [useSkillTool], tool_choice: "auto" } : {}),
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  const msg = data.choices?.[0]?.message;
                  const toolCall = msg?.tool_calls?.find((call: any) => call?.function?.name === "use_skill");
                  if (toolCall?.function?.arguments) {
                    const args = JSON.parse(toolCall.function.arguments);
                    skillCall = args?.skill_id ? {
                      skill_id: String(args.skill_id),
                      message: args.message,
                      arguments: (args.arguments && typeof args.arguments === "object") ? args.arguments : undefined,
                    } : null;
                  }
                  aiReply = msg?.content || null;
                }
              } else if (selectedProvider === "google") {
                const model = (cfg.model || "gemini-2.0-flash").trim();
                const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    system_instruction: { parts: [{ text: system }] },
                    contents: contextMessages.map(m => ({
                      role: m.role === "assistant" ? "model" : "user",
                      parts: [{ text: m.content }]
                    })),
                    ...(useSkillTool ? {
                      tools: [{ function_declarations: [{
                        name: useSkillTool.function.name,
                        description: useSkillTool.function.description,
                        parameters: {
                          type: "object",
                          properties: {
                            skill_id: {
                              type: "string",
                              enum: (useSkillTool.function.parameters as any)?.properties?.skill_id?.enum || [],
                              description: "ID exato da skill que deve ser executada."
                            },
                            arguments_json: {
                              type: "string",
                              description: "JSON string com os argumentos (path/query/body). Ex: '{\"id\":\"...\"}'. Use '{}' se não houver argumentos."
                            },
                            message: {
                              type: "string",
                              description: "Mensagem curta para o usuário antes de executar a skill."
                            }
                          },
                          required: ["skill_id"]
                        }
                      }] }],
                      tool_config: { function_calling_config: { mode: "AUTO" } }
                    } : {})
                  }),
                });
                if (!res.ok) {
                  const errBody = await res.text().catch(() => "");
                  console.error(`[agent-node] Gemini ${res.status}:`, errBody);
                  aiReply = `⚠️ Erro ${res.status} do provedor de IA (Gemini). Verifique a chave, o modelo (${model}) ou a configuração das skills. Detalhes: ${errBody.slice(0, 300)}`;
                }
                if (res.ok) {
                  const data = await res.json();
                  const parts = data.candidates?.[0]?.content?.parts || [];
                  const fn = parts.find((part: any) => part.functionCall?.name === "use_skill")?.functionCall;
                  if (fn?.args?.skill_id) {
                    let parsedArgs: Record<string, any> | undefined;
                    if (fn.args.arguments && typeof fn.args.arguments === "object") {
                      parsedArgs = fn.args.arguments;
                    } else if (typeof fn.args.arguments_json === "string") {
                      try { parsedArgs = JSON.parse(fn.args.arguments_json); } catch { parsedArgs = undefined; }
                    }
                    skillCall = {
                      skill_id: String(fn.args.skill_id),
                      message: fn.args.message,
                      arguments: parsedArgs,
                    };
                  }
                  aiReply = parts.map((part: any) => part.text).filter(Boolean).join("\n").trim() || null;
                }
              }
            } catch (e) {
              console.error("[agent-node] AI call failed", e);
            }
          }

          skillCall = skillCall || parseSkillFromText(aiReply);

          const matchedSkill = skillCall?.skill_id ? skills.find((s) => s.id === skillCall!.skill_id) : null;
          if (skillCall?.skill_id && matchedSkill) {
            const skillCallKey = `${skillCall.skill_id}:${JSON.stringify(skillCall.arguments || {})}`;
            skillCallsThisRun[skillCallKey] = (skillCallsThisRun[skillCallKey] || 0) + 1;
            if (skillCallsThisRun[skillCallKey] > 1) {
              const stopMsg = "Não consegui concluir essa consulta com os dados disponíveis. Pode confirmar a opção desejada ou tentar novamente em instantes?";
              const botMsg: RuntimeMessage = {
                id: crypto.randomUUID(),
                conversation_id: conversationId || "temp",
                role: "assistant",
                content: stopMsg,
                created_at: new Date().toISOString()
              };
              messageHistory.push(botMsg);
              nextMessages.push({ ...botMsg, type: "bot", content: stopMsg, isHtml: false } as Message);
              waitingFor = "input-text";
              waitingForCfg = { placeholder: "Converse com o agente..." };
              status = "waiting_input";
              break;
            }

            if (skillCall.message && !matchedSkill._http) {
              const notice = String(skillCall.message).trim();
              if (notice) nextMessages.push({ id: crypto.randomUUID(), conversation_id: conversationId || "temp", role: "assistant", type: "bot", content: notice, isHtml: false } as Message);
            }

            // Composite id `${nodeId}::${endpointId}` para HTTP-Request dinâmico:
            // extraímos o endpoint alvo e os argumentos do Agente, e injetamos
            // como diretiva efêmera consumida pelo executor do node.
            let targetNodeId = skillCall.skill_id;
            if (matchedSkill._http) {
              targetNodeId = matchedSkill._http.nodeId;
              (variables as any).__dynamicSkillDispatch = {
                nodeId: matchedSkill._http.nodeId,
                endpointId: matchedSkill._http.endpointId,
                args: skillCall.arguments || {},
                permissions: matchedSkill._http.permissions || {},
              };
            }

            const varsBefore = JSON.parse(JSON.stringify(variables));
            const skillResult = await runLocalFlow(
              {
                mode: "flow",
                current_node_id: targetNodeId,
                active_agent_node_id: null,
                variables,
                message_history: messageHistory,
                persistent_memory: persistentMemory,
                visitor_id: visitorId,
                conversation_id: conversationId,
                waiting_for_input: false
              },
              undefined,
              containers,
              edgesList,
              visitedRedirects
            );
            delete (variables as any).__dynamicSkillDispatch;


            const skillVars = skillResult.runtime_state?.variables || {};
            Object.assign(variables, skillVars);
            nextMessages.push(...(skillResult.messages || []));

            // Se a skill pausou aguardando input do usuário, entrega o controle e sai.
            const skillPaused = skillResult.status === "waiting_input" || !!skillResult.runtime_state?.waiting_for;
            if (skillPaused) {
              return {
                ...skillResult,
                messages: nextMessages,
                runtime_state: {
                  ...skillResult.runtime_state,
                  variables: { ...variables },
                  active_agent_node_id: activeAgentNodeId,
                  mode: "agent"
                }
              };
            }

            // Skill finalizou — devolve resultado ao Agent IA para gerar a resposta final ao usuário.
            const skillMeta = skills.find((s) => s.id === skillCall.skill_id);
            const diff: Record<string, any> = {};
            Object.keys(skillVars).forEach((k) => {
              if (k.startsWith("__")) return;
              if (JSON.stringify(skillVars[k]) !== JSON.stringify(varsBefore[k])) diff[k] = skillVars[k];
            });
            const payload = Object.keys(diff).length
              ? diff
              : { httpResponse: skillVars.httpResponse ?? { ok: true, message: "Consulta executada sem novas variáveis." } };
            const compactForAgent = (value: any, depth = 0): any => {
              if (value == null || typeof value === "boolean" || typeof value === "number") return value;
              if (typeof value === "string") return value.length > 800 ? `${value.slice(0, 800)}…` : value;
              if (depth > 5) return Array.isArray(value) ? `[${value.length} itens]` : "[objeto]";
              if (Array.isArray(value)) {
                // Preserva arrays de primitivos (strings/números curtos) inteiros — ex: listas de horários, IDs.
                const isPrimitiveArray = value.every(
                  (v) => v == null || typeof v === "string" || typeof v === "number" || typeof v === "boolean",
                );
                if (isPrimitiveArray) return value.map((item) => compactForAgent(item, depth + 1));
                const MAX_ITEMS = 50;
                const sliced = value.slice(0, MAX_ITEMS).map((item) => compactForAgent(item, depth + 1));
                if (value.length > MAX_ITEMS) sliced.push(`… (+${value.length - MAX_ITEMS} itens omitidos)`);
                return sliced;
              }
              if (typeof value === "object") {
                const entries = Object.entries(value).slice(0, 48);
                return Object.fromEntries(entries.map(([k, v]) => [k, compactForAgent(v, depth + 1)]));
              }
              return String(value);
            };
            let payloadStr: string;
            try { payloadStr = JSON.stringify(compactForAgent(payload)); } catch { payloadStr = String(payload); }
            if (payloadStr.length > 6000) payloadStr = payloadStr.slice(0, 6000) + "…";

            const toolMsg: RuntimeMessage = {
              id: crypto.randomUUID(),
              conversation_id: conversationId || "temp",
              role: "user",
              content: `[Resultado da skill "${skillMeta?.label || skillCall.skill_id}"]:\n${payloadStr}\n\nCom base neste resultado, responda ao usuário de forma natural e útil (em português). Não chame a mesma skill novamente a menos que seja realmente necessário.`,
              metadata: {
                kind: "skill_result",
                skill_id: skillCall.skill_id,
                result_type: skillMeta?._http?.resultType || "context",
              },
              created_at: new Date().toISOString()
            };
            messageHistory.push(toolMsg);

            // Reexecuta o node do Agent IA com o input sintético para gerar a resposta final.
            currentNodeId = activeAgentNodeId;
            input = { message: toolMsg.content, __fromSkill: true } as any;
            continue;
          }

          if (aiReply) {
            const botMsg: RuntimeMessage = {
              id: crypto.randomUUID(),
              conversation_id: conversationId || "temp",
              role: "assistant",
              content: aiReply,
              created_at: new Date().toISOString()
            };
            messageHistory.push(botMsg);
            if (conversationId) conversationService.saveMessage(botMsg);
            nextMessages.push({ ...botMsg, type: "bot", content: aiReply, isHtml: false } as Message);
          }

          waitingFor = "input-text";
          waitingForCfg = { placeholder: "Converse com o agente..." };
          status = "waiting_input";
          break;

        }

        // Standard nodes
        if (nodeType === "bubble-text" || nodeType === "bubble-number") {
          const rawValue = firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value);
          if (rawValue) {
            const html = richHtmlFor(rawValue, { variables });
            nextMessages.push({ 
              id: crypto.randomUUID(), 
              conversation_id: conversationId || "temp",
              role: "assistant",
              type: "bot", 
              content: html, 
              isHtml: true 
            });
          }
        } else if (nodeType === "bubble-image") {
          nextMessages.push({ 
            id: crypto.randomUUID(), 
            conversation_id: conversationId || "temp",
            role: "assistant",
            type: "bot", 
            content: firstText(cfg.ImageURL, cfg.imageUrl, cfg.url, cfg.src), 
            isImage: true, 
            alt: firstText(cfg.ImageAlt, cfg.alt) 
          });
        } else if (nodeType === "set-variable" && cfg.variableName) {
          variables[cfg.variableName] = evaluateSetVariableValue(cfg, variables, replaceVars);
        } else if (nodeType === "script") {
          try {
            const rawCode = String(cfg.code || "");
            const interpolated = replaceVars(rawCode);
            const varNames = Object.keys(variables);
            const varValues = varNames.map((k) => variables[k]);
            // eslint-disable-next-line no-new-func
            const fn = new Function(...varNames, `"use strict";\n${interpolated}`);
            const result = await fn(...varValues);
            console.log(`[node:script] result=`, result);
            if (cfg.variableName) {
              variables[cfg.variableName] = result;
            }
          } catch (err) {
            console.error("[node:script] error", err);
            nextMessages.push({
              id: crypto.randomUUID(),
              conversation_id: conversationId || "temp",
              role: "assistant",
              type: "bot",
              content: `⚠️ Erro no script: ${err instanceof Error ? err.message : String(err)}`,
              isHtml: false,
            } as Message);
          }
        } else if (nodeType === "http-request") {
          // Helper: navega em objeto JSON por dot-path. Aceita "data.foo" e "foo" indistintamente
          // se a resposta tiver ou não wrapper "data".
          const getByPath = (obj: any, path: string): any => {
            if (!path) return obj;
            const parts = path.split(".").filter(Boolean);
            const tryPath = (start: any, keys: string[]) => {
              let cur = start;
              for (const p of keys) {
                if (Array.isArray(cur)) {
                  // mapeia sobre arrays automaticamente
                  cur = cur.map((it) => (it && typeof it === "object" ? it[p] : undefined));
                } else if (cur != null && typeof cur === "object") {
                  cur = cur[p];
                } else {
                  return undefined;
                }
              }
              return cur;
            };
            const first = tryPath(obj, parts);
            if (first !== undefined) return first;
            if (parts[0] === "data") return tryPath(obj, parts.slice(1));
            if (obj && typeof obj === "object" && "data" in obj) return tryPath((obj as any).data, parts);
            return undefined;
          };

            const applyMappings = (responseData: any, mappings: any[]) => {
              const mappedKeys: string[] = [];
            (mappings || []).forEach((m: any) => {
              if (!m?.variableName) return;
              const val = getByPath(responseData, m.jsonPath || "");
              if (val !== undefined) {
                  const targetKey = String(m.variableName).trim();
                  variables[targetKey] = val;
                  mappedKeys.push(targetKey);
                  console.log(`[node:http-request] mapped ${m.jsonPath} -> ${m.variableName}`);
              }
            });
              return mappedKeys;
          };

          const operationMode = (cfg.operationMode as "generic" | "dynamic") || "generic";

          try {
            if (operationMode === "dynamic") {
              // ---------- MODO DINÂMICO ----------
              const allEndpoints: any[] = Array.isArray(cfg.endpoints) ? cfg.endpoints : [];

              // Diretiva injetada pelo Agente IA (skill dispatch): quando presente,
              // executa APENAS o endpoint escolhido e aplica os argumentos fornecidos
              // pelo modelo — respeitando as permissões configuradas.
              const dispatch = (variables as any).__dynamicSkillDispatch;
              const isDispatched = dispatch && dispatch.nodeId === node.id;
              const endpoints: any[] = isDispatched
                ? allEndpoints.filter((e) => e.id === dispatch.endpointId)
                : allEndpoints;

              if (isDispatched && !endpoints.length) {
                console.warn(`[node:http-request][dynamic] endpoint "${dispatch.endpointId}" não encontrado`);
              }

              if (!endpoints.length) {
                console.warn("[node:http-request] modo dinâmico sem endpoints configurados");
                const branchNext = nextFromNodeIn(node.id, container.id, containers, edgesList, "error", true);
                if (branchNext) { currentNodeId = branchNext; continue; }
              } else {
                let lastOk = true;
                let lastData: any = null;
                for (const ep of endpoints) {
                  const method = String(ep.method || "GET").toUpperCase();

                  // Argumentos vindos do Agente IA (só para o endpoint despachado).
                  const agentArgs: Record<string, any> = isDispatched ? (dispatch.args || {}) : {};
                  const perms = isDispatched ? (dispatch.permissions || ep.permissions || {}) : (ep.permissions || {});
                  const agentPath: Record<string, any> = (agentArgs.pathParams && typeof agentArgs.pathParams === "object") ? agentArgs.pathParams : {};
                  const agentQuery: Record<string, any> = (agentArgs.queryParams && typeof agentArgs.queryParams === "object") ? agentArgs.queryParams : {};
                  const agentBody = agentArgs.body;
                  // Busca recursiva por um valor no objeto de argumentos do agente
                  // (tolera formatos como { id: "..." }, { pathParams: { id } }, { arguments: {...} },
                  //  arrays [{ id, name }], nomes com case diferente, etc.).
                  const deepFindValue = (obj: any, name: string, depth = 0): any => {
                    if (obj == null || depth > 4) return undefined;
                    if (Array.isArray(obj)) {
                      for (const item of obj) {
                        const v = deepFindValue(item, name, depth + 1);
                        if (v !== undefined) return v;
                      }
                      return undefined;
                    }
                    if (typeof obj !== "object") return undefined;
                    const lower = name.toLowerCase();
                    for (const [k, v] of Object.entries(obj)) {
                      if (k.toLowerCase() === lower && (typeof v === "string" || typeof v === "number")) return v;
                    }
                    for (const v of Object.values(obj)) {
                      const found = deepFindValue(v, name, depth + 1);
                      if (found !== undefined) return found;
                    }
                    return undefined;
                  };
                  const pickAgentValue = (name: string) => {
                    const direct = agentPath[name] ?? agentQuery[name] ?? (name in agentArgs ? agentArgs[name] : undefined);
                    if (direct !== undefined) return direct;
                    return deepFindValue(agentArgs, name);
                  };

                  const normalizeLookupText = (value: unknown) => String(value ?? "")
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, " ")
                    .trim();

                  const collectLookupTerms = () => {
                    const terms = new Set<string>();
                    const add = (value: unknown) => {
                      const normalized = normalizeLookupText(value);
                      if (!normalized) return;
                      terms.add(normalized);
                      normalized.split(" ").filter((part) => part.length >= 3).forEach((part) => terms.add(part));
                    };
                    add(variables.last_message);
                    add((variables as any).last_user_message);
                    const scanArgs = (obj: any, depth = 0) => {
                      if (obj == null || depth > 3) return;
                      if (typeof obj === "string" || typeof obj === "number") { add(obj); return; }
                      if (Array.isArray(obj)) { obj.forEach((item) => scanArgs(item, depth + 1)); return; }
                      if (typeof obj === "object") Object.values(obj).forEach((value) => scanArgs(value, depth + 1));
                    };
                    scanArgs(agentArgs);
                    return Array.from(terms).filter((term) => term && !/^[0-9a-f-]{20,}$/i.test(term));
                  };

                  const inferIdFromKnownLists = (paramName: string) => {
                    if (!/(^id$|_id$)/i.test(paramName)) return undefined;
                    const terms = collectLookupTerms();
                    if (!terms.length) return undefined;
                    const seen = new WeakSet<object>();
                    let best: { id: string | number; score: number; label: string } | null = null;
                    const scoreLabel = (label: string) => {
                      const normalized = normalizeLookupText(label);
                      if (!normalized) return 0;
                      let score = 0;
                      for (const term of terms) {
                        if (normalized === term) score = Math.max(score, 100);
                        else if (term.includes(normalized) || normalized.includes(term)) score = Math.max(score, Math.min(normalized.length, term.length));
                      }
                      return score;
                    };
                    const liveVariableKeys = new Set(
                      Array.isArray((variables as any).__liveVariableKeys)
                        ? (variables as any).__liveVariableKeys.map((key: unknown) => String(key))
                        : []
                    );
                    const inspect = (obj: any, depth = 0, keyHint?: string) => {
                      if (keyHint && liveVariableKeys.has(keyHint)) return;
                      if (obj == null || depth > 7) return;
                      if (Array.isArray(obj)) { obj.forEach((item) => inspect(item, depth + 1)); return; }
                      if (typeof obj !== "object") return;
                      if (seen.has(obj)) return;
                      seen.add(obj);

                      const id = obj.id ?? obj.service_id ?? obj.serviceId ?? obj.uuid;
                      const label = obj.name ?? obj.title ?? obj.label ?? obj.description;
                      if ((typeof id === "string" || typeof id === "number") && typeof label === "string") {
                        const score = scoreLabel(label);
                        if (score > (best?.score || 0)) best = { id, score, label };
                      }
                      Object.entries(obj).forEach(([childKey, value]) => inspect(value, depth + 1, childKey));
                    };
                    inspect(variables);
                    const match = best as { id: string | number; score: number; label: string } | null;
                    if (match && match.score >= 3) {
                      console.log(`[node:http-request][dynamic] path param "${paramName}" inferido por contexto: ${match.label}`);
                      return match.id;
                    }
                    return undefined;
                  };

                  let url = replaceVars(String(ep.url || ""));

                  // Path params: substitui {name} e :name pelos valores do agente (se permitido) ou variáveis do fluxo.
                  // Decodifica `%3A` / `%7B` / `%7D` que podem ter vindo de new URL().toString()
                  url = url
                    .replace(/%3A([a-zA-Z0-9_]+)/gi, ":$1")
                    .replace(/%7B/gi, "{")
                    .replace(/%7D/gi, "}");
                  const rawNames = [
                    ...(ep.pathParams || []),
                    ...(ep.argsSchema?.pathParams || []).map((p: any) => p?.name).filter(Boolean),
                    ...[...url.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]),
                    ...[...url.matchAll(/(?<=\/):([a-zA-Z0-9_]+)/g)].map((m) => m[1]),
                  ];
                  // Filtra nomes inválidos que sobraram de configs antigas (ex.: "%3Aid").
                  const pathNames = new Set<string>(
                    rawNames
                      .map((n: string) => String(n).replace(/^%3A/i, "").replace(/^:/, ""))
                      .filter((n: string) => /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(n))
                  );
                  pathNames.forEach((p) => {
                    const fromAgent = perms.pathParams === false ? undefined : pickAgentValue(p);
                    const agentValueLooksLikeId = fromAgent === undefined
                      || typeof fromAgent === "number"
                      || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(fromAgent))
                      || /^[a-zA-Z0-9_-]{12,}$/.test(String(fromAgent));
                    const inferred = (fromAgent === undefined || !agentValueLooksLikeId) ? inferIdFromKnownLists(p) : undefined;
                    const v = inferred !== undefined
                      ? inferred
                      : fromAgent !== undefined
                        ? fromAgent
                        : variables[p];
                    if (v !== undefined && v !== null && v !== "") {
                      const enc = encodeURIComponent(String(v));
                      url = url
                        .replace(new RegExp(`\\{${p}\\}`, "g"), enc)
                        .replace(new RegExp(`(?<=/):${p}(?=/|$|\\?)`, "g"), enc);
                    } else {
                      console.warn(`[node:http-request][dynamic] path param "${p}" sem valor — URL ficará com placeholder`);
                    }
                  });

                  // Se ainda restou placeholder (ex.: /:algo/ ou /{algo}/ ou /%3Aalgo/),
                  // aborta a chamada — evita 500 no servidor por causa de placeholder literal.
                  if (/\/(?::[a-zA-Z0-9_]+|\{[^}]+\}|%3A[a-zA-Z0-9_]+)(?=\/|$|\?)/i.test(url)) {
                    console.warn(`[node:http-request][dynamic] URL ainda contém placeholder não resolvido — chamada abortada: ${url}`);
                    lastOk = false;
                    lastData = {
                      ok: false,
                      error: "missing_path_param",
                      message: "Endpoint não executado porque faltou valor para um parâmetro da URL.",
                      url,
                    };
                    variables.httpResponse = lastData;
                    continue;
                  }

                  const qp: string[] = [];
                  const usedQuery = new Set<string>();
                  (ep.queryParams || []).forEach((p: any) => {
                    if (!p?.name) return;
                    const fromAgent = perms.queryParams === false ? undefined : agentQuery[p.name] ?? (p.name in agentArgs ? agentArgs[p.name] : undefined);
                    const val = fromAgent !== undefined ? String(fromAgent) : replaceVars(String(p.value ?? ""));
                    qp.push(`${encodeURIComponent(p.name)}=${encodeURIComponent(val)}`);
                    usedQuery.add(p.name);
                  });
                  // Query params extras do agente (declarados no argsSchema mas ausentes na config).
                  if (perms.queryParams !== false) {
                    Object.entries(agentQuery).forEach(([k, v]) => {
                      if (usedQuery.has(k) || v === undefined || v === null) return;
                      qp.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
                    });
                  }
                  if (qp.length) url += (url.includes("?") ? "&" : "?") + qp.join("&");

                  const headers: Record<string, string> = {};
                  (ep.headers || []).forEach((h: any) => {
                    if (h?.name) headers[h.name] = replaceVars(String(h.value ?? ""));
                  });
                  const epAuth = ep.auth || {};
                  if (epAuth.type === "bearer" && epAuth.token) {
                    headers["Authorization"] = `Bearer ${replaceVars(String(epAuth.token))}`;
                  } else if (epAuth.type === "basic" && epAuth.username) {
                    headers["Authorization"] = "Basic " + btoa(`${replaceVars(epAuth.username)}:${replaceVars(epAuth.password || "")}`);
                  } else if (epAuth.type === "apiKey" && epAuth.name) {
                    if ((epAuth.location || "header") === "header") headers[epAuth.name] = replaceVars(String(epAuth.value || ""));
                    else url += (url.includes("?") ? "&" : "?") + `${encodeURIComponent(epAuth.name)}=${encodeURIComponent(replaceVars(String(epAuth.value || "")))}`;
                  }

                  let body: string | undefined;
                  if (!["GET", "HEAD"].includes(method)) {
                    // Body do agente tem prioridade (se permitido). Aceita objeto ou string JSON.
                    const canAgentBody = perms.body !== false;
                    if (canAgentBody && agentBody !== undefined && agentBody !== null && agentBody !== "") {
                      body = typeof agentBody === "string" ? replaceVars(agentBody) : JSON.stringify(agentBody);
                      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
                    } else if (ep.body) {
                      body = replaceVars(String(ep.body));
                      if (ep.bodyContentType === "json" && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
                      if (ep.bodyContentType === "form-urlencoded" && !headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
                    }
                  }

                  if (!url) {
                    console.warn(`[node:http-request][dynamic] endpoint ${ep.id} sem URL — pulando`);
                    lastOk = false;
                    continue;
                  }

                  console.log(`[node:http-request][dynamic] ${method} ${url}`, { dispatched: isDispatched, agentArgs });
                  const res = await fetch(url, { method, headers, body });
                  const text = await res.text();
                  let data: any; try { data = JSON.parse(text); } catch { data = text; }
                  lastOk = res.ok;
                  lastData = data;
                  console.log(`[node:http-request][dynamic] ${ep.id} → status ${res.status}`);


                  // salva resposta completa em variável baseada no nome/id da skill
                  const varBase = String(ep.name || ep.id || "endpoint")
                    .replace(/[^a-zA-Z0-9_]/g, "_")
                    .replace(/_+/g, "_")
                    .replace(/^_|_$/g, "") || "endpoint";
                  variables[varBase] = data;
                  variables["httpResponse"] = data; // compat com nodes que leem httpResponse
                  const mappedKeys = applyMappings(data, ep.responseMappings || []);
                  if (ep.resultType === "live") {
                    const liveKeys = new Set(
                      Array.isArray((variables as any).__liveVariableKeys)
                        ? (variables as any).__liveVariableKeys.map((key: unknown) => String(key))
                        : []
                    );
                    liveKeys.add(varBase);
                    liveKeys.add("httpResponse");
                    mappedKeys.forEach((key) => liveKeys.add(key));
                    (variables as any).__liveVariableKeys = Array.from(liveKeys);
                  }
                }

                const handle = lastOk ? "success" : "error";
                const branchNext = nextFromNodeIn(node.id, container.id, containers, edgesList, handle, true);
                if (branchNext) { currentNodeId = branchNext; continue; }
              }
            } else {
              // ---------- MODO GENÉRICO (legado) ----------
              const method = String(cfg.method || "GET").toUpperCase();
              let url = replaceVars(String(cfg.url || ""));

              const qp: string[] = [];
              (Array.isArray(cfg.queryParams) ? cfg.queryParams : []).forEach((p: any) => {
                const key = p?.name || p?.key;
                if (key) qp.push(`${encodeURIComponent(key)}=${encodeURIComponent(replaceVars(String(p.value ?? "")))}`);
              });
              if (qp.length) url += (url.includes("?") ? "&" : "?") + qp.join("&");

              const headers: Record<string, string> = {};
              (Array.isArray(cfg.headers) ? cfg.headers : []).forEach((h: any) => {
                const key = h?.name || h?.key;
                if (key) headers[key] = replaceVars(String(h.value ?? ""));
              });

              const auth = cfg.authCredentials || {};
              if (cfg.authType === "basic" && auth.username) {
                headers["Authorization"] = "Basic " + btoa(`${replaceVars(auth.username || "")}:${replaceVars(auth.password || "")}`);
              } else if (cfg.authType === "bearer" && auth.token) {
                headers["Authorization"] = `Bearer ${replaceVars(auth.token)}`;
              } else if (cfg.authType === "apiKey" && auth.apiKeyName) {
                if ((auth.apiKeyLocation || "header") === "header") {
                  headers[auth.apiKeyName] = replaceVars(auth.apiKeyValue || "");
                } else {
                  url += (url.includes("?") ? "&" : "?") + `${encodeURIComponent(auth.apiKeyName)}=${encodeURIComponent(replaceVars(auth.apiKeyValue || ""))}`;
                }
              } else if (cfg.authType === "customHeader" && auth.headerName) {
                headers[auth.headerName] = replaceVars(auth.headerValue || "");
              }

              let body: string | undefined;
              if (["POST", "PUT", "PATCH", "DELETE"].includes(method) && cfg.sendBody !== false) {
                const bct = cfg.bodyContentType || "json";
                if (bct === "json") {
                  body = replaceVars(String(cfg.bodyJson || "{}"));
                  if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
                } else if (bct === "form-urlencoded") {
                  const params = new URLSearchParams();
                  (cfg.bodyParams || []).forEach((p: any) => {
                    const k = p?.name || p?.key;
                    if (k) params.append(k, replaceVars(String(p.value ?? "")));
                  });
                  body = params.toString();
                  if (!headers["Content-Type"]) headers["Content-Type"] = "application/x-www-form-urlencoded";
                } else {
                  body = replaceVars(String(cfg.bodyRaw || ""));
                }
              }

              console.log(`[node:http-request] ${method} ${url}`);
              const res = await fetch(url, { method, headers, body });
              const responseText = await res.text();
              let responseData: any;
              try { responseData = JSON.parse(responseText); } catch { responseData = responseText; }

              const varName = (cfg.responseVariable || "httpResponse").trim();
              if (varName) {
                variables[varName] = responseData;
                console.log(`[node:http-request] saved response in "${varName}"`);
              }
              applyMappings(responseData, cfg.responseMappings || []);

              const handle = res.ok ? "success" : "error";
              const branchNext = nextFromNodeIn(node.id, container.id, containers, edgesList, handle, true);
              if (branchNext) {
                currentNodeId = branchNext;
                continue;
              }
            }
          } catch (err) {
            console.error("[node:http-request] error", err);
            const branchNext = nextFromNodeIn(node.id, container.id, containers, edgesList, "error", true);
            if (branchNext) { currentNodeId = branchNext; continue; }
          }
        } else if (nodeType === "condition") {
          const conditions: ConditionGroup[] = cfg.conditions || [];
          const matchedCondition = conditions.find((condition) => evaluateCondition(condition, variables, replaceVars));
          const conditionHandle = matchedCondition ? `${node.id}-cond-${matchedCondition.id}` : `${node.id}-else`;
          currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList, conditionHandle, true);
          continue;
        } else if (nodeType === "go-to" && cfg.targetContainerId) {
          console.log(`[node:go-to] Jumping from node ${node.id} to container: ${cfg.targetContainerId}`);
          const targetNodeId = resolveTargetIn(cfg.targetContainerId, containers);
          if (targetNodeId && targetNodeId !== node.id) {
            currentNodeId = targetNodeId;
            // Crucial: continue inside the while loop so it processes the target node immediately
            continue;
          } else {
            console.warn(`[node:go-to] Target not found or same as current: ${targetNodeId}`);
            // If jump fails, still try to follow normal edges as fallback
          }
        } else if (nodeType === "redirect") {
          const targetRef = cfg.targetFlow || cfg.targetFlowId;
          if (!targetRef) {
            console.warn("[node:redirect] sem targetFlow", node.id);
            currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
            continue;
          }

          const redirectKey = `${node.id}:${targetRef}`;
          if (visitedRedirects.has(redirectKey)) {
            console.warn("[node:redirect] loop detectado no node", node.id);
            nextMessages.push({ 
              id: crypto.randomUUID(), 
              conversation_id: conversationId || "temp",
              role: "assistant",
              type: "bot", 
              content: "⚠️ Loop de redirecionamento detectado.",
              isHtml: false
            } as Message);
            currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
            continue;
          }

          visitedRedirects.add(redirectKey);

          console.log(`[node:redirect] carregando fluxo ${targetRef}`);
          let targetFlow: any = null;
          try {
            // IMPORTANTE: usar o client do sistema (getSupabase), onde os flows
            // realmente vivem. O client de @/integrations/supabase/client aponta
            // para outro projeto e por isso retornava "não encontrado".
            const sysSupabase = getSupabase();
            const { data: byId } = await sysSupabase
              .from("chatbot_flows")
              .select("*")
              .eq("id", targetRef)
              .maybeSingle();
            targetFlow = byId;
            if (!targetFlow) {
              const { data: byPublic } = await sysSupabase
                .from("chatbot_flows")
                .select("*")
                .eq("public_id", targetRef)
                .maybeSingle();
              targetFlow = byPublic;
            }
          } catch (e) {
            console.error("[node:redirect] erro ao carregar fluxo", e);
          }

          if (!targetFlow) {
            nextMessages.push({ 
              id: crypto.randomUUID(), 
              conversation_id: conversationId || "temp",
              role: "assistant",
              type: "bot", 
              content: "⚠️ Fluxo de destino não encontrado.",
              isHtml: false
            } as Message);
            currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
            continue;
          }

          const newContainers = targetFlow.published_containers || targetFlow.draft_containers || [];
          const newEdges = targetFlow.published_edges || targetFlow.draft_edges || [];
          
          if (!newContainers.length) {
             nextMessages.push({ 
              id: crypto.randomUUID(), 
              conversation_id: conversationId || "temp",
              role: "assistant",
              type: "bot", 
              content: "⚠️ Fluxo de destino vazio.",
              isHtml: false
            } as Message);
            currentNodeId = nextFromNodeIn(node.id, container.id, containers, edgesList);
            continue;
          }

          // Recursively execute the new flow
          const redirectResult = await runLocalFlow(
            { 
              mode: "flow",
              current_node_id: cfg.startNodeId || null,
              active_agent_node_id: null,
              variables,
              message_history: messageHistory,
              persistent_memory: persistentMemory,
              visitor_id: visitorId,
              conversation_id: conversationId,
              waiting_for_input: false
            },
            undefined,
            newContainers,
            newEdges,
            visitedRedirects
          );

          nextMessages.push(...(redirectResult.messages as Message[]));
          if (redirectResult.buttons?.length) nextButtons = redirectResult.buttons;
          if (redirectResult.waiting_for) {
            waitingFor = redirectResult.waiting_for;
            waitingForCfg = redirectResult.waiting_for_config;
            status = "waiting_input";
          }
          
          return {
            ...redirectResult,
            messages: nextMessages,
            runtime_state: {
              ...redirectResult.runtime_state,
              variables: { ...variables, ...redirectResult.runtime_state.variables }
            }
          };
        }

        // Only reach here if we didn't 'continue' or 'break' above
        const nextId = nextFromNodeIn(node.id, container.id, containers, edgesList);
        console.log(`[node:completed] ${node.id} → next: ${nextId}`);
        currentNodeId = nextId;
      }

      if (!currentNodeId && status === "running") status = "completed";

      return { 
        messages: nextMessages, 
        wait_ms: waitMs, 
        waiting_for: waitingFor, 
        waiting_for_config: waitingForCfg, 
        buttons: nextButtons, 
        runtime_state: { 
          mode,
          current_node_id: currentNodeId, 
          active_agent_node_id: activeAgentNodeId,
          conversation_id: conversationId,
          visitor_id: visitorId,
          message_history: messageHistory,
          persistent_memory: persistentMemory,
          variables, 
          waiting_for_input: status === "waiting_input",
          last_execution_status: status
        } 
      };
    };



  useEffect(() => {
    if (!isOpen || !flowId) {
      clearWaitTimer();
      hasStartedRef.current = false;
      runtimeStateRef.current = null;
      startedFlowRef.current = null;
      lastStartNodeIdRef.current = null;
      return;
    }

    const startNodeId = startContainer?.nodes?.[0]?.id || null;
    
    // Se o container de início mudou, reinicia
    if (hasStartedRef.current && startedFlowRef.current === flowId && lastStartNodeIdRef.current === startNodeId) {
      return;
    }

    contactIdRef.current = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    runtimeStateRef.current = null;
    hasStartedRef.current = true;
    startedFlowRef.current = flowId;
    lastStartNodeIdRef.current = startNodeId;
    startRuntimeSession();
  }, [isOpen, flowId, startContainer?.id]);

  useEffect(() => {
    return () => clearWaitTimer();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const clearWaitTimer = () => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  };

  const scheduleRuntimeContinue = (waitMs: unknown) => {
    const delay = Number(waitMs);
    if (!Number.isFinite(delay) || delay <= 0) return false;
    clearWaitTimer();
    waitTimerRef.current = window.setTimeout(() => {
      waitTimerRef.current = null;
      continueRuntime();
    }, delay);
    return true;
  };

  const applyRuntimeData = (data: any, replaceMessages = false) => {
    const incomingState = data.runtime_state || runtimeStateRef.current;
    const waitMs = Number(data.wait_ms);
    const hasActiveWait = Number.isFinite(waitMs) && waitMs > 0;
    runtimeStateRef.current = incomingState;
    if (replaceMessages) setMessages(data.messages || []);
    else if (!hasActiveWait || (data.messages || []).length > 0) setMessages(prev => [...prev, ...(data.messages || [])]);
    setWaitingForInput(!!data.waiting_for && data.waiting_for !== "buttons");
    setWaitingForType(data.waiting_for);
    setWaitingForConfig(data.waiting_for_config || null);
    setWaitingForButton(data.waiting_for === "buttons");
    setActiveButtons(data.buttons || []);
    return scheduleRuntimeContinue(data.wait_ms);
  };

  const startRuntimeSession = async () => {
    setIsLoading(true);
    setMessages([]);
    const data = await runLocalFlow(null);
    applyRuntimeData(data, true);
    if (!waitTimerRef.current) setIsLoading(false);
  };

  const continueRuntime = async () => {
    setIsLoading(true);
    const data = await runLocalFlow(runtimeStateRef.current);
    applyRuntimeData(data);
    if (!waitTimerRef.current) setIsLoading(false);
  };


  const sendMessage = async (message?: string, buttonId?: string, fileData?: { type: 'image' | 'video' | 'audio' | 'file', url: string, file?: File }) => {
    const msgToSend = message || currentInput || fileData?.url;
    if (!msgToSend && !buttonId && !fileData) return;

    if (!buttonId && !fileData && waitingForType && msgToSend) {
      const handleError = (errorContent: string) => {
        const userMsg: Message = { 
          id: `u-${Date.now()}`, 
          conversation_id: runtimeStateRef.current?.conversation_id || "temp",
          role: "user",
          type: "user", 
          content: msgToSend 
        };
        const errorMsgObj: Message = { 
          id: `b-err-${Date.now()}`, 
          conversation_id: runtimeStateRef.current?.conversation_id || "temp",
          role: "assistant",
          type: "bot", 
          content: errorContent
        };
        setMessages(prev => [...prev, userMsg, errorMsgObj]);
        setCurrentInput("");
        setIsLoading(false);
      };

      if (waitingForType === "input-mail") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(msgToSend)) {
          handleError(waitingForConfig?.invalidMessage || "Por favor, insira um e-mail válido.");
          return;
        }
      } else if (waitingForType === "input-webSite") {
        try {
          new URL(msgToSend.startsWith('http') ? msgToSend : `https://${msgToSend}`);
        } catch (e) {
          handleError(waitingForConfig?.invalidMessage || "Por favor, insira um link válido.");
          return;
        }
      } else if (waitingForType === "input-number") {
        const num = Number(msgToSend);
        if (isNaN(num)) {
          handleError(waitingForConfig?.invalidMessage || "Por favor, insira um número válido.");
          return;
        }
        if (waitingForConfig?.min !== undefined && num < waitingForConfig.min) {
          handleError(waitingForConfig?.invalidMessage || `O valor mínimo é ${waitingForConfig.min}.`);
          return;
        }
        if (waitingForConfig?.max !== undefined && num > waitingForConfig.max) {
          handleError(waitingForConfig?.invalidMessage || `O valor máximo é ${waitingForConfig.max}.`);
          return;
        }
      }
    }

    if (msgToSend || fileData) {
      const userMsg: Message = { 
        id: `u-${Date.now()}`, 
        conversation_id: runtimeStateRef.current?.conversation_id || "temp",
        role: "user",
        type: "user", 
        content: msgToSend || "",
        isImage: fileData?.type === 'image',
        isVideo: fileData?.type === 'video',
        isAudio: fileData?.type === 'audio',
        isFile: fileData?.type === 'file'
      };
      setMessages(prev => [...prev, userMsg]);
    }

    setIsLoading(true);
    setCurrentInput("");

    const currentState = runtimeStateRef.current;
    
    // Prepare input for input-universal if needed
    let inputPayload: any = { message: msgToSend, button_id: buttonId };
    if (fileData) {
      const typeMap: any = { image: 'imageInput', video: 'videoInput', audio: 'audioInput', file: 'documentInput' };
      inputPayload = {
        ...inputPayload,
        type: typeMap[fileData.type] || 'textInput',
        url: fileData.url,
        fileName: fileData.file?.name,
        mimetype: fileData.file?.type
      };
      
      // If we have a file, let's get base64 if needed (local test only)
      if (fileData.file) {
        const reader = new FileReader();
        inputPayload.base64 = await new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(fileData.file!);
        });
      }
    } else if (waitingForType === 'input-universal') {
      inputPayload.type = 'textInput';
    }

    const data = await runLocalFlow(currentState, inputPayload);
    
    applyRuntimeData(data);
    setIsLoading(false);
  };

  const handleButtonClick = (button: ButtonConfig) => sendMessage(undefined, button.id);
  const handleSendMessage = () => sendMessage();

  if (!isOpen) return null;

  const themeStyle: React.CSSProperties = {};
  if (theme?.primaryColor) {
    (themeStyle as any)["--bot-flow"] = theme.primaryColor;
  }
  
  if (theme?.userBubbleColor) (themeStyle as any)["--user-msg-bg"] = theme.userBubbleColor;
  else if (theme?.primaryColor) (themeStyle as any)["--user-msg-bg"] = theme.primaryColor;

  if (theme?.userTextColor) (themeStyle as any)["--user-msg-fg"] = theme.userTextColor;
  else (themeStyle as any)["--user-msg-fg"] = "#ffffff";

  if (theme?.botBubbleColor) (themeStyle as any)["--bot-msg-bg"] = theme.botBubbleColor;
  else (themeStyle as any)["--bot-msg-bg"] = "hsl(var(--muted))";

  if (theme?.botTextColor) (themeStyle as any)["--bot-msg-fg"] = theme.botTextColor;
  else (themeStyle as any)["--bot-msg-fg"] = "hsl(var(--foreground))";

  if (theme?.backgroundColor) themeStyle.backgroundColor = theme.backgroundColor;
  
  if (theme?.backgroundImage) {
    themeStyle.backgroundImage = `url(${theme.backgroundImage})`;
    themeStyle.backgroundSize = 'cover';
    themeStyle.backgroundPosition = 'center';
    themeStyle.backgroundRepeat = 'no-repeat';
  }

  if (theme?.textColor) themeStyle.color = theme.textColor;
  if (theme?.fontFamily) themeStyle.fontFamily = theme.fontFamily;

  const containerClass = fullScreen
    ? "absolute inset-0 h-full w-full bg-card flex flex-col z-50"
    : "w-80 absolute top-0 right-0 h-full bg-card border-l border-border shadow-2xl flex flex-col z-50";

  return (
    <aside className={containerClass} style={themeStyle}>
      {isCapturing && (
        <div className="absolute inset-0 z-[60] bg-black flex flex-col items-center justify-center p-4">
          {(captureType === 'video' || captureType === 'image') && (
            <video 
              ref={captureVideoRef} 
              autoPlay 
              muted 
              playsInline 
              className="w-full max-h-[70%] bg-zinc-900 rounded-lg object-contain mb-4"
            />
          )}
          {captureType === 'audio' && (
            <div className="flex flex-col items-center gap-4 mb-8">
              <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center animate-pulse">
                <Mic className="h-10 w-10 text-red-500" />
              </div>
              <span className="text-white text-2xl font-mono">{formatDuration(recordingDuration)}</span>
              <span className="text-zinc-400 text-sm">Gravando áudio...</span>
            </div>
          )}
          {(captureType === 'video') && (
             <div className="flex flex-col items-center gap-2 mb-4">
               <span className="text-white font-mono">{formatDuration(recordingDuration)}</span>
             </div>
          )}
          <div className="flex gap-4">
            <Button variant="outline" className="rounded-full px-6 border-white text-white hover:bg-white/10" onClick={cancelCapture}>Cancelar</Button>
            <Button variant="destructive" className="rounded-full px-6" onClick={stopCapture}>
              {captureType === 'image' ? 'Tirar Foto' : 'Parar Gravação'}
            </Button>
          </div>
        </div>
      )}
      
      {recordedBlob && (
        <div className="absolute inset-0 z-[60] bg-black/95 flex flex-col items-center justify-center p-4">
           <div className="w-full max-h-[70%] mb-4 overflow-hidden rounded-lg bg-zinc-900 flex items-center justify-center">
             {captureType === 'image' && <img src={URL.createObjectURL(recordedBlob)} className="max-w-full max-h-full object-contain" alt="Preview" />}
             {captureType === 'video' && <video src={URL.createObjectURL(recordedBlob)} controls className="max-w-full max-h-full" />}
             {captureType === 'audio' && (
               <div className="p-8 bg-zinc-800 rounded-lg w-full max-w-xs flex flex-col items-center gap-4">
                 <Mic className="h-12 w-12 text-primary" />
                 <audio src={URL.createObjectURL(recordedBlob)} controls className="w-full" />
               </div>
             )}
           </div>
           <div className="flex gap-4">
             <Button variant="outline" className="rounded-full px-6 border-white text-white hover:bg-white/10" onClick={() => {
               setRecordedBlob(null);
               if (captureType) startCapture(captureType);
             }}>Refazer</Button>
             <Button className="rounded-full px-8" onClick={sendCaptured} style={{ background: theme?.primaryColor }}>Enviar</Button>
           </div>
        </div>
      )}
      <div className="flex flex-col w-full h-full">
        <div className="sticky top-0 z-10 shrink-0 min-h-14 border-b border-border px-3 py-2 flex items-center justify-between"
          style={{ 
            background: theme?.headerBackgroundColor || "bg-gradient-to-r from-primary/20 via-card to-card",
            color: theme?.headerTextColor || "inherit"
          }}>
          <div className="flex items-center gap-3 min-w-0">
            {theme?.avatarUrl ? (
              <img src={theme.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: theme?.headerTextColor || "var(--bot-flow)" }} />
            )}
            <div className="min-w-0">
              <h2 className="font-semibold text-sm truncate" style={{ color: theme?.headerTextColor }}>{headerTitle}</h2>
              {headerSubtitle && <p className="text-[11px] leading-tight truncate opacity-70" style={{ color: theme?.headerTextColor }}>{headerSubtitle}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                runtimeStateRef.current = null;
                startRuntimeSession();
              }} 
              style={{ color: theme?.headerTextColor }}
              title="Reiniciar chat"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {!hideClose && <Button variant="ghost" size="icon" onClick={onClose} style={{ color: theme?.headerTextColor }}><X className="h-5 w-5" /></Button>}
          </div>
        </div>
        <ScrollArea className="flex-1 p-3" ref={scrollRef}>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "bot" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-md text-left ${message.type === "bot" ? "rounded-bl-sm" : "rounded-br-sm"}`}
                  style={message.type === "user" 
                    ? { background: theme?.userBubbleColor || "var(--user-msg-bg)", color: "var(--user-msg-fg)" } 
                    : { background: theme?.botBubbleColor || "var(--bot-msg-bg)", color: "var(--bot-msg-fg)" }}>
                  {message.isImage ? <img src={message.content} alt={message.alt} className="max-w-full rounded" />
                   : message.isVideo ? <video src={message.content} controls className="max-w-full rounded" />
                   : message.isAudio ? <div className="flex items-center gap-2"><Headphones className="h-4 w-4 shrink-0" /><AudioPlayer src={message.content} autoPlay={message.autoplay} /></div>
                   : message.isFile ? <div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0" /><span className="truncate max-w-[180px]">{message.content}</span></div>
                   : message.isHtml ? <div className="rich-bubble whitespace-pre-wrap break-words" dangerouslySetInnerHTML={{ __html: message.content }} />
                   : message.type === "bot" ? (
                       <div className="prose prose-sm max-w-none break-words [&>*]:my-1 [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0" style={{ color: "inherit" }}>
                         <ReactMarkdown 
                           remarkPlugins={[remarkGfm]}
                           components={{
                              strong: ({node, ...props}) => <strong className="font-bold text-inherit" {...props} />,
                           }}
                         >
                            {normalizeMarkdown(message.content)}
                         </ReactMarkdown>
                       </div>
                     )
                   : <div className="whitespace-pre-wrap break-words">{renderTextSegments(message.content)}</div>}
                </div>
              </div>
            ))}
            {isLoading && <div className="flex justify-start"><div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-sm"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div></div>}
          </div>
        </ScrollArea>
        {waitingForButton && activeButtons.length > 0 && (
          <div className="p-3 border-t border-border space-y-2 bg-card">
            <div className="flex flex-wrap gap-2">
              {activeButtons.map((btn) => (
                <Button key={btn.id} variant="outline" size="sm" onClick={() => handleButtonClick(btn)} disabled={isLoading}>
                  {btn.label}
                </Button>
              ))}
            </div>
          </div>
        )}
        {waitingForInput && (
          <div className="p-3 border-t border-border flex flex-col gap-2" style={{ background: theme?.inputBackgroundColor }}>
            {!waitingForButton && (
              <div className="flex flex-col gap-2">
                {waitingForType === "input-universal" ? (
                  <div className="flex flex-col gap-2">
                    <div className="flex items-end gap-2">
                      <div className="relative">
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon" 
                          className="rounded-full shrink-0 hover:bg-muted"
                          disabled={isLoading}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAttachMenuOpen((v) => !v);
                          }}
                        >
                          <Paperclip className="h-5 w-5 text-muted-foreground" />
                        </Button>
                        {attachMenuOpen && (
                          <>
                            <div
                              className="fixed inset-0 z-[9998]"
                              onClick={() => setAttachMenuOpen(false)}
                            />
                            <div className="absolute bottom-full mb-2 left-0 w-48 p-2 z-[9999] bg-popover border border-border shadow-xl rounded-xl">
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const url = URL.createObjectURL(file);
                                      sendMessage(undefined, undefined, { type: 'image', url, file });
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                                  <ImageIcon className="h-4 w-4" />
                                </div>
                                <span>Imagem</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'video/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const url = URL.createObjectURL(file);
                                      sendMessage(undefined, undefined, { type: 'video', url, file });
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                  <Video className="h-4 w-4" />
                                </div>
                                <span>Vídeo</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'audio/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const url = URL.createObjectURL(file);
                                      sendMessage(undefined, undefined, { type: 'audio', url, file });
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600">
                                  <Mic className="h-4 w-4" />
                                </div>
                                <span>Áudio</span>
                              </button>
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = '*/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) {
                                      const url = URL.createObjectURL(file);
                                      sendMessage(undefined, undefined, { type: 'file', url, file });
                                    }
                                  };
                                  input.click();
                                }}
                              >
                                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600">
                                  <FileText className="h-4 w-4" />
                                </div>
                                <span>Documento</span>
                              </button>
                              <div className="border-t my-1" />
                              <button
                                type="button"
                                className="w-full flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-muted text-left text-sm text-primary"
                                onClick={() => {
                                  setAttachMenuOpen(false);
                                  startCapture('image');
                                }}
                              >
                                <Camera className="h-4 w-4" />
                                <span>Câmera (Foto)</span>
                              </button>
                            </div>
                          </>
                        )}
                      </div>


                      <Textarea
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={waitingForConfig?.placeholder || "Digite sua mensagem..."}
                        rows={1}
                        className="flex-1 min-w-0 resize-none min-h-[40px] max-h-[160px] rounded-2xl bg-muted/50 border-none focus-visible:ring-1"
                        style={{ color: theme?.inputTextColor || "inherit" }}
                        disabled={isLoading}
                      />
                      
                      <Button 
                        size="icon" 
                        onClick={handleSendMessage} 
                        disabled={isLoading || !currentInput.trim()}
                        className="rounded-full shrink-0"
                        style={{ background: theme?.primaryColor, color: "#ffffff" }}
                      >
                        <Send className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : waitingForType === "input-image" || waitingForType === "input-video" || waitingForType === "input-audio" || waitingForType === "input-file" ? (
                  <div className="flex flex-wrap gap-2 justify-center py-2">
                    <input 
                      type="file" 
                      id="file-upload" 
                      className="hidden" 
                      accept={
                        waitingForType === "input-image" ? "image/*" : 
                        waitingForType === "input-video" ? "video/*" : 
                        waitingForType === "input-audio" ? "audio/*" : "*"
                      }
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const url = URL.createObjectURL(file);
                          const type = waitingForType.replace('input-', '') as any;
                          sendMessage(undefined, undefined, { type, url, file });
                        }
                      }}
                    />
                    <Button 
                      variant="outline" 
                      className="flex-1 gap-2 rounded-full" 
                      onClick={() => document.getElementById('file-upload')?.click()}
                      disabled={isLoading}
                    >
                      <Upload className="h-4 w-4" />
                      {waitingForType === "input-image" ? "Enviar Foto" : 
                       waitingForType === "input-video" ? "Enviar Vídeo" : 
                       waitingForType === "input-audio" ? "Enviar Áudio" : "Enviar Arquivo"}
                    </Button>
                    {(waitingForType === "input-image" || waitingForType === "input-video" || waitingForType === "input-audio") && (
                      <Button 
                        variant="outline" 
                        className="flex-1 gap-2 rounded-full" 
                        onClick={() => {
                          const type = waitingForType.replace('input-', '') as any;
                          startCapture(type);
                        }}
                        disabled={isLoading}
                      >
                        {waitingForType === "input-image" ? <Camera className="h-4 w-4" /> : 
                         waitingForType === "input-video" ? <Video className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        {waitingForType === "input-image" ? "Tirar Foto" : 
                         waitingForType === "input-video" ? "Gravar Vídeo" : "Gravar Áudio"}
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="flex gap-2 items-end w-full">
                    {waitingForType === "input-number" || waitingForType === "input-mail" || waitingForType === "input-webSite" || waitingForType === "input-phone" ? (
                      <div className="relative flex-1">
                        {waitingForType === "input-phone" && <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />}
                        <Input 
                          value={currentInput} 
                          onChange={(e) => setCurrentInput(e.target.value)} 
                          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} 
                          placeholder={waitingForConfig?.resPonseUserNumber || waitingForConfig?.responseUserTextInput || waitingForConfig?.placeholder || (waitingForType === "input-phone" ? "Seu telefone" : "Digite aqui")}
                          type={waitingForType === "input-number" ? (typeof waitingForConfig?.min === 'number' || typeof waitingForConfig?.max === 'number' ? "number" : "text") : waitingForType === "input-mail" ? "email" : waitingForType === "input-webSite" ? "url" : "tel"}
                          min={waitingForType === "input-number" ? waitingForConfig?.min : undefined}
                          max={waitingForType === "input-number" ? waitingForConfig?.max : undefined}
                          step={waitingForType === "input-number" ? waitingForConfig?.step : undefined}
                          className={`flex-1 min-w-0 rounded-2xl ${waitingForType === "input-phone" ? "pl-9" : ""}`}
                          style={{ background: theme?.inputBackgroundColor ? "rgba(255,255,255,0.1)" : undefined, color: theme?.inputTextColor || "inherit", borderColor: theme?.inputTextColor ? `${theme.inputTextColor}40` : undefined }}
                          disabled={isLoading}
                        />
                      </div>
                    ) : (
                      <Textarea
                        value={currentInput}
                        onChange={(e) => setCurrentInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        placeholder={waitingForConfig?.responseUserTextInput || waitingForConfig?.placeholder || "Digite aqui (Shift+Enter para quebrar linha)"}
                        rows={1}
                        className="flex-1 min-w-0 resize-none min-h-[40px] max-h-[160px] rounded-2xl"
                        style={{ background: theme?.inputBackgroundColor ? "rgba(255,255,255,0.1)" : undefined, color: theme?.inputTextColor || "inherit", borderColor: theme?.inputTextColor ? `${theme.inputTextColor}40` : undefined }}
                        disabled={isLoading}
                      />
                    )}
                    <Button 
                      size="icon" 
                      onClick={handleSendMessage} 
                      disabled={isLoading || !currentInput.trim()}
                      className="rounded-full"
                      style={{ background: theme?.primaryColor, color: "#ffffff" }}
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
