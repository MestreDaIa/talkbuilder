import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Play, Loader2 } from "lucide-react";

const DEFAULT_BASE_URL = "https://fwoescubnnagdvwasbjl.supabase.co/functions/v1/booking-api";

type Endpoint = {
  method: "GET";
  path: string;
  label: string;
  description: string;
  hasParam?: boolean;
  paramLabel?: string;
  query?: { key: string; label: string; placeholder?: string }[];
};

const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/health", label: "Health", description: "Ping para validar chave + workspace." },
  { method: "GET", path: "/workspace", label: "Workspace", description: "Informações do workspace autenticado." },
  { method: "GET", path: "/instances", label: "Instâncias", description: "Lista todas as instâncias de WhatsApp." },
  { method: "GET", path: "/instances/:id", label: "Instância por ID", description: "Detalhe de uma instância.", hasParam: true, paramLabel: "instance_id" },
  { method: "GET", path: "/bots", label: "Bots", description: "Lista bots (publicados por padrão).", query: [{ key: "published", label: "published", placeholder: "true | false" }] },
  { method: "GET", path: "/bots/:id", label: "Bot por ID", description: "Detalhe de um bot (inclui settings).", hasParam: true, paramLabel: "bot_id" },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto border border-border">
      <code>{children}</code>
    </pre>
  );
}

function EndpointTester({ baseUrl, apiKey, ep }: { baseUrl: string; apiKey: string; ep: Endpoint }) {
  const [param, setParam] = useState("");
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<number | null>(null);
  const [response, setResponse] = useState<string>("");

  async function run() {
    if (!apiKey) {
      toast.error("Informe a API Key primeiro");
      return;
    }
    let path = ep.path;
    if (ep.hasParam) {
      if (!param.trim()) { toast.error(`Informe ${ep.paramLabel}`); return; }
      path = path.replace(/:[^/]+/, encodeURIComponent(param.trim()));
    }
    const qs = new URLSearchParams();
    ep.query?.forEach(q => { const v = queryValues[q.key]; if (v) qs.set(q.key, v); });
    const url = `${baseUrl.replace(/\/$/, "")}${path}${qs.toString() ? `?${qs}` : ""}`;

    setLoading(true); setStatus(null); setResponse("");
    try {
      const res = await fetch(url, { headers: { "x-api-key": apiKey, "Content-Type": "application/json" } });
      setStatus(res.status);
      const text = await res.text();
      try { setResponse(JSON.stringify(JSON.parse(text), null, 2)); }
      catch { setResponse(text); }
    } catch (e: any) {
      setResponse(`Erro de rede: ${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{ep.method}</Badge>
          <code className="text-sm font-mono">{ep.path}</code>
          <span className="text-sm text-muted-foreground">— {ep.label}</span>
        </div>
        <CardDescription>{ep.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {ep.hasParam && (
          <div className="space-y-1">
            <Label>{ep.paramLabel}</Label>
            <Input value={param} onChange={e => setParam(e.target.value)} placeholder="UUID..." />
          </div>
        )}
        {ep.query?.map(q => (
          <div className="space-y-1" key={q.key}>
            <Label>{q.label}</Label>
            <Input
              value={queryValues[q.key] ?? ""}
              onChange={e => setQueryValues(v => ({ ...v, [q.key]: e.target.value }))}
              placeholder={q.placeholder}
            />
          </div>
        ))}
        <Button onClick={run} disabled={loading} size="sm">
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Play className="w-4 h-4 mr-2" />}
          Testar
        </Button>
        {status !== null && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Status:</span>
              <Badge variant={status >= 200 && status < 300 ? "default" : "destructive"}>{status}</Badge>
              <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(response); toast.success("Copiado"); }}>
                <Copy className="w-3 h-3" />
              </Button>
            </div>
            <CodeBlock>{response}</CodeBlock>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DocsPage() {
  const [baseUrl, setBaseUrl] = useState(DEFAULT_BASE_URL);
  const [apiKey, setApiKey] = useState("");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Zailom Flow — Documentação da API</h1>
          <p className="text-muted-foreground">
            API pública read-only do Zailom Flow, destinada ao consumo pelo Zailom Booking.
          </p>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Configuração</CardTitle>
            <CardDescription>Cole sua API Key gerada em Configurações → API Keys.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Base URL</Label>
              <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>API Key</Label>
              <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="zf_..." />
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="tester">
          <TabsList>
            <TabsTrigger value="tester">Testar endpoints</TabsTrigger>
            <TabsTrigger value="docs">Documentação</TabsTrigger>
          </TabsList>

          <TabsContent value="tester" className="space-y-4 mt-4">
            {ENDPOINTS.map(ep => (
              <EndpointTester key={ep.path} baseUrl={baseUrl} apiKey={apiKey} ep={ep} />
            ))}
          </TabsContent>

          <TabsContent value="docs" className="space-y-6 mt-4">
            <Card>
              <CardHeader><CardTitle>Autenticação</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p>Envie a API Key em <strong>um</strong> dos headers:</p>
                <CodeBlock>{`x-api-key: <API_KEY>
# ou
Authorization: Bearer <API_KEY>`}</CodeBlock>
                <p className="text-muted-foreground">
                  Toda requisição é escopada ao workspace dono da chave — não é possível acessar recursos de outro workspace.
                </p>
                <ul className="text-sm list-disc pl-5 space-y-1">
                  <li><Badge variant="outline">401</Badge> Header ausente ou chave inválida</li>
                  <li><Badge variant="outline">403</Badge> Chave desativada</li>
                  <li><Badge variant="outline">404</Badge> Recurso não encontrado (ou não pertence ao workspace)</li>
                  <li><Badge variant="outline">500</Badge> Erro interno</li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>GET /health</CardTitle><CardDescription>Ping rápido.</CardDescription></CardHeader>
              <CardContent>
                <CodeBlock>{`{
  "ok": true,
  "workspace_id": "uuid",
  "workspace_slug": "empresa-x",
  "timestamp": "2026-07-05T12:00:00.000Z"
}`}</CodeBlock>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>GET /workspace</CardTitle></CardHeader>
              <CardContent>
                <CodeBlock>{`{
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
}`}</CodeBlock>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>GET /instances</CardTitle><CardDescription>Lista instâncias de WhatsApp.</CardDescription></CardHeader>
              <CardContent>
                <CodeBlock>{`{
  "instances": [{
    "id": "uuid",
    "name": "Atendimento",
    "instance_name": "atendimento-01",
    "status": "connected",
    "connected": true,
    "phone_number": "5511999999999",
    "last_connected_at": "2026-07-05T10:00:00Z",
    "created_at": "...",
    "updated_at": "..."
  }]
}`}</CodeBlock>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>GET /instances/:id</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Retorna <code>{`{ "instance": {...} }`}</code>. 404 se não pertencer ao workspace.</p></CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>GET /bots</CardTitle>
                <CardDescription>Somente publicados por padrão. Use <code>?published=false</code> para incluir rascunhos.</CardDescription>
              </CardHeader>
              <CardContent>
                <CodeBlock>{`{
  "bots": [{
    "id": "uuid",
    "name": "Bot de Agendamento",
    "description": "Fluxo principal",
    "is_published": true,
    "is_active": true,
    "status": "published",
    "public_id": "abc123",
    "published_at": "2026-07-01T12:00:00Z",
    "updated_at": "...",
    "created_at": "..."
  }]
}`}</CodeBlock>
                <p className="text-xs text-muted-foreground mt-2"><code>status</code>: <code>published</code> | <code>draft</code> | <code>inactive</code>.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>GET /bots/:id</CardTitle></CardHeader>
              <CardContent><p className="text-sm text-muted-foreground">Retorna <code>{`{ "bot": {...} }`}</code> com <code>settings</code>. 404 se não pertencer ao workspace.</p></CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Exemplo curl</CardTitle></CardHeader>
              <CardContent>
                <CodeBlock>{`curl -H "x-api-key: SUA_API_KEY" \\
  ${DEFAULT_BASE_URL}/health`}</CodeBlock>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
