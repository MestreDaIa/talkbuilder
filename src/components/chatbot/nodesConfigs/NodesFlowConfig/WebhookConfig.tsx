import { useState, useEffect, useLayoutEffect, useRef, useMemo } from "react";
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
import { Copy, Check, Radio, Square, ChevronRight, ChevronDown, ArrowRight, Plus, Trash2, Braces } from "lucide-react";
import { toast } from "sonner";
import { SkillConfig } from "../SkillConfig";
import { JsonViewer } from "./JsonViewer";
import { VariableModal } from "../../VariableModal";
import { useVariables } from "@/context/VariablesContext";

interface CapturedRequest {
  receivedAt: string;
  method: string;
  headers: Record<string, any>;
  query: Record<string, any>;
  params: Record<string, any>;
  body: any;
}

interface ResponseMapping {
  variableName: string;
  jsonPath: string;
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
    responseMappings?: ResponseMapping[];
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
  const [responseMappings, setResponseMappings] = useState<ResponseMapping[]>(() => config.responseMappings || []);
  const [variableModalOpen, setVariableModalOpen] = useState<{ open: boolean; index: number }>({ open: false, index: -1 });
  const { getAllVariableNames, variables } = useVariables();
  const availableVariables = useMemo(() => getAllVariableNames(), [variables, getAllVariableNames]);
  
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
    setResponseMappings(config.responseMappings || []);
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
  const [showClear, setShowClear] = useState(false);
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

  const clearCapture = () => {
    setCapturedEvents([]);
    setSelectedEventIdx(0);
    setLastTestPayload(null);
    updateMainConfig({ lastTestPayload: null });
    sinceRef.current = 0;
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

        <div className="space-y-2 border border-border rounded-md p-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Mapear Campos para Variáveis</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-[10px]"
              onClick={() => {
                const next = [...responseMappings, { variableName: "", jsonPath: "" }];
                setResponseMappings(next);
                updateMainConfig({ responseMappings: next });
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Novo
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground leading-snug">
            Selecione (ou crie) a variável e informe o caminho do campo no payload recebido (ex: <code className="font-mono">body.data.messageType</code>). Use depois como <code className="font-mono">{`{{nomeDaVariavel}}`}</code>.
          </p>
          {responseMappings.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic">Nenhum mapeamento. Por padrão o payload completo fica disponível em <code className="font-mono">{`{{webhookData}}`}</code>.</p>
          )}
          {responseMappings.map((m, idx) => (
            <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[10px]">Variável</Label>
                <div className="flex gap-1">
                  <Input
                    value={m.variableName}
                    list={`wh-vars-${idx}`}
                    placeholder="messageType"
                    className="h-8 text-xs flex-1"
                    onChange={(e) => {
                      const next = [...responseMappings];
                      next[idx] = { ...next[idx], variableName: e.target.value };
                      setResponseMappings(next);
                      updateMainConfig({ responseMappings: next });
                    }}
                  />
                  <datalist id={`wh-vars-${idx}`}>
                    {availableVariables.map((v) => <option key={v} value={v} />)}
                  </datalist>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setVariableModalOpen({ open: true, index: idx })}
                  >
                    <Braces className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px]">Caminho (path)</Label>
                <Input
                  value={m.jsonPath}
                  placeholder="body.data.messageType"
                  className="h-8 text-xs font-mono"
                  onChange={(e) => {
                    const next = [...responseMappings];
                    next[idx] = { ...next[idx], jsonPath: e.target.value };
                    setResponseMappings(next);
                    updateMainConfig({ responseMappings: next });
                  }}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => {
                  const next = responseMappings.filter((_, i) => i !== idx);
                  setResponseMappings(next);
                  updateMainConfig({ responseMappings: next });
                }}
              >
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>

        <VariableModal
          open={variableModalOpen.open}
          onClose={() => setVariableModalOpen({ open: false, index: -1 })}
          onSelect={(v) => {
            if (variableModalOpen.index >= 0) {
              const next = [...responseMappings];
              next[variableModalOpen.index] = { ...next[variableModalOpen.index], variableName: v };
              setResponseMappings(next);
              updateMainConfig({ responseMappings: next });
            }
          }}
        />


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

      <section className="bg-muted/20 overflow-hidden flex flex-col h-full border-l border-border">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-background/40">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Output</span>
            {listening && (
              <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <div className="flex items-center gap-2">
            {capturedEvents.length > 0 && (
              <>
                <Badge variant="outline" className="text-[10px]">{capturedEvents.length} eventos</Badge>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={clearCapture}>
                  <Square className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
        
        <div className="flex-1 flex flex-col min-h-0">
          {capturedEvents.length > 0 ? (
            <>
              {/* Lista de Eventos */}
              <div className="h-40 border-b border-border overflow-y-auto bg-background/20 p-2 space-y-1 shrink-0">
                {capturedEvents.map((ev, idx) => {
                  const eventName = ev.body?.event || ev.method || "Event";
                  const time = new Date(ev.receivedAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedEventIdx(idx)}
                      className={`w-full flex items-center justify-between p-2 text-[10px] rounded-md transition-colors ${
                        selectedEventIdx === idx 
                          ? "bg-primary text-primary-foreground font-medium" 
                          : "hover:bg-muted text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2 overflow-hidden">
                        <ArrowRight className={`h-3 w-3 shrink-0 ${selectedEventIdx === idx ? "opacity-100" : "opacity-0"}`} />
                        <span className="truncate">{eventName}</span>
                      </div>
                      <span className="shrink-0 opacity-70 ml-2">{time}</span>
                    </button>
                  );
                })}
              </div>

              {/* Detalhes do Evento Selecionado */}
              <div className="flex-1 p-4 overflow-y-auto font-mono text-[11px] bg-background/10">
                <div className="space-y-4">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-bold">Resumo da Requisição</div>
                    <div className="grid grid-cols-2 gap-2 text-[10px] bg-muted/30 p-2 rounded-md mb-4">
                      <div><span className="text-muted-foreground">Método:</span> <span className="font-semibold">{currentEvent?.method}</span></div>
                      <div><span className="text-muted-foreground">Data/Hora:</span> <span>{new Date(currentEvent?.receivedAt || "").toLocaleString()}</span></div>
                    </div>
                  </div>
                  
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-bold">Payload JSON</div>
                    <JsonViewer data={currentEvent} />
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground text-center p-6">
              <Radio className={`h-8 w-8 mb-3 ${listening ? "animate-pulse text-primary" : "opacity-20"}`} />
              <p className="text-sm font-medium">Aguardando eventos...</p>
              <p className="text-xs mt-1 max-w-[200px]">
                {listening 
                  ? "Envie uma requisição para a URL de teste para ver os dados aqui em tempo real."
                  : "Clique em 'Listen for test event' para começar a capturar requisições."}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
