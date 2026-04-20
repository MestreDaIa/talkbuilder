import { flow } from "@/data/flow";

export function getWaitingFor(nodeId: string) {
  const node = flow.find(n => n.id === nodeId);
  if (!node) return null;

  if (node.type === "input") return "input";
  if (node.type === "input_number") return "input_number";

  return null;
}
