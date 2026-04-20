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

interface ChatWidgetProps {
  flowId?: string;
  companyId: string;
  companyName?: string;
  primaryColor?: string;
}

export const ChatWidget = ({
  flowId,
  companyId,
  companyName = "Assistente",
  primaryColor = "#3b82f6",
}: ChatWidgetProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [buttons, setButtons] = useState<ChatButton[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const getRuntimeUrl = () => {
    try {
      return getEdgeFunctionUrl('chatbot-runtime');
    } catch {
      return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-runtime`;
    }
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

  const startSession = async () => {
    if (!flowId) {
      setError("Nenhum fluxo de chatbot configurado");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${getRuntimeUrl()}/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          flow_id: flowId,
          company_id: companyId,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao iniciar sessão");
      }

      const data = await response.json();
      setSessionId(data.session_id);
      setMessages(data.messages || []);
      setWaitingFor(data.waiting_for);
      setButtons(data.buttons || []);
    } catch (err: any) {
      console.error("Error starting session:", err);
      setError(err.message || "Erro ao conectar com o chatbot");
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (message?: string, buttonId?: string) => {
    if (!sessionId) return;

    const msgToSend = message || input;
    if (!msgToSend && !buttonId) return;

    setIsLoading(true);
    setInput("");

    try {
      const response = await fetch(`${getRuntimeUrl()}/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: msgToSend,
          button_id: buttonId,
        }),
      });

      if (!response.ok) {
        throw new Error("Falha ao enviar mensagem");
      }

      const data = await response.json();
      setMessages(data.messages || []);
      setWaitingFor(data.waiting_for);
      setButtons(data.buttons || []);
    } catch (err: any) {
      console.error("Error sending message:", err);
      setError(err.message || "Erro ao enviar mensagem");
    } finally {
      setIsLoading(false);
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
    setButtons([]);
    setError(null);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110 z-50"
        style={{ backgroundColor: primaryColor }}
      >
        <MessageCircle className="w-6 h-6 text-white" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-background border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden z-50">
      {/* Header */}
      <div
        className="p-4 flex items-center justify-between"
        style={{ backgroundColor: primaryColor }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{companyName}</h3>
            <p className="text-xs text-white/70">Assistente virtual</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors"
        >
          <X className="w-4 h-4 text-white" />
        </button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
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
                className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                  message.type === "bot"
                    ? "bg-muted text-foreground rounded-bl-md"
                    : "text-white rounded-br-md"
                }`}
                style={message.type === "user" ? { backgroundColor: primaryColor } : undefined}
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
        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Digite sua mensagem..."
              disabled={isLoading}
              className="flex-1 rounded-full"
            />
            <Button
              size="icon"
              onClick={() => sendMessage()}
              disabled={isLoading || !input.trim()}
              className="rounded-full"
              style={{ backgroundColor: primaryColor }}
            >
              <Send className="w-4 h-4" />
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
