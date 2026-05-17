import { useState, useMemo, useEffect } from "react";
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
import { Plus, HelpCircle, Search, Braces } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { VariableModal } from "../../VariableModal";

interface SetVariableConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

type ValueType = "custom" | "expression" | "empty" | "now" | "today" | "yesterday" | "tomorrow" | "random";

export const SetVariableConfig = ({ config, setConfig }: SetVariableConfigProps) => {
  const { getAllVariableNames, addVariable } = useVariables();
  const [searchValue, setSearchValue] = useState("");
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [previewValue, setPreviewValue] = useState<string>("");
  
  const variableNames = getAllVariableNames();
  
  const selectedVariable = config.variableName || "";
  const valueType: ValueType = config.valueType || "expression";
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

  const handleVariableSelect = (variableName: string) => {
    const textarea = document.getElementById('expression-textarea') as HTMLTextAreaElement;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = config.value || "";
    const variableRef = `{{${variableName}}}`;
    const newVal = currentVal.substring(0, start) + variableRef + currentVal.substring(end);
    
    setConfig({ ...config, value: newVal });
    
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variableRef.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  useEffect(() => {
    if (valueType === "custom") return;

    if (valueType === "expression") {
      try {
        if (!customValue) {
          setPreviewValue("(vazio)");
          return;
        }

        const runScript = (code: string) => {
          try {
            // Remove as chaves {{ }} se o usuário colocou apenas uma variável
            const cleanCode = code.replace(/\{\{|\}\}/g, '');
            
            // Se o código parece ser um bloco com múltiplos statements (tem ; ou várias linhas)
            if (code.includes(';') || code.includes('\n')) {
              const func = new Function(`
                try {
                  ${code.includes('return') ? code : `return ${code};`}
                } catch (e) {
                  return "Erro na execução";
                }
              `);
              return func();
            }

            // Se for uma expressão simples ou valor único
            const func = new Function(`
              try {
                return ${cleanCode};
              } catch (e) {
                return \`${code}\`;
              }
            `);
            return func();
          } catch (e) {
            return code;
          }
        };

        const result = runScript(customValue);
        setPreviewValue(String(result));
      } catch (e) {
        setPreviewValue(customValue);
      }
    } else {
      switch (valueType) {
        case "empty": setPreviewValue("(vazio)"); break;
        case "now": setPreviewValue(new Date().toISOString()); break;
        case "today": setPreviewValue(new Date().toLocaleDateString('pt-BR')); break;
        case "yesterday": {
          const d = new Date();
          d.setDate(d.getDate() - 1);
          setPreviewValue(d.toLocaleDateString('pt-BR'));
          break;
        }
        case "tomorrow": {
          const d = new Date();
          d.setDate(d.getDate() + 1);
          setPreviewValue(d.toLocaleDateString('pt-BR'));
          break;
        }
        case "random": setPreviewValue(Math.random().toString(36).substring(2, 8)); break;
      }
    }
  }, [valueType, customValue]);

  return (
    <div className="p-4 space-y-5">
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

      <div className="space-y-2">
        <Label>Atribuir valor:</Label>
        <Select value={valueType} onValueChange={(v) => handleValueTypeChange(v as ValueType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="expression">Expressão / Valor</SelectItem>
            <SelectItem value="custom">Código JavaScript (Avançado)</SelectItem>
            <SelectItem value="empty">Vazio</SelectItem>
            <SelectItem value="now">Agora (data/hora)</SelectItem>
            <SelectItem value="today">Hoje</SelectItem>
            <SelectItem value="yesterday">Ontem</SelectItem>
            <SelectItem value="tomorrow">Amanhã</SelectItem>
            <SelectItem value="random">ID Aleatório</SelectItem>
          </SelectContent>
        </Select>
      </div>

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

      {valueType === "expression" && (
        <div className="space-y-2">
          <div className="relative">
            <Textarea
              id="expression-textarea"
              placeholder="Ex: {{n1}} + 5 ou apenas um texto..."
              value={customValue}
              onChange={(e) => setConfig({ ...config, value: e.target.value })}
              className="min-h-[100px] text-sm pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setVariableModalOpen(true)}
              title="Inserir variável"
            >
              <Braces className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Digite <strong>{"{{valor}} + 10"}</strong> para somar, ou apenas o valor que deseja salvar.
          </p>
        </div>
      )}

      {valueType === "custom" && (
        <div className="space-y-2">
          <Label className="text-xs font-bold text-orange-500 uppercase">Modo Desenvolvedor</Label>
          <Textarea
            placeholder="// Ex: return variables.n1 + 5;"
            value={customValue}
            onChange={(e) => setConfig({ ...config, value: e.target.value })}
            className="min-h-[180px] font-mono text-sm bg-slate-900 text-slate-100 border-slate-700"
          />
          <p className="text-xs text-muted-foreground">
            Use <code className="bg-muted px-1">return</code> para definir o valor final.
          </p>
        </div>
      )}

      {valueType !== "custom" && (
        <div className="p-3 bg-muted rounded-lg">
          <p className="text-xs text-muted-foreground mb-1">Preview do valor:</p>
          <code className="text-sm font-mono text-primary break-all">
            {previewValue}
          </code>
        </div>
      )}

      <VariableModal
        open={variableModalOpen}
        onClose={() => setVariableModalOpen(false)}
        onSelect={handleVariableSelect}
      />
    </div>
  );
};