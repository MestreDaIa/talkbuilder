"use client";

import { useEffect, useState } from "react";

type Message = {
  from: "bot" | "user";
  content_message: string;
};

type WaitingFor = "input" | "input_number" | null;

export default function ChatUI() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [waitingFor, setWaitingFor] = useState<WaitingFor>(null);
  const [loading, setLoading] = useState(false);

  // 🔹 inicia a sessão
  async function startSession() {
    setLoading(true);

    const res = await fetch("/api/chat/start", {
      method: "POST",
    });

    const data = await res.json();

    setSessionId(data.sessionId);
    setMessages(data.messages);
    setWaitingFor(data.waitingFor);

    setLoading(false);
  }

  useEffect(() => {
    // defer calling startSession to avoid synchronous setState inside the effect
    (async () => {
      await Promise.resolve();
      await startSession();
    })();
  }, []);

  async function sendMessage() {
    if (!input.trim() || !sessionId || loading || !waitingFor) return;

    setLoading(true);

    const res = await fetch("/api/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        message: input,
      }),
    });

    const data = await res.json();

    setMessages(data.messages);
    setWaitingFor(data.waitingFor);
    setInput("");

    setLoading(false);
  }

  return (
    <div className='p-6 bg-gray-300 border border-red-600 h-full'>
      <h2>🤖 Chatbot</h2>

      <div className='min-h-[200px] border border-red-600'>
        {messages.map((msg, i) => (
          <div key={i}>
            <strong>{msg.from}:</strong> {msg.content_message}
          </div>
        ))}
      </div>

      {waitingFor && !loading ? (
        <div>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              waitingFor === "input_number"
              ? "Digite um número..."
              : "Digite sua resposta..."
            }
          />
          <button onClick={sendMessage}>
            Enviar
          </button>
        </div>
      ) : (
        <p>Aguardando resposta do bot...</p>
      )}
    </div>
  );
}
