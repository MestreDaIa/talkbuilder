import { useState, useEffect, useRef } from "react";
import { X, Send, Headphones, Play, Pause, Image as ImageIcon, Video as VideoIcon, FileText, Mic, Camera, Upload, Trash2, StopCircle, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { type Container, type Node, type ButtonConfig, type Edge } from "../../types/chatbot";
import { ScrollArea } from "../../components/ui/scroll-area";
import { Checkbox } from "../../components/ui/checkbox";
import { getEdgeFunctionUrl } from "@/lib/supabaseHelpers";
import { renderTextSegments } from "@/lib/textParser";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  isVideo?: boolean;
  isImage?: boolean;
  isFile?: boolean;
  isAudio?: boolean;
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

  const nextFromNode = (nodeId: string, containerId: string, handle?: string | null) => {
    const normalizeHandle = (value?: string | null) => {
      if (!value) return "";
      const raw = String(value);
      const buttonMatch = raw.match(/-btn-(.+)$/);
      if (buttonMatch?.[1]) return buttonMatch[1];
      if (raw.endsWith("-default")) return "default";
      return raw;
    };
    const wantedHandle = normalizeHandle(handle);
    let edge = edges.find((e) => e.source === nodeId && wantedHandle && normalizeHandle(e.sourceHandle) === wantedHandle);
    if (!edge && wantedHandle) edge = edges.find((e) => e.source === nodeId && normalizeHandle(e.sourceHandle) === "default");
    if (!edge) edge = edges.find((e) => e.source === nodeId && !e.sourceHandle);
    if (!edge) edge = edges.find((e) => e.source === nodeId);
    if (edge) return findNode(edge.target) ? edge.target : (firstNodeOfContainer(edge.target) || edge.target);
    const containerEdge = edges.find((e) => e.source === containerId);
    if (containerEdge) return findNode(containerEdge.target) ? containerEdge.target : firstNodeOfContainer(containerEdge.target);
    return null;
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
      if (runtimeStateRef.current?.pending_wait_node_id) {
        const waitNodeInfo = findNode(runtimeStateRef.current.pending_wait_node_id);
        runtimeStateRef.current = {
          ...runtimeStateRef.current,
          current_node_id: waitNodeInfo
            ? nextFromNode(waitNodeInfo.node.id, waitNodeInfo.container.id)
            : runtimeStateRef.current.current_node_id,
          pending_wait_node_id: null,
        };
      }
      continueRuntime();
    }, delay);
    return true;
  };

  const applyRuntimeData = (data: any, replaceMessages = false) => {
    const incomingState = data.runtime_state || runtimeStateRef.current;
    const waitMs = Number(data.wait_ms);
    const hasActiveWait = Number.isFinite(waitMs) && waitMs > 0;
    runtimeStateRef.current = hasActiveWait
      ? { ...(incomingState || {}), pending_wait_node_id: incomingState?.current_node_id ?? null }
      : incomingState;
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
    try {
      const response = await fetch(getRuntimeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          flow_id: flowId,
          contact_id: contactIdRef.current,
          channel: "webchat",
        }),
      });
      const data = await response.json();
      applyRuntimeData(data, true);
    } catch (err) {
      console.error("Test Runtime error:", err);
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
  };

  const continueRuntime = async () => {
    if (!flowId) return;
    setIsLoading(true);

    try {
      const response = await fetch(getRuntimeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          flow_id: flowId,
          contact_id: contactIdRef.current,
          channel: "webchat",
          payload: { runtime_state: runtimeStateRef.current },
        }),
      });
      const data = await response.json();
      applyRuntimeData(data);
    } catch (err) {
      console.error("Test Runtime continue error:", err);
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
  };

  const sendMessage = async (message?: string, buttonId?: string) => {
    const msgToSend = message || currentInput;
    if (!msgToSend && !buttonId) return;

    if (msgToSend) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
    }

    setIsLoading(true);
    setCurrentInput("");

    try {
      const response = await fetch(getRuntimeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          flow_id: flowId,
          contact_id: contactIdRef.current,
          channel: "webchat",
          payload: { message: msgToSend, button_id: buttonId, runtime_state: runtimeStateRef.current },
        }),
      });
      const data = await response.json();
      applyRuntimeData(data);
    } catch (err) {
      console.error("Test Runtime message error:", err);
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
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
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-md ${message.type === "bot" ? "rounded-bl-sm bg-muted" : "rounded-br-sm text-white"}`}
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
