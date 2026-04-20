import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface BubbleVideoConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const BubbleVideoConfig = ({ config, setConfig }: BubbleVideoConfigProps) => {
  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="videoUrl">URL do Vídeo</Label>
        <Input
          id="videoUrl"
          type="text"
          placeholder="https://exemplo.com/video.mp4"
          value={config.VideoURL || ""}
          onChange={(e) => setConfig({ ...config, VideoURL: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="videoAlt">Descrição</Label>
        <Input
          id="videoAlt"
          type="text"
          placeholder="Descrição do vídeo"
          value={config.VideoAlt || ""}
          onChange={(e) => setConfig({ ...config, VideoAlt: e.target.value })}
        />
      </div>
    </div>
  );
};
