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

interface Message {
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

interface RuntimeState {
  current_node_id: string | null;
  variables: Record<string, any>;
  waiting_for_input: boolean;
  pending_wait_node_id?: string | null;
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
    let currentNodeId = state?.current_node_id || startContainer?.nodes?.[0]?.id || null;
    const variables = { ...(state?.variables || {}) };
    const nextMessages: Message[] = [];
    let waitingFor: string | null = null;
    let waitingForCfg: any = null;
    let nextButtons: ButtonConfig[] = [];
    let waitMs = 0;
    let steps = 0;

    const firstText = (...values: any[]) => String(values.find((v) => typeof v === "string" && v.trim()) || "");
    const cleanText = (text: string) => richToPlainText(text);
    const replaceVars = (text: string) => cleanText(text).replace(/{{(.*?)}}/g, (_, key) => variables[key.trim()] ?? `{{${key}}}`);
    const evaluateSetVariableValue = (cfg: any, vars: Record<string, any>): any => {
      const valueType = String(cfg.valueType || "custom").toLowerCase();
      const raw = cfg.value ?? "";
      if (valueType === "empty") return "";
      const code = String(raw);
      // Substitute {{var}} -> JSON literal so the JS code can use them
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
    const parseWaitMs = (cfg: any) => {
      const amount = Math.max(1, Number(cfg.waitTime ?? cfg.duration ?? cfg.seconds ?? 5) || 5);
      const unit = String(cfg.timeUnit ?? cfg.unit ?? "seconds").toLowerCase();
      return amount * (unit.startsWith("hour") || unit.startsWith("hora") ? 3600000 : unit.startsWith("minute") || unit.startsWith("minuto") ? 60000 : 1000);
    };

    if (state?.waiting_for_input && input && currentNodeId) {
      const current = findNode(currentNodeId);
      if (current) {
        const varName = current.node.config?.variableName || current.node.config?.saveVariable;
        const value = input.message ?? input.button_id;
        if (varName && value !== undefined) variables[varName] = value;
        const currentType = String(current.node.type || "").toLowerCase();
        if (currentType === "ai-agent" || currentType === "ai-node") {
          variables.__last_agent_user_message = value ?? "";
          currentNodeId = current.node.id;
        } else {
          currentNodeId = nextFromNode(current.node.id, current.container.id, input.button_id);
        }
      }
    }

    while (currentNodeId && steps++ < 100) {
      const found = findNode(currentNodeId);
      if (!found) {
        currentNodeId = firstNodeOfContainer(currentNodeId);
        if (currentNodeId) continue;
        break;
      }

      const { node, container } = found;
      const cfg = node.config || {};
      const nodeType = String(node.type || "").toLowerCase();

      if (nodeType === "wait" || nodeType === "await") {
        waitMs = parseWaitMs(cfg);
        currentNodeId = nextFromNode(node.id, container.id);
        break;
      }

      if (nodeType === "bubble-text" || nodeType === "bubble-number") {
        const rawValue = firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value);
        if (rawValue) {
          const html = richHtmlFor(rawValue, { variables });
          nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: html, isHtml: true });
        }
      } else if (nodeType === "bubble-image") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.ImageURL, cfg.imageUrl, cfg.url, cfg.src), isImage: true, alt: firstText(cfg.ImageAlt, cfg.alt) });
      } else if (nodeType === "bubble-video") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.VideoURL, cfg.videoUrl, cfg.url, cfg.src), isVideo: true });
      } else if (nodeType === "bubble-audio") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.AudioURL, cfg.audioUrl, cfg.url, cfg.src), isAudio: true, autoplay: cfg.AudioAutoplay ?? cfg.autoplay });
      } else if (nodeType === "bubble-document" || nodeType === "bubble-file") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.FileURL, cfg.fileUrl, cfg.url, cfg.FileName, cfg.name), isFile: true });
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
        const objective = cfg.objective || cfg.systemPrompt || "agente de teste";
        const instructions = firstText(cfg.instructions, cfg.prompt, cfg.message);
        const hasTools = allContainers.some(c => c.nodes.some(n => n.config?.isSkill));
        const userMessage = String(variables.__last_agent_user_message || "").trim();
        
        // Verifica se existem chaves de API configuradas no settings ou no próprio nó
        const nodeKey = (cfg.apiKey || "").trim();
        const nodeProvider = (cfg.provider || "openai").toLowerCase();
        const isGoogle = nodeProvider === "google" || nodeProvider === "gemini";
        
        const globalKeys = settings?.aiKeys || {};
        const openaiKey = (globalKeys.openaiKey || "").trim() || (nodeProvider === "openai" ? nodeKey : "");
        const anthropicKey = (globalKeys.anthropicKey || "").trim() || (nodeProvider === "anthropic" ? nodeKey : "");
        const googleKey = (globalKeys.googleKey || "").trim() || (isGoogle ? nodeKey : "");
        
        // Fallback final: se o usuário colocou uma chave no nó mas não selecionou provider, usa pelo provider do nó
        const fallbackKey = nodeKey && !openaiKey && !anthropicKey && !googleKey ? nodeKey : "";
        
        let selectedProvider: "openai" | "anthropic" | "google" | "gemini" = "openai";
        if (openaiKey) selectedProvider = "openai";
        else if (anthropicKey) selectedProvider = "anthropic";
        else if (googleKey || (isGoogle && fallbackKey)) {
          selectedProvider = (nodeProvider === "gemini" || nodeProvider === "google") ? nodeProvider as any : "google";
        }
        else if (fallbackKey) selectedProvider = nodeProvider as any;

        const activeKey = openaiKey || anthropicKey || googleKey || fallbackKey;
        const hasAnyKey = !!activeKey;

        // Limpa a mensagem processada para evitar repetições
        variables.__last_agent_user_message = "";

        if (!hasAnyKey) {
          nextMessages.push({ 
            id: crypto.randomUUID(), 
            type: "bot", 
            content: userMessage
              ? `🤖 [SIMULAÇÃO DE AGENTE]\nRecebi: "${userMessage}"\n\nAinda não encontrei uma chave de API configurada para responder de verdade. Objetivo atual: ${objective}\n\n${hasTools ? "Também identifiquei Skills disponíveis no fluxo." : "Dica: marque blocos como Skill para o agente poder usá-los."}`
              : `🤖 [SIMULAÇÃO DE AGENTE]\nObjetivo: ${objective}\n\nO sistema de IA está configurado, mas para funcionar de verdade, você precisará configurar uma chave de API nas configurações do bot ou no próprio nó.\n\n${hasTools ? "Identifiquei que você já tem blocos configurados como Skills!" : "Dica: Você ainda não marcou nenhum bloco como 'Skill' para este agente usar."}`, 
          });
          
          waitingFor = "input-text";
          waitingForCfg = { placeholder: "Simule uma conversa com o agente..." };
        } else {
          const skillsText = hasTools ? "\n\nPercebi que existem Skills disponíveis neste fluxo; quando o motor real estiver conectado, eu poderei decidir quando acioná-las." : "";
          
          if (userMessage) {
            const kbFiles: Array<{ name: string; content?: string; truncated?: boolean }> = Array.isArray(cfg.kbFiles) ? cfg.kbFiles : [];
            const kbLinks: Array<{ url: string }> = Array.isArray(cfg.kbLinks) ? cfg.kbLinks : [];
            const kbFilesEnabled = cfg.kbFilesEnabled && kbFiles.length > 0;
            const kbLinksEnabled = cfg.kbLinksEnabled && kbLinks.length > 0;
            let kbBlock = "";
            if (kbFilesEnabled || kbLinksEnabled) {
              const parts: string[] = [`\n\n=== BASE DE CONHECIMENTO${cfg.kbName ? ` (${cfg.kbName})` : ""} ===`];
              parts.push("Use EXCLUSIVAMENTE as informações abaixo como sua fonte de verdade. Se a resposta não estiver aqui, diga que não encontrou na base.");
              if (kbFilesEnabled) {
                kbFiles.forEach((f, i) => {
                  const content = (f.content || "").trim();
                  console.log(`[TestPanel] Injecting file ${i+1}: ${f.name}, content length: ${content.length}`);
                  parts.push(`\n--- Arquivo ${i + 1}: ${f.name} ---\n${content || "[arquivo sem conteúdo legível]"}${f.truncated ? "\n[...conteúdo truncado...]" : ""}`);
                });
              }
              if (kbLinksEnabled) {
                parts.push(`\n--- Links de referência ---`);
                kbLinks.forEach((l, i) => parts.push(`${i + 1}. ${l.url}`));
              }
              parts.push("\n=== FIM DA BASE DE CONHECIMENTO ===");
              kbBlock = parts.join("\n");
            }
            const systemPrompt = `Objetivo: ${objective}${instructions ? `\nInstruções: ${instructions}` : ""}${kbBlock}`;
            let aiReply: string | null = null;
            try {
              if (selectedProvider === "openai") {
                const res = await fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: { "Authorization": `Bearer ${activeKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    model: cfg.model || "gpt-4o-mini",
                    messages: [
                      { role: "system", content: systemPrompt },
                      { role: "user", content: userMessage }
                    ],
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  aiReply = data.choices?.[0]?.message?.content || null;
                } else {
                  const errorData = await res.json().catch(() => ({}));
                  if (res.status === 429 && errorData.error?.code === "insufficient_quota") {
                    aiReply = "❌ Sua chave da OpenAI está sem créditos ou atingiu o limite de uso (Quota Exceeded). Verifique seu plano e faturamento no painel da OpenAI.";
                  } else {
                    console.error("[TestPanel] OpenAI error", res.status, errorData);
                  }
                }
              } else if (selectedProvider === "google" || (selectedProvider as string) === "gemini") {
                const modelInput = (cfg.model || "gemini-2.5-flash").trim();
                const normalizeGeminiModel = (model: string) => {
                  if (model.includes("gemini-1.5") || model === "gemini-pro" || model.includes("gemini-1.0")) return "gemini-2.5-flash";
                  return model.replace(/^models\//, "");
                };
                const modelsToTry = [...new Set([
                  normalizeGeminiModel(modelInput),
                  "gemini-2.5-flash",
                  "gemini-2.5-pro",
                  "gemini-2.0-flash",
                ].filter(Boolean))];

                let lastError = null;
                let success = false;

                for (const model of modelsToTry) {
                  try {
                    console.log(`[TestPanel] Trying Gemini model: ${model}`);
                    const versions = ["v1beta", "v1"];
                    
                    for (const version of versions) {
                      const res = await fetch(`https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${encodeURIComponent(activeKey)}`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            contents: [
                              ...(systemPrompt ? [{ role: "user", parts: [{ text: `System Instruction: ${systemPrompt}` }] }] : []),
                              { role: "user", parts: [{ text: userMessage }] }
                            ],
                          }),
                      });

                      if (res.ok) {
                        const data = await res.json();
                        const firstCandidate = data.candidates?.[0];
                        if (firstCandidate?.content?.parts) {
                          aiReply = firstCandidate.content.parts.map((p: any) => p.text).join("");
                          success = true;
                          break;
                        } else if (firstCandidate?.finishReason) {
                          aiReply = `⚠️ O Gemini não gerou uma resposta. Motivo: ${firstCandidate.finishReason}`;
                          success = true;
                          break;
                        }
                      } else {
                        lastError = await res.json().catch(() => ({}));
                        console.warn(`[TestPanel] Gemini model ${model} (${version}) failed:`, lastError);
                        
                        // If it's an API key error, stop trying everything
                        if (res.status === 400 && lastError.error?.message?.toLowerCase().includes("api key")) break;
                        // If it's a model error but not a 404, we might want to try other models but maybe not other versions
                      }
                    }
                    if (success) break;
                    if (lastError?.error?.message?.toLowerCase().includes("api key")) break;
                  } catch (err) {
                    console.error(`[TestPanel] Error calling Gemini model ${model}:`, err);
                    lastError = err;
                  }
                }

                if (!success) {
                  console.error("[TestPanel] All Gemini models/versions failed", lastError);
                  if (lastError?.error?.message?.includes("API key")) {
                    aiReply = "❌ Chave de API do Gemini inválida ou não autorizada.";
                  } else {
                    aiReply = `❌ Erro no Gemini: ${lastError?.error?.message || "Não foi possível obter resposta."}`;
                  }
                }
              } else if (selectedProvider === "anthropic") {
                const res = await fetch("https://api.anthropic.com/v1/messages", {
                  method: "POST",
                  headers: {
                    "x-api-key": activeKey,
                    "anthropic-version": "2023-06-01",
                    "anthropic-dangerous-direct-browser-access": "true",
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model: cfg.model || "claude-3-5-sonnet-latest",
                    max_tokens: 1024,
                    system: systemPrompt,
                    messages: [{ role: "user", content: userMessage }],
                  }),
                });
                if (res.ok) {
                  const data = await res.json();
                  aiReply = data.content?.[0]?.text || null;
                } else {
                  const errorData = await res.json().catch(() => ({}));
                  console.error("[TestPanel] Anthropic error", res.status, errorData);
                }
              }
            } catch (e: any) {
              console.error("[TestPanel] AI Call failed", e);
              aiReply = `❌ Erro de conexão ou CORS: ${e.message || "Não foi possível conectar ao provedor"}. Verifique se seu navegador está bloqueando a requisição direta para a API.`;
            }

            if (aiReply) {
              nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: aiReply });
            } else {
              nextMessages.push({
                id: crypto.randomUUID(),
                type: "bot",
                content: `⚠️ Não consegui obter resposta do provedor ${selectedProvider.toUpperCase()}. Verifique se a chave de API é válida e se o modelo "${cfg.model || "(padrão)"}" está disponível. Veja o console do navegador para detalhes.`,
              });
            }
          } else {
            nextMessages.push({ 
              id: crypto.randomUUID(), 
              type: "bot", 
              content: `✨ [AGENTE ATIVO - ${selectedProvider.toUpperCase()}]\nChave configurada com sucesso. Pode mandar uma mensagem para conversar comigo.\n\nObjetivo: ${objective}${skillsText}`, 
            });
          }
          
          waitingFor = "input-text";
          waitingForCfg = { placeholder: "Converse com seu agente real..." };
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

      if (waitingFor) break;
      currentNodeId = nextFromNode(node.id, container.id);
    }

    return { messages: nextMessages, wait_ms: waitMs, waiting_for: waitingFor, waiting_for_config: waitingForCfg, buttons: nextButtons, runtime_state: { current_node_id: currentNodeId, variables, waiting_for_input: !!waitingFor } };
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
      if (waitingForType === "input-mail") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(msgToSend)) {
          const errorMsg = waitingForConfig?.invalidMessage || "Por favor, insira um e-mail válido.";
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setCurrentInput("");
          setIsLoading(false);
          return;
        }
      } else if (waitingForType === "input-webSite") {
        try {
          new URL(msgToSend.startsWith('http') ? msgToSend : `https://${msgToSend}`);
        } catch (e) {
          const errorMsg = waitingForConfig?.invalidMessage || "Por favor, insira um link válido.";
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setCurrentInput("");
          setIsLoading(false);
          return;
        }
      } else if (waitingForType === "input-number") {
        const num = Number(msgToSend);
        if (isNaN(num)) {
          const errorMsg = waitingForConfig?.invalidMessage || "Por favor, insira um número válido.";
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setCurrentInput("");
          setIsLoading(false);
          return;
        }
        if (waitingForConfig?.min !== undefined && num < waitingForConfig.min) {
          const errorMsg = waitingForConfig?.invalidMessage || `O valor mínimo é ${waitingForConfig.min}.`;
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setCurrentInput("");
          setIsLoading(false);
          return;
        }
        if (waitingForConfig?.max !== undefined && num > waitingForConfig.max) {
          const errorMsg = waitingForConfig?.invalidMessage || `O valor máximo é ${waitingForConfig.max}.`;
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setCurrentInput("");
          setIsLoading(false);
          return;
        }
      }
    }

    if (msgToSend) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
    }

    setIsLoading(true);
    setCurrentInput("");

    const data = await runLocalFlow(runtimeStateRef.current, { message: msgToSend, button_id: buttonId });
    applyRuntimeData(data);

    if (!waitTimerRef.current) setIsLoading(false);
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
                   : renderTextSegments(message.content)}
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
        {waitingForInput && !waitingForButton && (
          <div className="p-3 border-t border-border flex gap-2" style={{ background: theme?.inputBackgroundColor }}>
            <Input 
              value={currentInput} 
              onChange={(e) => setCurrentInput(e.target.value)} 
              onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendMessage()} 
              placeholder={
                waitingForConfig?.resPonseUserNumber || 
                waitingForConfig?.responseUserTextInput || 
                waitingForConfig?.placeholder || 
                "Digite aqui"
              }
              type={
                waitingForType === "input-number" 
                  ? (typeof waitingForConfig?.min === 'number' || typeof waitingForConfig?.max === 'number' ? "number" : "text") 
                  : waitingForType === "input-mail" 
                  ? "email" 
                  : waitingForType === "input-webSite" 
                  ? "url" 
                  : "text"
              }
              min={waitingForType === "input-number" ? waitingForConfig?.min : undefined}
              max={waitingForType === "input-number" ? waitingForConfig?.max : undefined}
              step={waitingForType === "input-number" ? waitingForConfig?.step : undefined}
              className="flex-1 min-w-0" 
              style={{ 
                background: theme?.inputBackgroundColor ? "rgba(255,255,255,0.1)" : undefined,
                color: theme?.inputTextColor || "inherit",
                borderColor: theme?.inputTextColor ? `${theme.inputTextColor}40` : undefined
              }}
              disabled={isLoading} 
            />
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
    </aside>
  );
};
