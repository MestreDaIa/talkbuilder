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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    urlMode?: "test" | "production";
    isSkill?: boolean;
    skillDescription?: string;
  };
  setConfig: (config: WebhookConfigProps["config"]) => void;
}

const getBaseUrl = () => {
  const backendUrl = import.meta.env.VITE_BACKEND_URL as string | undefined;
  if (backendUrl) return backendUrl;

  const runtimeUrl = import.meta.env.VITE_CHATBOT_RUNTIME_URL as string | undefined;
  if (runtimeUrl) {
    return runtimeUrl.replace(/\/runtime$/, "");
  }
  
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;
  return projectId ? `https://${projectId}.supabase.co/functions/v1` : "";
};


export const WebhookConfig = ({ config, setConfig }: WebhookConfigProps) => {
  // Inicializamos o estado local diretamente do config recebido
  const [baseUrl, setBaseUrl] = useState(() => config.baseUrl || getBaseUrl());
  const [method, setMethod] = useState(() => config.method || "POST");
  const [path, setPath] = useState(() => config.path || "");
  const [authentication, setAuthentication] = useState(() => config.authentication || "none");
  const [authCredentials, setAuthCredentials] = useState(() => config.authCredentials || {});
  const [respondMode, setRespondMode] = useState(() => config.respondMode || "immediately");
  const [responseCode, setResponseCode] = useState(() => config.responseCode || 200);
  const [responseData, setResponseData] = useState(() => config.responseData || "all");
  const [responseVariable, setResponseVariable] = useState(() => config.responseVariable || "webhookData");
  const [allowedOrigins, setAllowedOrigins] = useState(() => config.allowedOrigins || "*");
  const [lastTestPayload, setLastTestPayload] = useState<CapturedRequest | null>(() => config.lastTestPayload || null);
  const [urlMode, setUrlMode] = useState<"test" | "production">(() => config.urlMode || "test");
  
  // Refs para rastrear valores atuais e evitar loops
  const isUpdatingRef = useRef(false);

  // Sincroniza props -> estado local (APENAS se o config mudar externamente)
  useEffect(() => {
    if (isUpdatingRef.current) return;
    
    setBaseUrl(config.baseUrl || getBaseUrl());
    setMethod(config.method || "POST");
    setPath(config.path || "");
    setAuthentication(config.authentication || "none");
    setAuthCredentials(config.authCredentials || {});
    setRespondMode(config.respondMode || "immediately");
    setResponseCode(config.responseCode || 200);
    setResponseData(config.responseData || "all");
    setResponseVariable(config.responseVariable || "webhookData");
    setAllowedOrigins(config.allowedOrigins || "*");
    setLastTestPayload(config.lastTestPayload || null);
    setUrlMode(config.urlMode || "test");
  }, [config]);

  // Função centralizada de atualização
  const updateMainConfig = (updates: Partial<WebhookConfigProps["config"]>) => {
    isUpdatingRef.current = true;
    setConfig({ ...config, ...updates });
    // Pequeno timeout para resetar a flag após o ciclo de renderização
    setTimeout(() => {
      isUpdatingRef.current = false;
    }, 100);
  };

  const [capturedEvents, setCapturedEvents] = useState<CapturedRequest[]>(
    config.lastTestPayload ? [config.lastTestPayload] : []
  );
  const [selectedEventIdx, setSelectedEventIdx] = useState<number>(0);
  const sinceRef = useRef(0);
  const [copied, setCopied] = useState(false);
  const [listening, setListening] = useState(false);
  const pollRef = useRef<number | null>(null);

  const cleanedPath = (path || "meu-webhook").replace(/^\/+|\/+$/g, "");
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
  const productionUrl = `${(baseUrl || "").replace(/\/+$/, "")}/${cleanedPath}`;
  const displayedUrl = urlMode === "test" ? testUrl : productionUrl;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(displayedUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 1500);
  };

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

    try {
      await fetch(captureUrl, { method: "DELETE" });
    } catch { /* ignore */ }
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
              const last = next[next.length - 1] || null;
              setLastTestPayload(last);
              updateMainConfig({ lastTestPayload: last });
              return next;
            });
          }
        }
      } catch { /* ignore */ }
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

  const currentEvent = capturedEvents[selectedEventIdx] || lastTestPayload;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_1fr] gap-0 min-h-[60vh]">
      <aside className="border-r border-border bg-muted/30 p-4 space-y-4">
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Webhook URLs
          </h4>
          <Tabs value={urlMode} onValueChange={(v) => {
            const val = v as "test" | "production";
            setUrlMode(val);
            updateMainConfig({ urlMode: val });
          }}>
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
        </div>
      </aside>

      <section className="p-5 space-y-4 border-r border-border overflow-y-auto">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Parâmetros
        </h4>

        <div className="space-y-1.5">
          <Label className="text-xs">Base URL da API</Label>
          <Input 
            value={baseUrl} 
            onChange={(e) => {
              setBaseUrl(e.target.value);
              updateMainConfig({ baseUrl: e.target.value });
            }} 
            placeholder="https://sua-api.com" 
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Método HTTP</Label>
            <Select value={method} onValueChange={(v) => {
              setMethod(v);
              updateMainConfig({ method: v });
            }}>
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
            <Input value={path} onChange={(e) => {
              setPath(e.target.value);
              updateMainConfig({ path: e.target.value });
            }} placeholder="meu-webhook" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Autenticação</Label>
          <Select value={authentication} onValueChange={(v) => {
            setAuthentication(v);
            updateMainConfig({ authentication: v });
          }}>
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
                onChange={(e) => {
                  const creds = { ...authCredentials, username: e.target.value };
                  setAuthCredentials(creds);
                  updateMainConfig({ authCredentials: creds });
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Senha</Label>
              <Input
                type="password"
                value={authCredentials.password || ""}
                onChange={(e) => {
                  const creds = { ...authCredentials, password: e.target.value };
                  setAuthCredentials(creds);
                  updateMainConfig({ authCredentials: creds });
                }}
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
                onChange={(e) => {
                  const creds = { ...authCredentials, headerName: e.target.value };
                  setAuthCredentials(creds);
                  updateMainConfig({ authCredentials: creds });
                }}
                placeholder="X-API-Key"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Valor</Label>
              <Input
                type="password"
                value={authCredentials.headerValue || ""}
                onChange={(e) => {
                  const creds = { ...authCredentials, headerValue: e.target.value };
                  setAuthCredentials(creds);
                  updateMainConfig({ authCredentials: creds });
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Modo de Resposta</Label>
            <Select value={respondMode} onValueChange={(v) => {
              setRespondMode(v);
              updateMainConfig({ respondMode: v });
            }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="immediately">Imediatamente</SelectItem>
                <SelectItem value="lastNode">Ao finalizar fluxo</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Código de Resposta</Label>
            <Select value={String(responseCode)} onValueChange={(v) => {
              const val = Number(v);
              setResponseCode(val);
              updateMainConfig({ responseCode: val });
            }}>
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
            onChange={(e) => {
              setResponseVariable(e.target.value);
              updateMainConfig({ responseVariable: e.target.value });
            }}
            placeholder="webhookData"
          />
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs">Origens Permitidas (CORS)</Label>
          <Input
            value={allowedOrigins}
            onChange={(e) => {
              setAllowedOrigins(e.target.value);
              updateMainConfig({ allowedOrigins: e.target.value });
            }}
            placeholder="* ou https://meusite.com"
          />
        </div>

        <SkillConfig config={config} setConfig={setConfig} />
      </section>

      <section className="bg-muted/20 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/40">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output</span>
          {capturedEvents.length > 0 && (
            <Badge variant="outline" className="text-[10px]">{capturedEvents.length} eventos</Badge>
          )}
        </div>
        <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px]">
          {currentEvent ? (
            <pre className="whitespace-pre-wrap">{JSON.stringify(currentEvent, null, 2)}</pre>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center">
              <Radio className={`h-8 w-8 mb-2 ${listening ? "animate-pulse text-primary" : ""}`} />
              <p>Aguardando evento...</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
