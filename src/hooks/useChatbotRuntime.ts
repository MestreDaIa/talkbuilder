import { useState, useEffect, useRef, useCallback } from "react";

interface Message {
  id: string;
  type: "bot" | "user";
  content: string;
  isImage?: boolean;
}

interface ChatButton {
  id: string;
  label: string;
}

const RUNTIME_URL = "https://fwoescubnnagdvwasbjl.functions.supabase.co/chatbot-runtime";

export function useChatbotRuntime(flowId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [buttons, setButtons] = useState<ChatButton[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  const contactId = useRef<string>(localStorage.getItem("chat_contact_id") || (() => {
    const id = `web-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem("chat_contact_id", id);
    return id;
  })());

  const startSession = useCallback(async () => {
    if (!flowId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(RUNTIME_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "start",
          flow_id: flowId,
          contact_id: contactId.current,
          channel: "webchat",
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      
      setSessionId(data.session_id);
      setMessages(data.messages || []);
      setWaitingFor(data.waiting_for);
      setButtons(data.buttons || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [flowId]);

  const sendMessage = useCallback(async (message?: string, buttonId?: string) => {
    if (!flowId || (!message && !buttonId)) return;
    
    if (message) {
      setMessages(prev => [...prev, { id: `u-${Date.now()}`, type: "user", content: message }]);
    }
    
    setIsLoading(true);
    try {
      const response = await fetch(RUNTIME_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "message",
          flow_id: flowId,
          contact_id: contactId.current,
          channel: "webchat",
          payload: { message, button_id: buttonId },
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setMessages(prev => [...prev, ...(data.messages || [])]);
      setWaitingFor(data.waiting_for);
      setButtons(data.buttons || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [flowId]);

  return {
    messages,
    isLoading,
    error,
    waitingFor,
    buttons,
    sessionId,
    startSession,
    sendMessage,
    setMessages,
    setSessionId
  };
}
