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
    initialVariables?: InitialVariable[];
  };
  setConfig: (config: StartConfigProps["config"]) => void;
}

export const StartConfig = ({ config, setConfig }: StartConfigProps) => {
  const [initialVariables, setInitialVariables] = useState<InitialVariable[]>(
    config.initialVariables || []
  );

  useEffect(() => {
    setConfig({
      initialVariables,
    });
  }, [initialVariables]);

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
    <div className="space-y-4 p-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Variáveis Globais do Bot</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddVariable}
            className="h-8 gap-1"
          >
            <Plus className="h-4 w-4" />
            Adicionar
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Defina variáveis que estarão disponíveis em todo o fluxo do bot.
        </p>

        {initialVariables.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed rounded-lg bg-muted/30">
            <p className="text-sm text-muted-foreground">
              Nenhuma variável definida ainda.
            </p>
          </div>
        ) : (
          <div className="space-y-3 mt-4">
            {initialVariables.map((variable, index) => (
              <div key={index} className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border border-border">
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground ml-1">Nome da Variável</Label>
                  <Input
                    value={variable.name}
                    onChange={(e) =>
                      handleVariableChange(index, "name", e.target.value)
                    }
                    placeholder="ex: nome_usuario"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-[10px] uppercase text-muted-foreground ml-1">Valor Padrão</Label>
                  <Input
                    value={variable.defaultValue}
                    onChange={(e) =>
                      handleVariableChange(index, "defaultValue", e.target.value)
                    }
                    placeholder="Valor opcional"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRemoveVariable(index)}
                  className="h-8 w-8 mt-5 text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-primary/5 rounded-lg p-3 border border-primary/10">
        <p className="text-xs text-primary/80 leading-relaxed">
          <strong>Como usar:</strong> Para usar estas variáveis em outros blocos (como em textos ou condições), utilize o formato <code>{`{{nome_da_variavel}}`}</code>.
        </p>
      </div>
    </div>
  );
};
