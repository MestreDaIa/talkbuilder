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
  Zap, Database, Shield, ShieldOff, Sparkles, Upload, FileText,
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
  strictIds?: boolean;
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
    documentationContent?: string;
    documentationFileName?: string;
    openApiContext?: string;
    apiDocumentationSourceUrl?: string;
    apiServerBaseUrl?: string;
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
  const [isReadingFile, setIsReadingFile] = useState(false);
  const endpoints: DynamicEndpoint[] = useMemo(() => config.endpoints ?? [], [config.endpoints]);
  const documentationContent = String((config as any).documentationContent || "");
  const documentationFileName = String((config as any).documentationFileName || "");
  const openApiContext = String((config as any).openApiContext || "");
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
    if (!apiBaseUrl.trim()) { toast.error("Informe a URL da documentação da API"); return; }
    setIsAnalyzing(true);
    try {
      const backend = String(import.meta.env.VITE_BACKEND_URL || "https://api-flowbuilder.zailom.com").replace(/\/$/, "");
      const response = await fetch(`${backend}/api/docs/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ url: apiBaseUrl.trim() }),
      });
      const result: any = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || `Falha HTTP ${response.status}`);
      if (result.format === "yaml") {
        update({ apiBaseUrl, discovered: [], openApiContext: String(result.raw || "").slice(0, 20000), apiDocumentationSourceUrl: result.sourceUrl });
        toast.warning("Documento YAML encontrado e anexado ao contexto. Para importar endpoints automaticamente, publique também a versão JSON do OpenAPI.");
        return;
      }
      const doc = result.spec;
      const list = discoverEndpointsFromOpenApi(doc);
      let apiServerBaseUrl = "";
      try {
        if (doc?.servers?.[0]?.url) apiServerBaseUrl = new URL(doc.servers[0].url, result.sourceUrl).toString().replace(/\/$/, "");
        else if (doc?.host) apiServerBaseUrl = `${(doc.schemes?.[0] || new URL(result.sourceUrl).protocol.replace(":", ""))}://${doc.host}${doc.basePath || ""}`.replace(/\/$/, "");
        else apiServerBaseUrl = new URL(result.sourceUrl).origin;
      } catch { apiServerBaseUrl = new URL(result.sourceUrl).origin; }
      update({
        apiBaseUrl,
        apiServerBaseUrl,
        discovered: list,
        openApiContext: JSON.stringify(doc, null, 2).slice(0, 20000),
        apiDocumentationSourceUrl: result.sourceUrl,
      });
      if (!list.length) toast.warning("O documento foi lido, mas não contém endpoints em paths.");
      else toast.success(`${list.length} endpoint(s) descoberto(s). A documentação também ficará disponível ao Agente IA.`);
    } catch (e: any) {
      toast.error("Falha ao analisar API: " + (e?.message || String(e)));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const importDocumentationFile = async (file?: File) => {
    if (!file) return;
    const allowed = /\.(md|markdown|txt|json|ya?ml|csv|pdf)$/i.test(file.name) || /^(text\/|application\/(json|yaml|x-yaml|pdf))/.test(file.type);
    if (!allowed) { toast.error("Formato não suportado. Envie PDF, Markdown, TXT, JSON, YAML ou CSV."); return; }
    if (file.size > 1000000) { toast.error("O arquivo deve ter no máximo 1 MB."); return; }
    setIsReadingFile(true);
    try {
      let content = "";
      if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        const data = new Uint8Array(await file.arrayBuffer());
        const pdf = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;
        const pages: string[] = [];
        let extractedLength = 0;
        for (let pageNo = 1; pageNo <= pdf.numPages && extractedLength < 20000; pageNo++) {
          const page = await pdf.getPage(pageNo);
          const textContent = await page.getTextContent();
          const pageText = textContent.items.map((item: any) => "str" in item ? item.str : "").filter(Boolean).join(" ");
          pages.push(pageText);
          extractedLength += pageText.length;
        }
        content = pages.join("\n");
        if (!content.trim()) {
          toast.error("Não encontrei texto selecionável nesse PDF. PDFs digitalizados precisam de OCR antes do envio.");
          return;
        }
      } else {
        content = await file.text();
      }
      if (!content.trim()) { toast.error("O arquivo está vazio."); return; }
      update({ documentationContent: content.slice(0, 20000), documentationFileName: file.name });
      toast.success(\`Documento "\${file.name}" anexado ao contexto do Agente IA.\`);
    } catch (e: any) {
      toast.error("Não foi possível ler o arquivo: " + (e?.message || String(e)));
    } finally {
      setIsReadingFile(false);
    }
  };

  const addFromDiscovered = (d: DiscoveredEndpoint) => {
    const alreadyExists = endpoints.some(e => e.id === d.id);
    if (alreadyExists) { toast.info("Endpoint já adicionado"); return; }
    const baseUrl = String(config.apiServerBaseUrl || apiBaseUrl.replace(/\/(api-docs(?:-json)?|docs|swagger|openapi\.json|swagger\.json|v3\/api-docs).*$/i, "")).replace(/\/$/, "");
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

      {/* DOCUMENTAÇÃO DE APOIO PARA A IA */}
      <div className="space-y-2 rounded-md border p-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <Label className="text-xs font-semibold">Documento de apoio para o Agente IA</Label>
        </div>
        <p className="text-xs text-muted-foreground">
          Anexe o guia Markdown/TXT ou outro documento com regras de negócio, campos, exemplos e instruções.
          Ele complementa a URL/OpenAPI: não cria permissões nem executa endpoints por conta própria.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.md,.markdown,.txt,.json,.yaml,.yml,.csv,application/pdf,text/plain,text/markdown,application/json,application/yaml"
              disabled={isReadingFile}
              onChange={(e) => { const file = e.target.files?.[0]; void importDocumentationFile(file); e.currentTarget.value = ""; }}
            />
            <span className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs hover:bg-muted">
              {isReadingFile ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              Anexar documento
            </span>
          </label>
          {documentationFileName && (
            <Badge variant="secondary" className="max-w-full gap-1">
              <FileText className="h-3 w-3" /> {documentationFileName}
            </Badge>
          )}
          {documentationContent && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => update({ documentationContent: "", documentationFileName: "" })}>
              Remover documento
            </Button>
          )}
        </div>
        {documentationContent && (
          <p className="text-[10px] text-emerald-600">
            Documento carregado ({documentationContent.length.toLocaleString()} caracteres). O conteúdo será incluído no contexto da IA.
          </p>
        )}
        {openApiContext && (
          <p className="text-[10px] text-emerald-600">
            OpenAPI analisado{(config as any).apiDocumentationSourceUrl ? `: ${(config as any).apiDocumentationSourceUrl}` : ""}. O contrato técnico também ficará disponível ao Agente IA.
          </p>
        )}
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
      setTestResult(`Status ${res.status}\n\n${formatted}`);
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
        <div className="flex items-start gap-2 rounded-md border p-2 bg-muted/30">
          <input
            id={`strict-${endpoint.id}`}
            type="checkbox"
            className="mt-0.5"
            checked={endpoint.strictIds ?? ["POST", "PUT", "PATCH", "DELETE"].includes(String(endpoint.method || "").toUpperCase())}
            onChange={(e) => onChange({ strictIds: e.target.checked })}
          />
          <label htmlFor={`strict-${endpoint.id}`} className="text-[11px] leading-tight">
            <span className="font-semibold">Modo estrito de IDs</span>
            <span className="block text-muted-foreground">
              Rejeita a chamada quando algum <code>*_id</code> (path, query ou body) não foi retornado por uma consulta desta sessão. Sem esta opção, o runtime tenta substituir por um ID já validado.
            </span>
          </label>
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
          <Input value={endpoint.url} onChange={(e) => onChange({ url: e.target.value })} placeholder="https://api.exemplo.com/v1/services/{{service_id}}/employees" className="h-8 text-xs flex-1" />
          <Button size="sm" variant="outline" className="h-8" onClick={runTest} disabled={isTesting}>
            {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Parâmetros de caminho aceitam <code>{"{{service_id}}"}</code>, <code>{"{service_id}"}</code> ou <code>{":service_id"}</code>.
          O runtime resolve o valor a partir dos argumentos da Skill (preferencialmente <code>pathParams</code>), sem depender de uma API ou produto específico.
        </p>

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
    const raw = endpoint.url || "";
    // Decodifica `%3A` -> `:` (URLs colados/importados costumam vir url-encoded)
    const url = raw.replace(/%3A([a-zA-Z0-9_]+)/gi, ":$1")
      .replace(/\{\{\s*([A-Za-z_][A-Za-z0-9_.-]*)\s*\}\}/g, "{$1}");
    const set = new Set<string>();
    for (const m of url.matchAll(/\{([^{}]+)\}/g)) set.add(m[1].trim());
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
