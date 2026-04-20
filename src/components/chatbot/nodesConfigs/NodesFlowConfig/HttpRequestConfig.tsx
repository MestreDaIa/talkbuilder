import { useState, useEffect } from "react";
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
import { Plus, Trash2, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface KeyValuePair {
  name: string;
  value: string;
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
  };
  setConfig: (config: HttpRequestConfigProps["config"]) => void;
}

export const HttpRequestConfig = ({
  config,
  setConfig,
}: HttpRequestConfigProps) => {
  const [method, setMethod] = useState(config.method || "GET");
  const [url, setUrl] = useState(config.url || "");
  const [authType, setAuthType] = useState(config.authType || "none");
  const [authCredentials, setAuthCredentials] = useState(
    config.authCredentials || {}
  );
  const [queryParams, setQueryParams] = useState<KeyValuePair[]>(
    config.queryParams || []
  );
  const [headers, setHeaders] = useState<KeyValuePair[]>(config.headers || []);
  const [sendBody, setSendBody] = useState(config.sendBody ?? false);
  const [bodyContentType, setBodyContentType] = useState(
    config.bodyContentType || "json"
  );
  const [bodyParams, setBodyParams] = useState<KeyValuePair[]>(
    config.bodyParams || []
  );
  const [bodyJson, setBodyJson] = useState(config.bodyJson || "{}");
  const [bodyRaw, setBodyRaw] = useState(config.bodyRaw || "");
  const [timeout, setTimeout_] = useState(config.timeout || 30000);
  const [followRedirects, setFollowRedirects] = useState(
    config.followRedirects ?? true
  );
  const [ignoreSSL, setIgnoreSSL] = useState(config.ignoreSSL ?? false);
  const [responseVariable, setResponseVariable] = useState(
    config.responseVariable || "httpResponse"
  );
  const [responseFormat, setResponseFormat] = useState(
    config.responseFormat || "json"
  );
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  useEffect(() => {
    setConfig({
      method,
      url,
      authType,
      authCredentials,
      queryParams,
      headers,
      sendBody,
      bodyContentType,
      bodyParams,
      bodyJson,
      bodyRaw,
      timeout,
      followRedirects,
      ignoreSSL,
      responseVariable,
      responseFormat,
    });
  }, [
    method,
    url,
    authType,
    authCredentials,
    queryParams,
    headers,
    sendBody,
    bodyContentType,
    bodyParams,
    bodyJson,
    bodyRaw,
    timeout,
    followRedirects,
    ignoreSSL,
    responseVariable,
    responseFormat,
  ]);

  const handleAddKeyValue = (
    list: KeyValuePair[],
    setList: (val: KeyValuePair[]) => void
  ) => {
    setList([...list, { name: "", value: "" }]);
  };

  const handleRemoveKeyValue = (
    index: number,
    list: KeyValuePair[],
    setList: (val: KeyValuePair[]) => void
  ) => {
    setList(list.filter((_, i) => i !== index));
  };

  const handleKeyValueChange = (
    index: number,
    field: keyof KeyValuePair,
    value: string,
    list: KeyValuePair[],
    setList: (val: KeyValuePair[]) => void
  ) => {
    const updated = [...list];
    updated[index] = { ...updated[index], [field]: value };
    setList(updated);
  };

  const handleTestRequest = async () => {
    if (!url) {
      toast.error("Informe a URL");
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      // Build query string
      let fullUrl = url;
      if (queryParams.length > 0) {
        const params = new URLSearchParams();
        queryParams.forEach((p) => {
          if (p.name) params.append(p.name, p.value);
        });
        const qs = params.toString();
        if (qs) fullUrl += (fullUrl.includes("?") ? "&" : "?") + qs;
      }

      // Build headers
      const reqHeaders: Record<string, string> = {};
      headers.forEach((h) => {
        if (h.name) reqHeaders[h.name] = h.value;
      });

      // Auth headers
      if (authType === "bearer" && authCredentials.token) {
        reqHeaders["Authorization"] = `Bearer ${authCredentials.token}`;
      } else if (authType === "basic" && authCredentials.username) {
        const encoded = btoa(
          `${authCredentials.username}:${authCredentials.password || ""}`
        );
        reqHeaders["Authorization"] = `Basic ${encoded}`;
      } else if (authType === "header" && authCredentials.headerName) {
        reqHeaders[authCredentials.headerName] =
          authCredentials.headerValue || "";
      } else if (authType === "apiKey" && authCredentials.apiKeyName) {
        if (authCredentials.apiKeyLocation === "header") {
          reqHeaders[authCredentials.apiKeyName] =
            authCredentials.apiKeyValue || "";
        }
      }

      // Build body
      let body: string | undefined;
      if (sendBody && method !== "GET" && method !== "HEAD") {
        if (bodyContentType === "json") {
          reqHeaders["Content-Type"] = "application/json";
          body = bodyJson;
        } else if (bodyContentType === "form-urlencoded") {
          reqHeaders["Content-Type"] = "application/x-www-form-urlencoded";
          const params = new URLSearchParams();
          bodyParams.forEach((p) => {
            if (p.name) params.append(p.name, p.value);
          });
          body = params.toString();
        } else if (bodyContentType === "raw") {
          body = bodyRaw;
        }
      }

      const response = await fetch(fullUrl, {
        method,
        headers: reqHeaders,
        body,
      });

      const responseText = await response.text();
      let formatted = responseText;
      try {
        const json = JSON.parse(responseText);
        formatted = JSON.stringify(json, null, 2);
      } catch {
        // Keep as text
      }

      setTestResult(
        `Status: ${response.status} ${response.statusText}\n\n${formatted}`
      );
      toast.success(`Requisição concluída: ${response.status}`);
    } catch (error: any) {
      setTestResult(`Erro: ${error.message}`);
      toast.error(`Erro na requisição: ${error.message}`);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Method & URL */}
      <div className="flex gap-2">
        <div className="w-32">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="PUT">PUT</SelectItem>
              <SelectItem value="PATCH">PATCH</SelectItem>
              <SelectItem value="DELETE">DELETE</SelectItem>
              <SelectItem value="HEAD">HEAD</SelectItem>
              <SelectItem value="OPTIONS">OPTIONS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input
          className="flex-1"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.exemplo.com/endpoint"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleTestRequest}
          disabled={isTesting}
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
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

        {/* Query Parameters */}
        <TabsContent value="params" className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Query Parameters</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddKeyValue(queryParams, setQueryParams)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          {queryParams.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Nenhum parâmetro de query.
            </p>
          ) : (
            <div className="space-y-2">
              {queryParams.map((param, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={param.name}
                    onChange={(e) =>
                      handleKeyValueChange(
                        index,
                        "name",
                        e.target.value,
                        queryParams,
                        setQueryParams
                      )
                    }
                    placeholder="Nome"
                    className="flex-1"
                  />
                  <Input
                    value={param.value}
                    onChange={(e) =>
                      handleKeyValueChange(
                        index,
                        "value",
                        e.target.value,
                        queryParams,
                        setQueryParams
                      )
                    }
                    placeholder="Valor (suporta {{var}})"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleRemoveKeyValue(index, queryParams, setQueryParams)
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Authentication */}
        <TabsContent value="auth" className="space-y-3">
          <div className="space-y-2">
            <Label>Tipo de Autenticação</Label>
            <Select value={authType} onValueChange={setAuthType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
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
                <Input
                  value={authCredentials.username || ""}
                  onChange={(e) =>
                    setAuthCredentials({
                      ...authCredentials,
                      username: e.target.value,
                    })
                  }
                  placeholder="username"
                />
              </div>
              <div className="space-y-2">
                <Label>Senha</Label>
                <Input
                  type="password"
                  value={authCredentials.password || ""}
                  onChange={(e) =>
                    setAuthCredentials({
                      ...authCredentials,
                      password: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {authType === "bearer" && (
            <div className="space-y-2">
              <Label>Token</Label>
              <Input
                type="password"
                value={authCredentials.token || ""}
                onChange={(e) =>
                  setAuthCredentials({
                    ...authCredentials,
                    token: e.target.value,
                  })
                }
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
              />
            </div>
          )}

          {authType === "header" && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome do Header</Label>
                <Input
                  value={authCredentials.headerName || ""}
                  onChange={(e) =>
                    setAuthCredentials({
                      ...authCredentials,
                      headerName: e.target.value,
                    })
                  }
                  placeholder="X-API-Key"
                />
              </div>
              <div className="space-y-2">
                <Label>Valor do Header</Label>
                <Input
                  type="password"
                  value={authCredentials.headerValue || ""}
                  onChange={(e) =>
                    setAuthCredentials({
                      ...authCredentials,
                      headerValue: e.target.value,
                    })
                  }
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          {authType === "apiKey" && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da API Key</Label>
                  <Input
                    value={authCredentials.apiKeyName || ""}
                    onChange={(e) =>
                      setAuthCredentials({
                        ...authCredentials,
                        apiKeyName: e.target.value,
                      })
                    }
                    placeholder="api_key"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor</Label>
                  <Input
                    type="password"
                    value={authCredentials.apiKeyValue || ""}
                    onChange={(e) =>
                      setAuthCredentials({
                        ...authCredentials,
                        apiKeyValue: e.target.value,
                      })
                    }
                    placeholder="••••••••"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <Select
                  value={authCredentials.apiKeyLocation || "header"}
                  onValueChange={(v) =>
                    setAuthCredentials({
                      ...authCredentials,
                      apiKeyLocation: v,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="header">Header</SelectItem>
                    <SelectItem value="query">Query Param</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </TabsContent>

        {/* Headers */}
        <TabsContent value="headers" className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Headers</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleAddKeyValue(headers, setHeaders)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          </div>
          {headers.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum header.</p>
          ) : (
            <div className="space-y-2">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={header.name}
                    onChange={(e) =>
                      handleKeyValueChange(
                        index,
                        "name",
                        e.target.value,
                        headers,
                        setHeaders
                      )
                    }
                    placeholder="Nome"
                    className="flex-1"
                  />
                  <Input
                    value={header.value}
                    onChange={(e) =>
                      handleKeyValueChange(
                        index,
                        "value",
                        e.target.value,
                        headers,
                        setHeaders
                      )
                    }
                    placeholder="Valor (suporta {{var}})"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleRemoveKeyValue(index, headers, setHeaders)
                    }
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Body */}
        <TabsContent value="body" className="space-y-3">
          <div className="flex items-center space-x-2">
            <Switch
              id="sendBody"
              checked={sendBody}
              onCheckedChange={setSendBody}
            />
            <Label htmlFor="sendBody">Enviar Body</Label>
          </div>

          {sendBody && (
            <>
              <div className="space-y-2">
                <Label>Tipo de Conteúdo</Label>
                <Select value={bodyContentType} onValueChange={setBodyContentType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="json">JSON</SelectItem>
                    <SelectItem value="form-urlencoded">
                      Form URL-encoded
                    </SelectItem>
                    <SelectItem value="form-data">Form-Data</SelectItem>
                    <SelectItem value="raw">Raw</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {bodyContentType === "json" && (
                <div className="space-y-2">
                  <Label>JSON Body</Label>
                  <Textarea
                    value={bodyJson}
                    onChange={(e) => setBodyJson(e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={5}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Suporta variáveis: {"{{variavel}}"}
                  </p>
                </div>
              )}

              {(bodyContentType === "form-urlencoded" ||
                bodyContentType === "form-data") && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Campos</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleAddKeyValue(bodyParams, setBodyParams)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar
                    </Button>
                  </div>
                  {bodyParams.map((param, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        value={param.name}
                        onChange={(e) =>
                          handleKeyValueChange(
                            index,
                            "name",
                            e.target.value,
                            bodyParams,
                            setBodyParams
                          )
                        }
                        placeholder="Nome"
                        className="flex-1"
                      />
                      <Input
                        value={param.value}
                        onChange={(e) =>
                          handleKeyValueChange(
                            index,
                            "value",
                            e.target.value,
                            bodyParams,
                            setBodyParams
                          )
                        }
                        placeholder="Valor"
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          handleRemoveKeyValue(index, bodyParams, setBodyParams)
                        }
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {bodyContentType === "raw" && (
                <div className="space-y-2">
                  <Label>Raw Body</Label>
                  <Textarea
                    value={bodyRaw}
                    onChange={(e) => setBodyRaw(e.target.value)}
                    placeholder="Conteúdo raw..."
                    rows={5}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Options */}
        <TabsContent value="options" className="space-y-4">
          <div className="space-y-2">
            <Label>Timeout (ms)</Label>
            <Input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout_(Number(e.target.value))}
              placeholder="30000"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="followRedirects"
              checked={followRedirects}
              onCheckedChange={setFollowRedirects}
            />
            <Label htmlFor="followRedirects">Seguir Redirecionamentos</Label>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="ignoreSSL"
              checked={ignoreSSL}
              onCheckedChange={setIgnoreSSL}
            />
            <Label htmlFor="ignoreSSL">Ignorar Erros SSL</Label>
          </div>

          <div className="space-y-2">
            <Label>Salvar resposta em variável</Label>
            <Input
              value={responseVariable}
              onChange={(e) => setResponseVariable(e.target.value)}
              placeholder="httpResponse"
            />
          </div>

          <div className="space-y-2">
            <Label>Formato da Resposta</Label>
            <Select value={responseFormat} onValueChange={setResponseFormat}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="text">Texto</SelectItem>
                <SelectItem value="binary">Binário</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </TabsContent>
      </Tabs>

      {/* Test Result */}
      {testResult && (
        <div className="space-y-2">
          <Label>Resultado do Teste</Label>
          <pre className="text-xs bg-muted p-3 rounded overflow-x-auto max-h-48 overflow-y-auto">
            {testResult}
          </pre>
        </div>
      )}

      <div className="bg-muted/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Dica:</strong> Use {"{{variavel}}"} para inserir valores
          dinâmicos na URL, headers ou body. A resposta será armazenada na
          variável configurada.
        </p>
      </div>
    </div>
  );
};
