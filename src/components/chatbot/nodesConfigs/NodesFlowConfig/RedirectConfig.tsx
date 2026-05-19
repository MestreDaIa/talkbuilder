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

interface RedirectConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
  containers: Container[];
}

export const RedirectConfig = ({ config, setConfig }: RedirectConfigProps) => {
  const [targetFlow, setTargetFlow] = useState(config.targetFlow || "");

  useEffect(() => {
    setConfig({ ...config, targetFlow });
  }, [targetFlow]);

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Selecionar Fluxo de Destino</Label>
        <Select value={targetFlow} onValueChange={setTargetFlow}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione um bot/fluxo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="main-flow">Fluxo Principal</SelectItem>
            <SelectItem value="support-flow">Suporte Técnico</SelectItem>
            <SelectItem value="sales-flow">Vendas</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" />
          Direciona o fluxo atual para outro bot.
        </p>
      </div>
    </div>
  );
};
