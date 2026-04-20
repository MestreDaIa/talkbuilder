import { useState, useMemo } from "react";
import { NodeConfig, ConditionComparison, ConditionGroup } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
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
import { Check, ChevronsUpDown, Plus, Trash2, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface ConditionConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

const operators = [
  { value: "equals", label: "Equal to" },
  { value: "not_equals", label: "Not equal" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Does not contain" },
  { value: "greater_than", label: "Greater than" },
  { value: "less_than", label: "Less than" },
  { value: "is_set", label: "Is set" },
  { value: "is_empty", label: "Is empty" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: "matches_regex", label: "Matches regex" },
  { value: "not_matches_regex", label: "Not matches regex" },
];

const logicalOperators = [
  { value: "AND", label: "E" },
  { value: "OR", label: "OU" },
];

const ComparisonItem = ({
  comparison,
  onUpdate,
  onDelete,
  showLogicalOperator,
  logicalOperator,
  onLogicalOperatorChange,
}: {
  comparison: ConditionComparison;
  onUpdate: (updates: Partial<ConditionComparison>) => void;
  onDelete: () => void;
  showLogicalOperator: boolean;
  logicalOperator?: "AND" | "OR";
  onLogicalOperatorChange?: (op: "AND" | "OR") => void;
}) => {
  const { getAllVariableNames, addVariable } = useVariables();
  const [varOpen, setVarOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");
  
  const variableNames = getAllVariableNames();
  
  const filteredVariables = useMemo(() => {
    if (!searchValue) return variableNames;
    return variableNames.filter(name => 
      name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [variableNames, searchValue]);

  const canCreateNew = searchValue && !variableNames.includes(searchValue);
  const needsValue = !["is_set", "is_empty"].includes(comparison.operator);

  const handleSelectVariable = (varName: string) => {
    onUpdate({ variableName: varName });
    setVarOpen(false);
    setSearchValue("");
  };

  const handleCreateVariable = () => {
    if (searchValue) {
      addVariable(searchValue, "");
      handleSelectVariable(searchValue);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-card border rounded-lg">
      {showLogicalOperator && logicalOperator && onLogicalOperatorChange && (
        <div className="flex justify-center -mt-6 mb-2">
          <Select value={logicalOperator} onValueChange={(v) => onLogicalOperatorChange(v as "AND" | "OR")}>
            <SelectTrigger className="w-20 h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {logicalOperators.map(op => (
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-3">
          {/* Variable selector */}
          <Popover open={varOpen} onOpenChange={setVarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={varOpen}
                className="w-full justify-between h-9 text-sm"
              >
                {comparison.variableName || "Pesquise uma variável"}
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
                        className="w-full justify-start gap-2 text-sm"
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
                            comparison.variableName === varName ? "opacity-100" : "opacity-0"
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

          {/* Operator selector */}
          <Select 
            value={comparison.operator} 
            onValueChange={(v) => onUpdate({ operator: v as ConditionComparison["operator"] })}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Selecione um operador" />
            </SelectTrigger>
            <SelectContent>
              {operators.map(op => (
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Value input (if needed) */}
          {needsValue && (
            <div className="relative">
              <Input
                value={comparison.value || ""}
                onChange={(e) => onUpdate({ value: e.target.value })}
                placeholder="Type a value..."
                className="h-9 text-sm pr-10"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => {/* TODO: Open variable modal */}}
              >
                <User className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
          )}
        </div>

        {/* Delete button */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-destructive"
          onClick={onDelete}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export const ConditionConfig = ({ config, setConfig }: ConditionConfigProps) => {
  const conditions: ConditionGroup[] = config.conditions || [
    { id: crypto.randomUUID(), comparisons: [], logicalOperator: "AND" }
  ];

  const updateCondition = (conditionId: string, updates: Partial<ConditionGroup>) => {
    const newConditions = conditions.map(c => 
      c.id === conditionId ? { ...c, ...updates } : c
    );
    setConfig({ ...config, conditions: newConditions });
  };

  const addCondition = () => {
    const newCondition: ConditionGroup = {
      id: crypto.randomUUID(),
      comparisons: [],
      logicalOperator: "AND",
    };
    setConfig({ ...config, conditions: [...conditions, newCondition] });
  };

  const deleteCondition = (conditionId: string) => {
    if (conditions.length <= 1) return;
    setConfig({ ...config, conditions: conditions.filter(c => c.id !== conditionId) });
  };

  const addComparison = (conditionId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;
    
    const newComparison: ConditionComparison = {
      id: crypto.randomUUID(),
      variableName: "",
      operator: "equals",
      value: "",
    };
    
    updateCondition(conditionId, {
      comparisons: [...condition.comparisons, newComparison],
    });
  };

  const updateComparison = (conditionId: string, comparisonId: string, updates: Partial<ConditionComparison>) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;
    
    const newComparisons = condition.comparisons.map(comp =>
      comp.id === comparisonId ? { ...comp, ...updates } : comp
    );
    
    updateCondition(conditionId, { comparisons: newComparisons });
  };

  const deleteComparison = (conditionId: string, comparisonId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;
    
    updateCondition(conditionId, {
      comparisons: condition.comparisons.filter(c => c.id !== comparisonId),
    });
  };

  return (
    <div className="p-4 space-y-4">
      <Label className="text-base font-semibold">Condições</Label>
      
      {conditions.map((condition, condIdx) => (
        <div key={condition.id} className="space-y-3">
          {condIdx > 0 && (
            <div className="text-center text-xs text-muted-foreground py-1">
              — OU —
            </div>
          )}
          
          <div className="space-y-2">
            {condition.comparisons.map((comparison, compIdx) => (
              <ComparisonItem
                key={comparison.id}
                comparison={comparison}
                onUpdate={(updates) => updateComparison(condition.id, comparison.id, updates)}
                onDelete={() => deleteComparison(condition.id, comparison.id)}
                showLogicalOperator={compIdx > 0}
                logicalOperator={condition.logicalOperator}
                onLogicalOperatorChange={(op) => updateCondition(condition.id, { logicalOperator: op })}
              />
            ))}
            
            <Button
              variant="default"
              className="w-full bg-primary hover:bg-primary/90"
              onClick={() => addComparison(condition.id)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Adicionar comparação
            </Button>
          </div>
        </div>
      ))}

      {conditions.length > 0 && conditions[0].comparisons.length > 0 && (
        <Button
          variant="outline"
          className="w-full"
          onClick={addCondition}
        >
          <Plus className="h-4 w-4 mr-2" />
          Adicionar grupo de condições (OU)
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        As comparações dentro de um grupo usam o operador lógico selecionado (E/OU).
        Grupos diferentes são combinados com OU.
      </p>
    </div>
  );
};
