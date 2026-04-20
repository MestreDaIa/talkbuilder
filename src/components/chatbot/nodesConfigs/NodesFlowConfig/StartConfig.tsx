import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

interface InitialVariable {
  name: string;
  defaultValue: string;
}

interface StartConfigProps {
  config: {
    flowName?: string;
    description?: string;
    initialVariables?: InitialVariable[];
  };
  setConfig: (config: StartConfigProps["config"]) => void;
}

export const StartConfig = ({ config, setConfig }: StartConfigProps) => {
  const [flowName, setFlowName] = useState(config.flowName || "");
  const [description, setDescription] = useState(config.description || "");
  const [initialVariables, setInitialVariables] = useState<InitialVariable[]>(
    config.initialVariables || []
  );

  useEffect(() => {
    setConfig({
      flowName,
      description,
      initialVariables,
    });
  }, [flowName, description, initialVariables]);

  const handleAddVariable = () => {
    setInitialVariables([...initialVariables, { name: "", defaultValue: "" }]);
  };

  const handleRemoveVariable = (index: number) => {
    setInitialVariables(initialVariables.filter((_, i) => i !== index));
  };

  const handleVariableChange = (
    index: number,
    field: keyof InitialVariable,
    value: string
  ) => {
    const updated = [...initialVariables];
    updated[index] = { ...updated[index], [field]: value };
    setInitialVariables(updated);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="flowName">Nome do Fluxo</Label>
        <Input
          id="flowName"
          value={flowName}
          onChange={(e) => setFlowName(e.target.value)}
          placeholder="Ex: Atendimento Principal"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descreva o objetivo deste fluxo..."
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Variáveis Iniciais</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddVariable}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </div>

        {initialVariables.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Nenhuma variável inicial definida.
          </p>
        ) : (
          <div className="space-y-2">
            {initialVariables.map((variable, index) => (
              <div key={index} className="flex items-center gap-2">
                <Input
                  value={variable.name}
                  onChange={(e) =>
                    handleVariableChange(index, "name", e.target.value)
                  }
                  placeholder="Nome"
                  className="flex-1"
                />
                <Input
                  value={variable.defaultValue}
                  onChange={(e) =>
                    handleVariableChange(index, "defaultValue", e.target.value)
                  }
                  placeholder="Valor padrão"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveVariable(index)}
                  className="flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-muted/50 rounded-lg p-3">
        <p className="text-xs text-muted-foreground">
          <strong>Dica:</strong> O node Start é o ponto de entrada do fluxo. Ele
          será executado primeiro quando o chatbot for iniciado ou quando o
          botão "Testar" for clicado.
        </p>
      </div>
    </div>
  );
};
