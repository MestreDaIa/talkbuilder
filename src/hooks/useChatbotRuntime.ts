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

interface RuntimeState {
  current_node_id: string | null;
  variables: Record<string, any>;
  waiting_for_input: boolean;
  is_waiting_time: boolean;
}

const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL || `${import.meta.env.VITE_SUPABASE_URL || "https://fwoescubnnagdvwasbjl.supabase.co"}/functions/v1/chatbot-runtime`;

export function useChatbotRuntime(flowId?: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingFor, setWaitingFor] = useState<string | null>(null);
  const [buttons, setButtons] = useState<ChatButton[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const runtimeStateRef = useRef<RuntimeState | null>(null);
  const waitTimerRef = useRef<number | null>(null);
  
  const contactId = useRef<string>(localStorage.getItem("chat_contact_id") || (() => {
    const id = `web-${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem("chat_contact_id", id);
    return id;
  })());

  useEffect(() => {
    return () => clearWaitTimer();
  }, []);

  const clearWaitTimer = () => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  };

  const scheduleRuntimeContinue = (waitMs: unknown) => {
    const delay = Number(waitMs);
    if (!Number.isFinite(delay) || delay <= 0) return false;
    
    console.log(`[Runtime] Scheduling wait for ${delay}ms`);
    clearWaitTimer();
    
    // Use window.setTimeout for better browser reliability
    waitTimerRef.current = window.setTimeout(() => {
      console.log("[Runtime] Wait finished, continuing...");
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
      // If we received messages but also a wait instruction, 
      // the messages should be shown, but the state must block further auto-execution
      setMessages(prev => [...prev, ...(data.messages || [])]);
    }
    
    setWaitingFor(data.waiting_for);
    setButtons(data.buttons || []);
    
    return scheduleRuntimeContinue(data.wait_ms);
  };

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
      applyRuntimeData(data, true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
  }, [flowId]);

  async function continueRuntime() {
    if (!flowId) return;
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
          payload: { runtime_state: runtimeStateRef.current },
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      applyRuntimeData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
    }
  }

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
          payload: { message, button_id: buttonId, runtime_state: runtimeStateRef.current },
        }),
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error);

      applyRuntimeData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      if (!waitTimerRef.current) setIsLoading(false);
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
