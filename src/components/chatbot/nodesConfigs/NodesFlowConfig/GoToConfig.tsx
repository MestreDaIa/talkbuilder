import { useState, useEffect } from "react";
import { NodeConfig, Container } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Info } from "lucide-react";

interface GoToConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
  containers: Container[];
}

export const GoToConfig = ({ config, setConfig, containers }: GoToConfigProps) => {
  const [targetContainerId, setTargetContainerId] = useState(config.targetContainerId || "");

  useEffect(() => {
    setConfig({ ...config, targetContainerId });
  }, [targetContainerId]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Pular para o Bloco</Label>
        <Select value={targetContainerId} onValueChange={setTargetContainerId}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o bloco de destino" />
          </SelectTrigger>
          <SelectContent>
            {containers.map((container) => (
              <SelectItem key={container.id} value={container.id}>
                {container.nameContainer || `Bloco #${container.id.slice(-4)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Salta a execução diretamente para o bloco selecionado.
        </p>
      </div>
    </div>
  );
};
