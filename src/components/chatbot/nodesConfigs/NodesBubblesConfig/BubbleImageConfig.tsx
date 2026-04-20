import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BubbleImageConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const BubbleImageConfig = ({ config, setConfig }: BubbleImageConfigProps) => {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="imageUrl">URL da Imagem</Label>
        <Input
          id="imageUrl"
          type="text"
          placeholder="https://exemplo.com/imagem.png"
          value={config.ImageURL || ""}
          onChange={(e) => setConfig({ ...config, ImageURL: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="imageAlt">Texto Alternativo</Label>
        <Input
          id="imageAlt"
          type="text"
          placeholder="Descrição da imagem"
          value={config.ImageAlt || ""}
          onChange={(e) => setConfig({ ...config, ImageAlt: e.target.value })}
        />
      </div>
      {config.ImageURL && (
        <div className="mt-4">
          <img src={config.ImageURL} alt={config.ImageAlt || "Preview"} className="max-h-32 rounded border" />
        </div>
      )}
    </div>
  );
};
