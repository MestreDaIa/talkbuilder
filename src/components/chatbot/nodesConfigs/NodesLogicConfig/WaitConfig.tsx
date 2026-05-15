import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Hourglass } from "lucide-react";

interface WaitConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const WaitConfig = ({ config, setConfig }: WaitConfigProps) => {
  const waitTime = config.waitTime || 5;
  const timeUnit = config.timeUnit || "seconds";

  const handleWaitTimeChange = (value: string) => {
    const numValue = parseInt(value, 10);
    if (!isNaN(numValue)) {
      setConfig({ ...config, waitTime: numValue });
    }
  };

  const handleTimeUnitChange = (value: string) => {
    setConfig({ ...config, timeUnit: value });
  };

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 mb-2">
        <Hourglass className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-medium">Aguardar</h3>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="waitTime">Tempo de espera</Label>
          <div className="flex gap-2">
            <Input
              id="waitTime"
              type="number"
              min="1"
              value={waitTime}
              onChange={(e) => handleWaitTimeChange(e.target.value)}
              className="w-24"
            />
            <Select value={timeUnit} onValueChange={handleTimeUnitChange}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Selecione a unidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="seconds">Segundos</SelectItem>
                <SelectItem value="minutes">Minutos</SelectItem>
                <SelectItem value="hours">Horas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="p-3 bg-muted rounded-lg border border-border">
          <p className="text-xs text-muted-foreground italic">
            O chatbot irá pausar por {waitTime} {timeUnit === 'seconds' ? 'segundo(s)' : timeUnit === 'minutes' ? 'minuto(s)' : 'hora(s)'} antes de prosseguir para o próximo bloco.
          </p>
        </div>
      </div>
    </div>
  );
};
