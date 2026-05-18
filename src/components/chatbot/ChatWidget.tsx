import { useState, useEffect, useRef } from "react";
import { MessageCircle, X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getEdgeFunctionUrl } from "@/lib/supabaseHelpers";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  isImage?: boolean;
  isVideo?: boolean;
  isAudio?: boolean;
}

interface ChatButton {
  id: string;
  label: string;
  value?: string;
}

interface RuntimeState {
  current_node_id: string | null;
  variables: Record<string, any>;
  waiting_for_input: boolean;
  is_waiting_time: boolean;
}

interface ChatWidgetProps {
  flowId?: string;
  companyId: string;
  companyName?: string;
  primaryColor?: string;
  themeSettings?: {
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
  };
}

export const ChatWidget = ({
  flowId,
  companyId,
  companyName = "Assistente",
  primaryColor = "#3b82f6",
  themeSettings,
}: ChatWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [waitingForConfig, setWaitingForConfig] = useState<any>(null);
  const [buttons, setButtons] = useState<ChatButton[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const runtimeStateRef = useRef<RuntimeState | null>(null);
  const waitTimerRef = useRef<number | null>(null);

  const getRuntimeUrl = () => {
    const baseUrl = import.meta.env.VITE_SUPABASE_URL || "https://fwoescubnnagdvwasbjl.supabase.co";
    return `${baseUrl}/functions/v1/chatbot-runtime`;
  };

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Start session when widget opens
  useEffect(() => {
    if (isOpen && !sessionId && flowId) {
      startSession();
    }
  }, [isOpen, flowId]);

  useEffect(() => {
    return () => clearWaitTimer();
  }, []);

  const clearWaitTimer = () => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  };

  const getContactId = () => localStorage.getItem("chat_contact_id") || (() => {
    const id = `web-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem("chat_contact_id", id);
    return id;
  })();

  const scheduleRuntimeContinue = (waitMs: unknown) => {
    const delay = Number(waitMs);
    if (!Number.isFinite(delay) || delay <= 0) return false;
    
    console.log(`[ChatWidget] Scheduling wait for ${delay}ms`);
    clearWaitTimer();
    
    waitTimerRef.current = window.setTimeout(() => {
      console.log("[ChatWidget] Wait finished, continuing...");
      waitTimerRef.current = null;
      continueRuntime();
    }, delay);
    
    return true;
  };

  const applyRuntimeData = (data: any, replaceMessages = false) => {
    runtimeStateRef.current = data.runtime_state || runtimeStateRef.current;
    
    // Check if we are in a waiting period
    const isWaiting = data.wait_ms > 0 || (data.runtime_state?.is_waiting_time);
    
    if (replaceMessages) {
      setMessages(data.messages || []);
    } else {
      setMessages(prev => [...prev, ...(data.messages || [])]);
    }
    
    setWaitingFor(data.waiting_for);
    setWaitingForConfig(data.waiting_for_config || null);
    setButtons(data.buttons || []);

    return scheduleRuntimeContinue(data.wait_ms);
  };

  const startSession = async () => {
    if (!flowId) {
      setError("Nenhum fluxo de chatbot configurado");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(getRuntimeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          flow_id: flowId,
          contact_id: getContactId(),
          channel: "webchat",
        }),
      });

      if (!response.ok) throw new Error("Falha ao iniciar sessão");

      const data = await response.json();
      setSessionId(data.session_id);
      applyRuntimeData(data, true);
    } catch (err: any) {
      setError(err.message || "Erro ao conectar com o chatbot");
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
          contact_id: getContactId(),
          channel: "webchat",
          payload: { runtime_state: runtimeStateRef.current },
        }),
      });

      if (!response.ok) throw new Error("Falha ao continuar conversa");

      const data = await response.json();
      applyRuntimeData(data);
    } catch (err: any) {
      setError(err.message || "Erro ao continuar conversa");
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
  };

  const sendMessage = async (message?: string, buttonId?: string) => {
    const msgToSend = message || input;
    if (!msgToSend && !buttonId) return;

    // Validation
    if (!buttonId && waitingFor && msgToSend) {
      if (waitingFor === "input-mail") {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(msgToSend)) {
          const errorMsg = waitingForConfig?.invalidMessage || "Por favor, insira um e-mail válido.";
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setInput("");
          return;
        }
      } else if (waitingFor === "input-webSite") {
        try {
          new URL(msgToSend.startsWith('http') ? msgToSend : `https://${msgToSend}`);
        } catch (e) {
          const errorMsg = waitingForConfig?.invalidMessage || "Por favor, insira um link válido.";
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setInput("");
          return;
        }
      } else if (waitingFor === "input-number") {
        const num = Number(msgToSend);
        if (isNaN(num)) {
          const errorMsg = waitingForConfig?.invalidMessage || "Por favor, insira um número válido.";
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setInput("");
          return;
        }
        if (waitingForConfig?.min !== undefined && num < waitingForConfig.min) {
          const errorMsg = waitingForConfig?.invalidMessage || `O valor mínimo é ${waitingForConfig.min}.`;
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setInput("");
          return;
        }
        if (waitingForConfig?.max !== undefined && num > waitingForConfig.max) {
          const errorMsg = waitingForConfig?.invalidMessage || `O valor máximo é ${waitingForConfig.max}.`;
          setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
          setMessages(prev => [...prev, { id: `b-err-${Date.now()}`, type: "bot", content: errorMsg }]);
          setInput("");
          return;
        }
      }
    }

    if (msgToSend) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: msgToSend }]);
    }

    setIsLoading(true);
    setInput("");

    try {
      const response = await fetch(getRuntimeUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          flow_id: flowId,
          contact_id: getContactId(),
          channel: "webchat",
          payload: { message: msgToSend, button_id: buttonId, runtime_state: runtimeStateRef.current },
        }),
      });

      if (!response.ok) throw new Error("Falha ao enviar mensagem");

      const data = await response.json();
      applyRuntimeData(data);
    } catch (err: any) {
      setError(err.message || "Erro ao enviar mensagem");
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
  };

  const handleButtonClick = (button: ChatButton) => {
    sendMessage(undefined, button.id);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      sendMessage();
    }
  };

  const resetChat = () => {
    setSessionId(null);
    setMessages([]);
    setWaitingFor(null);
    setWaitingForConfig(null);
    setButtons([]);
    runtimeStateRef.current = null;
    clearWaitTimer();
    setError(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50 overflow-hidden"
        style={{ background: primaryColor }}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div 
      className="fixed bottom-6 right-6 w-96 h-[500px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50"
      style={{ 
        fontFamily: themeSettings?.fontFamily || 'inherit',
      }}
    >
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ 
          background: themeSettings?.headerBackgroundColor || primaryColor,
          color: themeSettings?.headerTextColor || '#ffffff'
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold" style={{ color: themeSettings?.headerTextColor || '#ffffff' }}>{companyName}</h3>
            <p className="text-xs opacity-70" style={{ color: themeSettings?.headerTextColor || '#ffffff' }}>Assistente virtual</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <X className="w-4 h-4" style={{ color: themeSettings?.headerTextColor || '#ffffff' }} />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea 
        className="flex-1 p-4" 
        ref={scrollRef}
        style={{ 
          backgroundColor: themeSettings?.backgroundColor || 'transparent',
          backgroundImage: themeSettings?.backgroundImage ? `url(${themeSettings.backgroundImage})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        <div className="space-y-3">
          {error && (
            <div className="bg-destructive/10 text-destructive p-3 rounded-lg text-sm">
              {error}
              <button
                onClick={resetChat}
                className="block mt-2 text-xs underline"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === "bot" ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm text-left shadow-sm ${
                  message.type === "bot"
                    ? "rounded-bl-md"
                    : "rounded-br-md"
                }`}
                style={
                  message.type === "user" 
                    ? { background: themeSettings?.userBubbleColor || primaryColor, color: themeSettings?.userTextColor || '#ffffff' } 
                    : { background: themeSettings?.botBubbleColor || '#f3f4f6', color: themeSettings?.botTextColor || '#1f2937' }
                }
              >
                {message.isImage ? (
                  <img src={message.content} alt="Imagem" className="max-w-full rounded" />
                ) : message.isVideo ? (
                  <video src={message.content} controls className="max-w-full rounded" />
                ) : message.isAudio ? (
                  <audio src={message.content} controls className="max-w-full" />
                ) : (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-muted px-4 py-2 rounded-2xl rounded-bl-md">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Buttons */}
      {buttons.length > 0 && waitingFor === "buttons" && (
        <div className="p-3 border-t border-border">
          <div className="flex flex-wrap gap-2">
            {buttons.map((btn) => (
              <Button
                key={btn.id}
                variant="outline"
                size="sm"
                onClick={() => handleButtonClick(btn)}
                disabled={isLoading}
                className="rounded-full"
              >
                {btn.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      {waitingFor && waitingFor !== "buttons" && (
        <div className="p-3 border-t border-border" style={{ background: themeSettings?.inputBackgroundColor || '#ffffff' }}>
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                waitingForConfig?.resPonseUserNumber || 
                waitingForConfig?.responseUserTextInput || 
                waitingForConfig?.placeholder || 
                "Digite sua mensagem"
              }
              disabled={isLoading}
              type={
                waitingFor === "input-number" 
                  ? (typeof waitingForConfig?.min === 'number' || typeof waitingForConfig?.max === 'number' ? "number" : "text") 
                  : waitingFor === "input-mail" 
                  ? "email" 
                  : waitingFor === "input-webSite" 
                  ? "url" 
                  : "text"
              }
              min={waitingFor === "input-number" ? waitingForConfig?.min : undefined}
              max={waitingFor === "input-number" ? waitingForConfig?.max : undefined}
              step={waitingFor === "input-number" ? waitingForConfig?.step : undefined}
              className="flex-1 rounded-full min-w-0"
              style={{ 
                color: themeSettings?.inputTextColor || '#1f2937',
                backgroundColor: 'rgba(255, 255, 255, 0.1)', // Subtle overlay
                borderColor: themeSettings?.inputTextColor ? `${themeSettings.inputTextColor}40` : undefined
              }}
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="rounded-full overflow-hidden"
              style={{ background: primaryColor }}
            >
              <Send className="w-4 h-4 text-white" />
            </Button>
          </div>
        </div>
      )}

      {/* Restart button when flow is complete */}
      {!waitingFor && messages.length > 0 && !isLoading && (
        <div className="p-3 border-t border-border">
          <Button
            variant="outline"
            onClick={resetChat}
            className="w-full rounded-full"
          >
            Iniciar nova conversa
          </Button>
        </div>
      )}
    </div>
  );
};