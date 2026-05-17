import { NodeConfig } from "@/types/chatbot";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Braces, X } from "lucide-react";
import { useState, useRef } from "react";
import { VariableModal } from "../../VariableModal";

interface ScriptConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const ScriptConfig = ({ config, setConfig }: ScriptConfigProps) => {
  const [variableModalOpen, setVariableModalOpen] = useState(false);
  const [isSavingToVar, setIsSavingToVar] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleVariableSelect = (variableName: string) => {
    if (isSavingToVar) {
      setConfig({ ...config, variableName });
      setVariableModalOpen(false);
      setIsSavingToVar(false);
      return;
    }

    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentCode = config.code || "";
    
    // Insert variable reference at cursor position
    const variableRef = `{{${variableName}}}`;
    const newCode = currentCode.substring(0, start) + variableRef + currentCode.substring(end);
    
    setConfig({ ...config, code: newCode });
    
    // Focus and set cursor position after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + variableRef.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const openVariableSelectorForSave = () => {
    setIsSavingToVar(true);
    setVariableModalOpen(true);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="code">Código JavaScript</Label>
        <div className="relative">
          <Textarea
            ref={textareaRef}
            id="code"
            placeholder="// Seu código aqui..."
            value={config.code || ""}
            onChange={(e) => setConfig({ ...config, code: e.target.value })}
            className="min-h-[150px] font-mono text-sm pr-10"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute bottom-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsSavingToVar(false);
              setVariableModalOpen(true);
            }}
            title="Inserir variável"
          >
            <Braces className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Salvar o resultado em</Label>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="w-full justify-start font-normal"
            onClick={openVariableSelectorForSave}
          >
            {config.variableName ? (
              <span className="flex items-center gap-2">
                <code className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-xs">{"{{"}{config.variableName}{"}}"}</code>
              </span>
            ) : (
              <span className="text-muted-foreground">Selecionar variável (opcional)</span>
            )}
          </Button>
          {config.variableName && (
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setConfig({ ...config, variableName: undefined })}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground">
          O valor retornado pelo script (<code>return ...</code>) será salvo nesta variável.
        </p>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <Label htmlFor="executeOnServer">Executar no Servidor</Label>
          <p className="text-xs text-muted-foreground">Requer Lovable Cloud</p>
        </div>
        <Switch
          id="executeOnServer"
          checked={config.executeOnServer || false}
          onCheckedChange={(checked) => setConfig({ ...config, executeOnServer: checked })}
        />
      </div>

      <div className="space-y-2 p-3 bg-muted/50 rounded-lg border border-border">
        <p className="text-xs font-semibold text-foreground uppercase tracking-wider">Como usar (Estilo Typebot):</p>
        <div className="space-y-1 text-[11px] text-muted-foreground">
          <p>• <strong>Variáveis:</strong> <code className="bg-background px-1 rounded">variables.nome</code></p>
          <p>• <strong>Simples:</strong> <code className="bg-background px-1 rounded">return variables.n1 + 5;</code></p>
          <p>• <strong>Várias:</strong> <code className="bg-background px-1 rounded">return {"{ soma: 15, msg: 'ok' }"}</code></p>
        </div>
      </div>

      <VariableModal
        open={variableModalOpen}
        onClose={() => {
          setVariableModalOpen(false);
          setIsSavingToVar(false);
        }}
        onSelect={handleVariableSelect}
      />
    </div>
  );
};
