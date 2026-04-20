import { ChatNode  } from "@/types/chatbot";

export const flow: ChatNode[] = [
  {
    id: "start",
    type: "bubble",
    content: "Ola qual é o seu nome ?",
    next: "input_Name",
  },
  {
    id: "input_Name",
    type: "input",
    next: "ask_age"
  },
  {
    id: "ask_age",
    type: "bubble",
    content: "qual sua idade?",
    next: "input_age"
  },
  {
    id: "input_age",
    type: "input_number",
    next: "end"
  },
  {
    id: "end",
    type: "bubble",
    content: "Obrigado por compartilhar suas informações!",
  },
];
