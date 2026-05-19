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
import { useVariables } from "@/context/VariablesContext";
import { Search, Plus } from "lucide-react";
import { useState, useMemo } from "react";

interface AIConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

const AI_PROVIDERS = [
  { id: "openai", name: "OpenAI" },
  { id: "groq", name: "Groq" },
  { id: "gemini", name: "Google Gemini" },
  { id: "anthropic", name: "Anthropic Claude" },
  { id: "openrouter", name: "OpenRouter" },
  { id: "deepseek", name: "DeepSeek" },
  { id: "ollama", name: "Ollama" },
  { id: "mistral", name: "Mistral" },
];

export const AIConfig = ({ config, setConfig }: AIConfigProps) => {
  const { getAllVariableNames, addVariable } = useVariables();
  const [searchValue, setSearchValue] = useState("");
  const variableNames = getAllVariableNames();

  const provider = config.provider || "openai";
  const model = config.model || "";
  const systemPrompt = config.systemPrompt || "";
  const userMessage = config.userMessage || "{{last_message}}";
  const temperature = config.temperature ?? 0.7;
  const saveVariable = config.saveVariable || "";

  const filteredVariables = useMemo(() => {
    if (!searchValue) return variableNames;
    return variableNames.filter(name => 
      name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [variableNames, searchValue]);

  const trimmedSearch = searchValue.trim();
  const canCreateNew = trimmedSearch && !variableNames.includes(trimmedSearch);

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provedor de IA</Label>
          <Select 
            value={provider} 
            onValueChange={(v) => setConfig({ ...config, provider: v })}
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
          <Input 
            placeholder="Ex: gpt-4o, llama3-70b..."
            value={model}
            onChange={(e) => setConfig({ ...config, model: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>System Prompt (Instruções do Bot)</Label>
        <Textarea 
          placeholder="Você é um assistente prestativo..."
          value={systemPrompt}
          onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Mensagem do Usuário / Prompt</Label>
        <Textarea 
          placeholder="Use {{last_message}} para a última resposta"
          value={userMessage}
          onChange={(e) => setConfig({ ...config, userMessage: e.target.value })}
        />
      </div>

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
    </div>
  );
};
