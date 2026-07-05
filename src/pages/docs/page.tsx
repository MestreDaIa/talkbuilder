import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Activity,
  Bot,
  Building2,
  Copy,
  Key,
  Loader2,
  Play,
  Plug,
  Send,
  Settings2,
  Shield,
  BookOpen,
  Terminal,
  Webhook,
} from "lucide-react";

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

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
  params?: ParamDef[];
  bodyExample?: string;
  responseExample: string;
  responseCodes?: { code: number; label: string }[];
};

type SidebarGroup = {
  label: string;
  items: { id: string; label: string; method?: HttpMethod }[];
};

type ApiSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  baseUrl: string;
  description: string;
  auth: {
    type: "apiKey" | "none" | "bearer";
    description: string;
    example?: string;
  };
  sidebar: SidebarGroup[];
  endpoints: Record<string, Endpoint>;
  reference?: ReferenceDoc[];
};

type ReferenceDoc = {
  id: string;
  title: string;
  body: React.ReactNode;
};

/* -------------------------------------------------------------------------- */
/* Data — Booking API (nova)                                                  */
/* -------------------------------------------------------------------------- */

const BOOKING_BASE = "https://fwoescubnnagdvwasbjl.supabase.co/functions/v1/booking-api";

const bookingEndpoints: Endpoint[] = [
  {
    id: "health",
    method: "GET",
    path: "/health",
    title: "Health Check",
    summary: "Ping rápido para validar chave + workspace.",
    description:
      "Use este endpoint logo após o usuário clicar em 'Conectar' no Booking. Retorna o workspace vinculado à API Key enviada.",
    responseExample: `{
  "ok": true,
  "workspace_id": "9b4fce4a-05f7-494d-aaf8-c2159244e99d",
  "workspace_slug": "empresa-x",
  "timestamp": "2026-07-05T12:00:00.000Z"
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 401, label: "API Key ausente ou inválida" },
      { code: 403, label: "API Key desativada" },
    ],
  },
  {
    id: "workspace",
    method: "GET",
    path: "/workspace",
    title: "Workspace",
    summary: "Informações completas do workspace autenticado.",
    responseExample: `{
  "workspace": {
    "id": "uuid",
    "slug": "empresa-x",
    "name": "Empresa X",
    "email": "user@empresa.com",
    "status": "active",
    "plan": "pro",
    "source": "booking",
    "external_company_id": "uuid|null",
    "limits": {
      "max_chatbots": 5,
      "max_messages": 5000,
      "max_integrations": 3
    },
    "created_at": "2026-06-11T20:17:10Z"
  }
}`,
  },
  {
    id: "instances",
    method: "GET",
    path: "/instances",
    title: "Listar instâncias",
    summary: "Lista todas as instâncias de WhatsApp do workspace.",
    responseExample: `{
  "instances": [{
    "id": "uuid",
    "name": "Atendimento",
    "instance_name": "atendimento-01",
    "status": "connected",
    "connected": true,
    "phone_number": "5511999999999",
    "last_connected_at": "2026-07-05T10:00:00Z"
  }]
}`,
  },
  {
    id: "instance-by-id",
    method: "GET",
    path: "/instances/:id",
    title: "Instância por ID",
    summary: "Detalhe de uma instância específica.",
    params: [
      {
        key: "id",
        label: "id",
        in: "path",
        required: true,
        placeholder: "UUID da instância",
      },
    ],
    responseExample: `{
  "instance": {
    "id": "uuid",
    "name": "Atendimento",
    "instance_name": "atendimento-01",
    "status": "connected",
    "phone_number": "5511999999999"
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
    summary: "Lista bots do workspace (publicados por padrão).",
    params: [
      {
        key: "published",
        label: "published",
        in: "query",
        placeholder: "true | false",
        description: "Se false, inclui rascunhos e inativos.",
      },
    ],
    responseExample: `{
  "bots": [{
    "id": "uuid",
    "name": "Bot de Agendamento",
    "description": "Fluxo principal",
    "is_published": true,
    "is_active": true,
    "status": "published",
    "public_id": "abc123",
    "published_at": "2026-07-01T12:00:00Z"
  }]
}`,
  },
  {
    id: "bot-by-id",
    method: "GET",
    path: "/bots/:id",
    title: "Bot por ID",
    summary: "Detalhe completo de um bot (inclui settings).",
    params: [
      {
        key: "id",
        label: "id",
        in: "path",
        required: true,
        placeholder: "UUID do bot",
      },
    ],
    responseExample: `{
  "bot": {
    "id": "uuid",
    "name": "Bot de Agendamento",
    "status": "published",
    "settings": { "...": "..." }
  }
}`,
    responseCodes: [
      { code: 200, label: "OK" },
      { code: 404, label: "Bot não pertence ao workspace" },
    ],
  },
];

/* -------------------------------------------------------------------------- */
/* Data — Flow Runtime API (existente)                                        */
/* -------------------------------------------------------------------------- */

const RUNTIME_BASE = "https://fwoescubnnagdvwasbjl.supabase.co/functions/v1/chatbot-runtime";

const runtimeEndpoints: Endpoint[] = [
  {
    id: "runtime-start",
    method: "POST",
    path: "/start",
    title: "Iniciar sessão",
    summary: "Inicializa uma sessão de execução do bot para um usuário.",
    description:
      "Retorna o primeiro bloco de mensagens do bot e um sessionId a ser usado nos próximos requests.",
    params: [
      {
        key: "bot_id",
        label: "bot_id",
        in: "body",
        required: true,
        placeholder: "UUID do bot publicado",
      },
      {
        key: "user_id",
        label: "user_id",
        in: "body",
        placeholder: "Identificador único do usuário final",
      },
    ],
    bodyExample: `{
  "bot_id": "uuid",
  "user_id": "user-123"
}`,
    responseExample: `{
  "session_id": "uuid",
  "messages": [
    { "type": "text", "content": "Olá! Como posso ajudar?" }
  ]
}`,
  },
  {
    id: "runtime-message",
    method: "POST",
    path: "/message",
    title: "Enviar mensagem",
    summary: "Envia uma mensagem do usuário e recebe a resposta do bot.",
    params: [
      { key: "session_id", label: "session_id", in: "body", required: true },
      { key: "message", label: "message", in: "body", required: true },
    ],
    bodyExample: `{
  "session_id": "uuid",
  "message": "Quero agendar um horário"
}`,
    responseExample: `{
  "messages": [
    { "type": "text", "content": "Claro! Para qual dia?" }
  ],
  "finished": false
}`,
  },
];

/* -------------------------------------------------------------------------- */
/* References                                                                  */
/* -------------------------------------------------------------------------- */

const references: ReferenceDoc[] = [
  {
    id: "auth",
    title: "Autenticação",
    body: (
      <div className="space-y-3 text-sm">
        <p>Todas as requisições precisam enviar a API Key em <strong>um</strong> dos headers:</p>
        <CodeBlock code={`x-api-key: <API_KEY>
# ou
Authorization: Bearer <API_KEY>`} />
        <p className="text-muted-foreground">
          Toda requisição é escopada automaticamente ao workspace dono da chave.
        </p>
      </div>
    ),
  },
  {
    id: "status-codes",
    title: "Códigos HTTP",
    body: (
      <div className="space-y-2 text-sm">
        {[
          [200, "OK"],
          [400, "Requisição inválida"],
          [401, "API Key ausente ou inválida"],
          [403, "API Key desativada"],
          [404, "Recurso não encontrado ou fora do workspace"],
          [500, "Erro interno"],
        ].map(([code, label]) => (
          <div key={code} className="flex items-center gap-3 py-1 border-b border-border/60">
            <Badge variant="outline" className="font-mono min-w-[3rem] justify-center">{code}</Badge>
            <span>{label}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "curl",
    title: "Exemplos curl",
    body: (
      <div className="space-y-3">
        <CodeBlock code={`curl -H "x-api-key: SUA_API_KEY" \\
  ${BOOKING_BASE}/health`} />
        <CodeBlock code={`curl -H "Authorization: Bearer SUA_API_KEY" \\
  ${BOOKING_BASE}/bots`} />
      </div>
    ),
  },
  {
    id: "security",
    title: "Regras de segurança",
    body: (
      <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
        <li>A API é read-only — não há endpoints de escrita.</li>
        <li>O escopo é determinado <strong>exclusivamente</strong> pela API Key. Parâmetros do cliente nunca definem workspace.</li>
        <li>Cada request atualiza o <code>last_used_at</code> da chave, permitindo auditoria.</li>
        <li>Chaves desativadas retornam <Badge variant="outline">403</Badge> imediatamente.</li>
      </ul>
    ),
  },
];

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

const sections: ApiSection[] = [
  {
    id: "flow-runtime",
    label: "API Flow (Runtime)",
    icon: Bot,
    baseUrl: RUNTIME_BASE,
    description: "API usada pelo runtime dos bots do Zailom Flow.",
    auth: {
      type: "apiKey",
      description: "Header x-api-key ou Authorization: Bearer <key>.",
      example: "x-api-key: zf_...",
    },
    sidebar: [
      {
        label: "Runtime",
        items: runtimeEndpoints.map((e) => ({ id: e.id, label: e.title, method: e.method })),
      },
    ],
    endpoints: Object.fromEntries(runtimeEndpoints.map((e) => [e.id, e])),
  },
  {
    id: "booking",
    label: "Booking Integration API",
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
    id: "reference",
    label: "Referências",
    icon: BookOpen,
    baseUrl: BOOKING_BASE,
    description: "Guia geral: autenticação, códigos, exemplos e segurança.",
    auth: { type: "none", description: "Documentação estática." },
    sidebar: [
      {
        label: "Guias",
        items: references.map((r) => ({ id: r.id, label: r.title })),
      },
    ],
    endpoints: {},
    reference: references,
  },
];

/* -------------------------------------------------------------------------- */
/* Small UI helpers                                                            */
/* -------------------------------------------------------------------------- */

function CodeBlock({ code }: { code: string }) {
  return (
    <div className="relative group">
      <pre className="rounded-lg bg-muted/60 border border-border p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <button
        onClick={() => { navigator.clipboard.writeText(code); toast.success("Copiado"); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-background border border-border rounded p-1.5 hover:bg-accent"
        aria-label="Copiar"
      >
        <Copy className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function MethodBadge({ method }: { method: HttpMethod }) {
  const colors: Record<HttpMethod, string> = {
    GET: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
    POST: "bg-blue-500/15 text-blue-500 border-blue-500/30",
    PUT: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    PATCH: "bg-purple-500/15 text-purple-500 border-purple-500/30",
    DELETE: "bg-red-500/15 text-red-500 border-red-500/30",
  };
  return (
    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${colors[method]}`}>
      {method}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Endpoint view + tester                                                      */
/* -------------------------------------------------------------------------- */

function EndpointView({
  endpoint,
  baseUrl,
  apiKey,
}: {
  endpoint: Endpoint;
  baseUrl: string;
  apiKey: string;
}) {
  const [pathParams, setPathParams] = useState<Record<string, string>>({});
  const [queryParams, setQueryParams] = useState<Record<string, string>>({});
  const [bodyStr, setBodyStr] = useState(endpoint.bodyExample ?? "");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState<string>("");
  const [duration, setDuration] = useState<number | null>(null);

  // Reset when endpoint changes
  useEffect(() => {
    setPathParams({});
    setQueryParams({});
    setBodyStr(endpoint.bodyExample ?? "");
    setStatus(null);
    setResponse("");
    setDuration(null);
  }, [endpoint.id]);

  const pathDefs = endpoint.params?.filter((p) => p.in === "path") ?? [];
  const queryDefs = endpoint.params?.filter((p) => p.in === "query") ?? [];
  const hasBody = endpoint.method !== "GET" && endpoint.method !== "DELETE";

  const finalUrl = useMemo(() => {
    let p = endpoint.path;
    pathDefs.forEach((pd) => {
      const v = pathParams[pd.key] ?? "";
      p = p.replace(`:${pd.key}`, v ? encodeURIComponent(v) : `:${pd.key}`);
    });
    const qs = new URLSearchParams();
    queryDefs.forEach((qd) => {
      const v = queryParams[qd.key];
      if (v) qs.set(qd.key, v);
    });
    return `${baseUrl.replace(/\/$/, "")}${p}${qs.toString() ? `?${qs}` : ""}`;
  }, [endpoint.path, pathParams, queryParams, baseUrl, pathDefs, queryDefs]);

  async function run() {
    if (!apiKey) {
      toast.error("Configure sua API Key acima");
      return;
    }
    for (const pd of pathDefs) {
      if (pd.required && !pathParams[pd.key]) {
        toast.error(`Informe ${pd.label}`);
        return;
      }
    }
    setLoading(true);
    setStatus(null);
    setResponse("");
    const start = performance.now();
    try {
      const init: RequestInit = {
        method: endpoint.method,
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
      };
      if (hasBody && bodyStr.trim()) init.body = bodyStr;
      const res = await fetch(finalUrl, init);
      setStatus(res.status);
      const text = await res.text();
      try {
        setResponse(JSON.stringify(JSON.parse(text), null, 2));
      } catch {
        setResponse(text);
      }
    } catch (e: any) {
      setResponse(`Erro de rede: ${e?.message ?? e}`);
    } finally {
      setDuration(Math.round(performance.now() - start));
      setLoading(false);
    }
  }

  return (
    <div className="max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <MethodBadge method={endpoint.method} />
          <code className="text-sm font-mono text-muted-foreground">{endpoint.path}</code>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">{endpoint.title}</h1>
        <p className="text-muted-foreground">{endpoint.summary}</p>
        {endpoint.description && (
          <p className="text-sm text-muted-foreground mt-2">{endpoint.description}</p>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Left: params + tester */}
        <div className="space-y-5">
          <section className="border border-border rounded-lg p-4 bg-card">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Parâmetros
            </h2>

            {pathDefs.length === 0 && queryDefs.length === 0 && !hasBody && (
              <p className="text-xs text-muted-foreground">Este endpoint não possui parâmetros.</p>
            )}

            {pathDefs.length > 0 && (
              <div className="space-y-3 mb-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Path</div>
                {pathDefs.map((pd) => (
                  <div key={pd.key} className="space-y-1">
                    <Label className="text-xs flex items-center gap-2">
                      {pd.label}
                      {pd.required && <span className="text-red-500">*</span>}
                    </Label>
                    <Input
                      value={pathParams[pd.key] ?? ""}
                      onChange={(e) => setPathParams((v) => ({ ...v, [pd.key]: e.target.value }))}
                      placeholder={pd.placeholder}
                      className="font-mono text-sm h-9"
                    />
                    {pd.description && <p className="text-xs text-muted-foreground">{pd.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {queryDefs.length > 0 && (
              <div className="space-y-3 mb-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Query</div>
                {queryDefs.map((qd) => (
                  <div key={qd.key} className="space-y-1">
                    <Label className="text-xs">{qd.label}</Label>
                    <Input
                      value={queryParams[qd.key] ?? ""}
                      onChange={(e) => setQueryParams((v) => ({ ...v, [qd.key]: e.target.value }))}
                      placeholder={qd.placeholder}
                      className="font-mono text-sm h-9"
                    />
                    {qd.description && <p className="text-xs text-muted-foreground">{qd.description}</p>}
                  </div>
                ))}
              </div>
            )}

            {hasBody && (
              <div className="space-y-1 mb-4">
                <div className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Body (JSON)</div>
                <Textarea
                  value={bodyStr}
                  onChange={(e) => setBodyStr(e.target.value)}
                  className="font-mono text-xs min-h-[120px]"
                  spellCheck={false}
                />
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <div className="text-xs text-muted-foreground mb-2 font-mono break-all">{finalUrl}</div>
              <Button onClick={run} disabled={loading} size="sm" className="w-full">
                {loading ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" /> Enviar requisição</>
                )}
              </Button>
            </div>
          </section>

          {status !== null && (
            <section className="border border-border rounded-lg p-4 bg-card">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Resposta
                </h2>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={status >= 200 && status < 300 ? "default" : "destructive"}
                    className="font-mono"
                  >
                    {status}
                  </Badge>
                  {duration !== null && (
                    <span className="text-xs text-muted-foreground">{duration}ms</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => { navigator.clipboard.writeText(response); toast.success("Copiado"); }}
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <pre className="rounded bg-muted/60 border border-border p-3 text-xs overflow-x-auto max-h-[420px] font-mono leading-relaxed">
                <code>{response}</code>
              </pre>
            </section>
          )}
        </div>

        {/* Right: example + codes */}
        <div className="space-y-5">
          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4" /> Exemplo de resposta
            </h2>
            <CodeBlock code={endpoint.responseExample} />
          </section>

          {endpoint.responseCodes && (
            <section>
              <h2 className="text-sm font-semibold mb-3">Códigos de resposta</h2>
              <div className="space-y-1">
                {endpoint.responseCodes.map((rc) => (
                  <div key={rc.code} className="flex items-center gap-3 py-1.5 text-sm border-b border-border/50">
                    <Badge variant="outline" className="font-mono min-w-[3rem] justify-center">{rc.code}</Badge>
                    <span className="text-muted-foreground">{rc.label}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Webhook className="w-4 h-4" /> curl
            </h2>
            <CodeBlock
              code={`curl -X ${endpoint.method} "${finalUrl}" \\
  -H "x-api-key: ${apiKey || "SUA_API_KEY"}"${
                hasBody && bodyStr.trim() ? ` \\\n  -H "Content-Type: application/json" \\\n  -d '${bodyStr.replace(/'/g, "'\\''")}'` : ""
              }`}
            />
          </section>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Reference view                                                              */
/* -------------------------------------------------------------------------- */

function ReferenceView({ doc }: { doc: ReferenceDoc }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-4">{doc.title}</h1>
      <div>{doc.body}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Page shell                                                                  */
/* -------------------------------------------------------------------------- */

export default function DocsPage() {
  const [activeSectionId, setActiveSectionId] = useState<string>("booking");
  const [activeItemId, setActiveItemId] = useState<string>("health");
  const [apiKey, setApiKey] = useState("");
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("zailom_docs_api_key");
    if (saved) setApiKey(saved);
  }, []);

  useEffect(() => {
    if (apiKey) localStorage.setItem("zailom_docs_api_key", apiKey);
  }, [apiKey]);

  const section = sections.find((s) => s.id === activeSectionId)!;

  // When switching header tab, jump to the first sidebar item
  useEffect(() => {
    const first = section.sidebar[0]?.items[0]?.id;
    if (first) setActiveItemId(first);
  }, [activeSectionId]); // eslint-disable-line

  const isReference = section.id === "reference";
  const endpoint = !isReference ? section.endpoints[activeItemId] : undefined;
  const refDoc = isReference ? section.reference?.find((r) => r.id === activeItemId) : undefined;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top header */}
      <header className="border-b border-border bg-card/40 backdrop-blur sticky top-0 z-30">
        <div className="flex items-center h-14 px-6 gap-6">
          <a href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-md bg-primary/15 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <span className="font-semibold text-sm">Zailom Docs</span>
          </a>

          <nav className="flex items-center gap-1">
            {sections.map((s) => {
              const Icon = s.icon;
              const active = s.id === activeSectionId;
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveSectionId(s.id)}
                  className={`px-3 h-9 rounded-md text-sm font-medium flex items-center gap-2 transition-colors ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {s.label}
                </button>
              );
            })}
          </nav>

          <div className="flex-1" />

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowConfig((v) => !v)}
            className="gap-2"
          >
            <Key className="w-4 h-4" />
            {apiKey ? "API Key configurada" : "Configurar API Key"}
          </Button>
        </div>

        {showConfig && (
          <div className="border-t border-border bg-card/60 px-6 py-4">
            <div className="max-w-3xl grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div className="space-y-1">
                <Label className="text-xs">API Key</Label>
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="zf_..."
                  className="font-mono h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Gerada em Configurações → API Keys. Fica salva neste navegador.
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={() => setShowConfig(false)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <aside className="w-64 border-r border-border bg-card/20 overflow-y-auto shrink-0">
          <div className="p-4 border-b border-border">
            <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-1">
              Base URL
            </div>
            <div className="text-xs font-mono text-foreground break-all">{section.baseUrl}</div>
          </div>

          <nav className="p-3 space-y-5">
            {section.sidebar.map((group) => (
              <div key={group.label}>
                <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider px-2 mb-2">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = item.id === activeItemId;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveItemId(item.id)}
                        className={`w-full text-left px-2 py-1.5 rounded-md text-sm flex items-center gap-2 transition-colors ${
                          active
                            ? "bg-accent text-foreground"
                            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                        }`}
                      >
                        {item.method && <MethodBadge method={item.method} />}
                        <span className="truncate">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main */}
        <main className="flex-1 overflow-y-auto p-8">
          {endpoint && (
            <EndpointView endpoint={endpoint} baseUrl={section.baseUrl} apiKey={apiKey} />
          )}
          {refDoc && <ReferenceView doc={refDoc} />}
          {!endpoint && !refDoc && (
            <div className="text-muted-foreground text-sm">Selecione um item na barra lateral.</div>
          )}
        </main>
      </div>
    </div>
  );
}
