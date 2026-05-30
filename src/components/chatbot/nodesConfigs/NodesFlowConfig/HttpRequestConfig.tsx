import { useState, useEffect, useMemo } from "react";
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
import { Plus, Trash2, Play, Loader2, ChevronDown, ChevronRight, Braces } from "lucide-react";
import { toast } from "sonner";
import { useVariables } from "@/context/VariablesContext";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { VariableModal } from "../../VariableModal";
import { cn } from "@/lib/utils";
import { SkillConfig } from "../SkillConfig";

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
  const { getAllVariableNames, addVariable } = useVariables();
  
  // Sincronização de estados locais
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
  const [followRedirects, setFollowRedirects] = useState(config.followRedirects ?? true);
  const [ignoreSSL, setIgnoreSSL] = useState(config.ignoreSSL ?? false);
  const [responseVariable, setResponseVariable] = useState(config.responseVariable || "httpResponse");
  const [responseFormat, setResponseFormat] = useState(config.responseFormat || "json");
  const [responseMappings, setResponseMappings] = useState<ResponseMapping[]>(config.responseMappings || []);

  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [lastJsonResponse, setLastJsonResponse] = useState<any>(null);
  const [isSaveExpanded, setIsSaveExpanded] = useState(false);
  const [variableModalOpen, setVariableModalOpen] = useState<{ open: boolean; index: number }>({ open: false, index: -1 });

  // Sincroniza estados locais se a config do pai mudar (ex: ao abrir o modal)
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
    setFollowRedirects(config.followRedirects ?? true);
    setIgnoreSSL(config.ignoreSSL ?? false);
    setResponseVariable(config.responseVariable || "httpResponse");
    setResponseFormat(config.responseFormat || "json");
    setResponseMappings(config.responseMappings || []);
  }, [config]);

  // Helper para atualizar config e estado local
  const updateConfig = (updates: Partial<typeof config>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
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
    return paths;
  }, [lastJsonResponse]);

  const handleAddKeyValue = (
    list: KeyValuePair[],
    setList: (val: KeyValuePair[]) => void,
    field: "queryParams" | "headers" | "bodyParams"
  ) => {
    const newList = [...list, { name: "", value: "" }];
    setList(newList);
    updateConfig({ [field]: newList });
  };

  const handleRemoveKeyValue = (
    index: number,
    list: KeyValuePair[],
    setList: (val: KeyValuePair[]) => void,
    field: "queryParams" | "headers" | "bodyParams"
  ) => {
    const newList = list.filter((_, i) => i !== index);
    setList(newList);
    updateConfig({ [field]: newList });
  };

  const handleKeyValueChange = (
    index: number,
    field: keyof KeyValuePair,
    value: string,
    list: KeyValuePair[],
    setList: (val: KeyValuePair[]) => void,
    configField: "queryParams" | "headers" | "bodyParams"
  ) => {
    const updated = [...list];
    updated[index] = { ...updated[index], [field]: value };
    setList(updated);
    updateConfig({ [configField]: updated });
  };

  const handleAddResponseMapping = () => {
    const newList = [...responseMappings, { jsonPath: "", variableName: "" }];
    setResponseMappings(newList);
    updateConfig({ responseMappings: newList });
  };

  const handleRemoveResponseMapping = (index: number) => {
    const newList = responseMappings.filter((_, i) => i !== index);
    setResponseMappings(newList);
    updateConfig({ responseMappings: newList });
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

    try {
      let fullUrl = url;
      if (queryParams.length > 0) {
        const params = new URLSearchParams();
        queryParams.forEach((p) => { if (p.name) params.append(p.name, p.value); });
        const qs = params.toString();
        if (qs) fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
      }

      const reqHeaders: Record<string, string> = {};
      headers.forEach((h) => { if (h.name) reqHeaders[h.name] = h.value; });

      if (authType === "bearer" && authCredentials.token) {
        reqHeaders["Authorization"] = `Bearer ${authCredentials.token}`;
      } else if (authType === "basic" && authCredentials.username) {
        const encoded = btoa(`${authCredentials.username}:${authCredentials.password || ""}`);
        reqHeaders["Authorization"] = `Basic ${encoded}`;
      } else if (authType === "header" && authCredentials.headerName) {
        reqHeaders[authCredentials.headerName] = authCredentials.headerValue || "";
      } else if (authType === "apiKey" && authCredentials.apiKeyName) {
        if (authCredentials.apiKeyLocation === "header") {
          reqHeaders[authCredentials.apiKeyName] = authCredentials.apiKeyValue || "";
        }
      }

      let body: string | undefined;
      if (sendBody && method !== "GET" && method !== "HEAD") {
        if (bodyContentType === "json") {
          reqHeaders["Content-Type"] = "application/json";
          body = bodyJson;
        } else if (bodyContentType === "form-urlencoded") {
          reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          const params = new URLSearchParams();
          bodyParams.forEach((p) => { if (p.name) params.append(p.name, p.value); });
          body = params.toString();
        } else if (bodyContentType === "raw") {
          body = bodyRaw;
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

  return (
    <div className="space-y-4 p-4">
      <div className="flex gap-2">
        <div className="w-32">
          <Select value={method} onValueChange={(val) => {
            setMethod(val);
            updateConfig({ method: val });
          }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Input
          className="flex-1"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            updateConfig({ url: e.target.value });
          }}
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
          <TabsTrigger value="options">Opções</TabsTrigger>
        </TabsList>

        <TabsContent value="params" className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Query Parameters</Label>
            <Button variant="outline" size="sm" onClick={() => handleAddKeyValue(queryParams, setQueryParams, "queryParams")}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {queryParams.map((param, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={param.name} placeholder="Nome" className="flex-1" onChange={(e) => handleKeyValueChange(index, "name", e.target.value, queryParams, setQueryParams, "queryParams")} />
                <Input value={param.value} placeholder="Valor (suporta {{var}})" className="flex-1" onChange={(e) => handleKeyValueChange(index, "value", e.target.value, queryParams, setQueryParams, "queryParams")} />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveKeyValue(index, queryParams, setQueryParams, "queryParams")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="auth" className="space-y-3">
          <div className="space-y-2">
            <Label>Tipo de Autenticação</Label>
            <Select value={authType} onValueChange={(val) => { setAuthType(val); updateConfig({ authType: val }); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="basic">Basic Auth</SelectItem>
                <SelectItem value="bearer">Bearer Token</SelectItem>
                <SelectItem value="header">Header Auth</SelectItem>
                <SelectItem value="apiKey">API Key</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {authType === "basic" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Input value={authCredentials.username || ""} onChange={(e) => {
                  const newAuth = { ...authCredentials, username: e.target.value };
                  setAuthCredentials(newAuth); updateConfig({ authCredentials: newAuth });
                }} />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input type="password" value={authCredentials.password || ""} onChange={(e) => {
                  const newAuth = { ...authCredentials, password: e.target.value };
                  setAuthCredentials(newAuth); updateConfig({ authCredentials: newAuth });
                }} />
              </div>
            </div>
          )}
          {authType === "bearer" && (
            <div className="space-y-2">
              <Label>Token</Label>
              <Input type="password" value={authCredentials.token || ""} onChange={(e) => {
                const newAuth = { ...authCredentials, token: e.target.value };
                setAuthCredentials(newAuth); updateConfig({ authCredentials: newAuth });
              }} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="headers" className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Headers</Label>
            <Button variant="outline" size="sm" onClick={() => handleAddKeyValue(headers, setHeaders, "headers")}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {headers.map((header, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input value={header.name} placeholder="Nome" className="flex-1" onChange={(e) => handleKeyValueChange(index, "name", e.target.value, headers, setHeaders, "headers")} />
                <Input value={header.value} placeholder="Valor" className="flex-1" onChange={(e) => handleKeyValueChange(index, "value", e.target.value, headers, setHeaders, "headers")} />
                <Button variant="ghost" size="icon" onClick={() => handleRemoveKeyValue(index, headers, setHeaders, "headers")}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="body" className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch id="sendBody" checked={sendBody} onCheckedChange={(val) => { setSendBody(val); updateConfig({ sendBody: val }); }} />
            <Label htmlFor="sendBody">Enviar Body</Label>
          </div>
          {sendBody && (
            <>
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select value={bodyContentType} onValueChange={(val) => { setBodyContentType(val); updateConfig({ bodyContentType: val }); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="form-urlencoded">Form URL-encoded</SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {bodyContentType === "json" && (
                <Textarea value={bodyJson} rows={5} className="font-mono text-sm" onChange={(e) => { setBodyJson(e.target.value); updateConfig({ bodyJson: e.target.value }); }} />
              )}
              {bodyContentType === "raw" && (
                <Textarea value={bodyRaw} rows={5} className="font-mono text-sm" onChange={(e) => { setBodyRaw(e.target.value); updateConfig({ bodyRaw: e.target.value }); }} />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="options" className="space-y-4">
          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input type="number" value={timeout} onChange={(e) => { const v = Number(e.target.value); setTimeout_(v); updateConfig({ timeout: v }); }} />
          </div>
        </TabsContent>
      </Tabs>

      {testResult && (
        <div className="space-y-2 mt-4">
          <Label>Resultado do Teste</Label>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">{testResult}</pre>
        </div>
      )}

      <Collapsible open={isSaveExpanded} onOpenChange={setIsSaveExpanded} className="space-y-2 border rounded-lg p-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold">Save in variable</Label>
          <CollapsibleTrigger asChild><Button variant="ghost" size="sm">{isSaveExpanded ? <ChevronDown /> : <ChevronRight />}</Button></CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-4 pt-2">
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddResponseMapping}><Plus className="h-3 w-3 mr-1" /> Add entry</Button>
          {responseMappings.map((mapping, index) => (
            <div key={index} className="space-y-4 p-4 border rounded-md bg-muted/30 relative">
              <Button variant="ghost" size="icon" className="h-6 w-6 absolute top-1 right-1" onClick={() => handleRemoveResponseMapping(index)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              <div className="space-y-2">
                <Label>data:</Label>
                <Input value={mapping.jsonPath} list={`jsonPaths-${index}`} onChange={(e) => handleResponseMappingChange(index, "jsonPath", e.target.value)} />
                <datalist id={`jsonPaths-${index}`}>{jsonPaths.map(p => <option key={p} value={p} />)}</datalist>
              </div>
              <div className="space-y-2">
                <Label>set variable:</Label>
                <div className="flex gap-2">
                  <Input className="flex-1" value={mapping.variableName} list={`variables-${index}`} onChange={(e) => handleResponseMappingChange(index, "variableName", e.target.value)} />
                  <datalist id={`variables-${index}`}>{availableVariables.map(v => <option key={v} value={v} />)}</datalist>
                  <Button variant="ghost" size="icon" className="h-10 w-10 border" onClick={() => setVariableModalOpen({ open: true, index })}><Braces className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>

      <VariableModal open={variableModalOpen.open} onClose={() => setVariableModalOpen({ ...variableModalOpen, open: false })} onSelect={(v) => handleResponseMappingChange(variableModalOpen.index, "variableName", v)} />
      <SkillConfig config={config} setConfig={setConfig} />
    </div>
  );
};
