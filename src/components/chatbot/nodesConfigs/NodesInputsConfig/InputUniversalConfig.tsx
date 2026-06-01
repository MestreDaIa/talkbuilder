import { useState } from "react";
import { Braces } from "lucide-react";
import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { VariableModal } from "@/components/chatbot/VariableModal";
import { useVariables } from "@/context/VariablesContext";

interface InputUniversalConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const InputUniversalConfig = ({ config, setConfig }: InputUniversalConfigProps) => {
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [variableModalTarget, setVariableModalTarget] = useState<'placeholder' | 'saveVariable'>('placeholder');
  const { getAllVariableNames, addVariable } = useVariables();
  
  const allVariables = getAllVariableNames();

  const handleOpenVariableModal = (target: 'placeholder' | 'saveVariable') => {
    setVariableModalTarget(target);
    setVariableModalOpen(true);
  };

  const handleSelectVariable = (varName: string) => {
    if (variableModalTarget === 'placeholder') {
      const currentValue = config.placeholder || '';
      setConfig({ ...config, placeholder: currentValue + `{{${varName}}}` });
    } else {
      setConfig({ ...config, saveVariable: varName });
    }
  };

  const handleAddVariable = () => {
    const varName = config.saveVariable?.trim();
    if (varName && !allVariables.includes(varName)) {
      addVariable(varName, '');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="placeholder">Placeholder (Dica no campo de texto)</Label>
        <div className="flex gap-2">
          <Input
            id="placeholder"
            type="text"
            placeholder="Ex: Digite algo ou envie um arquivo..."
            value={config.placeholder || ""}
            onChange={(e) => setConfig({ ...config, placeholder: e.target.value })}
            className="flex-1"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleOpenVariableModal('placeholder')}
            title="Inserir variável"
          >
            <Braces className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="saveVariable">Salvar resposta (objeto padronizado) em variável</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="saveVariable"
              type="text"
              placeholder="nome_variavel"
              value={config.saveVariable || ""}
              onChange={(e) => setConfig({ ...config, saveVariable: e.target.value })}
              list="variable-suggestions"
            />
            <datalist id="variable-suggestions">
              {allVariables.map((v) => (
                <option key={v} value={v} />
              ))}
            </datalist>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => handleOpenVariableModal('saveVariable')}
            title="Selecionar variável"
          >
            <Braces className="h-4 w-4" />
          </Button>
          {config.saveVariable && !allVariables.includes(config.saveVariable) && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleAddVariable}
            >
              + Add
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          O retorno será um objeto com: type (textInput, imageInput, etc) e content (valor ou link).
        </p>
      </div>

      <VariableModal
        open={variableModalOpen}
        onClose={() => setVariableModalOpen(false)}
        onSelect={handleSelectVariable}
      />
    </div>
  );
};
