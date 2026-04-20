import { Session, ChatNode } from "@/types/chatbot";

type RunnerResult = 
{ action: "ADVANCE"; next?: string } | { action: "WAIT" };

type Runner = (session: Session, node: ChatNode) => RunnerResult;

export const runners: Record<string, Runner> = {
  bubble: (session, node) => {
    session.messages.push({ 
      from: "bot", 
      content_message: node.content ?? "",
    }); 

    return {
      action: "ADVANCE",
      next: node.next
    };
  },

  input: () => {
    return {
      action: "WAIT"
    };
  },
  input_number: () => {
    return {
      action: "WAIT"
    };
  },
  
};
