import { useState } from "react";
import { Braces } from "lucide-react";
import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { VariableModal } from "@/components/chatbot/VariableModal";
import { useVariables } from "@/contexts/VariablesContext";

interface InputWebSiteConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const InputWebSiteConfig = ({ config, setConfig }: InputWebSiteConfigProps) => {
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
      const currentValue = config.responseUserTextInput || '';
      setConfig({ ...config, responseUserTextInput: currentValue + `{{${varName}}}` });
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
        <Label htmlFor="placeholder">Placeholder</Label>
        <div className="flex gap-2">
          <Input
            id="placeholder"
            type="text"
            placeholder="Digite o link..."
            value={config.responseUserTextInput || ""}
            onChange={(e) => setConfig({ ...config, responseUserTextInput: e.target.value })}
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
        <Label htmlFor="saveVariable">Salvar resposta em variável</Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input
              id="saveVariable"
              type="text"
              placeholder="website"
              value={config.saveVariable || ""}
              onChange={(e) => setConfig({ ...config, saveVariable: e.target.value })}
              list="variable-suggestions-website"
            />
            <datalist id="variable-suggestions-website">
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
      </div>

      <VariableModal
        open={variableModalOpen}
        onClose={() => setVariableModalOpen(false)}
        onSelect={handleSelectVariable}
      />
    </div>
  );
};
