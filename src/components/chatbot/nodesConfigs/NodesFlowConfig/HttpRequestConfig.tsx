import { useState, useEffect, useMemo, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Play, Loader2, ChevronDown, ChevronRight, Braces, Info, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useVariables } from "@/context/VariablesContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { VariableModal } from "../../VariableModal";
import { SkillConfig } from "../SkillConfig";
import { HttpDynamicConfig } from "./HttpDynamicConfig";
import { Sparkles, Wrench } from "lucide-react";

interface KeyValuePair {
  name: string;
  value: string;
}

interface ResponseMapping {
  jsonPath: string;
  variableName: string;
}

interface HttpRequestConfigProps {
  config: {
    method?: string;
    url?: string;
    authType?: string;
    authCredentials?: {
      username?: string;
      password?: string;
      token?: string;
      headerName?: string;
      headerValue?: string;
      apiKeyName?: string;
      apiKeyValue?: string;
      apiKeyLocation?: string;
    };
    queryParams?: KeyValuePair[];
    headers?: KeyValuePair[];
    sendBody?: boolean;
    bodyContentType?: string;
    bodyParams?: KeyValuePair[];
    bodyJson?: string;
    bodyRaw?: string;
    timeout?: number;
    followRedirects?: boolean;
    ignoreSSL?: boolean;
    responseVariable?: string;
    responseFormat?: string;
    responseMappings?: ResponseMapping[];
  };
  setConfig: (config: HttpRequestConfigProps["config"]) => void;
}

export const HttpRequestConfig = ({
  config,
  setConfig,
}: HttpRequestConfigProps) => {
  const { getAllVariableNames, variables, replaceVariablesInText } = useVariables();
  
  // Local state for UI
  const [method, setMethod] = useState(config.method || "GET");
  const [url, setUrl] = useState(config.url || "");
  const [authType, setAuthType] = useState(config.authType || "none");
  const [authCredentials, setAuthCredentials] = useState(config.authCredentials || {});
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>(config.queryParams || []);
  const [headers, setHeaders] = useState<KeyValuePair[]>(config.headers || []);
  const [sendBody, setSendBody] = useState(config.sendBody ?? false);
  const [bodyContentType, setBodyContentType] = useState(config.bodyContentType || "json");
  const [bodyParams, setBodyParams] = useState<KeyValuePair[]>(config.bodyParams || []);
  const [bodyJson, setBodyJson] = useState(config.bodyJson || "{}");
  const [bodyRaw, setBodyRaw] = useState(config.bodyRaw || "");
  const [timeout, setTimeout_] = useState(config.timeout || 30000);
  const [responseMappings, setResponseMappings] = useState<ResponseMapping[]>(config.responseMappings || []);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [lastJsonResponse, setLastJsonResponse] = useState<any>(null);
  const [isSaveExpanded, setIsSaveExpanded] = useState(false);
  const [variableModalOpen, setVariableModalOpen] = useState<{ open: boolean; index: number }>({ open: false, index: -1 });

  // Variables for testing (mocks)
  const [testVariables, setTestVariables] = useState<Record<string, string>>({
    messageId: "",
    remoteJid: "5511999999999@s.whatsapp.net",
    instanceName: "teste05",
    apiKey: ""
  });

  // Sincroniza estados locais se a config do pai mudar
  useEffect(() => {
    setMethod(config.method || "GET");
    setUrl(config.url || "");
    setAuthType(config.authType || "none");
    setAuthCredentials(config.authCredentials || {});
    setQueryParams(config.queryParams || []);
    setHeaders(config.headers || []);
    setSendBody(config.sendBody ?? false);
    setBodyContentType(config.bodyContentType || "json");
    setBodyParams(config.bodyParams || []);
    setBodyJson(config.bodyJson || "{}");
    setBodyRaw(config.bodyRaw || "");
    setTimeout_(config.timeout || 30000);
    setResponseMappings(config.responseMappings || []);
  }, [config]);

  const updateConfig = (updates: Partial<typeof config>) => {
    setConfig({ ...config, ...updates });
  };

  const availableVariables = useMemo(() => getAllVariableNames(), [getAllVariableNames]);

  const jsonPaths = useMemo(() => {
    if (!lastJsonResponse) return [];
    const paths: string[] = [];
    const traverse = (obj: any, path: string = "data") => {
      if (obj === null || typeof obj !== "object") {
        paths.push(path);
        return;
      }
      paths.push(path);
      if (Array.isArray(obj)) {
        obj.forEach((item, index) => traverse(item, `${path}.${index}`));
      } else {
        Object.keys(obj).forEach((key) => traverse(obj[key], `${path}.${key}`));
      }
    };
    traverse(lastJsonResponse);
    return [...new Set(paths)];
  }, [lastJsonResponse]);

  const handleAddKeyValue = (list: KeyValuePair[], setList: any, field: string) => {
    const newList = [...list, { name: "", value: "" }];
    setList(newList);
    updateConfig({ [field]: newList });
  };

  const handleRemoveKeyValue = (index: number, list: KeyValuePair[], setList: any, field: string) => {
    const newList = list.filter((_, i) => i !== index);
    setList(newList);
    updateConfig({ [field]: newList });
  };

  const handleKeyValueChange = (index: number, field: string, value: string, list: KeyValuePair[], setList: any, configField: string) => {
    const updated = [...list];
    updated[index] = { ...updated[index], [field]: value };
    setList(updated);
    updateConfig({ [configField]: updated });
  };

  const handleResponseMappingChange = (index: number, field: keyof ResponseMapping, value: string) => {
    const updated = [...responseMappings];
    updated[index] = { ...updated[index], [field]: value };
    setResponseMappings(updated);
    updateConfig({ responseMappings: updated });
  };

  const handleTestRequest = async () => {
    if (!url) {
      toast.error("Informe a URL");
      return;
    }
    setIsTesting(true);
    setTestResult(null);
    setLastJsonResponse(null);

    // Prepare variables for substitution (actual + mocks)
    const varsForSubstitution = { ...variables, ...testVariables };
    const replace = (text: string) => replaceVariablesInText(text, varsForSubstitution);

    try {
      let fullUrl = replace(url);
      
      // Build query string
      if (queryParams.length > 0) {
        const params = new URLSearchParams();
        queryParams.forEach((p) => {
          if (p.name) params.append(replace(p.name), replace(p.value));
        });
        const qs = params.toString();
        if (qs) fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
      }

      const reqHeaders: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.name) reqHeaders[replace(h.name)] = replace(h.value);
      });

      // Auth
      if (authType === "bearer" && authCredentials.token) {
        reqHeaders["Authorization"] = `Bearer ${replace(authCredentials.token)}`;
      } else if (authType === "basic" && authCredentials.username) {
        const user = replace(authCredentials.username);
        const pass = replace(authCredentials.password || "");
        reqHeaders["Authorization"] = `Basic ${btoa(`${user}:${pass}`)}`;
      } else if (authType === "apiKey" && authCredentials.apiKeyName) {
        const name = replace(authCredentials.apiKeyName);
        const val = replace(authCredentials.apiKeyValue || "");
        if (authCredentials.apiKeyLocation === "header") reqHeaders[name] = val;
      }

      let body: string | undefined;
      if (sendBody && !["GET", "HEAD"].includes(method)) {
        if (bodyContentType === "json") {
          reqHeaders["Content-Type"] = "application/json";
          body = replace(bodyJson);
        } else if (bodyContentType === "form-urlencoded") {
          reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          const params = new URLSearchParams();
          bodyParams.forEach((p) => { if (p.name) params.append(replace(p.name), replace(p.value)); });
          body = params.toString();
        } else if (bodyContentType === "raw") {
          body = replace(bodyRaw);
        }
      }

      const response = await fetch(fullUrl, { method, headers: reqHeaders, body });
      const responseText = await response.text();
      let formatted = responseText;
      try {
        const json = JSON.parse(responseText);
        formatted = JSON.stringify(json, null, 2);
        setLastJsonResponse(json);
      } catch { }

      setTestResult(`Status: ${response.status} ${response.statusText}\n\n${formatted}`);
      toast.success(`Requisição concluída: ${response.status}`);
    } catch (error: any) {
      setTestResult(`Erro: ${error.message}`);
      toast.error(`Erro na requisição: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  const operationMode: "generic" | "dynamic" = (config as any).operationMode || "generic";

  return (
    <div className="space-y-4 p-4">
      {/* Modo de Operação */}
      <div className="rounded-md border bg-muted/30 p-2">
        <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Modo de Operação</Label>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={() => updateConfig({ operationMode: "generic" } as any)}
            className={`flex items-center gap-2 rounded-md border p-2 text-xs transition ${operationMode === "generic" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
          >
            <Wrench className="h-4 w-4" />
            <div className="text-left">
              <div className="font-semibold">Genérico</div>
              <div className="text-[10px] text-muted-foreground">Um endpoint, controle total.</div>
            </div>
          </button>
          <button
            type="button"
            onClick={() => updateConfig({ operationMode: "dynamic" } as any)}
            className={`flex items-center gap-2 rounded-md border p-2 text-xs transition ${operationMode === "dynamic" ? "border-primary bg-primary/10" : "border-border hover:bg-accent"}`}
          >
            <Sparkles className="h-4 w-4" />
            <div className="text-left">
              <div className="font-semibold">Dinâmico</div>
              <div className="text-[10px] text-muted-foreground">Skills para o Agente IA.</div>
            </div>
          </button>
        </div>
      </div>

      {operationMode === "dynamic" ? (
        <>
          <HttpDynamicConfig config={config as any} setConfig={setConfig as any} />
          <SkillConfig config={config} setConfig={setConfig} />
        </>
      ) : (<>
      {/* Informação sobre variáveis */}
      <div className="bg-blue-50 border border-blue-200 rounded p-3 flex gap-2">
        <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-blue-700 text-xs font-semibold">Variáveis no Teste</p>
          <p className="text-blue-600 text-[10px]">
            Use {"{{messageId}}"} ou outras variáveis. Preencha os valores de teste na aba <strong>Test Vars</strong> para validar a requisição agora.
          </p>
        </div>
      </div>

      {/* URL & Method */}
      <div className="flex gap-2">
        <div className="w-28 shrink-0">
          <Select value={method} onValueChange={(v) => { setMethod(v); updateConfig({ method: v }); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"].map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="flex-1"
          value={url}
          onChange={(e) => { setUrl(e.target.value); updateConfig({ url: e.target.value }); }}
          placeholder="https://api.exemplo.com/endpoint"
        />
        <Button variant="outline" onClick={handleTestRequest} disabled={isTesting}>
          {isTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        </Button>
      </div>

      <Tabs defaultValue="params" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="params">Params</TabsTrigger>
          <TabsTrigger value="auth">Auth</TabsTrigger>
          <TabsTrigger value="headers">Headers</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="test">Test Vars</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Query Parameters</Label>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAddKeyValue(queryParams, setQueryParams, "queryParams")}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
          {queryParams.map((param, index) => (
            <div key={index} className="flex gap-2">
              <Input value={param.name} placeholder="Nome" className="h-8 text-xs" onChange={(e) => handleKeyValueChange(index, "name", e.target.value, queryParams, setQueryParams, "queryParams")} />
              <Input value={param.value} placeholder="Valor" className="h-8 text-xs" onChange={(e) => handleKeyValueChange(index, "value", e.target.value, queryParams, setQueryParams, "queryParams")} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveKeyValue(index, queryParams, setQueryParams, "queryParams")}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="auth" className="space-y-3 pt-2">
          <Label className="text-xs">Tipo de Autenticação</Label>
          <Select value={authType} onValueChange={(v) => { setAuthType(v); updateConfig({ authType: v }); }}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["none", "basic", "bearer", "apiKey"].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {authType === "basic" && (
            <div className="grid grid-cols-2 gap-2">
              <Input value={authCredentials.username || ""} placeholder="Usuário" className="h-8 text-xs" onChange={(e) => {
                const creds = { ...authCredentials, username: e.target.value };
                setAuthCredentials(creds); updateConfig({ authCredentials: creds });
              }} />
              <Input type="password" value={authCredentials.password || ""} placeholder="Senha" className="h-8 text-xs" onChange={(e) => {
                const creds = { ...authCredentials, password: e.target.value };
                setAuthCredentials(creds); updateConfig({ authCredentials: creds });
              }} />
            </div>
          )}
          {authType === "bearer" && (
            <Input type="password" value={authCredentials.token || ""} placeholder="Token" className="h-8 text-xs" onChange={(e) => {
              const creds = { ...authCredentials, token: e.target.value };
              setAuthCredentials(creds); updateConfig({ authCredentials: creds });
            }} />
          )}
        </TabsContent>

        <TabsContent value="headers" className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Headers</Label>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleAddKeyValue(headers, setHeaders, "headers")}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar
            </Button>
          </div>
          {headers.map((h, index) => (
            <div key={index} className="flex gap-2">
              <Input value={h.name} placeholder="Nome" className="h-8 text-xs" onChange={(e) => handleKeyValueChange(index, "name", e.target.value, headers, setHeaders, "headers")} />
              <Input value={h.value} placeholder="Valor" className="h-8 text-xs" onChange={(e) => handleKeyValueChange(index, "value", e.target.value, headers, setHeaders, "headers")} />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRemoveKeyValue(index, headers, setHeaders, "headers")}><Trash2 className="h-3 w-3 text-destructive" /></Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="body" className="space-y-3 pt-2">
          <div className="flex items-center space-x-2">
            <Switch id="sendBody" checked={sendBody} onCheckedChange={(v) => { setSendBody(v); updateConfig({ sendBody: v }); }} />
            <Label htmlFor="sendBody" className="text-xs">Enviar Body</Label>
          </div>
          {sendBody && (
            <>
              <Select value={bodyContentType} onValueChange={(v) => { setBodyContentType(v); updateConfig({ bodyContentType: v }); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="json">JSON</SelectItem>
                  <SelectItem value="form-urlencoded">Form URL-encoded</SelectItem>
                  <SelectItem value="raw">Raw</SelectItem>
                </SelectContent>
              </Select>
              {bodyContentType === "json" && <Textarea value={bodyJson} rows={4} className="font-mono text-xs" onChange={(e) => { setBodyJson(e.target.value); updateConfig({ bodyJson: e.target.value }); }} />}
              {bodyContentType === "raw" && <Textarea value={bodyRaw} rows={4} className="font-mono text-xs" onChange={(e) => { setBodyRaw(e.target.value); updateConfig({ bodyRaw: e.target.value }); }} />}
            </>
          )}
        </TabsContent>

        <TabsContent value="test" className="space-y-3 pt-2">
          <Label className="text-xs">Valores de Teste (Mocks)</Label>
          <div className="space-y-2">
            {Object.entries(testVariables).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-24 text-[10px] font-mono text-muted-foreground">{key}</div>
                <Input value={val} placeholder={`Valor para {{${key}}}`} className="h-7 text-[10px]" onChange={(e) => setTestVariables({ ...testVariables, [key]: e.target.value })} />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Test Result */}
      {testResult && (
        <div className="space-y-1 mt-2">
          <Label className="text-[10px]">Resultado do Teste</Label>
          <pre className="text-[10px] bg-muted p-2 rounded overflow-auto max-h-32 font-mono">{testResult}</pre>
        </div>
      )}

      {/* Save in Variable Mapping */}
      <Collapsible open={isSaveExpanded} onOpenChange={setIsSaveExpanded} className="border rounded-lg p-2 bg-muted/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Label className="text-xs font-semibold">Mapear Resposta</Label>
            {!lastJsonResponse && <AlertCircle className="h-3 w-3 text-amber-500" />}
          </div>
          <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="h-6 w-6 p-0">{isSaveExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}</Button></CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-2 pt-2">
          <Button variant="outline" size="sm" className="h-6 text-[10px] w-full" onClick={() => { setResponseMappings([...responseMappings, { jsonPath: "", variableName: "" }]); setIsSaveExpanded(true); }}>
            <Plus className="h-3 w-3 mr-1" /> Novo Mapeamento
          </Button>
          {responseMappings.map((m, idx) => (
            <div key={idx} className="p-2 border rounded bg-card space-y-2 relative">
              <Button variant="ghost" size="icon" className="h-5 w-5 absolute top-1 right-1" onClick={() => { const nl = responseMappings.filter((_, i) => i !== idx); setResponseMappings(nl); updateConfig({ responseMappings: nl }); }}><Trash2 className="h-3 w-3 text-destructive" /></Button>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px]">Caminho (ex: data.id)</Label>
                  <Input value={m.jsonPath} list={`paths-${idx}`} className="h-7 text-[10px]" onChange={(e) => handleResponseMappingChange(idx, "jsonPath", e.target.value)} />
                  <datalist id={`paths-${idx}`}>{jsonPaths.map(p => <option key={p} value={p} />)}</datalist>
                </div>
                <div>
                  <Label className="text-[10px]">Salvar na Variável</Label>
                  <div className="flex gap-1">
                    <Input value={m.variableName} list={`vars-${idx}`} className="h-7 text-[10px] flex-1" onChange={(e) => handleResponseMappingChange(idx, "variableName", e.target.value)} />
                    <datalist id={`vars-${idx}`}>{availableVariables.map(v => <option key={v} value={v} />)}</datalist>
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => setVariableModalOpen({ open: true, index: idx })}><Braces className="h-3 w-3" /></Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <VariableModal open={variableModalOpen.open} onClose={() => setVariableModalOpen({ ...variableModalOpen, open: false })} onSelect={(v) => handleResponseMappingChange(variableModalOpen.index, "variableName", v)} />
      <SkillConfig config={config} setConfig={setConfig} />
      </>)}
    </div>
  );
};
