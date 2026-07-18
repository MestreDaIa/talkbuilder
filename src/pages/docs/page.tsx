import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Activity,
  Blocks,
  Bot,
  BookOpen,
  ChevronRight,
  Compass,
  Copy,
  Globe,
  Key,
  Layers,
  Loader2,
  Play,
  Plug,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  Shield,
  Terminal,
  Webhook,
  Workflow,
  Zap,
} from "lucide-react";
import { nodeCategories, nodeDocs, type NodeDoc } from "./nodesCatalog";
import { systemGuides } from "./systemGuides";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type AuthKind = "apiKey" | "jwtHs256" | "none" | "webhook";

type ParamDef = {
  key: string;
  label: string;
  in: "path" | "query" | "header" | "body";
  required?: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: string;
};

type Endpoint = {
  id: string;
  method: HttpMethod;
  path: string;
  title: string;
  summary: string;
  description?: string;
  auth?: AuthKind;
  params?: ParamDef[];
  bodyExample?: string;
  responseExample: string;
  responseCodes?: { code: number; label: string }[];
  notes?: string[];
};

type SidebarGroup = {
  label: string;
  items: { id: string; label: string; method?: HttpMethod }[];
};

type ReferenceDoc = {
  id: string;
  title: string;
  body: React.ReactNode;
};

type ApiSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  baseUrl: string;
  description: string;
  auth: {
    type: AuthKind;
    description: string;
    example?: string;
  };
  sidebar: SidebarGroup[];
  endpoints: Record<string, Endpoint>;
  reference?: ReferenceDoc[];
  overview?: ReferenceDoc;
};

/* -------------------------------------------------------------------------- */
/* Constants                                                                   */
/* -------------------------------------------------------------------------- */

const API_PROXY_URL = "https://api-flowbuilder.zailom.com";
const FN = (name: string) => `${API_PROXY_URL}/functions/v1/${name}`;

const BOOKING_BASE = `${API_PROXY_URL}/booking-api`;
const RUNTIME_BASE = FN("chatbot-runtime");
const PROVISION_BASE = FN("provision-account");
const SYNC_PLAN_BASE = FN("sync-embed-plan");
const READ_PLAN_BASE = FN("embed-plan-status");
const WPP_WEBHOOK_BASE = FN("whatsapp-webhook");
const CRAWL_BASE = FN("crawl");

/* -------------------------------------------------------------------------- */
/* Booking Integration API                                                     */
/* -------------------------------------------------------------------------- */

const bookingEndpoints: Endpoint[] = [
  {
    id: "health",
    method: "GET",
    path: "/health",
    title: "Health Check",
    summary: "Confirma que a API pública está online.",
    description:
      "Use para testar rapidamente se a URL profissional da API está respondendo, sem expor URLs internas aos usuários.",
    auth: "none",
    responseExample: `{
  "ok": true,
  "service": "booking-api",
  "timestamp": "2026-07-05T12:00:00.000Z"
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 401, label: "Header ausente ou chave inválida" },
      { code: 403, label: "Chave desativada" },
      { code: 404, label: "Workspace não encontrado" },
    ],
  },
  {
    id: "workspace",
    method: "GET",
    path: "/workspace",
    title: "Workspace",
    summary: "Retorna dados completos do workspace autenticado.",
    description:
      "Devolve nome, slug, plano, origem (flow ou booking), external_company_id e os limites (max_chatbots, max_messages, max_integrations).",
    auth: "apiKey",
    responseExample: `{
  "workspace": {
    "id": "9b4fce4a-05f7-494d-aaf8-c2159244e99d",
    "slug": "empresa-x",
    "name": "Empresa X",
    "email": "user@empresa.com",
    "status": "active",
    "plan": "pro",
    "source": "booking",
    "external_company_id": "fefb4d36-...",
    "limits": {
      "max_chatbots": 5,
      "max_messages": 5000,
      "max_integrations": 3
    },
    "created_at": "2026-06-11T20:17:10Z"
  }
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 401, label: "Chave inválida" },
      { code: 404, label: "Workspace não encontrado" },
    ],
  },
  {
    id: "instances",
    method: "GET",
    path: "/instances",
    title: "Listar instâncias WhatsApp",
    summary: "Lista todas as instâncias de WhatsApp (Evolution API) do workspace.",
    auth: "apiKey",
    responseExample: `{
  "instances": [
    {
      "id": "uuid",
      "name": "Atendimento",
      "instance_name": "atendimento-01",
      "status": "connected",
      "connected": true,
      "phone_number": "5511999999999",
      "last_connected_at": "2026-07-05T10:00:00Z",
      "created_at": "2026-06-01T10:00:00Z",
      "updated_at": "2026-07-05T10:00:00Z"
    }
  ]
}`,
    notes: [
      "connected é true quando status ∈ {connected, open}.",
      "phone_number é extraído de settings.phone_number, settings.phone, settings.number ou settings.wid.",
    ],
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 401, label: "Chave inválida" },
    ],
  },
  {
    id: "instance-by-id",
    method: "GET",
    path: "/instances/:id",
    title: "Instância por ID",
    summary: "Detalhe de uma instância específica.",
    auth: "apiKey",
    params: [
      { key: "id", label: "id", in: "path", required: true, placeholder: "UUID da instância" },
    ],
    responseExample: `{
  "instance": {
    "id": "uuid",
    "name": "Atendimento",
    "instance_name": "atendimento-01",
    "status": "connected",
    "connected": true,
    "phone_number": "5511999999999",
    "last_connected_at": "2026-07-05T10:00:00Z"
  }
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 404, label: "Instância não pertence ao workspace" },
    ],
  },
  {
    id: "bots",
    method: "GET",
    path: "/bots",
    title: "Listar bots",
    summary: "Lista bots do workspace. Por padrão retorna apenas publicados.",
    auth: "apiKey",
    params: [
      {
        key: "published",
        label: "published",
        in: "query",
        placeholder: "true | false",
        description: "Se false, inclui rascunhos e inativos. Padrão: true.",
      },
    ],
    responseExample: `{
  "bots": [
    {
      "id": "uuid",
      "name": "Bot de Agendamento",
      "description": "Fluxo principal",
      "is_published": true,
      "is_active": true,
      "status": "published",
      "public_id": "abc123",
      "published_at": "2026-07-01T12:00:00Z",
      "updated_at": "2026-07-04T09:00:00Z",
      "created_at": "2026-06-01T10:00:00Z"
    }
  ]
}`,
    notes: ['status pode ser: "published", "draft" ou "inactive".'],
    responseCodes: [{ code: 200, label: "OK" }],
  },
  {
    id: "bot-by-id",
    method: "GET",
    path: "/bots/:id",
    title: "Bot por ID",
    summary: "Detalhe completo de um bot (inclui settings).",
    auth: "apiKey",
    params: [
      { key: "id", label: "id", in: "path", required: true, placeholder: "UUID do bot" },
    ],
    responseExample: `{
  "bot": {
    "id": "uuid",
    "name": "Bot de Agendamento",
    "description": "Fluxo principal",
    "is_published": true,
    "is_active": true,
    "status": "published",
    "public_id": "abc123",
    "published_at": "2026-07-01T12:00:00Z",
    "settings": { "welcome_message": "Olá!" }
  }
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 404, label: "Bot não pertence ao workspace" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Chatbot Runtime API                                                         */
/* -------------------------------------------------------------------------- */

const runtimeEndpoints: Endpoint[] = [
  {
    id: "runtime-start",
    method: "POST",
    path: "/",
    title: "Iniciar sessão (action=start)",
    summary: "Inicializa uma execução do bot para um contato.",
    description:
      "O endpoint é único (POST na raiz da função). O comportamento muda pelo campo action. Use start para (re)iniciar do começo, message para enviar entrada do usuário. flow_id aceita tanto o UUID interno quanto o public_id publicado.",
    auth: "none",
    params: [
      { key: "action", label: "action", in: "body", placeholder: "start", description: 'Padrão: "start" se omitido.' },
      { key: "flow_id", label: "flow_id", in: "body", required: true, placeholder: "UUID ou public_id do bot" },
      { key: "contact_id", label: "contact_id", in: "body", required: true, placeholder: "Identificador do contato (ex: telefone, user id)" },
      { key: "channel", label: "channel", in: "body", placeholder: "webchat | whatsapp | api", description: "Detectado automaticamente quando ausente." },
      { key: "payload", label: "payload", in: "body", description: "Objeto opcional com variáveis iniciais." },
    ],
    bodyExample: `{
  "action": "start",
  "flow_id": "abc123",
  "contact_id": "user-5511999999999",
  "channel": "webchat"
}`,
    responseExample: `{
  "messages": [
    { "type": "text", "content": "Olá! Como posso ajudar?" }
  ],
  "waiting_for": "text",
  "buttons": null,
  "wait_ms": 0,
  "session_id": "uuid",
  "runtime_state": {
    "current_node_id": "node_2",
    "variables": {},
    "waiting_for_input": true,
    "mode": "flow"
  },
  "debug": { "node": "node_2", "status": "waiting_input" }
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 400, label: "flow_id ou contact_id ausente" },
      { code: 404, label: "Flow não encontrado" },
      { code: 500, label: "Erro interno de execução" },
    ],
  },
  {
    id: "runtime-message",
    method: "POST",
    path: "/",
    title: "Enviar mensagem (action=message)",
    summary: "Continua a execução do bot com uma resposta do usuário.",
    description:
      "Envie o texto (ou payload estruturado) do usuário no campo payload. Reutilize o mesmo contact_id e flow_id para manter a sessão.",
    auth: "none",
    params: [
      { key: "action", label: "action", in: "body", required: true, placeholder: "message" },
      { key: "flow_id", label: "flow_id", in: "body", required: true },
      { key: "contact_id", label: "contact_id", in: "body", required: true },
      { key: "payload", label: "payload", in: "body", required: true, description: "Contém a mensagem do usuário e/ou variáveis." },
    ],
    bodyExample: `{
  "action": "message",
  "flow_id": "abc123",
  "contact_id": "user-5511999999999",
  "payload": { "text": "Quero agendar um horário" }
}`,
    responseExample: `{
  "messages": [
    { "type": "text", "content": "Claro! Para qual dia?" }
  ],
  "waiting_for": "text",
  "buttons": null,
  "session_id": "uuid",
  "runtime_state": {
    "current_node_id": "node_5",
    "variables": { "intent": "book" },
    "waiting_for_input": true,
    "mode": "flow"
  }
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 400, label: "Campos obrigatórios ausentes" },
      { code: 404, label: "Flow não encontrado" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Provisioning & plan sync APIs (JWT HS256)                                   */
/* -------------------------------------------------------------------------- */

const provisioningEndpoints: Endpoint[] = [
  {
    id: "provision-account",
    method: "POST",
    path: "/provision-account",
    title: "Provisionar conta",
    summary: "Cria (ou upserta) usuário + workspace no Flow a partir do Booking.",
    description:
      "Autenticação via JWT HS256 assinado com EMBED_SHARED_SECRET. Se o e-mail já existir, o profile é atualizado. Um workspace é criado automaticamente pelo trigger handle_new_user.",
    auth: "jwtHs256",
    params: [
      { key: "email", label: "email", in: "body", required: true },
      { key: "password", label: "password", in: "body", required: true },
      { key: "slug", label: "slug", in: "body", required: true },
      { key: "display_name", label: "display_name", in: "body" },
      { key: "company_id", label: "company_id", in: "body", description: "ID externo (Booking)." },
      { key: "embed_source", label: "embed_source", in: "body", placeholder: "booking", description: "Padrão: booking." },
      { key: "embed_plan_tier", label: "embed_plan_tier", in: "body", placeholder: "starter | pro | business" },
      { key: "limits", label: "limits", in: "body", description: "Objeto opcional com max_chatbots, max_messages, max_integrations." },
    ],
    bodyExample: `{
  "email": "user@empresa.com",
  "password": "SenhaForte#123",
  "slug": "empresa-x",
  "display_name": "Empresa X",
  "company_id": "external-uuid-123",
  "embed_source": "booking",
  "embed_plan_tier": "pro",
  "limits": {
    "max_chatbots": 5,
    "max_messages": 10000,
    "max_integrations": 10
  }
}`,
    responseExample: `{
  "ok": true,
  "user_id": "uuid",
  "workspace_id": "uuid",
  "slug": "empresa-x"
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 400, label: "JSON inválido ou slug ausente" },
      { code: 401, label: "JWT ausente/expirado/assinatura inválida" },
      { code: 405, label: "Method not allowed" },
      { code: 500, label: "EMBED_SHARED_SECRET não configurado ou erro interno" },
    ],
  },
  {
    id: "sync-embed-plan",
    method: "POST",
    path: "/sync-embed-plan",
    title: "Sincronizar plano",
    summary: "Atualiza tier e limites do workspace externo.",
    description:
      "Localiza o profile por (embed_company_id, embed_source) ou por slug como fallback. Requer JWT HS256.",
    auth: "jwtHs256",
    params: [
      { key: "company_id", label: "company_id", in: "body", required: true },
      { key: "source", label: "source", in: "body", placeholder: "booking" },
      { key: "slug", label: "slug", in: "body", description: "Fallback caso company_id não seja encontrado." },
      { key: "tier", label: "tier", in: "body", required: true, placeholder: "starter | pro | business | suspended" },
      { key: "limits", label: "limits", in: "body", description: "max_chatbots, max_messages, max_integrations." },
    ],
    bodyExample: `{
  "company_id": "external-uuid-123",
  "source": "booking",
  "slug": "empresa-x",
  "tier": "business",
  "limits": {
    "max_chatbots": 20,
    "max_messages": 50000,
    "max_integrations": 999
  }
}`,
    responseExample: `{ "ok": true, "message": "Plan updated successfully" }`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 401, label: "Unauthorized" },
      { code: 404, label: "User not found" },
      { code: 500, label: "Erro interno" },
    ],
  },
  {
    id: "embed-plan-status",
    method: "GET",
    path: "/embed-plan-status",
    title: "Consultar plano (auditoria)",
    summary: "Read-only. Retorna tier atual sincronizado.",
    description:
      "Requer JWT HS256 com iss=flow-appoint, aud=builder-flow-api e purpose ∈ { read-plan, sync-plan }.",
    auth: "jwtHs256",
    params: [
      { key: "company_id", label: "company_id", in: "query", required: true },
      { key: "source", label: "source", in: "query", placeholder: "flow-appoint", description: "Padrão: flow-appoint." },
    ],
    responseExample: `{
  "ok": true,
  "source": "booking",
  "slug": "empresa-x",
  "tier": "pro",
  "synced_at": "2026-07-05T10:00:00.000Z"
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 400, label: "company_id obrigatório" },
      { code: 401, label: "Token inválido/expirado" },
      { code: 404, label: "Workspace não encontrado" },
      { code: 405, label: "Method not allowed" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Webhooks & utilitários                                                      */
/* -------------------------------------------------------------------------- */

const webhookEndpoints: Endpoint[] = [
  {
    id: "whatsapp-webhook",
    method: "POST",
    path: "/whatsapp-webhook",
    title: "Webhook Evolution API",
    summary: "Recebe eventos da Evolution API e dispara o runtime.",
    description:
      "Configure esta URL como webhook da instância na Evolution API. Eventos suportados: MESSAGES_UPSERT / messages.upsert. Respostas do bot são enviadas de volta via Evolution API automaticamente.",
    auth: "webhook",
    params: [
      { key: "event", label: "event", in: "body", placeholder: "MESSAGES_UPSERT" },
      { key: "instance", label: "instance", in: "body", required: true, description: "Nome da instância na Evolution." },
      { key: "apikey", label: "apikey", in: "body", description: "API Key da Evolution (fallback: EVO_GLOBAL_KEY)." },
      { key: "data", label: "data", in: "body", required: true, description: "Payload nativo da Evolution API." },
    ],
    bodyExample: `{
  "event": "MESSAGES_UPSERT",
  "instance": "atendimento-01",
  "apikey": "evo_...",
  "data": {
    "key": { "remoteJid": "5511999999999@s.whatsapp.net", "fromMe": false },
    "message": { "conversation": "Oi, quero agendar" }
  }
}`,
    responseExample: `{ "status": "ok" }`,
    notes: [
      "Retorna 200 mesmo em payloads inválidos, para evitar reenvios agressivos da Evolution.",
      "Grupos e mensagens fromMe são ignorados automaticamente.",
    ],
    responseCodes: [
      { code: 200, label: "OK (mesmo para eventos ignorados)" },
      { code: 500, label: "Erro interno" },
    ],
  },
  {
    id: "crawl",
    method: "POST",
    path: "/crawl",
    title: "Crawler de base de conhecimento",
    summary: "Rastreia um site (sitemap + rotas comuns) e devolve o conteúdo textual.",
    description:
      "Usado pela feature de Knowledge Base. Rastreia até 12 páginas, respeitando robots.txt e priorizando páginas com palavras-chave (preços, planos, sobre etc.).",
    auth: "none",
    params: [
      { key: "url", label: "url", in: "body", required: true, placeholder: "https://exemplo.com" },
      { key: "depth", label: "depth", in: "body", placeholder: "1", description: "Profundidade máxima. Padrão: 1." },
    ],
    bodyExample: `{
  "url": "https://empresa.com",
  "depth": 1
}`,
    responseExample: `{
  "content": "[FONTE: https://empresa.com]\\nTexto extraído...\\n\\n---\\n\\n[FONTE: https://empresa.com/precos]\\n...",
  "pages_crawled": 8
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 400, label: "URL obrigatória" },
      { code: 500, label: "Erro ao rastrear" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Overview & references                                                       */
/* -------------------------------------------------------------------------- */

const overviewDoc: ReferenceDoc = {
  id: "overview",
  title: "Bem-vindo à documentação do Zailom Flow",
  body: (
    <div className="space-y-6 text-sm leading-relaxed">
      <p className="text-muted-foreground">
        O Zailom Flow expõe diferentes APIs conforme o caso de uso. Escolha a aba correta no topo
        para acessar endpoints, exemplos e o testador interativo.
      </p>

      <div className="grid sm:grid-cols-2 gap-3">
        {[
          {
            icon: Plug,
            title: "Booking Integration API",
            desc: "Read-only para o Zailom Booking. Autenticada por API Key.",
            base: BOOKING_BASE,
          },
          {
            icon: Bot,
            title: "Chatbot Runtime API",
            desc: "Executa fluxos de bot em canais externos (webchat, apps).",
            base: RUNTIME_BASE,
          },
          {
            icon: Workflow,
            title: "Provisioning & Plan Sync",
            desc: "Criação de conta e sincronização de planos via JWT HS256.",
            base: `${API_PROXY_URL}/functions/v1`,
          },
          {
            icon: Webhook,
            title: "Webhooks & Utilitários",
            desc: "Webhook da Evolution API e crawler de knowledge base.",
            base: `${API_PROXY_URL}/functions/v1`,
          },
        ].map(({ icon: Icon, title, desc, base }) => (
          <div key={title} className="border border-border rounded-lg p-4 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Icon className="w-4 h-4 text-primary" />
              <div className="font-semibold text-sm">{title}</div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">{desc}</p>
            <code className="text-[11px] font-mono text-muted-foreground break-all">{base}</code>
          </div>
        ))}
      </div>

      <div>
        <h3 className="font-semibold mb-2 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" /> Como testar
        </h3>
        <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
          <li>Gere uma API Key em <strong>Configurações → API Keys</strong> do workspace.</li>
          <li>Clique em <strong>Configurar API Key</strong> no topo e cole a chave (fica salva neste navegador).</li>
          <li>Escolha um endpoint na sidebar e clique em <strong>Enviar requisição</strong>.</li>
        </ol>
      </div>

      <div className="border border-amber-500/30 bg-amber-500/5 rounded-lg p-4">
        <div className="font-semibold text-amber-600 dark:text-amber-400 mb-1 flex items-center gap-2">
          <Shield className="w-4 h-4" /> Escopo automático
        </div>
        <p className="text-xs text-muted-foreground">
          Toda requisição autenticada é escopada exclusivamente ao workspace dono da chave/JWT.
          Parâmetros do cliente nunca alteram esse escopo — não é possível acessar recursos de
          outro workspace.
        </p>
      </div>
    </div>
  ),
};

const references: ReferenceDoc[] = [
  {
    id: "auth",
    title: "Autenticação por API Key",
    body: (
      <div className="space-y-3 text-sm">
        <p>Todas as requisições da Booking API precisam enviar a API Key em <strong>um</strong> dos headers:</p>
        <CodeBlock code={`x-api-key: <API_KEY>
# ou
Authorization: Bearer <API_KEY>`} />
        <p className="text-muted-foreground">
          A chave identifica o workspace. O campo <code>last_used_at</code> é atualizado a cada
          request bem-sucedido, permitindo auditoria.
        </p>
      </div>
    ),
  },
  {
    id: "auth-jwt",
    title: "Autenticação JWT HS256",
    body: (
      <div className="space-y-3 text-sm">
        <p>
          Os endpoints de provisionamento e sync de plano usam JWT HS256 assinado com o segredo
          compartilhado <code>EMBED_SHARED_SECRET</code>.
        </p>
        <CodeBlock code={`Authorization: Bearer <JWT>

// Claims esperadas
{
  "iss": "flow-appoint",
  "aud": "builder-flow-api",
  "purpose": "sync-plan",   // ou "read-plan"
  "exp": 1730000000
}`} />
        <p className="text-muted-foreground">
          Tokens expirados retornam 401. Nunca exponha <code>EMBED_SHARED_SECRET</code> no
          front-end.
        </p>
      </div>
    ),
  },
  {
    id: "status-codes",
    title: "Códigos HTTP",
    body: (
      <div className="space-y-1.5 text-sm">
        {[
          [200, "OK"],
          [204, "No Content (CORS preflight)"],
          [400, "Requisição inválida ou campos obrigatórios ausentes"],
          [401, "Autenticação ausente/inválida (API Key ou JWT)"],
          [403, "Chave desativada"],
          [404, "Recurso não encontrado ou fora do workspace"],
          [405, "Método HTTP não permitido"],
          [500, "Erro interno"],
        ].map(([code, label]) => (
          <div key={code} className="flex items-center gap-3 py-1.5 border-b border-border/60">
            <Badge variant="outline" className="font-mono min-w-[3rem] justify-center">{code}</Badge>
            <span className="text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "plans",
    title: "Planos e limites",
    body: (
      <div className="space-y-3 text-sm">
        <div className="overflow-x-auto border border-border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold">Plano</th>
                <th className="text-left p-3 font-semibold">Bots</th>
                <th className="text-left p-3 font-semibold">Msgs/mês</th>
                <th className="text-left p-3 font-semibold">Integrações</th>
              </tr>
            </thead>
            <tbody className="[&_td]:p-3 [&_tr]:border-t [&_tr]:border-border">
              <tr><td>Starter</td><td>1</td><td>1.000</td><td>2</td></tr>
              <tr><td>Pro</td><td>5</td><td>10.000</td><td>10</td></tr>
              <tr><td>Business</td><td>20</td><td>50.000</td><td>Ilimitado</td></tr>
              <tr><td>Suspenso</td><td>0</td><td>0</td><td>0</td></tr>
            </tbody>
          </table>
        </div>
        <p className="text-muted-foreground text-xs">
          Limites podem ser sobrescritos por workspace via <code>sync-embed-plan</code>.
        </p>
      </div>
    ),
  },
  {
    id: "cors",
    title: "CORS",
    body: (
      <div className="space-y-3 text-sm">
        <p>
          Todas as funções respondem com <code>Access-Control-Allow-Origin: *</code> e aceitam
          preflight <code>OPTIONS</code> (204). Headers permitidos: <code>authorization</code>,{" "}
          <code>x-api-key</code>, <code>content-type</code>, <code>apikey</code>,{" "}
          <code>x-client-info</code>.
        </p>
      </div>
    ),
  },
  {
    id: "curl",
    title: "Exemplos curl completos",
    body: (
      <div className="space-y-4">
        <div>
          <div className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Health (Booking API)</div>
          <CodeBlock code={`curl ${BOOKING_BASE}/health`} />
        </div>
        <div>
          <div className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Listar bots publicados</div>
          <CodeBlock code={`curl -H "Authorization: Bearer SUA_API_KEY" \\
  "${BOOKING_BASE}/bots?published=true"`} />
        </div>
        <div>
          <div className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Iniciar runtime</div>
          <CodeBlock code={`curl -X POST ${RUNTIME_BASE} \\
  -H "Content-Type: application/json" \\
  -d '{"action":"start","flow_id":"abc123","contact_id":"user-1"}'`} />
        </div>
        <div>
          <div className="text-xs font-semibold mb-1 text-muted-foreground uppercase tracking-wider">Sync de plano</div>
          <CodeBlock code={`curl -X POST ${SYNC_PLAN_BASE} \\
  -H "Authorization: Bearer <JWT_HS256>" \\
  -H "Content-Type: application/json" \\
  -d '{"company_id":"ext-1","tier":"pro","source":"booking"}'`} />
        </div>
      </div>
    ),
  },
  {
    id: "security",
    title: "Regras de segurança",
    body: (
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        <li>A Booking API é <strong>read-only</strong>.</li>
        <li>O escopo é determinado <strong>exclusivamente</strong> pela API Key. Parâmetros do cliente não alteram o workspace.</li>
        <li>Chaves desativadas retornam <Badge variant="outline">403</Badge> imediatamente.</li>
        <li>Cada request atualiza <code>last_used_at</code>. Rotacione chaves periodicamente.</li>
        <li>Provisionamento e sync usam JWT HS256 com claims obrigatórias (iss/aud/purpose).</li>
      </ul>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

const sections: ApiSection[] = [
  {
    id: "overview",
    label: "Visão Geral",
    icon: Compass,
    baseUrl: API_PROXY_URL,
    description: "Comece por aqui.",
    auth: { type: "none", description: "Página inicial." },
    sidebar: [{ label: "Início", items: [{ id: "overview", label: "Visão Geral" }] }],
    endpoints: {},
    overview: overviewDoc,
  },
  {
    id: "sistema",
    label: "Sistema",
    icon: Layers,
    baseUrl: API_PROXY_URL,
    description: "Guias sobre a plataforma: arquitetura, integrações, operação e segurança.",
    auth: { type: "none", description: "Documentação conceitual." },
    sidebar: [
      { label: "Começando", items: systemGuides.slice(0, 3).map((g) => ({ id: g.id, label: g.title })) },
      { label: "Runtime & IA", items: systemGuides.slice(3, 8).map((g) => ({ id: g.id, label: g.title })) },
      { label: "Operação", items: systemGuides.slice(8).map((g) => ({ id: g.id, label: g.title })) },
    ],
    endpoints: {},
    reference: systemGuides,
  },
  {
    id: "booking",
    label: "Booking Integration",
    icon: Plug,
    baseUrl: BOOKING_BASE,
    description: "API pública read-only para integração Flow ↔ Booking.",
    auth: {
      type: "apiKey",
      description: "Header x-api-key ou Authorization: Bearer <key>.",
      example: "x-api-key: zf_...",
    },
    sidebar: [
      {
        label: "Sistema",
        items: [
          { id: "health", label: "Health", method: "GET" },
          { id: "workspace", label: "Workspace", method: "GET" },
        ],
      },
      {
        label: "WhatsApp",
        items: [
          { id: "instances", label: "Listar instâncias", method: "GET" },
          { id: "instance-by-id", label: "Instância por ID", method: "GET" },
        ],
      },
      {
        label: "Bots",
        items: [
          { id: "bots", label: "Listar bots", method: "GET" },
          { id: "bot-by-id", label: "Bot por ID", method: "GET" },
        ],
      },
    ],
    endpoints: Object.fromEntries(bookingEndpoints.map((e) => [e.id, e])),
  },
  {
    id: "runtime",
    label: "Chatbot Runtime",
    icon: Bot,
    baseUrl: RUNTIME_BASE,
    description: "Runtime de execução dos bots. POST único na raiz da função.",
    auth: { type: "none", description: "Sem autenticação (validação por flow_id/public_id)." },
    sidebar: [
      {
        label: "Runtime",
        items: runtimeEndpoints.map((e) => ({ id: e.id, label: e.title, method: e.method })),
      },
    ],
    endpoints: Object.fromEntries(runtimeEndpoints.map((e) => [e.id, e])),
  },
  {
    id: "provisioning",
    label: "Provisioning & Plans",
    icon: Workflow,
    baseUrl: `${API_PROXY_URL}/functions/v1`,
    description: "Provisionamento de contas e sincronização de planos externos.",
    auth: {
      type: "jwtHs256",
      description: "JWT HS256 com EMBED_SHARED_SECRET.",
      example: "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...",
    },
    sidebar: [
      {
        label: "Contas",
        items: [
          { id: "provision-account", label: "Provisionar conta", method: "POST" },
        ],
      },
      {
        label: "Planos",
        items: [
          { id: "sync-embed-plan", label: "Sincronizar plano", method: "POST" },
          { id: "embed-plan-status", label: "Consultar plano", method: "GET" },
        ],
      },
    ],
    endpoints: Object.fromEntries(provisioningEndpoints.map((e) => [e.id, e])),
  },
  {
    id: "webhooks",
    label: "Webhooks",
    icon: Webhook,
    baseUrl: `${API_PROXY_URL}/functions/v1`,
    description: "Webhook da Evolution API e utilitários.",
    auth: { type: "webhook", description: "Autenticação por payload/instance." },
    sidebar: [
      {
        label: "WhatsApp",
        items: [{ id: "whatsapp-webhook", label: "Evolution webhook", method: "POST" }],
      },
      {
        label: "Utilitários",
        items: [{ id: "crawl", label: "Crawler KB", method: "POST" }],
      },
    ],
    endpoints: Object.fromEntries(webhookEndpoints.map((e) => [e.id, e])),
  },
  {
    id: "bots",
    label: "Catálogo de Nodes",
    icon: Blocks,
    baseUrl: "Referência do editor",
    description: "Catálogo completo dos blocos disponíveis no editor de fluxos.",
    auth: { type: "none", description: "Referência conceitual — não faz chamada HTTP." },
    sidebar: nodeCategories.map((cat) => ({
      label: cat.label,
      items: nodeDocs
        .filter((n) => n.category === cat.id)
        .map((n) => ({ id: n.id, label: n.title })),
    })),
    endpoints: {},
  },
  {
    id: "reference",
    label: "Referências",
    icon: BookOpen,
    baseUrl: API_PROXY_URL,
    description: "Guias transversais: autenticação, códigos, planos, CORS e segurança.",
    auth: { type: "none", description: "Documentação estática." },
    sidebar: [
      { label: "Guias", items: references.map((r) => ({ id: r.id, label: r.title })) },
    ],
    endpoints: {},
    reference: references,
  },
];

/* -------------------------------------------------------------------------- */
/* UI helpers                                                                  */
/* -------------------------------------------------------------------------- */

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  return (
    <div className="docs-code relative group">
      {lang && (
        <div className="docs-code__lang">{lang}</div>
      )}
      <pre className="docs-code__pre">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); toast.success("Copiado"); }}
        className="docs-code__copy"
        aria-label="Copiar"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MethodBadge({ method, size = "sm" }: { method: HttpMethod; size?: "sm" | "md" }) {
  const cls = `docs-method docs-method--${method.toLowerCase()} ${size === "md" ? "docs-method--md" : ""}`;
  return <span className={cls}>{method}</span>;
}

function AuthPill({ auth }: { auth?: AuthKind }) {
  if (!auth || auth === "none") return <span className="docs-pill docs-pill--muted"><Globe className="w-3 h-3" /> Público</span>;
  if (auth === "apiKey") return <span className="docs-pill docs-pill--emerald"><Key className="w-3 h-3" /> API Key</span>;
  if (auth === "jwtHs256") return <span className="docs-pill docs-pill--violet"><Shield className="w-3 h-3" /> JWT HS256</span>;
  return <span className="docs-pill docs-pill--amber"><Webhook className="w-3 h-3" /> Webhook</span>;
}

function SectionHeading({ children, id }: { children: React.ReactNode; id?: string }) {
  return <h2 id={id} className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mt-8 mb-3">{children}</h2>;
}

function PropTable({ rows }: { rows: { name: string; type: string; required?: boolean; description: string }[] }) {
  return (
    <div className="docs-proptable">
      {rows.map((r) => (
        <div key={r.name} className="docs-proptable__row">
          <div className="docs-proptable__head">
            <code className="docs-proptable__name">{r.name}</code>
            <span className="docs-proptable__type">{r.type}</span>
            {r.required && <span className="docs-proptable__req">required</span>}
          </div>
          <p className="docs-proptable__desc">{r.description}</p>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Endpoint view (Mintlify-style: docs left, code right sticky)                */
/* -------------------------------------------------------------------------- */

function EndpointView({
  endpoint,
  section,
  apiKey,
  jwt,
}: {
  endpoint: Endpoint;
  section: ApiSection;
  apiKey: string;
  jwt: string;
}) {
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bodyStr, setBodyStr] = useState(endpoint.bodyExample ?? "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState<string>("");
  const [duration, setDuration] = useState<number | null>(null);
  const [tab, setTab] = useState<"curl" | "js" | "python">("curl");

  useEffect(() => {
    setPathParams({}); setQueryParams({}); setBodyStr(endpoint.bodyExample ?? "");
    setStatus(null); setResponse(""); setDuration(null);
  }, [endpoint.id]);

  const pathDefs = endpoint.params?.filter((p) => p.in === "path") ?? [];
  const queryDefs = endpoint.params?.filter((p) => p.in === "query") ?? [];
  const bodyDefs = endpoint.params?.filter((p) => p.in === "body") ?? [];
  const hasBody = endpoint.method !== "GET" && endpoint.method !== "DELETE";

  const finalUrl = useMemo(() => {
    const base = section.baseUrl.replace(/\/$/, "");
    let p = endpoint.path;
    pathDefs.forEach((pd) => {
      const v = pathParams[pd.key] ?? "";
      p = p.replace(`:${pd.key}`, v ? encodeURIComponent(v) : `:${pd.key}`);
    });
    const qs = new URLSearchParams();
    queryDefs.forEach((qd) => { const v = queryParams[qd.key]; if (v) qs.set(qd.key, v); });
    return `${base}${p === "/" ? "" : p}${qs.toString() ? `?${qs}` : ""}` || base;
  }, [endpoint.path, pathParams, queryParams, section.baseUrl, pathDefs, queryDefs]);

  const authHeaders = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (endpoint.auth === "apiKey") h["x-api-key"] = apiKey || "SUA_API_KEY";
    if (endpoint.auth === "jwtHs256") h["Authorization"] = `Bearer ${jwt || "SEU_JWT"}`;
    return h;
  }, [endpoint.auth, apiKey, jwt]);

  async function run() {
    if (endpoint.auth === "apiKey" && !apiKey) return toast.error("Configure sua API Key no topo");
    if (endpoint.auth === "jwtHs256" && !jwt) return toast.error("Configure o JWT HS256 no topo");
    for (const pd of pathDefs) if (pd.required && !pathParams[pd.key]) return toast.error(`Informe ${pd.label}`);
    setLoading(true); setStatus(null); setResponse("");
    const start = performance.now();
    try {
      const init: RequestInit = { method: endpoint.method, headers: authHeaders };
      if (hasBody && bodyStr.trim()) init.body = bodyStr;
      const res = await fetch(finalUrl, init);
      setStatus(res.status);
      const text = await res.text();
      try { setResponse(JSON.stringify(JSON.parse(text), null, 2)); } catch { setResponse(text); }
    } catch (e: any) {
      setResponse(`Erro de rede: ${e?.message ?? e}`);
    } finally {
      setDuration(Math.round(performance.now() - start));
      setLoading(false);
    }
  }

  const curlCmd = useMemo(() => {
    const headers = Object.entries(authHeaders).map(([k, v]) => ` \\\n  -H "${k}: ${v}"`).join("");
    const bodyPart = hasBody && bodyStr.trim() ? ` \\\n  -d '${bodyStr.replace(/'/g, "'\\''")}'` : "";
    return `curl -X ${endpoint.method} "${finalUrl}"${headers}${bodyPart}`;
  }, [endpoint.method, finalUrl, authHeaders, hasBody, bodyStr]);

  const jsCmd = useMemo(() => {
    return `const res = await fetch("${finalUrl}", {
  method: "${endpoint.method}",
  headers: ${JSON.stringify(authHeaders, null, 2).replace(/\n/g, "\n  ")}${hasBody && bodyStr.trim() ? `,
  body: JSON.stringify(${bodyStr.trim()})` : ""}
});
const data = await res.json();`;
  }, [finalUrl, endpoint.method, authHeaders, hasBody, bodyStr]);

  const pyCmd = useMemo(() => {
    const headersPy = JSON.stringify(authHeaders, null, 4);
    return `import requests

r = requests.${endpoint.method.toLowerCase()}(
    "${finalUrl}",
    headers=${headersPy}${hasBody && bodyStr.trim() ? `,
    json=${bodyStr.trim()}` : ""},
)
print(r.status_code, r.json())`;
  }, [finalUrl, endpoint.method, authHeaders, hasBody, bodyStr]);

  return (
    <div className="docs-endpoint">
      {/* LEFT — content */}
      <div className="docs-endpoint__main">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <MethodBadge method={endpoint.method} size="md" />
            <code className="docs-path">{endpoint.path}</code>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{endpoint.title}</h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{endpoint.summary}</p>
          {endpoint.description && (
            <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{endpoint.description}</p>
          )}
          <div className="mt-4"><AuthPill auth={endpoint.auth} /></div>
        </div>

        {pathDefs.length > 0 && (<><SectionHeading>Path parameters</SectionHeading><PropTable rows={pathDefs.map((p) => ({ name: p.key, type: "string", required: p.required, description: p.description ?? p.placeholder ?? "" }))} /></>)}
        {queryDefs.length > 0 && (<><SectionHeading>Query parameters</SectionHeading><PropTable rows={queryDefs.map((p) => ({ name: p.key, type: "string", required: p.required, description: p.description ?? p.placeholder ?? "" }))} /></>)}
        {hasBody && bodyDefs.length > 0 && (<><SectionHeading>Body</SectionHeading><PropTable rows={bodyDefs.map((p) => ({ name: p.key, type: "json", required: p.required, description: p.description ?? "" }))} /></>)}

        {endpoint.notes && endpoint.notes.length > 0 && (
          <div className="docs-callout mt-6">
            <div className="docs-callout__title">Notas</div>
            <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
              {endpoint.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

        {endpoint.responseCodes && (
          <>
            <SectionHeading>Códigos de resposta</SectionHeading>
            <div className="docs-codes">
              {endpoint.responseCodes.map((rc) => (
                <div key={rc.code} className={`docs-codes__row docs-codes__row--${rc.code < 300 ? "ok" : rc.code < 500 ? "warn" : "err"}`}>
                  <span className="docs-codes__code">{rc.code}</span>
                  <span className="docs-codes__label">{rc.label}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Interactive tester */}
        <SectionHeading>Testar endpoint</SectionHeading>
        <div className="docs-tester">
          {pathDefs.map((pd) => (
            <div key={pd.key} className="docs-tester__field">
              <Label className="text-xs font-mono">{pd.key}{pd.required && <span className="text-rose-400 ml-0.5">*</span>}</Label>
              <Input value={pathParams[pd.key] ?? ""} onChange={(e) => setPathParams((v) => ({ ...v, [pd.key]: e.target.value }))} placeholder={pd.placeholder} className="docs-input" />
            </div>
          ))}
          {queryDefs.map((qd) => (
            <div key={qd.key} className="docs-tester__field">
              <Label className="text-xs font-mono">?{qd.key}</Label>
              <Input value={queryParams[qd.key] ?? ""} onChange={(e) => setQueryParams((v) => ({ ...v, [qd.key]: e.target.value }))} placeholder={qd.placeholder} className="docs-input" />
            </div>
          ))}
          {hasBody && (
            <div className="docs-tester__field">
              <div className="flex items-center justify-between mb-1">
                <Label className="text-xs font-mono">body</Label>
                {endpoint.bodyExample && (
                  <button onClick={() => setBodyStr(endpoint.bodyExample!)} className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <RefreshCcw className="w-3 h-3" /> reset
                  </button>
                )}
              </div>
              <Textarea value={bodyStr} onChange={(e) => setBodyStr(e.target.value)} className="docs-input font-mono text-xs min-h-[140px]" spellCheck={false} />
            </div>
          )}
          <Button onClick={run} disabled={loading} className="docs-tester__run">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando…</> : <><Send className="w-4 h-4 mr-2" /> Enviar requisição</>}
          </Button>

          {status !== null && (
            <div className="docs-tester__response">
              <div className="flex items-center gap-2 mb-2">
                <span className={`docs-status docs-status--${status < 300 ? "ok" : status < 500 ? "warn" : "err"}`}>{status}</span>
                {duration !== null && <span className="text-xs text-muted-foreground">{duration}ms</span>}
                <div className="flex-1" />
                <button onClick={() => { navigator.clipboard.writeText(response); toast.success("Copiado"); }} className="docs-code__copy docs-code__copy--static">
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
              <pre className="docs-code__pre max-h-[360px]"><code>{response}</code></pre>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — sticky code panel */}
      <aside className="docs-endpoint__aside">
        <div className="docs-endpoint__stick">
          <div className="docs-tabs">
            {(["curl", "js", "python"] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} className={`docs-tabs__btn ${tab === t ? "docs-tabs__btn--active" : ""}`}>
                {t === "curl" ? "cURL" : t === "js" ? "JavaScript" : "Python"}
              </button>
            ))}
          </div>
          <div className="docs-panel">
            <div className="docs-panel__bar">
              <MethodBadge method={endpoint.method} />
              <span className="docs-panel__url">{finalUrl}</span>
            </div>
            <CodeBlock code={tab === "curl" ? curlCmd : tab === "js" ? jsCmd : pyCmd} />
          </div>
          <div className="docs-panel mt-4">
            <div className="docs-panel__bar">
              <span className="text-xs text-muted-foreground font-mono">200 · application/json</span>
            </div>
            <CodeBlock code={endpoint.responseExample} />
          </div>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Node doc view                                                               */
/* -------------------------------------------------------------------------- */

function NodeDocView({ node }: { node: NodeDoc }) {
  const cat = nodeCategories.find((c) => c.id === node.category)!;
  const Icon = node.icon;
  return (
    <div className="docs-endpoint">
      <div className="docs-endpoint__main">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <span className={`docs-pill ${cat.color.replace("text-", "text-").replace("bg-", "bg-").replace("border-", "border-")}`}>
              <Icon className="w-3 h-3" /> {cat.label}
            </span>
            <code className="docs-path">node: "{node.id}"</code>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground flex items-center gap-3">
            <span className="docs-node-icon"><Icon className="w-5 h-5" /></span>
            {node.title}
          </h1>
          <p className="text-muted-foreground mt-2 text-[15px] leading-relaxed">{node.summary}</p>
          <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{node.description}</p>
        </div>

        <SectionHeading>Quando usar</SectionHeading>
        <ul className="list-disc pl-5 space-y-1 text-sm text-muted-foreground">
          {node.useCases.map((u, i) => <li key={i}>{u}</li>)}
        </ul>

        <SectionHeading>Campos de configuração</SectionHeading>
        <PropTable rows={node.fields} />

        {node.outputs && node.outputs.length > 0 && (
          <>
            <SectionHeading>Handles de saída</SectionHeading>
            <div className="flex flex-wrap gap-2">
              {node.outputs.map((o) => (
                <span key={o} className="docs-pill docs-pill--muted"><ChevronRight className="w-3 h-3" /> {o}</span>
              ))}
            </div>
          </>
        )}
      </div>

      <aside className="docs-endpoint__aside">
        <div className="docs-endpoint__stick">
          <div className="docs-panel">
            <div className="docs-panel__bar">
              <span className="text-xs text-muted-foreground font-mono">exemplo</span>
            </div>
            <CodeBlock code={node.example} lang="json" />
          </div>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reference view                                                              */
/* -------------------------------------------------------------------------- */

function ReferenceView({ doc }: { doc: ReferenceDoc }) {
  return (
    <div className="docs-endpoint__main max-w-4xl">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-6">{doc.title}</h1>
      <div className="prose-docs">{doc.body}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page shell                                                                  */
/* -------------------------------------------------------------------------- */

export default function DocsPage() {
  const navigate = useNavigate();
  const { section: sectionParam, item: itemParam } = useParams();

  const initialSection = sections.find((s) => s.id === sectionParam)?.id ?? "overview";
  const [activeSectionId, setActiveSectionId] = useState<string>(initialSection);
  const [activeItemId, setActiveItemId] = useState<string>(itemParam ?? "overview");
  const [apiKey, setApiKey] = useState("");
  const [jwt, setJwt] = useState("");
  const [showConfig, setShowConfig] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const k = localStorage.getItem("zailom_docs_api_key");
    const j = localStorage.getItem("zailom_docs_jwt");
    if (k) setApiKey(k);
    if (j) setJwt(j);
  }, []);
  useEffect(() => { if (apiKey) localStorage.setItem("zailom_docs_api_key", apiKey); }, [apiKey]);
  useEffect(() => { if (jwt) localStorage.setItem("zailom_docs_jwt", jwt); }, [jwt]);

  // URL → estado
  useEffect(() => {
    const s = sections.find((x) => x.id === sectionParam);
    if (s) {
      setActiveSectionId(s.id);
      if (itemParam) setActiveItemId(itemParam);
      else {
        const first = s.sidebar[0]?.items[0]?.id;
        if (first) setActiveItemId(first);
      }
    }
  }, [sectionParam, itemParam]);

  const section = sections.find((s) => s.id === activeSectionId)!;

  const goTo = (sectionId: string, itemId?: string) => {
    const s = sections.find((x) => x.id === sectionId)!;
    const it = itemId ?? s.sidebar[0]?.items[0]?.id ?? sectionId;
    setActiveSectionId(sectionId);
    setActiveItemId(it);
    navigate(`/docs/${sectionId}/${it}`);
  };

  const isReference = section.id === "reference" || section.id === "sistema";
  const isOverview = section.id === "overview";
  const isBots = section.id === "bots";
  const endpoint = !isReference && !isOverview && !isBots ? section.endpoints[activeItemId] : undefined;
  const refDoc = isReference ? section.reference?.find((r) => r.id === activeItemId) : undefined;
  const nodeDoc = isBots ? nodeDocs.find((n) => n.id === activeItemId) : undefined;

  const filteredSidebar = useMemo(() => {
    if (!search.trim()) return section.sidebar;
    const q = search.toLowerCase();
    return section.sidebar
      .map((g) => ({ ...g, items: g.items.filter((it) => it.label.toLowerCase().includes(q) || it.id.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [section.sidebar, search]);

  return (
    <div className="docs-scope">
      {/* Top header */}
      <header className="docs-header">
        <div className="docs-header__inner">
          <a href="/" className="docs-brand">
            <div className="docs-brand__mark"><Zap className="w-4 h-4" /></div>
            <div className="docs-brand__text">
              <div className="docs-brand__title">Zailom</div>
              <div className="docs-brand__sub">Developer Docs</div>
            </div>
          </a>

          <nav className="docs-tabs docs-tabs--top">
            {sections.map((s) => {
              const Icon = s.icon;
              const active = s.id === activeSectionId;
              return (
                <button key={s.id} onClick={() => goTo(s.id)} className={`docs-tabs__btn ${active ? "docs-tabs__btn--active" : ""}`}>
                  <Icon className="w-4 h-4" /> {s.label}
                </button>
              );
            })}
          </nav>

          <div className="docs-header__right">
            <div className="docs-search">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar…" />
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowConfig((v) => !v)} className="docs-cred-btn">
              <Key className="w-4 h-4" />
              <span className="hidden md:inline">{apiKey || jwt ? "Credenciais" : "Credenciais"}</span>
              {(apiKey || jwt) && <span className="docs-dot" />}
            </Button>
          </div>
        </div>

        {showConfig && (
          <div className="docs-cred-panel">
            <div className="docs-cred-panel__inner">
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-2"><Key className="w-3 h-3" /> API Key (Booking)</Label>
                <Input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="zf_..." className="docs-input font-mono" />
                <p className="text-xs text-muted-foreground">Gerada em Configurações → API Keys. Salva neste navegador.</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-2"><Shield className="w-3 h-3" /> JWT HS256 (Provisioning)</Label>
                <Input type="password" value={jwt} onChange={(e) => setJwt(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiJ9..." className="docs-input font-mono" />
                <p className="text-xs text-muted-foreground">Assinado com EMBED_SHARED_SECRET.</p>
              </div>
              <div className="md:col-span-2 flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowConfig(false)}>Fechar</Button>
              </div>
            </div>
          </div>
        )}
      </header>

      <div className="docs-shell">
        {/* Sidebar */}
        <aside className="docs-sidebar">
          <div className="docs-sidebar__meta">
            <div className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground font-semibold mb-1">Base URL</div>
            <div className="text-xs font-mono text-foreground/90 break-all mb-2">{section.baseUrl}</div>
            <AuthPill auth={section.auth.type} />
            <p className="text-xs text-muted-foreground mt-3 leading-relaxed">{section.description}</p>
          </div>

          <nav className="docs-sidebar__nav">
            {filteredSidebar.map((group) => (
              <div key={group.label} className="mb-5">
                <div className="docs-sidebar__group">{group.label}</div>
                <div className="space-y-0.5">
                  {group.items.map((it) => {
                    const active = it.id === activeItemId;
                    return (
                      <button key={it.id} onClick={() => goTo(activeSectionId, it.id)} className={`docs-sidebar__item ${active ? "docs-sidebar__item--active" : ""}`}>
                        {it.method && <MethodBadge method={it.method} />}
                        <span className="flex-1 truncate">{it.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredSidebar.length === 0 && (
              <div className="text-xs text-muted-foreground px-2 py-4">Nenhum resultado.</div>
            )}
          </nav>
        </aside>

        {/* Main */}
        <main className="docs-main">
          {isOverview && section.overview && <ReferenceView doc={section.overview} />}
          {endpoint && <EndpointView endpoint={endpoint} section={section} apiKey={apiKey} jwt={jwt} />}
          {refDoc && <ReferenceView doc={refDoc} />}
          {nodeDoc && <NodeDocView node={nodeDoc} />}
          {!isOverview && !endpoint && !refDoc && !nodeDoc && (
            <div className="text-sm text-muted-foreground p-8">Selecione um item na sidebar.</div>
          )}
        </main>
      </div>
    </div>
  );
}
