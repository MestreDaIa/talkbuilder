import { useState, useEffect, useMemo } from "react";
import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useVariables } from "@/contexts/VariablesContext";
import { Check, ChevronsUpDown, Plus, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [open, setOpen] = useState(false);
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

  const canCreateNew = searchValue && !variableNames.includes(searchValue);

  const handleSelectVariable = (varName: string) => {
    setConfig({ ...config, variableName: varName });
    setOpen(false);
    setSearchValue("");
  };

  const handleCreateVariable = () => {
    if (searchValue) {
      addVariable(searchValue, "");
      handleSelectVariable(searchValue);
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
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="w-full justify-between"
            >
              {selectedVariable || "Selecione uma variável..."}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Pesquisar variável..." 
                value={searchValue}
                onValueChange={setSearchValue}
              />
              <CommandList>
                <CommandEmpty>
                  {canCreateNew ? (
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2"
                      onClick={handleCreateVariable}
                    >
                      <Plus className="h-4 w-4" />
                      Criar "{searchValue}"
                    </Button>
                  ) : (
                    "Nenhuma variável encontrada."
                  )}
                </CommandEmpty>
                <CommandGroup>
                  {filteredVariables.map((varName) => (
                    <CommandItem
                      key={varName}
                      value={varName}
                      onSelect={() => handleSelectVariable(varName)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedVariable === varName ? "opacity-100" : "opacity-0"
                        )}
                      />
                      {varName}
                    </CommandItem>
                  ))}
                </CommandGroup>
                {canCreateNew && filteredVariables.length > 0 && (
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateVariable}>
                      <Plus className="mr-2 h-4 w-4" />
                      Criar "{searchValue}"
                    </CommandItem>
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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
