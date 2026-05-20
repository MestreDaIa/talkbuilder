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

import { type Message as RuntimeMessage, type RuntimeState, type RuntimeMode, type PersistentMemory } from "../../types/runtime";
import { conversationService } from "../../services/conversationService";
import { buildAgentContext } from "../../services/aiContextBuilder";

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

  const findNode = (nodeId: string | null) => {
    if (!nodeId) return null;
    for (const container of allContainers) {
      const node = container.nodes.find((n) => n.id === nodeId);
      if (node) return { node, container };
    }
    return null;
  };

  const resolveTarget = (target: string): string | null => {
    if (!target) return null;
    if (findNode(target)) return target;
    const first = firstNodeOfContainer(target);
    if (first) return first;
    return null;
  };

  const nextFromNode = (nodeId: string, containerId: string, handle?: string | null, strictHandle = false): string | null => {
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
    const validEdges = edges.filter((e) => resolveTarget(e.target) !== null);
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
    if (edge) return resolveTarget(edge.target);

    const containerEdge = validEdges.find((e) => e.source === containerId && !e.sourceHandle);
    if (containerEdge) return resolveTarget(containerEdge.target);
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

    const runLocalFlow = async (state: RuntimeState | null, input?: { message?: string; button_id?: string }) => {
    let mode: RuntimeMode = state?.mode || "flow";
    let currentNodeId = state?.current_node_id || startContainer?.nodes?.[0]?.id || null;
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

    const firstText = (...values: any[]) => String(values.find((v) => typeof v === "string" && v.trim()) || "");
    const cleanText = (text: string) => richToPlainText(text);
    const replaceVars = (text: string) => cleanText(text).replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] ?? `{{${key}}}`);

    const parseWaitMs = (cfg: any) => {
      const amount = Math.max(1, Number(cfg.waitTime ?? cfg.duration ?? cfg.seconds ?? 5) || 5);
      const unit = String(cfg.timeUnit ?? cfg.unit ?? "seconds").toLowerCase();
      return amount * (unit.startsWith("hour") || unit.startsWith("hora") ? 3600000 : unit.startsWith("minute") || unit.startsWith("minuto") ? 60000 : 1000);
    };

    const evaluateSetVariableValue = (cfg: any, vars: Record<string, any>): any => {
      const valueType = String(cfg.valueType || "custom").toLowerCase();
      const raw = cfg.value ?? "";
      if (valueType === "empty") return "";
      const code = String(raw);
      const interpolated = code.replace(/{{\s*(.*?)\s*}}/g, (_, key) => {
        const v = vars[String(key).trim()];
        return JSON.stringify(v == null ? "" : v);
      });
      try {
        const hasReturn = /\breturn\b/.test(interpolated);
        const body = hasReturn ? interpolated : `return (${interpolated});`;
        const fn = new Function(`"use strict"; ${body}`);
        const result = fn();
        return result;
      } catch (err) {
        console.warn("[set-variable] eval failed, using raw value:", err);
        if (valueType === "custom") return replaceVars(code);
        return code;
      }
    };

    // Identificação de usuário e conversa (Visitor ID persistente)

    let visitorId = state?.visitor_id || localStorage.getItem("chat_visitor_id");
    if (!visitorId) {
      visitorId = `v-${Math.random().toString(36).slice(2, 11)}`;
      localStorage.setItem("chat_visitor_id", visitorId);
    }

    let conversationId = state?.conversation_id || null;
    if (!conversationId && flowId) {
      const conv = await conversationService.getOrCreateConversation(visitorId, flowId, "default-workspace");
      conversationId = conv.id;
      
      // Se não temos um estado anterior (início de sessão), mas encontramos uma conversa no banco,
      // retomamos o modo, o nó ativo e a memória persistente.
      if (!state) {
        mode = conv.runtime_mode || "flow";
        currentNodeId = conv.active_node_id || currentNodeId;
        Object.assign(persistentMemory, conv.memory || {});
        console.log("[Runtime] Sessão retomada do banco:", { mode, currentNodeId, memory: persistentMemory });
      }
    }

    // Lógica de Entrada de Usuário
    if (input && (state?.waiting_for_input || mode === "agent")) {
      const value = input.message ?? input.button_id;
      if (value !== undefined) {
        variables["last_message"] = value;
        console.log("[Runtime] Entrada recebida:", { value, mode, activeAgentNodeId });
        
        // Salvar mensagem do usuário no histórico e banco
        const userMsg: RuntimeMessage = {
          id: crypto.randomUUID(),
          conversation_id: conversationId || "temp",
          role: "user",
          content: String(value),
          created_at: new Date().toISOString()
        };
        messageHistory.push(userMsg);
        if (conversationId) conversationService.saveMessage(userMsg);

        if (mode === "agent" && activeAgentNodeId) {
          console.log("[Runtime] Mantendo modo AGENTE no nó:", activeAgentNodeId);
          currentNodeId = activeAgentNodeId;
        } else if (currentNodeId) {
          const current = findNode(currentNodeId);
          if (current) {
            console.log("[Runtime] Processando entrada no nó FLOW:", current.node.id);
            const varName = current.node.config?.variableName || current.node.config?.saveVariable;
            if (varName) {
              variables[varName] = value;
              console.log(`[Runtime] Variável salva: ${varName} =`, value);
            }
            
            const currentType = String(current.node.type || "").toLowerCase();
            if (currentType === "ai-agent") {
              mode = "agent";
              activeAgentNodeId = current.node.id;
              console.log("[Runtime] Transição para modo AGENTE ativada");
            } else if (currentType === "ai-node") {
              currentNodeId = current.node.id;
            } else {
              const nextId = nextFromNode(current.node.id, current.container.id, input.button_id);
              console.log("[Runtime] Avançando FLOW para:", nextId);
              currentNodeId = nextId;
            }
          }
        }
      }
    }

    console.log("[Runtime] Iniciando execução", { 
      startNodeId: currentNodeId, 
      mode,
      activeAgentNodeId,
      hasInput: !!input 
    });


    while (currentNodeId && steps++ < 100) {
      const found = findNode(currentNodeId);
      if (!found) {
        console.warn("[Runtime] Nó não encontrado:", currentNodeId);
        currentNodeId = firstNodeOfContainer(currentNodeId);
        if (currentNodeId) continue;
        break;
      }

      const { node, container } = found;
      const cfg = node.config || {};
      const nodeType = String(node.type || "").toLowerCase();
      console.log(`[Runtime] [Node:${nodeType}] Executando: ${node.id}`, {
        container: container.id,
        mode
      });


      if (nodeType === "wait" || nodeType === "await") {
        waitMs = parseWaitMs(cfg);
        currentNodeId = nextFromNode(node.id, container.id);
        break;
      }

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

      } else if (nodeType === "bubble-video") {
        nextMessages.push({ 
          id: crypto.randomUUID(), 
          conversation_id: conversationId || "temp",
          role: "assistant",
          type: "bot", 
          content: firstText(cfg.VideoURL, cfg.videoUrl, cfg.url, cfg.src), 
          isVideo: true 
        });

      } else if (nodeType === "bubble-audio") {
        nextMessages.push({ 
          id: crypto.randomUUID(), 
          conversation_id: conversationId || "temp",
          role: "assistant",
          type: "bot", 
          content: firstText(cfg.AudioURL, cfg.audioUrl, cfg.url, cfg.src), 
          isAudio: true, 
          autoplay: cfg.AudioAutoplay ?? cfg.autoplay 
        });

      } else if (nodeType === "bubble-document" || nodeType === "bubble-file") {
        nextMessages.push({ 
          id: crypto.randomUUID(), 
          conversation_id: conversationId || "temp",
          role: "assistant",
          type: "bot", 
          content: firstText(cfg.FileURL, cfg.fileUrl, cfg.url, cfg.FileName, cfg.name), 
          isFile: true 
        });

      } else if (nodeType.startsWith("input-") && nodeType !== "input-buttons") {
        waitingFor = nodeType;
        waitingForCfg = cfg;
      } else if (nodeType === "input-buttons") {
        waitingFor = "buttons";
        waitingForCfg = cfg;
        nextButtons = cfg.buttons || [];
      } else if (nodeType === "script") {
        const code = String(cfg.code || "");
        if (code) {
          try {
            // Contexto simplificado para o script
            const scriptContext = {
              ...variables, // Permite usar as variáveis diretamente (ex: n1, soma)
              variables: variables, // Mantém compatibilidade com variables.n1
              getVariable: (name: string) => variables[name],
              setVariable: (name: string, value: any) => { variables[name] = value; },
              window: window,
              alert: (msg: string) => window.alert(msg),
              console: console,
              fetch: window.fetch.bind(window),
              setTimeout: window.setTimeout.bind(window),
              JSON: JSON,
              Math: Math,
              Date: Date,
            };

            // Criamos as chaves para injetar no script
            const keys = Object.keys(scriptContext);
            const values = Object.values(scriptContext);

            // Criamos a função injetando as variáveis como argumentos locais
            const fn = new Function(...keys, `"use strict"; ${code}`);
            const result = fn.apply(null, values);

            // Se um nome de variável de destino estiver definido, salva o resultado nela
            if (cfg.variableName && result !== undefined) {
              variables[cfg.variableName] = result;
            }

            // Se o script retornar um objeto, mescla nas variáveis (estilo Typebot)
            if (result && typeof result === "object" && !Array.isArray(result)) {
              Object.assign(variables, result);
            }
          } catch (err) {
            console.error("[script-node] execution failed:", err);
          }
        }
      } else if (nodeType === "http-request") {
        const url = replaceVars(cfg.url || "");
        const method = cfg.method || "GET";
        const headers: Record<string, string> = {};
        (cfg.headers || []).forEach((h: any) => {
          if (h.name) headers[h.name] = replaceVars(h.value);
        });

        // Auth headers
        if (cfg.authType === "bearer" && cfg.authCredentials?.token) {
          headers["Authorization"] = `Bearer ${replaceVars(cfg.authCredentials.token)}`;
        } else if (cfg.authType === "basic" && cfg.authCredentials?.username) {
          const user = replaceVars(cfg.authCredentials.username);
          const pass = replaceVars(cfg.authCredentials.password || "");
          const encoded = btoa(`${user}:${pass}`);
          headers["Authorization"] = `Basic ${encoded}`;
        }

        // Body
        let body: any = undefined;
        if (cfg.sendBody && !["GET", "HEAD"].includes(method)) {
          if (cfg.bodyContentType === "json") {
            headers["Content-Type"] = "application/json";
            body = replaceVars(cfg.bodyJson || "{}");
          } else if (cfg.bodyContentType === "form-urlencoded") {
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            const params = new URLSearchParams();
            (cfg.bodyParams || []).forEach((p: any) => {
              if (p.name) params.append(p.name, replaceVars(p.value));
            });
            body = params.toString();
          }
        }

        try {
          const response = await fetch(url, {
            method,
            headers,
            body
          });

          if (response.ok) {
            const responseData = await response.json();
            
            // Apply response mappings
            const mappings: ResponseMapping[] = cfg.responseMappings || [];
            mappings.forEach(mapping => {
              if (mapping.jsonPath && mapping.variableName) {
                // Simple path resolver (e.g., "data.user.name")
                const parts = mapping.jsonPath.split('.');
                let value = responseData;
                
                // If path starts with "data." and the root object is the response, skip "data" 
                // unless the actual response has a "data" property.
                // Most users will type the path relative to the root.
                
                for (let i = 0; i < parts.length; i++) {
                  const part = parts[i];
                  if (value && typeof value === 'object' && part in value) {
                    value = value[part];
                  } else if (part === 'data' && i === 0 && (!value || !(part in value))) {
                    // Skip 'data' if it's the first part and NOT in the root response object
                    // This handles users who think they need to prefix with 'data'
                    continue;
                  } else {
                    value = undefined;
                    break;
                  }
                }

                
                if (value !== undefined) {
                  variables[mapping.variableName] = value;
                }
              }
            });
          }
        } catch (err) {
          console.error("[http-request] failed:", err);
        }
      } else if (nodeType === "ai-node" || nodeType === "ai-agent") {
        const isAgent = nodeType === "ai-agent";
        const objective = cfg.objective || cfg.systemPrompt || "assistente virtual";
        const instructions = firstText(cfg.instructions, cfg.prompt, cfg.message) || "Ajude o usuário da melhor forma possível.";
        
        console.log(`[AI Node] ${isAgent ? 'AGENT' : 'FLOW'} execution:`, {
          provider: cfg.provider || "openai",
          model: cfg.model,
          objective,
          instructions_length: instructions.length
        });

        
        // Verificação de intenção de saída (Exit Intents)
        const userMsgContent = String(variables["last_message"] || "").toLowerCase();
        const exitPhrases = ["voltar menu", "sair", "parar", "cancelar", "exit", "stop"];
        if (isAgent && exitPhrases.some(p => userMsgContent.includes(p))) {
          console.log("[AI Agent] Exit intent detectado, voltando para o Flow.");
          mode = "flow";
          activeAgentNodeId = null;
          currentNodeId = nextFromNode(node.id, container.id);
          continue;
        }

        const nodeKey = (cfg.apiKey || "").trim();
        const nodeProvider = (cfg.provider || "openai").toLowerCase();
        const globalKeys = settings?.aiKeys || {};
        const activeKey = (globalKeys[`${nodeProvider}Key`] || "").trim() || nodeKey;
        const selectedProvider = nodeProvider === "gemini" ? "google" : nodeProvider as "openai" | "anthropic" | "google";

        const { system, messages: contextMessages } = buildAgentContext({
          systemPrompt: `Objetivo: ${objective}\nInstruções: ${instructions}`,
          history: messageHistory,
          persistentMemory,
          variables
        });

        let aiReply: string | null = null;
        
        if (!activeKey) {
          aiReply = `🤖 [SIMULAÇÃO]\nConfigure uma chave de API para o provedor ${nodeProvider.toUpperCase()}.`;
        } else {
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
              const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(activeKey)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  contents: contextMessages.length > 0 ? contextMessages.map(m => ({
                    role: m.role === "assistant" ? "model" : "user",
                    parts: [{ text: m.content }]
                  })) : [{ role: "user", parts: [{ text: "Olá!" }] }]
                }),
              });
              if (res.ok) {
                const data = await res.json();
                aiReply = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
              }
            }
          } catch (e: any) { 
            console.error(e);
            aiReply = `❌ Erro na IA: ${e.message}`; 
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
          
          nextMessages.push({ 
            ...botMsg, 
            type: "bot", 
            content: aiReply 
          } as Message);
        }

        if (isAgent) {
          mode = "agent";
          activeAgentNodeId = node.id;
          waitingFor = "input-text";
          waitingForCfg = { placeholder: "Converse com o agente..." };
          console.log("[Runtime] Modo AGENTE ativado: aguardando input do usuário para continuar conversa.");
          break; // Agent pausa o fluxo e assume
        } else {
          // AI Node pontual: continua o fluxo
          const nextId = nextFromNode(node.id, container.id);
          console.log("[Runtime] AI Node concluído. Avançando para o próximo nó:", nextId);
          if (!nextId) {
            waitingFor = "input-text";
            waitingForCfg = { placeholder: "Digite aqui..." };
          }
          currentNodeId = nextId;
          continue;
        }


      } else if (nodeType === "set-variable" && cfg.variableName) {
        variables[cfg.variableName] = evaluateSetVariableValue(cfg, variables);
      } else if (nodeType === "condition") {
        const conditions: ConditionGroup[] = cfg.conditions || [];
        const matchedCondition = conditions.find((condition) => evaluateCondition(condition, variables, replaceVars));
        const conditionHandle = matchedCondition ? `${node.id}-cond-${matchedCondition.id}` : `${node.id}-else`;
        currentNodeId = nextFromNode(node.id, container.id, conditionHandle, true);
        continue;
      }

      if (waitingFor) {
        console.log("[Runtime] Pausando loop — aguardando:", waitingFor, "no nó", node.id);
        break;
      }
      const nextId = nextFromNode(node.id, container.id);
      console.log(`[Runtime] Nó ${node.id} concluído → próximo:`, nextId);
      currentNodeId = nextId;
    }

    console.log("[Runtime] Loop finalizado", { steps, currentNodeId, mode, waitingFor, messagesAdded: nextMessages.length });
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
        waiting_for_input: !!waitingFor 
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
    
    // Persistir estado inicial se houver conversa
    if (data.runtime_state?.conversation_id) {
      await conversationService.updateConversation(data.runtime_state.conversation_id, {
        runtime_mode: data.runtime_state.mode,
        active_node_id: data.runtime_state.current_node_id,
        memory: data.runtime_state.persistent_memory
      });
    }

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
    
    // Persistir estado no banco
    if (data.runtime_state?.conversation_id) {
      await conversationService.updateConversation(data.runtime_state.conversation_id, {
        runtime_mode: data.runtime_state.mode,
        active_node_id: data.runtime_state.current_node_id || data.runtime_state.active_agent_node_id,
        memory: data.runtime_state.persistent_memory
      });
    }

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
