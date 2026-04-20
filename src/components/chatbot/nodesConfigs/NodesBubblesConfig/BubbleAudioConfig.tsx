import { NodeConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Upload, Link, Trash2 } from "lucide-react";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";

interface BubbleAudioConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const BubbleAudioConfig = ({ config, setConfig }: BubbleAudioConfigProps) => {
  const [isUrlMode, setIsUrlMode] = useState(!config.AudioURL || config.AudioURL.startsWith('http'));
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setConfig({ ...config, AudioURL: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('audio/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setConfig({ ...config, AudioURL: base64String });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemoveAudio = () => {
    setConfig({ ...config, AudioURL: "" });
  };

  return (
    <div className="p-4 space-y-4">
      {/* Toggle URL/Upload */}
      <div className="flex items-center gap-2 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => setIsUrlMode(false)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            !isUrlMode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload
        </button>
        <button
          type="button"
          onClick={() => setIsUrlMode(true)}
          className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
            isUrlMode ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Link className="h-4 w-4" />
          URL
        </button>
      </div>

      {isUrlMode ? (
        <div className="space-y-2">
          <Label htmlFor="audioUrl">URL do Áudio</Label>
          <Input
            id="audioUrl"
            type="text"
            placeholder="https://exemplo.com/audio.mp3"
            value={config.AudioURL || ""}
            onChange={(e) => setConfig({ ...config, AudioURL: e.target.value })}
          />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Upload de Áudio</Label>
          {config.AudioURL && !config.AudioURL.startsWith('http') ? (
            <div className="space-y-2">
              <audio
                src={config.AudioURL}
                controls
                className="w-full"
              />
              <Button
                variant="destructive"
                size="sm"
                onClick={handleRemoveAudio}
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover áudio
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
            >
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Clique ou arraste um arquivo de áudio
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                MP3, WAV, OGG (máx. 10MB)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
          )}
        </div>
      )}

      {/* Audio Preview for URL mode */}
      {isUrlMode && config.AudioURL && config.AudioURL.startsWith('http') && (
        <div className="space-y-2">
          <Label>Preview</Label>
          <audio
            src={config.AudioURL}
            controls
            className="w-full"
          />
        </div>
      )}

      {/* Audio Description */}
      <div className="space-y-2">
        <Label htmlFor="audioAlt">Descrição do áudio</Label>
        <Input
          id="audioAlt"
          type="text"
          placeholder="Descrição para acessibilidade"
          value={config.AudioAlt || ""}
          onChange={(e) => setConfig({ ...config, AudioAlt: e.target.value })}
        />
      </div>

      {/* Autoplay */}
      <div className="flex items-center justify-between">
        <Label htmlFor="autoplay">Reproduzir automaticamente</Label>
        <Switch
          id="autoplay"
          checked={config.AudioAutoplay || false}
          onCheckedChange={(checked) => setConfig({ ...config, AudioAutoplay: checked })}
        />
      </div>
    </div>
  );
};
