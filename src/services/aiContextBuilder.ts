import { Message, PersistentMemory } from "../types/runtime";

interface BuildContextOptions {
  systemPrompt: string;
  history: Message[];
  persistentMemory: PersistentMemory;
  variables: Record<string, any>;
  knowledgeBase?: {
    kbFiles?: any[];
    kbFilesEnabled?: boolean;
    kbLinks?: any[];
    kbLinksEnabled?: boolean;
    knowledgeBaseId?: string;
  };
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
    ? `\n\n[MEMÓRIA DO USUÁRIO]\n${JSON.stringify(persistentMemory, null, 2)}`
    : "";

  // 3. Formatação das variáveis
  const varsStr = Object.keys(variables).length > 0
    ? `\n\n[VARIÁVEIS DO FLUXO]\n${JSON.stringify(variables, null, 2)}`
    : "";

  // 4. Formatação da Base de Conhecimento
  let kbStr = "";
  if (knowledgeBase) {
    const files = (knowledgeBase.kbFilesEnabled ? (knowledgeBase.kbFiles || []) : [])
      .filter((f: any) => f.content && f.content.length > 0)
      .map((f: any) => `### DOCUMENTO: ${f.name}\nCONTEÚDO:\n${f.content}`)
      .join("\n\n");
    
    const links = (knowledgeBase.kbLinksEnabled ? (knowledgeBase.kbLinks || []) : [])
      .filter((l: any) => l.url)
      .map((l: any) => `### FONTE (URL): ${l.url}\n${l.content ? `CONTEÚDO:\n${l.content}` : "(Conteúdo não disponível - use apenas a URL se necessário)"}`)
      .join("\n\n");

    if (files || links) {
      kbStr = `\n\n[INFORMAÇÕES DE SUPORTE - BASE DE CONHECIMENTO]\nVocê DEVE usar as informações abaixo como sua fonte principal de verdade. Se o usuário perguntar algo que está nestes documentos, responda EXATAMENTE o que está neles.\n\n${files}\n${links}`;
    }
  }


  // 5. Montagem do prompt do sistema
  const fullSystemPrompt = `${systemPrompt}${memoryStr}${varsStr}${kbStr}\n\nResponda sempre de forma natural e prestativa.`;

  console.log("[aiContextBuilder] Full System Prompt created. KB present:", !!kbStr);

  return {
    system: fullSystemPrompt,
    messages: recentHistory.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content
    }))
  };
};