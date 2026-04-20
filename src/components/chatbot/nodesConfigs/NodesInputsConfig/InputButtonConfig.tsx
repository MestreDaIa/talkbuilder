import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface InputButtonConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const InputButtonConfig = ({ config, setConfig }: InputButtonConfigProps) => {
  const isMultipleChoice = config.isMultipleChoice || false;
  const isSearchable = config.isSearchable || false;
  const saveVariable = config.saveVariable || "";
  const submitLabel = config.submitLabel || "Enviar";

  return (
    <div className="p-4 space-y-6">
      <div className="space-y-4">
        <h3 className="font-semibold text-sm border-b pb-2">Configurações do Grupo</h3>
        
        {/* Save Variable */}
        <div className="space-y-2">
          <Label htmlFor="save-variable">Salvar resposta em variável</Label>
          <Input
            id="save-variable"
            value={saveVariable}
            onChange={(e) => setConfig({ ...config, saveVariable: e.target.value })}
            placeholder="Ex: escolha_usuario"
          />
          <p className="text-xs text-muted-foreground">
            A escolha do usuário será salva nesta variável.
          </p>
        </div>

        {/* Multiple Choice Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label>Múltipla escolha</Label>
            <p className="text-xs text-muted-foreground">
              Permite selecionar mais de uma opção
            </p>
          </div>
          <Switch
            checked={isMultipleChoice}
            onCheckedChange={(checked) => setConfig({ ...config, isMultipleChoice: checked })}
          />
        </div>

        {/* Submit Label - only visible for multiple choice */}
        {isMultipleChoice && (
          <div className="space-y-2 pl-4 border-l-2 border-primary/20">
            <Label htmlFor="submit-label">Texto do botão enviar</Label>
            <Input
              id="submit-label"
              value={submitLabel}
              onChange={(e) => setConfig({ ...config, submitLabel: e.target.value })}
              placeholder="Enviar"
            />
          </div>
        )}

        {/* Searchable Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="space-y-0.5">
            <Label>Pesquisável</Label>
            <p className="text-xs text-muted-foreground">
              Exibe campo de busca para filtrar botões
            </p>
          </div>
          <Switch
            checked={isSearchable}
            onCheckedChange={(checked) => setConfig({ ...config, isSearchable: checked })}
          />
        </div>
      </div>

      {/* Info about buttons */}
      <div className="bg-muted/50 p-3 rounded-lg border border-dashed">
        <p className="text-xs text-muted-foreground">
          <strong>Dica:</strong> Para adicionar ou editar botões individuais, 
          use o campo diretamente no bloco do fluxo ou clique em cada botão.
        </p>
      </div>
    </div>
  );
};
