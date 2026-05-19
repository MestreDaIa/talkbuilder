import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { useVariables } from "@/context/VariablesContext";
import { Search, Plus, Brackets } from "lucide-react";
import { useState, useMemo } from "react";
import { VariableModal } from "../../VariableModal";

interface AIConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI", needsApiKey: true },
  { id: "groq", name: "Groq", needsApiKey: true },
  { id: "gemini", name: "Google Gemini", needsApiKey: true },
  { id: "anthropic", name: "Anthropic Claude", needsApiKey: true },
  { id: "openrouter", name: "OpenRouter", needsApiKey: true },
  { id: "deepseek", name: "DeepSeek", needsApiKey: true },
  { id: "ollama", name: "Ollama", needsApiKey: false },
  { id: "mistral", name: "Mistral", needsApiKey: true },
];

const MODELS_BY_PROVIDER: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"],
  groq: ["llama3-70b-8192", "llama3-8b-8192", "mixtral-8x7b-32768", "gemma-7b-it"],
  gemini: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  anthropic: ["claude-3-5-sonnet-20240620", "claude-3-opus-20240229", "claude-3-sonnet-20240229", "claude-3-haiku-20240307"],
  openrouter: ["auto"],
  deepseek: ["deepseek-chat", "deepseek-coder"],
  ollama: ["llama3", "mistral", "phi3", "nomic-embed-text"],
  mistral: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
};

export const AIConfig = ({ config, setConfig }: AIConfigProps) => {
  const { getAllVariableNames, addVariable } = useVariables();
  const [searchValue, setSearchValue] = useState("");
  const [isVariableModalOpen, setIsVariableModalOpen] = useState(false);
  const [activeTextarea, setActiveTextarea] = useState<"userMessage" | "systemPrompt" | null>(null);
  
  const variableNames = getAllVariableNames();

  const provider = config.provider || "openai";
  const model = config.model || MODELS_BY_PROVIDER[provider]?.[0] || "";
  const apiKey = config.apiKey || "";
  const systemPrompt = config.systemPrompt || "";
  const userMessage = config.userMessage || "{{last_message}}";
  const temperature = config.temperature ?? 0.7;
  const maxTokens = config.maxTokens ?? 1000;
  const topP = config.topP ?? 1;
  const streaming = config.streaming ?? false;
  const saveVariable = config.saveVariable || "";

  const selectedProvider = AI_PROVIDERS.find(p => p.id === provider);

  const filteredVariables = useMemo(() => {
    if (!searchValue) return variableNames;
    return variableNames.filter(name => 
      name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [variableNames, searchValue]);

  const trimmedSearch = searchValue.trim();
  const canCreateNew = trimmedSearch && !variableNames.includes(trimmedSearch);

  const handleVariableSelect = (varName: string) => {
    if (activeTextarea === "userMessage") {
      setConfig({ ...config, userMessage: userMessage + `{{${varName}}}` });
    } else if (activeTextarea === "systemPrompt") {
      setConfig({ ...config, systemPrompt: systemPrompt + `{{${varName}}}` });
    }
  };

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provedor de IA</Label>
          <Select 
            value={provider} 
            onValueChange={(v) => {
              const defaultModel = MODELS_BY_PROVIDER[v]?.[0] || "";
              setConfig({ ...config, provider: v, model: defaultModel });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Select
            value={model}
            onValueChange={(v) => setConfig({ ...config, model: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              {MODELS_BY_PROVIDER[provider]?.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
              <SelectItem value="custom">Outro (especificar...)</SelectItem>
            </SelectContent>
          </Select>
          {model === "custom" && (
            <Input 
              className="mt-2"
              placeholder="Nome do modelo..."
              onChange={(e) => setConfig({ ...config, customModel: e.target.value })}
            />
          )}
        </div>
      </div>

      {selectedProvider?.needsApiKey && (
        <div className="space-y-2">
          <Label>Chave de API (API Key)</Label>
          <Input 
            type="password"
            placeholder="sk-..."
            value={apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-2 relative">
        <Label>System Prompt (Contexto do Agente)</Label>
        <div className="relative">
          <Textarea 
            placeholder="Você é um assistente prestativo..."
            value={systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            className="min-h-[100px] pr-10"
          />
          <button
            type="button"
            className="absolute bottom-2 right-2 p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
            onClick={() => {
              setActiveTextarea("systemPrompt");
              setIsVariableModalOpen(true);
            }}
          >
            <Brackets className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="space-y-2 relative">
        <Label>Mensagem do Usuário / Prompt</Label>
        <div className="relative">
          <Textarea 
            placeholder="Use {{last_message}} para a última resposta"
            value={userMessage}
            onChange={(e) => setConfig({ ...config, userMessage: e.target.value })}
            className="min-h-[100px] pr-10"
          />
          <button
            type="button"
            className="absolute bottom-2 right-2 p-1.5 rounded-md hover:bg-accent text-muted-foreground transition-colors"
            onClick={() => {
              setActiveTextarea("userMessage");
              setIsVariableModalOpen(true);
            }}
          >
            <Brackets className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="space-y-4">
          <div className="flex justify-between">
            <Label>Temperatura ({temperature})</Label>
          </div>
          <Slider 
            value={[temperature]} 
            min={0} 
            max={2} 
            step={0.1}
            onValueChange={([v]) => setConfig({ ...config, temperature: v })}
          />
        </div>
        <div className="space-y-4">
          <div className="flex justify-between">
            <Label>Top P ({topP})</Label>
          </div>
          <Slider 
            value={[topP]} 
            min={0} 
            max={1} 
            step={0.01}
            onValueChange={([v]) => setConfig({ ...config, topP: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Max Tokens</Label>
          <Input 
            type="number"
            value={maxTokens}
            onChange={(e) => setConfig({ ...config, maxTokens: parseInt(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center justify-between pt-8">
          <Label htmlFor="streaming-mode">Streaming</Label>
          <Switch 
            id="streaming-mode"
            checked={streaming}
            onCheckedChange={(v) => setConfig({ ...config, streaming: v })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Salvar resposta na variável:</Label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchValue || saveVariable}
            onChange={(e) => {
              setSearchValue(e.target.value);
              setConfig({ ...config, saveVariable: e.target.value });
            }}
            placeholder="Pesquise ou crie uma variável"
            className="h-9 pl-9 text-sm"
          />
        </div>

        {(filteredVariables.length > 0 || canCreateNew) && (
          <div className="max-h-36 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
            {filteredVariables.map((varName) => (
              <button
                key={varName}
                type="button"
                className="w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => {
                  setConfig({ ...config, saveVariable: varName });
                  setSearchValue("");
                }}
              >
                {varName}
              </button>
            ))}
            {canCreateNew && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground text-primary font-medium border-t mt-1 pt-2"
                onClick={() => {
                  addVariable(trimmedSearch, "");
                  setConfig({ ...config, saveVariable: trimmedSearch });
                  setSearchValue("");
                }}
              >
                <Plus className="h-4 w-4" />
                Criar "{trimmedSearch}"
              </button>
            )}
          </div>
        )}
      </div>

      <VariableModal 
        open={isVariableModalOpen}
        onClose={() => {
          setIsVariableModalOpen(false);
          setActiveTextarea(null);
        }}
        onSelect={handleVariableSelect}
      />
    </div>
  );
};