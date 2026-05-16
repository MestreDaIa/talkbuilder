import { useState, useMemo } from "react";
import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useVariables } from "@/context/VariablesContext";
import { Plus, HelpCircle, Search } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SetVariableConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

type ValueType = "custom" | "empty" | "now" | "today" | "yesterday" | "tomorrow" | "random";

export const SetVariableConfig = ({ config, setConfig }: SetVariableConfigProps) => {
  const { getAllVariableNames, addVariable } = useVariables();
  const [searchValue, setSearchValue] = useState("");
  
  const variableNames = getAllVariableNames();
  
  const selectedVariable = config.variableName || "";
  const valueType: ValueType = config.valueType || "custom";
  const customValue = config.value || "";
  const saveInResults = config.saveInResults || false;
  const executeOnClient = config.executeOnClient || false;

  const filteredVariables = useMemo(() => {
    if (!searchValue) return variableNames;
    return variableNames.filter(name => 
      name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [variableNames, searchValue]);

  const trimmedSearch = searchValue.trim();
  const canCreateNew = trimmedSearch && !variableNames.includes(trimmedSearch);

  const handleSelectVariable = (varName: string) => {
    setConfig({ ...config, variableName: varName });
    setSearchValue("");
  };

  const handleCreateVariable = () => {
    if (trimmedSearch) {
      addVariable(trimmedSearch, "");
      handleSelectVariable(trimmedSearch);
    }
  };

  const handleValueTypeChange = (type: ValueType) => {
    let newValue = "";
    
    switch (type) {
      case "empty":
        newValue = "";
        break;
      case "now":
        newValue = "new Date().toISOString()";
        break;
      case "today":
        newValue = "new Date().toLocaleDateString('pt-BR')";
        break;
      case "yesterday":
        newValue = "(() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.toLocaleDateString('pt-BR'); })()";
        break;
      case "tomorrow":
        newValue = "(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.toLocaleDateString('pt-BR'); })()";
        break;
      case "random":
        newValue = "Math.random().toString(36).substring(2, 8)";
        break;
      case "custom":
        newValue = config.value || "";
        break;
    }
    
    setConfig({ ...config, valueType: type, value: newValue });
  };

  return (
    <div className="p-4 space-y-5">
      {/* Variable Search/Create */}
      <div className="space-y-2">
        <Label>Pesquisar ou criar variável:</Label>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchValue || selectedVariable}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setConfig({ ...config, variableName: e.target.value });
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
                  onClick={() => handleSelectVariable(varName)}
                >
                  {varName}
                </button>
              ))}
              {canCreateNew && (
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground text-primary font-medium border-t mt-1 pt-2"
                  onClick={handleCreateVariable}
                >
                  <Plus className="h-4 w-4" />
                  Criar "{trimmedSearch}"
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Value Type Dropdown */}
      <div className="space-y-2">
        <Label>Value:</Label>
        <Select value={valueType} onValueChange={(v) => handleValueTypeChange(v as ValueType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="custom">Custom</SelectItem>
            <SelectItem value="empty">Vazio</SelectItem>
            <SelectItem value="now">Agora (data/hora)</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="tomorrow">Amanhã</SelectItem>
            <SelectItem value="random">ID Aleatório</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Save in Results Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="saveInResults">Save in results?</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Se ativado, o valor da variável será salvo nos resultados do chatbot para análise posterior.</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="saveInResults"
          checked={saveInResults}
          onCheckedChange={(checked) => setConfig({ ...config, saveInResults: checked })}
        />
      </div>

      {/* Execute on Client Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor="executeOnClient">Execute on client?</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p>Ative quando precisar acessar informações do navegador (window, document, navigator, etc).</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Switch
          id="executeOnClient"
          checked={executeOnClient}
          onCheckedChange={(checked) => setConfig({ ...config, executeOnClient: checked })}
        />
      </div>

      {/* Code Editor (when Custom) */}
      {valueType === "custom" && (
        <div className="space-y-2">
          <Textarea
            placeholder="// Código JavaScript ou valor simples..."
            value={customValue}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
            className="min-h-[180px] font-mono text-sm bg-slate-900 text-slate-100 border-slate-700"
          />
          <p className="text-xs text-muted-foreground">
            Use {"{{variavel}}"} para referenciar outras variáveis. Suporta código JavaScript.
          </p>
        </div>
      )}

      {/* Preview for non-custom types */}
      {valueType !== "custom" && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Preview do valor:</p>
          <code className="text-sm font-mono text-primary">
            {valueType === "empty" && "(vazio)"}
            {valueType === "now" && "2025-01-11T10:30:00.000Z"}
            {valueType === "today" && "11/01/2025"}
            {valueType === "yesterday" && "10/01/2025"}
            {valueType === "tomorrow" && "12/01/2025"}
            {valueType === "random" && "a7b3c9"}
          </code>
        </div>
      )}
    </div>
  );
};