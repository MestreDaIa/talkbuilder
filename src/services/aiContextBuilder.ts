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
  const liveVariableKeys = new Set(
    Array.isArray((variables as any)?.__liveVariableKeys)
      ? (variables as any).__liveVariableKeys.map((key: unknown) => String(key))
      : []
  );
  for (const [k, v] of Object.entries(variables || {})) {
    if (k.startsWith("__")) continue;              // flags internas (ex.: __dynamicSkillDispatch)
    if (INTERNAL_VAR_KEYS.has(k)) continue;        // caches genéricos do runtime
    if (liveVariableKeys.has(k)) continue;         // resultados Live Data são voláteis e precisam ser reconsultados
    if (isLargeBlob(v)) continue;                  // respostas completas de API cacheadas
    cleanVariables[k] = v;
  }
  const varsStr = Object.keys(cleanVariables).length > 0
    ? `\n\n[VARIÁVEIS DO FLUXO]\n${JSON.stringify(cleanVariables, null, 2)}\n\nREGRAS DE ESCOPO DOS DADOS: diferencie uma nova mensagem/etapa da mesma tarefa de uma nova tarefa. Durante a mesma tarefa, preserve e reutilize os dados já confirmados e os IDs retornados pelas Skills. Só trate os dados como antigos quando o usuário iniciar claramente outra tarefa ou corrigir/substituir explicitamente um valor. Antes de uma mutação, valide que os campos obrigatórios correspondem à tarefa atual; não pergunte novamente valores já confirmados e não use valores de exemplo/default como se fossem dados do usuário.`
    : "";

  // 3.5. Data/hora atual (injetada automaticamente para o agente nunca "viajar no tempo")
  const now = new Date();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const isoDate = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const humanDate = now.toLocaleString("pt-BR", { dateStyle: "full", timeStyle: "short" });
  const dateStr = `\n\n[DATA E HORA ATUAL - FONTE DA VERDADE]\nHoje é ${humanDate} (${tz}).\nData ISO (use este formato em APIs): ${isoDate}\nTimestamp: ${now.toISOString()}\n\nREGRAS OBRIGATÓRIAS SOBRE DATA:\n- NUNCA invente datas nem use datas de treinamento. A ÚNICA data válida é a informada acima.\n- Quando o usuário disser "hoje", "amanhã", "próxima semana", etc., calcule a partir da data acima.\n- Ao chamar APIs que exigem datas (from/to, agendamentos, etc.), use SEMPRE datas iguais ou posteriores a ${isoDate}, nunca no passado.\n\nREGRA OBRIGATÓRIA SOBRE REUSO DE DADOS:\n- Preserve os valores confirmados durante a tarefa atual, inclusive entre chamadas de Skills. Uma resposta curta como um horário, telefone ou forma de pagamento normalmente responde à etapa pendente da mesma tarefa; não inicie uma nova operação por causa disso.\n- Só descarte valores e IDs quando o usuário iniciar claramente outra tarefa ou corrigir um dado.\n- Antes de criar/alterar/pagar, confira os dados atuais disponíveis no histórico, nas variáveis e nos resultados de Skills. Não peça novamente dados já fornecidos e não use valores de exemplo, placeholders ou dados de outra sessão.`;

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
  const runtimeReliabilityRules = `\n\n[REGRAS DE CONFIABILIDADE DO AGENTE]\n- Preserve a solicitação atual e todos os dados que o usuário já confirmou durante a mesma tarefa. Uma resposta a uma etapa pendente (por exemplo telefone, nome, horário ou pagamento) NÃO inicia outra operação. Não volte etapas nem peça novamente dados que já estão disponíveis no histórico, nas variáveis ou nos resultados de Skills.\n- Após uma Skill, use o resultado real para decidir a próxima etapa; não repita uma chamada com os mesmos argumentos só porque o resultado foi um erro.\n- Erros HTTP 4xx (por exemplo 400, 401, 403, 404 e 422) são falhas definitivas daquela chamada/argumentos. Não faça retry da mesma requisição. Procure uma Skill alternativa que possa resolver a tarefa; se não houver, explique o impedimento de forma breve, mantendo o contexto e os dados já coletados.\n- Erros HTTP 408, 429 e 5xx podem ser temporários e só devem ser repetidos de forma limitada. Nunca repita operações que criam, alteram, cancelam ou pagam sem verificar o resultado anterior.\n- Não invente identificadores nem trate uma falha de API como se o usuário não tivesse informado os dados.\n- IDs, UUIDs, tokens, chaves e identificadores técnicos retornados pelas APIs são metadados internos: use-os nas Skills quando necessário, mas NUNCA os mostre na resposta ao usuário. Apresente nomes/descrições legíveis; só revele um identificador técnico se o usuário pedir explicitamente informação técnica.\n`;
  const fullSystemPrompt = `${systemPrompt}${runtimeReliabilityRules}${dateStr}${memoryStr}${varsStr}${kbStr}\n\nResponda sempre de forma natural e prestativa.`;

  console.log("[aiContextBuilder] Full System Prompt created. KB present:", !!kbStr);

  return {
    system: fullSystemPrompt,
    messages: recentHistory.map(msg => ({
      role: msg.role === "assistant" ? "assistant" : msg.role,
      content: msg.content
    }))
  };
};