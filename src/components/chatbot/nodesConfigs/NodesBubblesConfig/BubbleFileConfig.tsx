import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BubbleFileConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const BubbleFileConfig = ({ config, setConfig }: BubbleFileConfigProps) => {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="fileUrl">URL do Arquivo</Label>
        <Input
          id="fileUrl"
          type="text"
          placeholder="https://exemplo.com/documento.pdf"
          value={config.FileURL || ""}
          onChange={(e) => setConfig({ ...config, FileURL: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="fileName">Nome do Arquivo</Label>
        <Input
          id="fileName"
          type="text"
          placeholder="documento.pdf"
          value={config.FileName || ""}
          onChange={(e) => setConfig({ ...config, FileName: e.target.value })}
        />
      </div>
    </div>
  );
};
