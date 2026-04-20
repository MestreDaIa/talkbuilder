import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface WebhookConfigProps {
  config: {
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
  };
  setConfig: (config: WebhookConfigProps["config"]) => void;
}

export const WebhookConfig = ({ config, setConfig }: WebhookConfigProps) => {
  const [method, setMethod] = useState(config.method || "POST");
  const [path, setPath] = useState(config.path || "");
  const [authentication, setAuthentication] = useState(
    config.authentication || "none"
  );
  const [authCredentials, setAuthCredentials] = useState(
    config.authCredentials || {}
  );
  const [respondMode, setRespondMode] = useState(
    config.respondMode || "immediately"
  );
  const [responseCode, setResponseCode] = useState(config.responseCode || 200);
  const [responseData, setResponseData] = useState(
    config.responseData || "all"
  );
  const [responseVariable, setResponseVariable] = useState(
    config.responseVariable || "webhookData"
  );
  const [allowedOrigins, setAllowedOrigins] = useState(
    config.allowedOrigins || "*"
  );
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setConfig({
      method,
      path,
      authentication,
      authCredentials,
      respondMode,
      responseCode,
      responseData,
      responseVariable,
      allowedOrigins,
    });
  }, [
    method,
    path,
    authentication,
    authCredentials,
    respondMode,
    responseCode,
    responseData,
    responseVariable,
    allowedOrigins,
  ]);

  const baseUrl = import.meta.env.VITE_CHATBOT_RUNTIME_URL || 
    `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
  const webhookUrl = `${baseUrl}/chatbot-webhook/${path || "meu-webhook"}`;

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success("URL copiada!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Webhook URL Preview */}
      <div className="space-y-2">
        <Label>URL do Webhook</Label>
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-muted p-2 rounded overflow-x-auto">
            {webhookUrl}
          </code>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleCopyUrl}
          >
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Method */}
        <div className="space-y-2">
          <Label>Método HTTP</Label>
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
            </SelectContent>
          </Select>
        </div>

        {/* Path */}
        <div className="space-y-2">
          <Label>Caminho</Label>
          <Input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="meu-webhook"
          />
        </div>
      </div>

      {/* Authentication */}
      <div className="space-y-2">
        <Label>Autenticação</Label>
        <Select value={authentication} onValueChange={setAuthentication}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="header">Header Auth</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Basic Auth Credentials */}
      {authentication === "basic" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Input
              value={authCredentials.username || ""}
              onChange={(e) =>
                setAuthCredentials({ ...authCredentials, username: e.target.value })
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
                setAuthCredentials({ ...authCredentials, password: e.target.value })
              }
              placeholder="••••••••"
            />
          </div>
        </div>
      )}

      {/* Header Auth Credentials */}
      {authentication === "header" && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Nome do Header</Label>
            <Input
              value={authCredentials.headerName || ""}
              onChange={(e) =>
                setAuthCredentials({ ...authCredentials, headerName: e.target.value })
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
                setAuthCredentials({ ...authCredentials, headerValue: e.target.value })
              }
              placeholder="••••••••"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Response Mode */}
        <div className="space-y-2">
          <Label>Modo de Resposta</Label>
          <Select value={respondMode} onValueChange={setRespondMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="immediately">Imediatamente</SelectItem>
              <SelectItem value="lastNode">Ao Finalizar Fluxo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Response Code */}
        <div className="space-y-2">
          <Label>Código de Resposta</Label>
          <Select
            value={String(responseCode)}
            onValueChange={(v) => setResponseCode(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="200">200 OK</SelectItem>
              <SelectItem value="201">201 Created</SelectItem>
              <SelectItem value="204">204 No Content</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Response Variable */}
      <div className="space-y-2">
        <Label>Salvar dados em variável</Label>
        <Input
          value={responseVariable}
          onChange={(e) => setResponseVariable(e.target.value)}
          placeholder="webhookData"
        />
        <p className="text-xs text-muted-foreground">
          Os dados recebidos pelo webhook serão salvos nesta variável.
        </p>
      </div>

      {/* Allowed Origins (CORS) */}
      <div className="space-y-2">
        <Label>Origens Permitidas (CORS)</Label>
        <Input
          value={allowedOrigins}
          onChange={(e) => setAllowedOrigins(e.target.value)}
          placeholder="* ou https://meusite.com"
        />
      </div>

      <div className="bg-muted/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Dica:</strong> O Webhook permite que sistemas externos
          disparem este fluxo via requisição HTTP. Use para integrações com
          outros sistemas.
        </p>
      </div>
    </div>
  );
};
