import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { TiptapEditor } from "@/components/chatbot/TiptapEditor";

interface BubbleTextConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const BubbleTextConfig = ({ config, setConfig }: BubbleTextConfigProps) => {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label>Mensagem</Label>
        <TiptapEditor
          value={config.message || ""}
          onChange={(value) => setConfig({ ...config, message: value })}
          placeholder="Digite a mensagem do bot..."
        />
      </div>
    </div>
  );
};
