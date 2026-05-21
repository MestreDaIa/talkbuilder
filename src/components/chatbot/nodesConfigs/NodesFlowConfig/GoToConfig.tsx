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
import { SkillConfig } from "../SkillConfig";

interface GoToConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
  containers: Container[];
}

export const GoToConfig = ({ config, setConfig, containers }: GoToConfigProps) => {
  const targetContainerId = config.targetContainerId || "";

  const handleValueChange = (value: string) => {
    const targetContainer = containers.find(c => c.id === value);
    const newConfig = { 
      ...config, 
      targetContainerId: value,
      targetContainerName: targetContainer?.nameContainer || `Bloco ${value.slice(-4)}`
    };
    console.log("[GoToConfig] Setting new config:", newConfig);
    setConfig(newConfig);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Pular para o Bloco</Label>
        <Select value={targetContainerId} onValueChange={handleValueChange}>
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
      <SkillConfig config={config} setConfig={setConfig} />
    </div>

  );
};
