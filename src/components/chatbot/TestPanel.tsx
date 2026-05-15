import { useState, useEffect, useRef } from "react";
import { X, Send, Headphones, Play, Pause, Image as ImageIcon, Video as VideoIcon, FileText, Mic, Camera, Upload, Trash2, StopCircle, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { type Container, type Node, type ButtonConfig, type Edge } from "../../types/chatbot";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Checkbox } from "../../components/ui/checkbox";
import { getEdgeFunctionUrl } from "@/lib/supabaseHelpers";
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
  textColor?: string;
  fontFamily?: string;
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
}: TestPanelProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [waitingForButton, setWaitingForButton] = useState(false);
  const [activeButtons, setActiveButtons] = useState<ButtonConfig[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMultipleChoice, setIsMultipleChoice] = useState(false);
  const [selectedButtons, setSelectedButtons] = useState<string[]>([]);
  const [submitLabel, setSubmitLabel] = useState("Enviar");
  const scrollRef = useRef<HTMLDivElement>(null);
  const runtimeStateRef = useRef<RuntimeState | null>(null);
  const hasStartedRef = useRef(false);
  const startedFlowRef = useRef<string | null>(null);
  const waitTimerRef = useRef<number | null>(null);

  const contactIdRef = useRef<string>(`test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

  const getRuntimeUrl = () => {
    return "https://fwoescubnnagdvwasbjl.functions.supabase.co/chatbot-runtime";
  };

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

  const nextFromNode = (nodeId: string, containerId: string, handle?: string | null): string | null => {
    const normalizeHandle = (value?: string | null) => {
      if (!value) return "";
      const raw = String(value);
      const buttonMatch = raw.match(/-btn-(.+)$/);
      if (buttonMatch?.[1]) return buttonMatch[1];
      if (raw.endsWith("-default")) return "default";
      return raw;
    };
    const wantedHandle = normalizeHandle(handle);
    // Only consider edges whose target still exists in the current graph.
    const validEdges = edges.filter((e) => resolveTarget(e.target) !== null);
    const fromNode = validEdges.filter((e) => e.source === nodeId);

    let edge = wantedHandle
      ? fromNode.find((e) => normalizeHandle(e.sourceHandle) === wantedHandle)
      : undefined;
    if (!edge && wantedHandle) edge = fromNode.find((e) => normalizeHandle(e.sourceHandle) === "default");
    if (!edge) edge = fromNode.find((e) => !e.sourceHandle);
    if (!edge) edge = fromNode[0];
    if (edge) return resolveTarget(edge.target);

    const containerEdge = validEdges.find((e) => e.source === containerId);
    if (containerEdge) return resolveTarget(containerEdge.target);
    return null;
  };

  const runLocalFlow = (state: RuntimeState | null, input?: { message?: string; button_id?: string }) => {
    let currentNodeId = state?.current_node_id || startContainer?.nodes?.[0]?.id || null;
    const variables = { ...(state?.variables || {}) };
    const nextMessages: Message[] = [];
    let waitingFor: "text" | "buttons" | null = null;
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

    if (state?.waiting_for_input && input && currentNodeId) {
      const current = findNode(currentNodeId);
      if (current) {
        const varName = current.node.config?.variableName || current.node.config?.saveVariable;
        const value = input.message ?? input.button_id;
        if (varName && value !== undefined) variables[varName] = value;
        currentNodeId = nextFromNode(current.node.id, current.container.id, input.button_id);
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
        const content = replaceVars(firstText(cfg.message, cfg.content, cfg.text, cfg.number, cfg.value));
        if (content) nextMessages.push({ id: crypto.randomUUID(), type: "bot", content });
      } else if (nodeType === "bubble-image") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.ImageURL, cfg.imageUrl, cfg.url, cfg.src), isImage: true, alt: firstText(cfg.ImageAlt, cfg.alt) });
      } else if (nodeType === "bubble-video") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.VideoURL, cfg.videoUrl, cfg.url, cfg.src), isVideo: true });
      } else if (nodeType === "bubble-audio") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.AudioURL, cfg.audioUrl, cfg.url, cfg.src), isAudio: true, autoplay: cfg.AudioAutoplay ?? cfg.autoplay });
      } else if (nodeType === "bubble-document" || nodeType === "bubble-file") {
        nextMessages.push({ id: crypto.randomUUID(), type: "bot", content: firstText(cfg.FileURL, cfg.fileUrl, cfg.url, cfg.FileName, cfg.name), isFile: true });
      } else if (nodeType.startsWith("input-") && nodeType !== "input-buttons") {
        waitingFor = "text";
      } else if (nodeType === "input-buttons") {
        waitingFor = "buttons";
        nextButtons = cfg.buttons || [];
      } else if (nodeType === "set-variable" && cfg.variableName) {
        variables[cfg.variableName] = replaceVars(cfg.value || "");
      }

      if (waitingFor) break;
      currentNodeId = nextFromNode(node.id, container.id);
    }

    return { messages: nextMessages, wait_ms: waitMs, waiting_for: waitingFor, buttons: nextButtons, runtime_state: { current_node_id: currentNodeId, variables, waiting_for_input: !!waitingFor } };
  };

  useEffect(() => {
    if (!isOpen || !flowId) {
      clearWaitTimer();
      hasStartedRef.current = false;
      runtimeStateRef.current = null;
      startedFlowRef.current = null;
      return;
    }

    if (hasStartedRef.current && startedFlowRef.current === flowId) return;

    contactIdRef.current = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    runtimeStateRef.current = null;
    hasStartedRef.current = true;
    startedFlowRef.current = flowId;
    startRuntimeSession();
  }, [isOpen, flowId]);

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
    setWaitingForInput(data.waiting_for === "text");
    setWaitingForButton(data.waiting_for === "buttons");
    setActiveButtons(data.buttons || []);
    return scheduleRuntimeContinue(data.wait_ms);
  };

  const startRuntimeSession = async () => {
    setIsLoading(true);
    setMessages([]);
    applyRuntimeData(runLocalFlow(null), true);
    if (!waitTimerRef.current) setIsLoading(false);
  };

  const continueRuntime = async () => {
    setIsLoading(true);
    applyRuntimeData(runLocalFlow(runtimeStateRef.current));
    if (!waitTimerRef.current) setIsLoading(false);
  };

  const sendMessage = async (message?: string, buttonId?: string) => {
    const msgToSend = message || currentInput;
    if (!msgToSend && !buttonId) return;

    if (msgToSend) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
    }

    setIsLoading(true);
    setCurrentInput("");

    applyRuntimeData(runLocalFlow(runtimeStateRef.current, { message: msgToSend, button_id: buttonId }));
    if (!waitTimerRef.current) setIsLoading(false);
  };

  const handleButtonClick = (button: ButtonConfig) => sendMessage(undefined, button.id);
  const handleSendMessage = () => sendMessage();

  if (!isOpen) return null;

  const themeStyle: React.CSSProperties = {};
  if (theme?.primaryColor) {
    (themeStyle as any)["--bot-flow"] = theme.primaryColor;
    (themeStyle as any)["--user-msg-bg"] = theme.primaryColor;
    (themeStyle as any)["--user-msg-fg"] = "#ffffff";
  }
  if (theme?.backgroundColor) themeStyle.background = theme.backgroundColor;
  if (theme?.textColor) themeStyle.color = theme.textColor;
  if (theme?.fontFamily) themeStyle.fontFamily = theme.fontFamily;

  const containerClass = fullScreen
    ? "absolute inset-0 h-full w-full bg-card flex flex-col z-50"
    : "w-80 absolute top-0 right-0 h-full bg-card border-l border-border shadow-2xl flex flex-col z-50";

  return (
    <aside className={containerClass} style={themeStyle}>
      <div className="flex flex-col w-full h-full">
        <div className="sticky top-0 z-10 shrink-0 min-h-14 border-b border-border px-3 py-2 flex items-center justify-between bg-gradient-to-r from-primary/20 via-card to-card">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2 h-2 rounded-full animate-pulse shrink-0" style={{ background: "var(--bot-flow)" }} />
            <div className="min-w-0">
              <h2 className="font-semibold text-sm text-foreground truncate">{headerTitle}</h2>
              {headerSubtitle && <p className="text-[11px] leading-tight text-muted-foreground truncate">{headerSubtitle}</p>}
            </div>
          </div>
          {!hideClose && <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>}
        </div>
        <ScrollArea className="flex-1 p-3 bg-background/40" ref={scrollRef}>
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className={`flex ${message.type === "bot" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-md text-left ${message.type === "bot" ? "rounded-bl-sm bg-muted" : "rounded-br-sm text-white"}`}
                  style={message.type === "user" ? { background: "var(--user-msg-bg)", color: "var(--user-msg-fg)" } : undefined}>
                  {message.isImage ? <img src={message.content} alt={message.alt} className="max-w-full rounded" />
                   : message.isVideo ? <video src={message.content} controls className="max-w-full rounded" />
                   : message.isAudio ? <div className="flex items-center gap-2"><Headphones className="h-4 w-4 shrink-0" /><AudioPlayer src={message.content} autoPlay={message.autoplay} /></div>
                   : message.isFile ? <div className="flex items-center gap-2"><FileText className="h-4 w-4 shrink-0" /><span className="truncate max-w-[180px]">{message.content}</span></div>
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
          <div className="p-3 border-t border-border flex gap-2 bg-card">
            <Input value={currentInput} onChange={(e) => setCurrentInput(e.target.value)} onKeyPress={(e) => e.key === "Enter" && !isLoading && handleSendMessage()} placeholder="Digite..." className="flex-1 bg-background" disabled={isLoading} />
            <Button size="icon" onClick={handleSendMessage} disabled={isLoading || !currentInput.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </aside>
  );
};
