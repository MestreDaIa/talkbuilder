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

  // 3. Formatação das variáveis (sanitizadas)
  // Remove chaves internas do runtime e blobs grandes (respostas de API cacheadas),
  // que poluem o contexto e fazem o agente reutilizar dados antigos em novas operações.
  const INTERNAL_VAR_KEYS = new Set([
    "httpResponse",
    "last_message",
    "last_user_message",
  ]);
  const isLargeBlob = (v: any) => {
    if (v == null || typeof v !== "object") return false;
    try {
      const s = JSON.stringify(v);
      return s.length > 400; // respostas completas de endpoints não devem entrar no prompt
    } catch { return true; }
  };
  const cleanVariables: Record<string, any> = {};
  for (const [k, v] of Object.entries(variables || {})) {
    if (k.startsWith("__")) continue;              // flags internas (ex.: __dynamicSkillDispatch)
    if (INTERNAL_VAR_KEYS.has(k)) continue;        // caches genéricos do runtime
    if (isLargeBlob(v)) continue;                  // respostas completas de API cacheadas
    cleanVariables[k] = v;
  }
  const varsStr = Object.keys(cleanVariables).length > 0
    ? `\n\n[VARIÁVEIS DO FLUXO]\n${JSON.stringify(cleanVariables, null, 2)}\n\nATENÇÃO: os valores acima podem ter sido coletados em interações ANTERIORES. Ao iniciar uma NOVA operação (novo agendamento, novo cadastro, nova compra, etc.), NÃO os reutilize automaticamente — confirme cada campo com o usuário novamente antes de chamar skills que criem, atualizem ou apaguem dados (POST/PUT/PATCH/DELETE).`
    : "";

  // 3.5. Data/hora atual (injetada automaticamente para o agente nunca "viajar no tempo")
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const isoDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const humanDate = now.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
  const dateStr = `\n\n[DATA E HORA ATUAL - FONTE DA VERDADE]\nHoje é ${humanDate} (${tz}).\nData ISO (use este formato em APIs): ${isoDate}\nTimestamp: ${now.toISOString()}\n\nREGRAS OBRIGATÓRIAS SOBRE DATA:\n- NUNCA invente datas nem use datas de treinamento. A ÚNICA data válida é a informada acima.\n- Quando o usuário disser "hoje", "amanhã", "próxima semana", etc., calcule a partir da data acima.\n- Ao chamar APIs que exigem datas (from/to, agendamentos, etc.), use SEMPRE datas iguais ou posteriores a ${isoDate}, nunca no passado.\n\nREGRA OBRIGATÓRIA SOBRE REUSO DE DADOS:\n- Cada nova solicitação do usuário é uma operação NOVA. Não copie datas, horários, IDs, nomes, e-mails ou qualquer valor de uma operação anterior — mesmo que estejam em [VARIÁVEIS DO FLUXO] ou apareçam no histórico. Sempre pergunte/valide com o usuário antes de submeter.`;

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
  const fullSystemPrompt = `${systemPrompt}${dateStr}${memoryStr}${varsStr}${kbStr}\n\nResponda sempre de forma natural e prestativa.`;

  console.log("[aiContextBuilder] Full System Prompt created. KB present:", !!kbStr);

  return {
    system: fullSystemPrompt,
    messages: recentHistory.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : msg.role,
      content: msg.content
    }))
  };
};