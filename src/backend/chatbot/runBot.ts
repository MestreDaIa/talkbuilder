import { Session, ChatNode } from "@/types/chatbot";
import { flow } from "@/data/flow";
import { runners } from "./runners";

export function runBot(
    session: Session, 
    userMessage?: string
  ): Session & { waitingFor: boolean } {

  const node: ChatNode | undefined = flow.find(
    n => n.id === session.currentNodeId
  );

  if(!node) return { ...session, waitingFor: false };

  // se o node é input e o usuario respondeu

  if(node.type === "input" && userMessage !== undefined) {
    session.messages.push({
      from: "user", 
      content_message: userMessage,
    });

    if(node.next) {
      session.currentNodeId = node.next!;
      return runBot(session);
    }

    return { ...session, waitingFor: false };
  }

  if(node.type === "input_number" && userMessage !== undefined) {
    const valueInputNumber = Number(userMessage);
    if(isNaN(valueInputNumber)) return { ...session, waitingFor: true };

    
    session.messages.push({
      from: "user",
      content_message: userMessage
    });

    session.currentNodeId = node.next!;
    return runBot(session);
  }

  const runner = runners[node.type];
  if(!runner) throw new Error(`Runner não encontrado para ${node.type}`);
  
  const result = runner(session, node);
  
  if(result.action === "ADVANCE" && result.next) {
    session.currentNodeId = result.next;
    return runBot(session);
  }



  return {...session, waitingFor: false};
}