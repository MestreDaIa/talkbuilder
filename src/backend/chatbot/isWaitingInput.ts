import { NodeType } from "@/types/chatbot";

export function isWaitingInput(type: NodeType): boolean {
  return type === "input" || type === "input_number";
}
