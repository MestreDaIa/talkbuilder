import { Message, PersistentMemory } from "../types/runtime";

interface BuildContextOptions {
  systemPrompt: string;
  history: Message[];
  persistentMemory: PersistentMemory;
  variables: Record<string, any>;
  knowledgeBase?: any;
  tools?: any[];
  maxHistoryMessages?: number;
}

export const buildAgentContext = ({
  systemPrompt,
  history,
  persistentMemory,
  variables,
  knowledgeBase,
  tools,
  maxHistoryMessages = 15
}: BuildContextOptions) => {
  // 1. Truncamento inteligente do histórico
  const recentHistory = history.slice(-maxHistoryMessages);

  // 2. Formatação da memória persistente
  const memoryStr = Object.keys(persistentMemory).length > 0 
    ? `\nMemória do Usuário:\n${JSON.stringify(persistentMemory, null, 2)}`
    : "";

  // 3. Formatação das variáveis
  const varsStr = Object.keys(variables).length > 0
    ? `\nVariáveis do Fluxo:\n${JSON.stringify(variables, null, 2)}`
    : "";

  // 4. Formatação da Base de Conhecimento
  let kbStr = "";
  if (knowledgeBase) {
    const files = (knowledgeBase.kbFiles || [])
      .filter((f: any) => knowledgeBase.kbFilesEnabled && f.content)
      .map((f: any) => `Arquivo: ${f.name}\nConteúdo: ${f.content}`)
      .join("\n\n");
    
    const links = (knowledgeBase.kbLinks || [])
      .filter((l: any) => knowledgeBase.kbLinksEnabled && l.url)
      .map((l: any) => `Link: ${l.url}`)
      .join("\n");

    if (files || links) {
      kbStr = `\n\nBASE DE CONHECIMENTO:\n${files}\n${links}`;
    }
  }

  // 5. Montagem do prompt do sistema
  const fullSystemPrompt = `${systemPrompt}${memoryStr}${varsStr}${kbStr}`;

  return {
    system: fullSystemPrompt,
    messages: recentHistory.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : msg.role,
      content: msg.content
    }))
  };
};
