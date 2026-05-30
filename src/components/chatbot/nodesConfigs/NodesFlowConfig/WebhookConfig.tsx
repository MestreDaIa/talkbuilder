import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Copy, Check, Radio, Square, ChevronRight, ChevronDown, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { SkillConfig } from "../SkillConfig";

interface CapturedRequest {
  receivedAt: string;
  method: string;
  headers: Record<string, any>;
  query: Record<string, any>;
  params: Record<string, any>;
  body: any;
}

interface WebhookConfigProps {
  config: {
    baseUrl?: string;
    method?: string;
    path?: string;

    authentication?: string;
    authCredentials?: {
      username?: string;
      password?: string;
      headerName?: string;
      headerValue?: string;
    };
    respondMode?: string;
    responseCode?: number;
    responseData?: string;
    responseVariable?: string;
    allowedOrigins?: string;
    lastTestPayload?: CapturedRequest | null;
  };
  setConfig: (config: WebhookConfigProps["config"]) => void;
}

const getBaseUrl = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backendUrl) return backendUrl;

  const runtimeUrl = import.meta.env.VITE_CHATBOT_RUNTIME_URL as string | undefined;
  if (runtimeUrl) {
    // Se a runtime URL termina com /runtime, removemos para pegar a base do servidor
    return runtimeUrl.replace(/\/runtime$/, "");
  }
  
  // Se estivermos no navegador e não houver backend URL, usamos o origin atual
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  return projectId ? `https://${projectId}.supabase.co/functions/v1` : "";
};


export const WebhookConfig = ({ config, setConfig }: WebhookConfigProps) => {
  const [baseUrl, setBaseUrl] = useState(config.baseUrl || getBaseUrl());
  const [method, setMethod] = useState(config.method || "POST");
  const [path, setPath] = useState(config.path || "");
  const [authentication, setAuthentication] = useState(config.authentication || "none");
  const [authCredentials, setAuthCredentials] = useState(config.authCredentials || {});
  const [respondMode, setRespondMode] = useState(config.respondMode || "immediately");
  const [responseCode, setResponseCode] = useState(config.responseCode || 200);
  const [responseData, setResponseData] = useState(config.responseData || "all");
  const [responseVariable, setResponseVariable] = useState(config.responseVariable || "webhookData");
  const [allowedOrigins, setAllowedOrigins] = useState(config.allowedOrigins || "*");
  const [lastTestPayload, setLastTestPayload] = useState<CapturedRequest | null>(
    config.lastTestPayload || null
  );
  const [capturedEvents, setCapturedEvents] = useState<CapturedRequest[]>(
    config.lastTestPayload ? [config.lastTestPayload] : []
  );
  const [selectedEventIdx, setSelectedEventIdx] = useState<number>(0);
  const sinceRef = useRef(0);


  const [urlMode, setUrlMode] = useState<"test" | "production">("test");
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const pollRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    // Mantém o rascunho do diálogo sempre sincronizado com o formulário do Webhook.
    // Usamos layout effect para o último campo digitado já estar no config antes
    // do usuário clicar em "Salvar" no modal.
    const newConfig = {
      baseUrl,
      method,
      path,
      authentication,
      authCredentials,
      respondMode,
      responseCode,
      responseData,
      responseVariable,
      allowedOrigins,
      lastTestPayload,
    };

    const hasChanged = Object.entries(newConfig).some(
      ([key, value]) => JSON.stringify(value) !== JSON.stringify((config as any)[key])
    );
    
    if (hasChanged) {
      setConfig({ ...config, ...newConfig });
    }
  }, [
    baseUrl,
    method,
    path,
    authentication,
    authCredentials,
    respondMode,
    responseCode,
    responseData,
    responseVariable,
    allowedOrigins,
    lastTestPayload,
    config,
    setConfig
  ]);

  const cleanedPath = (path || "meu-webhook").replace(/^\/+|\/+$/g, "");
  // Origem do servidor (sem path) — usada para as rotas internas de captura/teste,
  // que ficam na raiz (ex: /webhook-test/...). Permite o usuário deixar "/webhook"
  // no final da Base URL sem quebrar o Listen.
  const serverOrigin = (() => {
    try {
      const u = new URL(baseUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      return (baseUrl || "").replace(/\/+$/, "").replace(/\/webhook$/, "");
    }
  })();
  const testUrl = `${serverOrigin}/webhook-test/${cleanedPath}`;
  const captureUrl = `${serverOrigin}/webhook-capture/${cleanedPath}`;
  // Production URL = Base URL + path exatamente como o usuário configurou.
  // Para Evolution use: Base URL = https://api-flowbuilder.zailom.com/webhook  e Path = whatsapp
  const productionUrl = `${(baseUrl || "").replace(/\/+$/, "")}/${cleanedPath}`;
  const displayedUrl = urlMode === "test" ? testUrl : productionUrl;


  const handleCopyUrl = () => {
    navigator.clipboard.writeText(displayedUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 1500);
  };

  // Polling lifecycle
  useEffect(() => {
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, []);

  const startListening = async () => {
    if (!cleanedPath) {
      toast.error("Defina um caminho (path) antes de escutar.");
      return;
    }
    setListening(true);
    toast.info("Escutando eventos...", {
      description: `Envie uma requisição para a Test URL. Vários eventos serão acumulados abaixo.`,
    });

    // Clear any previous capture so we only see fresh ones
    try {
      await fetch(captureUrl, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    sinceRef.current = 0;
    setCapturedEvents([]);
    setSelectedEventIdx(0);

    const poll = async () => {
      try {
        const res = await fetch(`${captureUrl}?since=${sinceRef.current}`);
        if (res.ok) {
          const data = await res.json();
          const events: CapturedRequest[] = Array.isArray(data?.events) ? data.events : [];
          if (events.length > 0) {
            sinceRef.current = data.total ?? sinceRef.current + events.length;
            setCapturedEvents((prev) => {
              const next = [...prev, ...events];
              // mantém o último como "payload principal" para compatibilidade
              setLastTestPayload(next[next.length - 1] || null);
              return next;
            });
          }
        }
      } catch {
        /* ignore */
      }
    };

    pollRef.current = window.setInterval(poll, 1000);
  };

  const stopListening = () => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setListening(false);
  };

  const clearCapture = async () => {
    try {
      await fetch(captureUrl, { method: "DELETE" });
    } catch {
      /* ignore */
    }
    sinceRef.current = 0;
    setCapturedEvents([]);
    setLastTestPayload(null);
    setSelectedEventIdx(0);
    toast.success("Captura limpa");
  };

  // Detecta o nome do evento (Evolution usa body.event)
  const getEventLabel = (e: CapturedRequest) => {
    const ev = (e?.body as any)?.event;
    return typeof ev === "string" ? ev : `${e.method}`;
  };

  const currentEvent = capturedEvents[selectedEventIdx] || lastTestPayload;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-0 min-h-[60vh]">
      {/* ============ LEFT: Webhook URLs ============ */}
      <aside className="border-r border-border bg-muted/30 p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Webhook URLs
          </h4>
          <Tabs value={urlMode} onValueChange={(v) => setUrlMode(v as "test" | "production")}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="test">Test URL</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {method}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {urlMode === "test" ? "Captura no editor" : "Endpoint público"}
            </span>
          </div>
          <div className="rounded-md border border-border bg-background p-2 text-[11px] font-mono break-all">
            {displayedUrl}
          </div>
          <Button type="button" variant="outline" size="sm" className="w-full" onClick={handleCopyUrl}>
            {copied ? <Check className="h-3.5 w-3.5 mr-1.5" /> : <Copy className="h-3.5 w-3.5 mr-1.5" />}
            Copiar URL
          </Button>
        </div>

        <div className="pt-2 border-t border-border space-y-2">
          {!listening ? (
            <Button
              type="button"
              size="sm"
              className="w-full"
              onClick={startListening}
              disabled={urlMode !== "test"}
            >
              <Radio className="h-3.5 w-3.5 mr-1.5" />
              Listen for test event
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="w-full"
              onClick={stopListening}
            >
              <Square className="h-3.5 w-3.5 mr-1.5" />
              Parar de escutar
            </Button>
          )}
          <p className="text-[10px] text-muted-foreground leading-snug">
            1. Clique no botão acima para começar a escutar.<br />
            2. Envie uma requisição {method} para a <strong>Test URL</strong>.<br />
            3. O payload aparecerá automaticamente no painel <strong>Output</strong>.
          </p>
          
          <div className="pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-[10px] h-7"
              onClick={() => {
                const curl = `curl -X ${method} "${testUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{"exemplo": "dados", "numero": 123}'`;
                navigator.clipboard.writeText(curl);
                toast.success("Exemplo CURL copiado!", {
                  description: "Cole no seu terminal para testar."
                });
              }}
            >
              Copiar comando CURL p/ teste
            </Button>
          </div>
        </div>
      </aside>

      {/* ============ MIDDLE: Parameters ============ */}
      <section className="p-5 space-y-4 border-r border-border overflow-y-auto">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parâmetros
        </h4>

        <div className="space-y-1.5">
          <Label className="text-xs">Base URL da API</Label>
          <Input 
            value={baseUrl} 
            onChange={(e) => setBaseUrl(e.target.value)} 
            placeholder="https://sua-api.com" 
          />
          <p className="text-[10px] text-muted-foreground">
            A URL base onde o servidor está rodando. Por padrão usa o endereço atual.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">

          <div className="space-y-1.5">
            <Label className="text-xs">Método HTTP</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="PATCH">PATCH</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Caminho (Path)</Label>
            <Input value={path} onChange={(e) => setPath(e.target.value)} placeholder="meu-webhook" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Autenticação</Label>
          <Select value={authentication} onValueChange={setAuthentication}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              <SelectItem value="basic">Basic Auth</SelectItem>
              <SelectItem value="header">Header Auth</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {authentication === "basic" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Usuário</Label>
              <Input
                value={authCredentials.username || ""}
                onChange={(e) => setAuthCredentials({ ...authCredentials, username: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                value={authCredentials.password || ""}
                onChange={(e) => setAuthCredentials({ ...authCredentials, password: e.target.value })}
              />
            </div>
          </div>
        )}

        {authentication === "header" && (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome do Header</Label>
              <Input
                value={authCredentials.headerName || ""}
                onChange={(e) => setAuthCredentials({ ...authCredentials, headerName: e.target.value })}
                placeholder="X-API-Key"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input
                type="password"
                value={authCredentials.headerValue || ""}
                onChange={(e) => setAuthCredentials({ ...authCredentials, headerValue: e.target.value })}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Modo de Resposta</Label>
            <Select value={respondMode} onValueChange={setRespondMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediately">Imediatamente</SelectItem>
                <SelectItem value="lastNode">Ao finalizar fluxo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Código de Resposta</Label>
            <Select value={String(responseCode)} onValueChange={(v) => setResponseCode(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="200">200 OK</SelectItem>
                <SelectItem value="201">201 Created</SelectItem>
                <SelectItem value="204">204 No Content</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Salvar dados em variável</Label>
          <Input
            value={responseVariable}
            onChange={(e) => setResponseVariable(e.target.value)}
            placeholder="webhookData"
          />
          <p className="text-[11px] text-muted-foreground">
            Use <code className="bg-muted px-1 rounded">{"{{" + responseVariable + ".body.campo}}"}</code> nos próximos nodes.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Origens Permitidas (CORS)</Label>
          <Input
            value={allowedOrigins}
            onChange={(e) => setAllowedOrigins(e.target.value)}
            placeholder="* ou https://meusite.com"
          />
        </div>

        <SkillConfig config={config} setConfig={setConfig} />
      </section>

      {/* ============ RIGHT: Output ============ */}
      <section className="bg-muted/20 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Output
            </span>
            {capturedEvents.length > 0 && (
              <Badge variant="outline" className="text-[10px]">
                {capturedEvents.length} evento{capturedEvents.length > 1 ? "s" : ""}
              </Badge>
            )}
            {listening && (
              <Badge className="text-[10px] bg-red-500/15 text-red-500 border-red-500/30">
                <Radio className="h-2.5 w-2.5 mr-1 animate-pulse" /> ao vivo
              </Badge>
            )}
          </div>
          {capturedEvents.length > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={clearCapture}>
              Limpar
            </Button>
          )}
        </div>

        {capturedEvents.length > 0 && (
          <div className="border-b border-border bg-background/30 max-h-40 overflow-y-auto">
            {capturedEvents.map((e, i) => {
              const active = i === selectedEventIdx;
              const label = getEventLabel(e);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedEventIdx(i)}
                  className={`w-full text-left px-3 py-1.5 text-[11px] border-l-2 flex items-center justify-between gap-2 hover:bg-muted/60 ${
                    active ? "border-primary bg-muted/60" : "border-transparent"
                  }`}
                >
                  <span className="font-mono truncate">{label}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {new Date(e.receivedAt).toLocaleTimeString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 text-[11px] font-mono">
          {!currentEvent ? (
            <div className="h-full flex items-center justify-center text-center text-muted-foreground px-6">
              <div className="space-y-2">
                <Radio className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-xs">
                  Nenhum dado capturado ainda.
                  <br />
                  Clique em <strong>Listen for test event</strong> e dispare uma requisição para a Test URL.
                </p>
              </div>
            </div>
          ) : (
            <JsonTree value={currentEvent} rootName={responseVariable || "webhookData"} />
          )}
        </div>
      </section>
    </div>
  );
};

// =====================================================================
// JSON tree viewer — click any leaf to copy its variable path
// =====================================================================
interface JsonTreeProps {
  value: any;
  rootName: string;
}

const JsonTree = ({ value, rootName }: JsonTreeProps) => {
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground mb-2 px-1">
        Clique em qualquer campo para copiar o caminho da variável.
      </p>
      <TreeNode name={rootName} value={value} path={`{{${rootName}`} depth={0} isRoot />
    </div>
  );
};

const TreeNode = ({
  name,
  value,
  path,
  depth,
  isRoot = false,
}: {
  name: string;
  value: any;
  path: string;
  depth: number;
  isRoot?: boolean;
}) => {
  const [open, setOpen] = useState(depth < 2);
  const isObject = value !== null && typeof value === "object";
  const isArray = Array.isArray(value);

  const copyPath = (p: string) => {
    const full = `${p}}}`;
    navigator.clipboard.writeText(full);
    toast.success("Variável copiada", { description: full });
  };

  if (!isObject) {
    return (
      <div
        className="group flex items-start gap-2 pl-[calc(0.5rem*var(--d))] py-0.5 hover:bg-muted/60 rounded cursor-pointer"
        style={{ ["--d" as any]: depth + 1 }}
        onClick={() => copyPath(path)}
        title="Copiar caminho"
      >
        <span className="text-foreground/80">{name}:</span>
        <span
          className={
            typeof value === "string"
              ? "text-emerald-500"
              : typeof value === "number"
              ? "text-amber-500"
              : "text-sky-500"
          }
        >
          {typeof value === "string" ? `"${value}"` : String(value)}
        </span>
        <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-60 ml-auto mr-2" />
      </div>
    );
  }

  const entries = isArray
    ? (value as any[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, any>);

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 cursor-pointer hover:bg-muted/60 rounded"
        style={{ paddingLeft: `${depth * 0.75}rem` }}
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        <span className="text-foreground/80">{name}</span>
        <span className="text-muted-foreground ml-1">
          {isArray ? `[${entries.length}]` : `{${entries.length}}`}
        </span>
        {!isRoot && (
          <button
            type="button"
            className="ml-auto mr-2 text-[10px] text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              copyPath(path);
            }}
          >
            copiar
          </button>
        )}
      </div>
      {open && (
        <div>
          {entries.map(([k, v]) => {
            const childPath = isArray ? `${path}[${k}]` : `${path}.${k}`;
            return (
              <TreeNode
                key={k}
                name={k}
                value={v}
                path={childPath}
                depth={depth + 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};
