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

  // 3.5. Data/hora atual (injetada automaticamente para o agente nunca "viajar no tempo")
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const isoDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const humanDate = now.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
  const dateStr = `\n\n[DATA E HORA ATUAL - FONTE DA VERDADE]\nHoje é ${humanDate} (${tz}).\nData ISO (use este formato em APIs): ${isoDate}\nTimestamp: ${now.toISOString()}\n\nREGRAS OBRIGATÓRIAS SOBRE DATA:\n- NUNCA invente datas nem use datas de treinamento. A ÚNICA data válida é a informada acima.\n- Quando o usuário disser "hoje", "amanhã", "próxima semana", etc., calcule a partir da data acima.\n- Ao chamar APIs que exigem datas (from/to, agendamentos, etc.), use SEMPRE datas iguais ou posteriores a ${isoDate}, nunca no passado.`;

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
      role: msg.role === "assistant" ? "assistant" : msg.role,
      content: msg.content
    }))
  };
};