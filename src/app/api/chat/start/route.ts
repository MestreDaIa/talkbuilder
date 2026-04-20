export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";

import { createSession, saveSession } from "@/backend/chatbot/sessionStore";
import { runBot } from "@/backend/chatbot/runBot";
import { Session } from "@/types/chatbot";
import { flow } from "@/data/flow";

export async function POST() {
  // 1️⃣ cria sessão
  const session: Session = {
    id: crypto.randomUUID(),
    currentNodeId: "start",
    messages: [],
  };

  createSession(session);

  // 2️⃣ roda motor (bot inicia)
  const updatedSession = runBot(session);

  saveSession(updatedSession);

  // 3️⃣ descobre node atual
  const currentNode = flow.find(
    n => n.id === updatedSession.currentNodeId
  );

  // 4️⃣ define o que o bot espera
  let waitingFor: "input" | "input_number" | null = null;

  if (currentNode) {
    if (currentNode.type === "input") waitingFor = "input";
    if (currentNode.type === "input_number") waitingFor = "input_number";
  }

  // 5️⃣ resposta limpa e previsível
  return NextResponse.json({
    sessionId: updatedSession.id,
    messages: updatedSession.messages,
    currentNodeId: updatedSession.currentNodeId,
    waitingFor,
  });
}
