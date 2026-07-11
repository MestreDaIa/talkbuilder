// =============================================================================
// HTTP Request — Modo Dinâmico
// Transforma o node em provedor de Skills para o Agente IA.
// Fluxo: URL Base → Analisar API (OpenAPI) → lista de endpoints →
//        para cada endpoint: importar CURL → permissões por campo →
//        testar → mapear resposta → marcar Context/Live Data.
// =============================================================================
import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Plus, Trash2, Play, Loader2, ChevronDown, ChevronRight,
  Zap, Database, Shield, ShieldOff, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  parseCurl,
  discoverEndpointsFromOpenApi,
  type DiscoveredEndpoint,
  type ParsedCurl,
} from "@/lib/curlParser";

export interface DynamicEndpoint {
  id: string;                         // "GET /services"
  name?: string;
  description?: string;               // usado pelo Agente IA como skill description
  method: string;
  url: string;
  headers: { name: string; value: string }[];
  queryParams: { name: string; value: string }[];
  pathParams: string[];
  body: string | null;
  bodyContentType: "json" | "form-urlencoded" | "raw" | null;
  auth: ParsedCurl["auth"];
  permissions: {
    authorization: boolean;
    headers: boolean;
    queryParams: boolean;
    pathParams: boolean;
    body: boolean;
  };
  responseMappings: { jsonPath: string; variableName: string; contextKey?: string }[];
  resultType: "context" | "live";
  lastTestResponse?: any;
  argsSchema?: {
    pathParams?: { name: string; description: string; example?: string }[];
    queryParams?: { name: string; description: string; example?: string }[];
    bodyDescription?: string;
    bodyExample?: string;
  };
}

interface Props {
  config: {
    apiBaseUrl?: string;
    endpoints?: DynamicEndpoint[];
    discovered?: DiscoveredEndpoint[];
  };
  setConfig: (cfg: any) => void;
}

const emptyPerms = () => ({
  authorization: false,
  headers: true,
  queryParams: true,
  pathParams: true,
  body: true,
});

export const HttpDynamicConfig = ({ config, setConfig }: Props) => {
  const [apiBaseUrl, setApiBaseUrl] = useState(config.apiBaseUrl || "");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const endpoints: DynamicEndpoint[] = useMemo(() => config.endpoints ?? [], [config.endpoints]);
  const discovered: DiscoveredEndpoint[] = useMemo(() => config.discovered ?? [], [config.discovered]);

  const update = (patch: Partial<Props["config"]>) => setConfig({ ...config, ...patch });

  const updateEndpoint = (idx: number, patch: Partial<DynamicEndpoint>) => {
    const next = [...endpoints];
    next[idx] = { ...next[idx], ...patch };
    update({ endpoints: next });
  };

  const removeEndpoint = (idx: number) => update({ endpoints: endpoints.filter((_, i) => i !== idx) });

  const addBlankEndpoint = () => {
    update({
      endpoints: [
        ...endpoints,
        {
          id: `CUSTOM /${endpoints.length + 1}`,
          method: "GET", url: "", headers: [], queryParams: [], pathParams: [],
          body: null, bodyContentType: null, auth: { type: "none" },
          permissions: emptyPerms(), responseMappings: [], resultType: "context",
        },
      ],
    });
  };

  const analyzeApi = async () => {
    if (!apiBaseUrl) { toast.error("Informe a URL base da API"); return; }
    setIsAnalyzing(true);
    try {
      const candidates = [
        apiBaseUrl,
        apiBaseUrl.replace(/\/$/, "") + "/openapi.json",
        apiBaseUrl.replace(/\/$/, "") + "/swagger.json",
        apiBaseUrl.replace(/\/docs\/?$/, "") + "/openapi.json",
      ];
      let doc: any = null;
      for (const u of candidates) {
        try {
          const r = await fetch(u, { headers: { Accept: "application/json" } });
          if (!r.ok) continue;
          const j = await r.json();
          if (j?.paths) { doc = j; break; }
        } catch { /* try next */ }
      }
      if (!doc) {
        toast.warning("Nenhum OpenAPI/Swagger encontrado. Adicione endpoints via CURL manualmente.");
        update({ apiBaseUrl, discovered: [] });
        return;
      }
      const list = discoverEndpointsFromOpenApi(doc);
      update({ apiBaseUrl, discovered: list });
      toast.success(`${list.length} endpoint(s) descoberto(s)`);
    } catch (e: any) {
      toast.error("Falha ao analisar API: " + e.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const addFromDiscovered = (d: DiscoveredEndpoint) => {
    const alreadyExists = endpoints.some(e => e.id === d.id);
    if (alreadyExists) { toast.info("Endpoint já adicionado"); return; }
    const baseUrl = apiBaseUrl.replace(/\/(docs|swagger|openapi\.json).*$/i, "").replace(/\/$/, "");
    update({
      endpoints: [
        ...endpoints,
        {
          id: d.id, name: d.summary || d.id, description: d.description || d.summary,
          method: d.method, url: baseUrl + d.path,
          headers: [], queryParams: [], pathParams: [...d.path.matchAll(/\{([^}]+)\}/g)].map(m => m[1]),
          body: null, bodyContentType: null, auth: { type: "none" },
          permissions: emptyPerms(), responseMappings: [], resultType: "context",
        },
      ],
    });
    toast.success("Endpoint adicionado");
  };

  return (
    <div className="space-y-6 p-4">
      <div className="rounded-md border border-primary/30 bg-primary/5 p-3 flex gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <div className="text-xs text-primary/90">
          <strong>Modo Dinâmico:</strong> este node vira um provedor inteligente de Skills.
          O Agente IA decide <em>quando</em> usar cada endpoint; o Runtime decide <em>como</em>
          executar respeitando as permissões abaixo.
        </div>
      </div>

      {/* URL BASE + ANALISAR */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold">URL Base da API (docs / OpenAPI / Swagger)</Label>
        <div className="flex gap-2">
          <Input
            value={apiBaseUrl}
            onChange={(e) => setApiBaseUrl(e.target.value)}
            placeholder="https://api-booking.zailom.com/docs"
            className="h-9 text-sm"
          />
          <Button onClick={analyzeApi} disabled={isAnalyzing || !apiBaseUrl}>
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analisar API"}
          </Button>
        </div>
      </div>

      {/* ENDPOINTS DESCOBERTOS */}
      {discovered.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold">Endpoints descobertos ({discovered.length})</Label>
          <div className="max-h-48 overflow-auto border rounded-md divide-y">
            {discovered.map((d) => (
              <div key={d.id} className="flex items-center justify-between px-2 py-1.5 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="font-mono text-[10px]">{d.method}</Badge>
                  <span className="font-mono truncate">{d.path}</span>
                  {d.summary && <span className="text-muted-foreground truncate">— {d.summary}</span>}
                </div>
                <Button size="sm" variant="ghost" className="h-6" onClick={() => addFromDiscovered(d)}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* LISTA DE ENDPOINTS CONFIGURADOS */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Endpoints configurados como Skills ({endpoints.length})</Label>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={addBlankEndpoint}>
            <Plus className="h-3 w-3 mr-1" /> Novo em branco
          </Button>
        </div>

        {endpoints.length === 0 && (
          <div className="text-xs text-muted-foreground border border-dashed rounded p-4 text-center">
            Nenhum endpoint configurado ainda. Analise a API acima ou importe um CURL.
          </div>
        )}

        {endpoints.map((ep, idx) => (
          <EndpointCard
            key={idx}
            endpoint={ep}
            onChange={(patch) => updateEndpoint(idx, patch)}
            onRemove={() => removeEndpoint(idx)}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// Card individual por endpoint
// =============================================================================
function EndpointCard({
  endpoint, onChange, onRemove,
}: {
  endpoint: DynamicEndpoint;
  onChange: (p: Partial<DynamicEndpoint>) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [curlText, setCurlText] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const importCurl = () => {
    if (!curlText.trim()) { toast.error("Cole o CURL primeiro"); return; }
    try {
      const parsed = parseCurl(curlText);
      onChange({
        method: parsed.method,
        url: parsed.url,
        headers: parsed.headers,
        queryParams: parsed.queryParams,
        pathParams: parsed.pathParams,
        body: parsed.body,
        bodyContentType: parsed.bodyContentType,
        auth: parsed.auth,
        id: `${parsed.method} ${new URL(parsed.url || "http://x/").pathname}`,
      });
      toast.success(`CURL importado — ${parsed.method} · ${parsed.headers.length} headers · ${parsed.queryParams.length} query`);
      setCurlText("");
    } catch (e: any) {
      toast.error("Falha ao interpretar CURL: " + e.message);
    }
  };

  const runTest = async () => {
    if (!endpoint.url) { toast.error("Sem URL"); return; }
    setIsTesting(true); setTestResult(null);
    try {
      const url = new URL(endpoint.url);
      endpoint.queryParams.forEach(p => p.name && url.searchParams.set(p.name, p.value));
      const headers: Record<string, string> = {};
      endpoint.headers.forEach(h => h.name && (headers[h.name] = h.value));
      if (endpoint.auth.type === "bearer" && endpoint.auth.token) headers["Authorization"] = `Bearer ${endpoint.auth.token}`;
      if (endpoint.bodyContentType === "json" && endpoint.body) headers["Content-Type"] = "application/json";
      const res = await fetch(url.toString(), {
        method: endpoint.method,
        headers,
        body: ["GET", "HEAD"].includes(endpoint.method) ? undefined : (endpoint.body ?? undefined),
      });
      const text = await res.text();
      let json: any = null; try { json = JSON.parse(text); } catch {}
      const formatted = json ? JSON.stringify(json, null, 2) : text;
      setTestResult(`Status ${res.status}\n\n${formatted.slice(0, 4000)}`);
      onChange({ lastTestResponse: json ?? text });
      toast.success(`Status ${res.status}`);
    } catch (e: any) {
      setTestResult("Erro: " + e.message);
      toast.error(e.message);
    } finally { setIsTesting(false); }
  };

  const permBadge = (label: string, enabled: boolean, key: keyof DynamicEndpoint["permissions"]) => (
    <div className="flex items-center justify-between text-xs py-1">
      <span className="flex items-center gap-1.5">
        {enabled ? <Shield className="h-3 w-3 text-emerald-500" /> : <ShieldOff className="h-3 w-3 text-muted-foreground" />}
        {label}
      </span>
      <Switch
        checked={enabled}
        onCheckedChange={(v) => onChange({ permissions: { ...endpoint.permissions, [key]: v } })}
      />
    </div>
  );

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="border rounded-lg bg-card">
      <div className="flex items-center gap-2 p-2">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7">
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </CollapsibleTrigger>
        <Badge variant="outline" className="font-mono text-[10px]">{endpoint.method}</Badge>
        <span className="font-mono text-xs truncate flex-1">{endpoint.url || endpoint.id}</span>
        {endpoint.resultType === "live"
          ? <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/30 gap-1"><Zap className="h-3 w-3" />Live</Badge>
          : <Badge variant="secondary" className="gap-1"><Database className="h-3 w-3" />Context</Badge>}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>

      <CollapsibleContent className="border-t p-3 space-y-4">
        {/* Skill metadata */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[10px]">Nome da Skill</Label>
            <Input value={endpoint.name || ""} onChange={(e) => onChange({ name: e.target.value })} className="h-8 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Tipo de Resultado</Label>
            <Select value={endpoint.resultType} onValueChange={(v: any) => onChange({ resultType: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="context">Context Data (memorizável)</SelectItem>
                <SelectItem value="live">Live Data (sempre reconsultar)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-[10px]">Descrição para o Agente IA</Label>
          <Textarea
            value={endpoint.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
            className="text-xs min-h-[60px]"
            placeholder="Ex: Use este endpoint quando o usuário quiser ver os serviços disponíveis."
          />
        </div>

        {/* CURL importer */}
        <div className="rounded-md border p-2 bg-muted/30 space-y-2">
          <Label className="text-[10px] font-semibold">Importar CURL</Label>
          <Textarea
            value={curlText}
            onChange={(e) => setCurlText(e.target.value)}
            placeholder="curl -X POST 'https://api.exemplo.com/appointments' -H 'Authorization: Bearer ...' -d '{...}'"
            className="text-[10px] font-mono min-h-[70px]"
          />
          <Button size="sm" className="h-7 text-xs" onClick={importCurl}>Analisar CURL</Button>
        </div>

        {/* URL manual */}
        <div className="flex gap-2">
          <Select value={endpoint.method} onValueChange={(v) => onChange({ method: v })}>
            <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET","POST","PUT","PATCH","DELETE","HEAD"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={endpoint.url} onChange={(e) => onChange({ url: e.target.value })} className="h-8 text-xs flex-1" />
          <Button size="sm" variant="outline" className="h-8" onClick={runTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>

        {/* Permissões */}
        <div className="rounded-md border p-2 space-y-1">
          <Label className="text-[10px] font-semibold flex items-center gap-1">
            <Shield className="h-3 w-3" /> Permissões — o que o Agente IA pode alterar
          </Label>
          {permBadge("Authorization / API Key", endpoint.permissions.authorization, "authorization")}
          {permBadge("Headers customizados",    endpoint.permissions.headers,       "headers")}
          {permBadge("Query params",            endpoint.permissions.queryParams,   "queryParams")}
          {permBadge("Path params",             endpoint.permissions.pathParams,    "pathParams")}
          {permBadge("Body",                    endpoint.permissions.body,          "body")}
          <p className="text-[10px] text-muted-foreground pt-1">
            Credenciais permanecem seguras: campos desativados nunca poderão ser alterados pelo Agente em runtime.
          </p>
        </div>

        {/* Args Schema — o que o Agente IA precisa fornecer para chamar este endpoint */}
        <ArgsSchemaEditor endpoint={endpoint} onChange={onChange} />

        {/* Test result + mapping */}
        {testResult && (
          <div>
            <Label className="text-[10px]">Resultado do teste</Label>
            <pre className="text-[10px] bg-muted p-2 rounded max-h-40 overflow-auto font-mono">{testResult}</pre>
          </div>
        )}

        <div className="rounded-md border p-2 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-[10px] font-semibold">Mapeamento de resposta → variáveis / contexto</Label>
            <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() => onChange({
              responseMappings: [...(endpoint.responseMappings ?? []), { jsonPath: "", variableName: "", contextKey: "" }],
            })}>
              <Plus className="h-3 w-3 mr-1" /> Novo
            </Button>
          </div>
          {(endpoint.responseMappings ?? []).map((m, i) => (
            <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-1">
              <Input value={m.jsonPath} placeholder="data.id" className="h-7 text-[10px]" onChange={(e) => {
                const list = [...endpoint.responseMappings]; list[i] = { ...list[i], jsonPath: e.target.value };
                onChange({ responseMappings: list });
              }} />
              <Input value={m.variableName} placeholder="variável" className="h-7 text-[10px]" onChange={(e) => {
                const list = [...endpoint.responseMappings]; list[i] = { ...list[i], variableName: e.target.value };
                onChange({ responseMappings: list });
              }} />
              <Input value={m.contextKey || ""} placeholder="contexto (opcional)" className="h-7 text-[10px]" onChange={(e) => {
                const list = [...endpoint.responseMappings]; list[i] = { ...list[i], contextKey: e.target.value };
                onChange({ responseMappings: list });
              }} />
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                onChange({ responseMappings: endpoint.responseMappings.filter((_, x) => x !== i) });
              }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground">
            <strong>Variável</strong>: fica disponível para nodes do flow. <strong>Contexto</strong>: registra
            também na Session Memory via Context Manager (ideal para Context Data).
          </p>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// =============================================================================
// Editor de "Schema de Argumentos" — descreve, para o Agente IA, o que ele
// precisa preencher quando invocar este endpoint (path params, query params,
// body). Sem isto, o modelo não sabe qual valor injetar em `{id}`, `?date=...`,
// nem que estrutura JSON o body espera.
// =============================================================================
function ArgsSchemaEditor({
  endpoint, onChange,
}: {
  endpoint: DynamicEndpoint;
  onChange: (p: Partial<DynamicEndpoint>) => void;
}) {
  const schema = endpoint.argsSchema || {};

  // Sincroniza a lista de path params com os placeholders {name} / :name detectados na URL.
  const detectedPathParams = useMemo(() => {
    const url = endpoint.url || "";
    const set = new Set<string>();
    for (const m of url.matchAll(/\{([^}]+)\}/g)) set.add(m[1]);
    for (const m of url.matchAll(/(?<=\/):([a-zA-Z0-9_]+)/g)) set.add(m[1]);
    // fallback: pathParams originais do parse do CURL
    (endpoint.pathParams || []).forEach((p) => set.add(p));
    return Array.from(set);
  }, [endpoint.url, endpoint.pathParams]);

  const pathParams = schema.pathParams || [];
  const queryParams = schema.queryParams || [];

  const updateSchema = (patch: Partial<NonNullable<DynamicEndpoint["argsSchema"]>>) =>
    onChange({ argsSchema: { ...schema, ...patch } });

  const syncFromDetected = () => {
    const existingByName = new Map(pathParams.map((p) => [p.name, p]));
    const merged = detectedPathParams.map(
      (n) => existingByName.get(n) || { name: n, description: "", example: "" }
    );
    updateSchema({ pathParams: merged });
  };

  return (
    <div className="rounded-md border p-2 space-y-3 bg-muted/20">
      <div className="flex items-center justify-between">
        <Label className="text-[10px] font-semibold flex items-center gap-1">
          <Sparkles className="h-3 w-3 text-primary" /> Schema de argumentos p/ o Agente IA
        </Label>
        {detectedPathParams.length > 0 && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={syncFromDetected}>
            Sincronizar da URL ({detectedPathParams.length})
          </Button>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Descreva cada valor que o Agente IA deve fornecer. Se um valor não estiver aqui,
        o modelo não saberá que precisa enviá-lo — e a chamada pode falhar (400 / 422).
      </p>

      {/* Path params */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-semibold">Path params (ex.: {"{id}"} na URL)</Label>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() =>
            updateSchema({ pathParams: [...pathParams, { name: "", description: "", example: "" }] })
          }>
            <Plus className="h-3 w-3 mr-1" /> Novo
          </Button>
        </div>
        {pathParams.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">Nenhum path param definido.</p>
        )}
        {pathParams.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-1">
            <Input value={p.name} placeholder="id" className="h-7 text-[10px] font-mono" onChange={(e) => {
              const list = [...pathParams]; list[i] = { ...list[i], name: e.target.value };
              updateSchema({ pathParams: list });
            }} />
            <Input value={p.description} placeholder="Descrição p/ IA (ex.: ID do serviço escolhido)" className="h-7 text-[10px]" onChange={(e) => {
              const list = [...pathParams]; list[i] = { ...list[i], description: e.target.value };
              updateSchema({ pathParams: list });
            }} />
            <Input value={p.example || ""} placeholder="exemplo" className="h-7 text-[10px] font-mono" onChange={(e) => {
              const list = [...pathParams]; list[i] = { ...list[i], example: e.target.value };
              updateSchema({ pathParams: list });
            }} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() =>
              updateSchema({ pathParams: pathParams.filter((_, x) => x !== i) })
            }><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
      </div>

      {/* Query params */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-[10px] font-semibold">Query params</Label>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={() =>
            updateSchema({ queryParams: [...queryParams, { name: "", description: "", example: "" }] })
          }>
            <Plus className="h-3 w-3 mr-1" /> Novo
          </Button>
        </div>
        {queryParams.length === 0 && (
          <p className="text-[10px] text-muted-foreground italic">Nenhum query param declarado.</p>
        )}
        {queryParams.map((p, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-1">
            <Input value={p.name} placeholder="date" className="h-7 text-[10px] font-mono" onChange={(e) => {
              const list = [...queryParams]; list[i] = { ...list[i], name: e.target.value };
              updateSchema({ queryParams: list });
            }} />
            <Input value={p.description} placeholder="Descrição p/ IA" className="h-7 text-[10px]" onChange={(e) => {
              const list = [...queryParams]; list[i] = { ...list[i], description: e.target.value };
              updateSchema({ queryParams: list });
            }} />
            <Input value={p.example || ""} placeholder="2025-01-30" className="h-7 text-[10px] font-mono" onChange={(e) => {
              const list = [...queryParams]; list[i] = { ...list[i], example: e.target.value };
              updateSchema({ queryParams: list });
            }} />
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() =>
              updateSchema({ queryParams: queryParams.filter((_, x) => x !== i) })
            }><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </div>
        ))}
      </div>

      {/* Body schema/example */}
      <div className="space-y-1">
        <Label className="text-[10px] font-semibold">Body — descrição + exemplo JSON</Label>
        <Input
          value={schema.bodyDescription || ""}
          placeholder="Descrição do que o body representa (ex.: dados do agendamento)"
          className="h-7 text-[10px]"
          onChange={(e) => updateSchema({ bodyDescription: e.target.value })}
        />
        <Textarea
          value={schema.bodyExample || ""}
          onChange={(e) => updateSchema({ bodyExample: e.target.value })}
          placeholder={`{\n  "service_id": "<uuid do serviço>",\n  "employee_id": "<uuid do profissional>",\n  "start_at": "2025-01-30T14:00:00Z"\n}`}
          className="text-[10px] font-mono min-h-[80px]"
        />
        <p className="text-[10px] text-muted-foreground">
          O Agente enviará um JSON com <strong>a mesma estrutura</strong> do exemplo,
          substituindo os placeholders pelos valores extraídos da conversa.
        </p>
      </div>
    </div>
  );
}
