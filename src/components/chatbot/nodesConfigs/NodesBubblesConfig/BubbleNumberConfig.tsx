import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BubbleNumberConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const BubbleNumberConfig = ({ config, setConfig }: BubbleNumberConfigProps) => {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="number">Número</Label>
        <Input
          id="number"
          type="text"
          placeholder="Digite o número ou {{variavel}}"
          value={config.number || ""}
          onChange={(e) => setConfig({ ...config, number: e.target.value })}
        />
      </div>
    </div>
  );
};
