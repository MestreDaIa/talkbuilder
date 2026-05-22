import { useState, useEffect, useRef } from "react";
import { X, Send, Headphones, Play, Pause, FileText, Loader2, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { type Container, type Node, type ButtonConfig, type Edge, type ConditionComparison, type ConditionGroup } from "../../types/chatbot";

interface ResponseMapping {
  jsonPath: string;
  variableName: string;
}

import { ScrollArea } from "../../components/ui/scroll-area";
import { renderTextSegments } from "@/lib/textParser";
import { richHtmlFor, richToPlainText } from "@/lib/richText";

import { type Message as RuntimeMessage, type RuntimeState, type RuntimeMode, type PersistentMemory, type NodeExecutionStatus } from "../../types/runtime";
import { conversationService } from "../../services/conversationService";
import { buildAgentContext } from "../../services/aiContextBuilder";
import { supabase } from "@/integrations/supabase/client";
import { getSupabase } from "@/lib/supabaseClient";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const runtimeStateRef = useRef<RuntimeState | null>(null);
  const hasStartedRef = useRef(false);
  const startedFlowRef = useRef<string | null>(null);
  const lastStartNodeIdRef = useRef<string | null>(null);
  const waitTimerRef = useRef<number | null>(null);

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
    return key ? variables[key] : undefined;
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

    const runLocalFlow = async (
      state: RuntimeState | null, 
      input?: { message?: string; button_id?: string },
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
      const persistentMemory: PersistentMemory = { ...(state?.persistent_memory || {}) };
      const messageHistory: RuntimeMessage[] = [...(state?.message_history || [])];
      const nextMessages: Message[] = [];
      
      let waitingFor: string | null = null;
      let waitingForCfg: any = null;
      let nextButtons: ButtonConfig[] = [];
      let waitMs = 0;
      let steps = 0;
      let status: NodeExecutionStatus = "running";

      const firstText = (...values: any[]) => String(values.find((v) => typeof v === "string" && v.trim()) || "");
      const cleanText = (text: string) => richToPlainText(text);
      const replaceVars = (text: string) => cleanText(text).replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] ?? `{{${key}}}`);

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
            if (varName && userValue !== undefined) variables[varName] = userValue;
            
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
            waitingFor = nodeType === "input-buttons" ? "buttons" : "text";
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
              nextMessages.push({ ...botMsg, type: "bot", content: aiReply, isHtml: true } as Message);
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
                    messages: [{ role: "system", content: system }, ...contextMessages],
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
                    contents: contextMessages.map(m => ({
                      role: m.role === "assistant" ? "model" : "user",
                      parts: [{ text: m.content }]
                    }))
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
                }
              }
            } catch (e) {
              console.error("[agent-node] AI call failed", e);
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
            nextMessages.push({ ...botMsg, type: "bot", content: aiReply, isHtml: true } as Message);
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
          variables[cfg.variableName] = replaceVars(String(cfg.value || ""));
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


  const sendMessage = async (message?: string, buttonId?: string) => {
    const msgToSend = message || currentInput;
    if (!msgToSend && !buttonId) return;

    if (!buttonId && waitingForType && msgToSend) {
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


    if (msgToSend) {
      setMessages(prev => [...prev, { 
        id: `u-${Date.now()}`, 
        conversation_id: runtimeStateRef.current?.conversation_id || "temp",
        role: "user",
        type: "user", 
        content: msgToSend 
      }]);
    }

    setIsLoading(true);
    setCurrentInput("");

    const currentState = runtimeStateRef.current;
    const data = await runLocalFlow(currentState, { message: msgToSend, button_id: buttonId });
    
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
                         <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
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
          <div className="p-3 border-t border-border flex gap-2" style={{ background: theme?.inputBackgroundColor }}>
            {!waitingForButton && (
              <div className="flex flex-1 gap-2 items-end">
                {waitingForType === "input-number" || waitingForType === "input-mail" || waitingForType === "input-webSite" ? (
                  <Input 
                    value={currentInput} 
                    onChange={(e) => setCurrentInput(e.target.value)} 
                    onKeyPress={(e) => e.key === "Enter" && handleSendMessage()} 
                    placeholder={waitingForConfig?.resPonseUserNumber || waitingForConfig?.responseUserTextInput || waitingForConfig?.placeholder || "Digite aqui"}
                    type={waitingForType === "input-number" ? (typeof waitingForConfig?.min === 'number' || typeof waitingForConfig?.max === 'number' ? "number" : "text") : waitingForType === "input-mail" ? "email" : "url"}
                    min={waitingForType === "input-number" ? waitingForConfig?.min : undefined}
                    max={waitingForType === "input-number" ? waitingForConfig?.max : undefined}
                    step={waitingForType === "input-number" ? waitingForConfig?.step : undefined}
                    className="flex-1 min-w-0"
                    style={{ background: theme?.inputBackgroundColor ? "rgba(255,255,255,0.1)" : undefined, color: theme?.inputTextColor || "inherit", borderColor: theme?.inputTextColor ? `${theme.inputTextColor}40` : undefined }}
                    disabled={isLoading}
                  />
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
                    className="flex-1 min-w-0 resize-none min-h-[40px] max-h-[160px]"
                    style={{ background: theme?.inputBackgroundColor ? "rgba(255,255,255,0.1)" : undefined, color: theme?.inputTextColor || "inherit", borderColor: theme?.inputTextColor ? `${theme.inputTextColor}40` : undefined }}
                    disabled={isLoading}
                  />
                )}
                <Button 
                  size="icon" 
                  onClick={handleSendMessage} 
                  disabled={isLoading || !currentInput.trim()}
                  style={{ background: theme?.primaryColor, color: "#ffffff" }}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
