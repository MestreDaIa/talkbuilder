import { useState, useMemo } from "react";
import { NodeConfig, ConditionComparison, ConditionGroup, Container, Node } from "@/types/chatbot";
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
import { useVariables } from "@/context/VariablesContext";
import { Plus, Search, Trash2, User } from "lucide-react";

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

const createConditionId = () =>
  `condition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createComparisonId = () =>
  `comparison-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const getNodeVariableNames = (containers: Container[]) => {
  const names = new Set<string>();
  containers.forEach((container) => {
    container.nodes.forEach((node: Node) => {
      [node.config?.saveVariable, node.config?.variableName, node.config?.responseVariable]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => names.add(value));
    });
  });
  return Array.from(names);
};

const ComparisonItem = ({
  comparison,
  onUpdate,
  onDelete,
  availableVariables,
}: {
  comparison: ConditionComparison;
  onUpdate: (updates: Partial<ConditionComparison>) => void;
  onDelete: () => void;
  availableVariables: string[];
}) => {
  const { addVariable } = useVariables();
  const [searchValue, setSearchValue] = useState("");
  
  const filteredVariables = useMemo(() => {
    if (!searchValue) return availableVariables;
    return availableVariables.filter(name => 
      name.toLowerCase().includes(searchValue.toLowerCase())
    );
  }, [availableVariables, searchValue]);

  const trimmedSearch = searchValue.trim();
  const canCreateNew = trimmedSearch && !availableVariables.includes(trimmedSearch);
  const needsValue = !["is_set", "is_empty"].includes(comparison.operator);

  const handleSelectVariable = (varName: string) => {
    onUpdate({ variableName: varName });
    setSearchValue("");
  };

  const handleCreateVariable = () => {
    if (trimmedSearch) {
      addVariable(trimmedSearch, "");
      handleSelectVariable(trimmedSearch);
    }
  };

  return (
    <div className="space-y-3 p-3 bg-card border rounded-lg">
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-3">
          {/* Variable selector */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchValue || comparison.variableName || ""}
                onChange={(e) => {
                  setSearchValue(e.target.value);
                  onUpdate({ variableName: e.target.value });
                }}
                placeholder="Pesquise uma variável"
                className="h-9 pl-9 text-sm"
              />
            </div>

            {(filteredVariables.length > 0 || canCreateNew) && (
              <div className="max-h-36 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground">
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
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                    onClick={handleCreateVariable}
                  >
                    <Plus className="h-4 w-4" />
                    Criar "{trimmedSearch}"
                  </button>
                )}
              </div>
            )}
          </div>

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
                type="button"
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
          type="button"
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

export const ConditionConfig = ({ config, setConfig, containers = [] }: ConditionConfigProps & { containers?: Container[] }) => {
  const { getAllVariableNames } = useVariables();
  const availableVariables = useMemo(
    () => Array.from(new Set([...getAllVariableNames(), ...getNodeVariableNames(containers)])),
    [containers, getAllVariableNames]
  );

  const [defaultConditionId] = useState(createConditionId);
  const conditions: ConditionGroup[] = config.conditions?.length
    ? config.conditions
    : [{ id: defaultConditionId, comparisons: [], logicalOperator: "AND" }];

  const updateCondition = (conditionId: string, updates: Partial<ConditionGroup>) => {
    const newConditions = conditions.map(c => 
      c.id === conditionId ? { ...c, ...updates } : c
    );
    setConfig({ ...config, conditions: newConditions });
  };

  const addCondition = () => {
    const newCondition: ConditionGroup = {
      id: createConditionId(),
      comparisons: [],
      logicalOperator: "AND",
    };
    setConfig({ ...config, conditions: [...conditions, newCondition] });
  };

  const addComparison = (conditionId: string) => {
    const condition = conditions.find(c => c.id === conditionId);
    if (!condition) return;
    
    const newComparison: ConditionComparison = {
      id: createComparisonId(),
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
              <div key={comparison.id} className="space-y-2">
                {compIdx > 0 && (
                  <div className="flex justify-center py-1">
                    <Select
                      value={condition.logicalOperator}
                      onValueChange={(v) => updateCondition(condition.id, { logicalOperator: v as "AND" | "OR" })}
                    >
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
                <ComparisonItem
                  comparison={comparison}
                  availableVariables={availableVariables}
                  onUpdate={(updates) => updateComparison(condition.id, comparison.id, updates)}
                  onDelete={() => deleteComparison(condition.id, comparison.id)}
                />
              </div>
            ))}
            
            <Button
              type="button"
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
          type="button"
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
