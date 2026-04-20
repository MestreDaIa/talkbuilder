import { randomUUID } from "crypto";
import { runBot } from "./runBot";
import { Session } from "@/types/chatbot";



let session: Session = {
  id: randomUUID(),
  currentNodeId: "start",
  messages: [],
};

session = runBot(session);

// console.log("Apos Start");
// console.log("node atual:", session.currentNodeId);
console.log(session.messages);

session = runBot(session, "Adolf Hitler");

// console.log("apos input texto : Adolf Hitler");
console.log(session.messages);
// console.log("node atual:", session.currentNodeId);

session = runBot(session, "0");

// console.log("apos input numero : 0");
console.log(session.messages);
// console.log("node atual:", session.currentNodeId);
