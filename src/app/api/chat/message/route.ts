export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getSession, saveSession } from "@/backend/chatbot/sessionStore";
import { runBot } from "@/backend/chatbot/runBot";
import { flow } from "@/data/flow";
// import { isWaitingInput } from "@/backend/chatbot/isWaitingInput";

export async function POST(req: Request) {
  const { sessionId, message } = await req.json();

  if (!sessionId || message === undefined) {
    return NextResponse.json(
      { error: "sessionId e message são obrigatórios" },
      { status: 400 }
    );
  }

  const session = getSession(sessionId);

  if (!session) {
    return NextResponse.json(
      { error: "Sessão não encontrada" },
      { status: 404 }
    );
  }

  const updatedSession = runBot(session, message);

  saveSession(updatedSession);

  const currentNode = flow.find(
    n => n.id === updatedSession.currentNodeId
  );

  let waitingFor: "input" | "input_number" | null = null;

  if (currentNode) {
    if (currentNode.type === "input") waitingFor = "input";
    if (currentNode.type === "input_number") waitingFor = "input_number";
  }

  return NextResponse.json({
    sessionId: updatedSession.id,
    messages: updatedSession.messages,
    currentNodeId: updatedSession.currentNodeId,
    waitingFor,
  });
}
