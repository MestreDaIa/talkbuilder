import {
  Play, Webhook, Globe, CornerUpRight, Send,
  MessageSquare, Hash, Image as ImageIcon, Video, Mic, FileText,
  TextCursorInput, Mail, Phone, MousePointerClick, Link2,
  Variable, Code2, GitBranch, Clock, Hourglass,
  Sparkles, Bot,
  Sheet, UserRound,
} from "lucide-react";

export type NodeCategory = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string; // tailwind classes for chip
  description: string;
};

export type NodeField = {
  name: string;
  type: string;
  required?: boolean;
  description: string;
};

export type NodeDoc = {
  id: string;
  title: string;
  category: string;
  icon: React.ComponentType<{ className?: string }>;
  summary: string;
  description: string;
  useCases: string[];
  fields: NodeField[];
  example: string; // JSON string
  outputs?: string[]; // saída(s) / handles
};

export const nodeCategories: NodeCategory[] = [
  { id: "flow",         label: "Flow",         icon: Play,        color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", description: "Controle geral do fluxo: início, redirecionamentos e chamadas externas." },
  { id: "bubbles",      label: "Bubbles",      icon: MessageSquare, color: "text-sky-400 bg-sky-500/10 border-sky-500/30",         description: "Mensagens enviadas pelo bot ao usuário (texto, mídia, arquivos)." },
  { id: "inputs",       label: "Inputs",       icon: TextCursorInput, color: "text-amber-400 bg-amber-500/10 border-amber-500/30",  description: "Coleta de dados do usuário com validação por tipo." },
  { id: "logic",        label: "Logic",        icon: GitBranch,   color: "text-violet-400 bg-violet-500/10 border-violet-500/30",  description: "Variáveis, scripts, condições e temporização." },
  { id: "ai",           label: "AI",           icon: Sparkles,    color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30",        description: "Geração de resposta e agentes com LLMs." },
  { id: "integrations", label: "Integrações",  icon: Sheet,       color: "text-rose-400 bg-rose-500/10 border-rose-500/30",        description: "Serviços externos (Sheets, Human Handoff, etc)." },
];

const j = (o: unknown) => JSON.stringify(o, null, 2);

export const nodeDocs: NodeDoc[] = [
  /* ------------------------- FLOW ------------------------- */
  {
    id: "start", title: "Start", category: "flow", icon: Play,
    summary: "Ponto de entrada obrigatório do bot.",
    description: "Cada fluxo deve ter exatamente um bloco Start. É por ele que o runtime começa a execução. Pode inicializar variáveis padrão e definir uma mensagem de boas-vindas.",
    useCases: ["Inicializar sessão", "Definir variáveis de contexto (canal, idioma, tenant)"],
    fields: [
      { name: "welcomeMessage", type: "string", description: "Mensagem opcional enviada antes do primeiro nó." },
      { name: "initialVariables", type: "Record<string,string>", description: "Variáveis pré-populadas no contexto." },
    ],
    example: j({ id: "n1", type: "start", config: { welcomeMessage: "Olá 👋", initialVariables: { canal: "web" } } }),
    outputs: ["next"],
  },
  {
    id: "webhook", title: "Webhook", category: "logic", icon: Webhook,
    summary: "Recebe payload externo e injeta no contexto.",
    description: "Cria um endpoint exclusivo do fluxo que aceita POST. O corpo é gravado na variável configurada e o fluxo continua a partir deste nó.",
    useCases: ["Iniciar fluxo por evento externo", "Sincronização com CRM"],
    fields: [
      { name: "variableName", type: "string", required: true, description: "Onde salvar o payload recebido." },
      { name: "secret", type: "string", description: "Opcional. Valida header x-webhook-secret." },
    ],
    example: j({ id: "n2", type: "webhook", config: { variableName: "payload", secret: "shh" } }),
  },
  {
    id: "http-request", title: "HTTP Request", category: "logic", icon: Globe,
    summary: "Chamada HTTP síncrona a uma API externa.",
    description: "Executa GET/POST/PUT/PATCH/DELETE com headers, query e body dinâmicos (aceita interpolação {{variavel}}). A resposta é salva em variável e pode ter branches por status.",
    useCases: ["Consultar CRM", "Criar lead", "Buscar disponibilidade"],
    fields: [
      { name: "method", type: "'GET'|'POST'|'PUT'|'PATCH'|'DELETE'", required: true, description: "Verbo HTTP." },
      { name: "url", type: "string", required: true, description: "URL completa; aceita {{variaveis}}." },
      { name: "headers", type: "Record<string,string>", description: "Headers da requisição." },
      { name: "body", type: "string | object", description: "Body (JSON ou raw)." },
      { name: "saveResponseTo", type: "string", description: "Variável para armazenar body de resposta." },
      { name: "timeoutMs", type: "number", description: "Timeout. Default 15000." },
    ],
    example: j({
      id: "n3", type: "http-request",
      config: { method: "POST", url: "https://api.exemplo.com/leads", headers: { "Content-Type": "application/json" }, body: { nome: "{{nome}}" }, saveResponseTo: "lead" },
    }),
    outputs: ["success", "error"],
  },
  {
    id: "redirect", title: "Redirect", category: "flow", icon: CornerUpRight,
    summary: "Envia o usuário para uma URL externa (canais web).",
    description: "Em canais web, dispara redirect no browser. Em canais como WhatsApp, envia como link clicável.",
    useCases: ["Pagamento externo", "Formulário de terceiros"],
    fields: [
      { name: "url", type: "string", required: true, description: "URL de destino." },
      { name: "openInNewTab", type: "boolean", description: "Default true." },
    ],
    example: j({ id: "n4", type: "redirect", config: { url: "https://pagar.me/{{orderId}}" } }),
  },
  {
    id: "go-to", title: "Go To", category: "flow", icon: Send,
    summary: "Salta para outro bloco/fluxo.",
    description: "Redireciona a execução para outro container ou fluxo publicado, sem terminar a sessão.",
    useCases: ["Reaproveitar sub-fluxos", "Menu principal"],
    fields: [
      { name: "targetContainerId", type: "string", description: "ID do container destino." },
      { name: "targetFlowId", type: "string", description: "ID/public_id de outro bot." },
    ],
    example: j({ id: "n5", type: "go-to", config: { targetContainerId: "menu-principal" } }),
  },

  /* ------------------------- BUBBLES ------------------------- */
  {
    id: "bubble-text", title: "Text Bubble", category: "bubbles", icon: MessageSquare,
    summary: "Envia texto com formatação rica.",
    description: "Suporta HTML (Tiptap): negrito, itálico, sublinhado, listas, links e variáveis {{var}}. Renderizado como bolha do bot no chat.",
    useCases: ["Instrução", "Explicação", "Confirmação"],
    fields: [
      { name: "content", type: "string (HTML)", required: true, description: "Corpo em Tiptap/HTML." },
      { name: "typingDelayMs", type: "number", description: "Simula digitação antes de enviar." },
    ],
    example: j({ id: "b1", type: "bubble-text", config: { content: "<p>Olá <strong>{{nome}}</strong></p>", typingDelayMs: 800 } }),
  },
  {
    id: "bubble-number", title: "Number Bubble", category: "bubbles", icon: Hash,
    summary: "Envia um número formatado.",
    description: "Renderiza número com máscara e locale.",
    useCases: ["Exibir preço", "Exibir métricas"],
    fields: [
      { name: "value", type: "number | string", required: true, description: "Valor ou {{variavel}}." },
      { name: "format", type: "'currency'|'decimal'|'percent'", description: "Formato de exibição." },
      { name: "locale", type: "string", description: "ex: pt-BR." },
    ],
    example: j({ id: "b2", type: "bubble-number", config: { value: "{{total}}", format: "currency", locale: "pt-BR" } }),
  },
  {
    id: "bubble-image", title: "Image Bubble", category: "bubbles", icon: ImageIcon,
    summary: "Envia imagem via URL.", description: "Aceita URLs públicas (JPG/PNG/WEBP). No WhatsApp é anexada como mídia.",
    useCases: ["Catálogo", "Confirmação visual"],
    fields: [
      { name: "url", type: "string", required: true, description: "URL da imagem." },
      { name: "caption", type: "string", description: "Legenda opcional." },
    ],
    example: j({ id: "b3", type: "bubble-image", config: { url: "https://cdn.exemplo.com/foto.jpg", caption: "Nosso produto" } }),
  },
  {
    id: "bubble-video", title: "Video Bubble", category: "bubbles", icon: Video,
    summary: "Envia vídeo por URL ou embed.", description: "URLs diretas (MP4) ou YouTube/Vimeo (embed).",
    useCases: ["Onboarding em vídeo", "Tutorial"],
    fields: [
      { name: "url", type: "string", required: true, description: "URL do vídeo." },
      { name: "autoplay", type: "boolean", description: "Web apenas." },
    ],
    example: j({ id: "b4", type: "bubble-video", config: { url: "https://youtu.be/xyz" } }),
  },
  {
    id: "bubble-audio", title: "Audio Bubble", category: "bubbles", icon: Mic,
    summary: "Envia áudio (mp3/ogg).", description: "Ideal para mensagem de voz. No WhatsApp entrega como PTT quando ogg/opus.",
    useCases: ["Mensagem de voz", "Podcast curto"],
    fields: [
      { name: "url", type: "string", required: true, description: "URL do áudio." },
      { name: "ptt", type: "boolean", description: "Envia como voz (WhatsApp)." },
    ],
    example: j({ id: "b5", type: "bubble-audio", config: { url: "https://cdn/audio.ogg", ptt: true } }),
  },
  {
    id: "bubble-document", title: "Document Bubble", category: "bubbles", icon: FileText,
    summary: "Envia PDF ou arquivo genérico.",
    description: "Aceita URL de arquivo. Recomendado PDF, DOCX, XLSX.",
    useCases: ["Enviar contrato", "Enviar orçamento"],
    fields: [
      { name: "url", type: "string", required: true, description: "URL do documento." },
      { name: "fileName", type: "string", description: "Nome exibido." },
    ],
    example: j({ id: "b6", type: "bubble-document", config: { url: "https://cdn/proposta.pdf", fileName: "Proposta.pdf" } }),
  },

  /* ------------------------- INPUTS ------------------------- */
  {
    id: "input-text", title: "Text Input", category: "inputs", icon: TextCursorInput,
    summary: "Coleta texto livre do usuário.",
    description: "Aguarda mensagem do usuário e salva em variável. Suporta placeholder, tamanho mín/máx e retry.",
    useCases: ["Nome", "Observação", "Endereço"],
    fields: [
      { name: "variableName", type: "string", required: true, description: "Onde salvar." },
      { name: "placeholder", type: "string", description: "Texto do campo (web)." },
      { name: "minLength", type: "number", description: "Comprimento mínimo." },
      { name: "maxLength", type: "number", description: "Comprimento máximo." },
      { name: "retryMessage", type: "string", description: "Mensagem em caso de erro de validação." },
    ],
    example: j({ id: "i1", type: "input-text", config: { variableName: "nome", placeholder: "Digite seu nome", minLength: 2 } }),
  },
  {
    id: "input-number", title: "Number Input", category: "inputs", icon: Hash,
    summary: "Coleta número com validação.",
    description: "Aceita apenas dígitos. Suporta range e casas decimais.",
    useCases: ["Idade", "Quantidade", "Valor"],
    fields: [
      { name: "variableName", type: "string", required: true, description: "Onde salvar." },
      { name: "min", type: "number", description: "Valor mínimo." },
      { name: "max", type: "number", description: "Valor máximo." },
      { name: "allowDecimals", type: "boolean", description: "Default false." },
    ],
    example: j({ id: "i2", type: "input-number", config: { variableName: "idade", min: 18, max: 120 } }),
  },
  {
    id: "input-mail", title: "Email Input", category: "inputs", icon: Mail,
    summary: "Coleta e valida email.", description: "Regex RFC 5322 simplificada. Rejeita e reenvia mensagem de erro.",
    useCases: ["Cadastro", "Envio de proposta"],
    fields: [
      { name: "variableName", type: "string", required: true, description: "Onde salvar." },
      { name: "retryMessage", type: "string", description: "Msg em erro." },
    ],
    example: j({ id: "i3", type: "input-mail", config: { variableName: "email" } }),
  },
  {
    id: "input-phone", title: "Phone Input", category: "inputs", icon: Phone,
    summary: "Coleta telefone com formatação por país.",
    description: "Suporta E.164. Detecta país por prefixo ou por defaultCountry.",
    useCases: ["Cadastro", "WhatsApp opt-in"],
    fields: [
      { name: "variableName", type: "string", required: true, description: "Onde salvar." },
      { name: "defaultCountry", type: "string", description: "ISO-2, ex: 'BR'." },
    ],
    example: j({ id: "i4", type: "input-phone", config: { variableName: "telefone", defaultCountry: "BR" } }),
  },
  {
    id: "input-image", title: "Image Input", category: "inputs", icon: ImageIcon,
    summary: "Recebe upload de imagem.", description: "No WhatsApp captura mídia recebida. No web, componente de upload. Retorna URL pública.",
    useCases: ["Enviar RG", "Foto do produto"],
    fields: [
      { name: "variableName", type: "string", required: true, description: "Onde salvar URL." },
      { name: "maxSizeMb", type: "number", description: "Tamanho máximo." },
    ],
    example: j({ id: "i5", type: "input-image", config: { variableName: "foto_rg", maxSizeMb: 5 } }),
  },
  {
    id: "input-video",    title: "Video Input",    category: "inputs", icon: Video,     summary: "Recebe upload de vídeo.", description: "Como input-image porém para vídeos.", useCases: ["Depoimento"], fields: [{ name: "variableName", type: "string", required: true, description: "Onde salvar URL." }], example: j({ id: "i6", type: "input-video", config: { variableName: "video" } }) },
  {
    id: "input-audio",    title: "Audio Input",    category: "inputs", icon: Mic,       summary: "Recebe áudio.", description: "Aceita gravação de voz. Retorna URL do arquivo.", useCases: ["Comando de voz"], fields: [{ name: "variableName", type: "string", required: true, description: "Onde salvar URL." }], example: j({ id: "i7", type: "input-audio", config: { variableName: "audio" } }) },
  {
    id: "input-document", title: "Document Input", category: "inputs", icon: FileText,  summary: "Recebe documento (PDF/DOCX).", description: "Aceita upload de arquivos até maxSizeMb.", useCases: ["Contrato assinado"], fields: [{ name: "variableName", type: "string", required: true, description: "Onde salvar URL." }, { name: "maxSizeMb", type: "number", description: "Tamanho máximo." }], example: j({ id: "i8", type: "input-document", config: { variableName: "contrato" } }) },
  {
    id: "input-universal", title: "Universal Input", category: "inputs", icon: TextCursorInput,
    summary: "Aceita qualquer mensagem do usuário (texto ou mídia).",
    description: "Salva o payload cru na variável. Útil quando não se quer validar.",
    useCases: ["Chat livre", "Handoff"],
    fields: [{ name: "variableName", type: "string", required: true, description: "Onde salvar." }],
    example: j({ id: "i9", type: "input-universal", config: { variableName: "msg" } }),
  },
  {
    id: "input-buttons", title: "Buttons Input", category: "inputs", icon: MousePointerClick,
    summary: "Botões clicáveis com escolha única ou múltipla.",
    description: "Renderiza como quick replies (WhatsApp) ou botões (web). Cada botão pode ter valor, descrição e redirect próprio. Cria handles de saída para roteamento condicional.",
    useCases: ["Menu principal", "Sim/Não", "Escolha de produto"],
    fields: [
      { name: "buttons", type: "ButtonConfig[]", required: true, description: "Array de {id,label,value?,description?,redirectUrl?}." },
      { name: "saveVariable", type: "string", description: "Onde salvar o value escolhido." },
      { name: "isMultipleChoice", type: "boolean", description: "Permite marcar mais de um." },
      { name: "isSearchable", type: "boolean", description: "Ativa busca (listas grandes)." },
      { name: "submitLabel", type: "string", description: "Texto do botão confirmar (múltipla)." },
    ],
    example: j({
      id: "i10", type: "input-buttons",
      config: {
        saveVariable: "opcao",
        buttons: [
          { id: "b1", label: "Comprar", value: "buy" },
          { id: "b2", label: "Falar com humano", value: "human" },
        ],
      },
    }),
    outputs: ["por-botão"],
  },
  {
    id: "input-webSite", title: "Website Input", category: "inputs", icon: Link2,
    summary: "Valida URL de site.", description: "Regex de URL http/https. Ideal para coletar landing page do lead.",
    useCases: ["Domínio da empresa"],
    fields: [{ name: "variableName", type: "string", required: true, description: "Onde salvar." }],
    example: j({ id: "i11", type: "input-webSite", config: { variableName: "site" } }),
  },

  /* ------------------------- LOGIC ------------------------- */
  {
    id: "set-variable", title: "Set Variable", category: "logic", icon: Variable,
    summary: "Cria/atualiza uma variável no contexto.",
    description: "Aceita valor literal, referência a outra variável ({{var}}) ou expressão simples.",
    useCases: ["Marcar etapa", "Concatenar strings"],
    fields: [
      { name: "name", type: "string", required: true, description: "Nome da variável." },
      { name: "value", type: "string", required: true, description: "Valor (aceita interpolação)." },
    ],
    example: j({ id: "l1", type: "set-variable", config: { name: "etapa", value: "qualificacao" } }),
  },
  {
    id: "script", title: "Script", category: "logic", icon: Code2,
    summary: "Executa JavaScript sandboxed.",
    description: "Recebe o objeto vars e pode retornar { vars, next }. Timeout padrão 500ms. Sem acesso a rede/FS.",
    useCases: ["Cálculos", "Transformações", "Roteamento custom"],
    fields: [
      { name: "code", type: "string", required: true, description: "Código JS. Argumento: vars. Retorno opcional: { vars, next }." },
      { name: "timeoutMs", type: "number", description: "Default 500." },
    ],
    example: j({ id: "l2", type: "script", config: { code: "vars.total = (vars.qtd || 0) * 19.9; return { vars };" } }),
  },
  {
    id: "condition", title: "Condition", category: "logic", icon: GitBranch,
    summary: "Ramifica fluxo por regras compostas.",
    description: "Grupos de comparações com AND/OR. Operadores: equals, contains, greater_than, is_set, matches_regex, etc. Cada grupo é um handle de saída.",
    useCases: ["Se plano=pro → premium", "Se estado=SP → frete-x"],
    fields: [
      { name: "groups", type: "ConditionGroup[]", required: true, description: "Array de grupos com comparações." },
    ],
    example: j({
      id: "l3", type: "condition",
      config: { groups: [{ id: "g1", logicalOperator: "AND", comparisons: [{ id: "c1", variableName: "plano", operator: "equals", value: "pro" }] }] },
    }),
    outputs: ["por-grupo", "else"],
  },
  {
    id: "wait", title: "Wait", category: "logic", icon: Clock,
    summary: "Aguarda tempo fixo antes de seguir.",
    description: "Pausa a execução por N milissegundos. Não bloqueia outras sessões.",
    useCases: ["Espaçar mensagens", "Simular digitação"],
    fields: [{ name: "durationMs", type: "number", required: true, description: "Duração em ms." }],
    example: j({ id: "l4", type: "wait", config: { durationMs: 2000 } }),
  },

  /* ------------------------- AI ------------------------- */
  {
    id: "ai-node", title: "AI Completion", category: "ai", icon: Sparkles,
    summary: "Geração de texto com LLM (one-shot).",
    description: "Envia prompt + contexto para o provedor e salva a resposta em variável. Suporta base de conhecimento (RAG).",
    useCases: ["Resposta FAQ", "Reescrita", "Classificação"],
    fields: [
      { name: "provider", type: "'openai'|'google'|'anthropic'", required: true, description: "Provedor do modelo." },
      { name: "model", type: "string", required: true, description: "ex: gpt-4o-mini." },
      { name: "systemPrompt", type: "string", description: "Instrução base." },
      { name: "prompt", type: "string", required: true, description: "Prompt (aceita {{var}})." },
      { name: "temperature", type: "number", description: "0..1. Default 0.4." },
      { name: "knowledgeBaseId", type: "string", description: "Ativa RAG com KB." },
      { name: "saveResponseTo", type: "string", required: true, description: "Onde salvar a resposta." },
    ],
    example: j({
      id: "ai1", type: "ai-node",
      config: { provider: "openai", model: "gpt-4o-mini", systemPrompt: "Você é um vendedor educado.", prompt: "Cliente: {{msg}}. Responda em 2 frases.", saveResponseTo: "resposta" },
    }),
  },
  {
    id: "ai-agent", title: "AI Agent", category: "ai", icon: Bot,
    summary: "Agente multi-turno com ferramentas.",
    description: "Mantém memória da conversa, chama ferramentas (functions), pode encerrar por intent e transferir para humano.",
    useCases: ["Atendimento contínuo", "Assistente comercial"],
    fields: [
      { name: "provider", type: "string", required: true, description: "Provedor LLM." },
      { name: "model", type: "string", required: true, description: "Modelo." },
      { name: "systemPrompt", type: "string", required: true, description: "Persona do agente." },
      { name: "tools", type: "Tool[]", description: "Funções callable pelo agente." },
      { name: "handoffKeyword", type: "string", description: "Se detectada, sai do agente." },
      { name: "maxTurns", type: "number", description: "Limite de turnos. Default 20." },
    ],
    example: j({
      id: "ai2", type: "ai-agent",
      config: { provider: "openai", model: "gpt-4o", systemPrompt: "Assistente comercial. Colete nome, email e produto.", handoffKeyword: "humano", maxTurns: 15 },
    }),
    outputs: ["completed", "handoff", "timeout"],
  },

  /* ------------------------- INTEGRATIONS ------------------------- */
  {
    id: "google-sheets", title: "Google Sheets", category: "integrations", icon: Sheet,
    summary: "Escreve/lê linhas em uma planilha.",
    description: "Requer conexão OAuth do workspace com Google. Suporta append, read, update por range.",
    useCases: ["Log de leads", "Consulta de estoque"],
    fields: [
      { name: "operation", type: "'append'|'read'|'update'", required: true, description: "Ação." },
      { name: "spreadsheetId", type: "string", required: true, description: "ID da planilha." },
      { name: "range", type: "string", required: true, description: "ex: Leads!A:E." },
      { name: "values", type: "any[][]", description: "Valores para append/update." },
      { name: "saveResponseTo", type: "string", description: "Onde salvar (read)." },
    ],
    example: j({
      id: "int1", type: "google-sheets",
      config: { operation: "append", spreadsheetId: "1AbC...", range: "Leads!A:C", values: [["{{nome}}", "{{email}}", "{{telefone}}"]] },
    }),
  },
  {
    id: "human-handoff", title: "Human Handoff", category: "integrations", icon: UserRound,
    summary: "Transfere conversa para atendente humano.",
    description: "Pausa o bot para aquela sessão, notifica a fila configurada (departamento/tag) e mantém histórico visível ao atendente.",
    useCases: ["Escalar suporte", "Fechar venda com humano"],
    fields: [
      { name: "department", type: "string", description: "Fila/depto de destino." },
      { name: "tags", type: "string[]", description: "Tags de prioridade/skill." },
      { name: "message", type: "string", description: "Mensagem exibida ao usuário no handoff." },
      { name: "resumeOnTimeout", type: "boolean", description: "Retomar bot se ninguém atender em X min." },
    ],
    example: j({ id: "int2", type: "human-handoff", config: { department: "vendas", tags: ["pro"], message: "Encaminhando para um consultor 👤" } }),
  },
];
