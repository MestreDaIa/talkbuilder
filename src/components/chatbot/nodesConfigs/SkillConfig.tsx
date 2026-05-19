import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Brain } from "lucide-react";

interface SkillConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const SkillConfig = ({ config, setConfig }: SkillConfigProps) => {
  const isSkill = config.isSkill ?? false;
  const skillDescription = config.skillDescription || "";

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-primary" />
          <Label className="font-semibold cursor-pointer" htmlFor="skill-toggle">
            Habilitar como Skill (Ferramenta IA)
          </Label>
        </div>
        <Switch
          id="skill-toggle"
          checked={isSkill}
          onCheckedChange={(checked) => setConfig({ ...config, isSkill: checked })}
        />
      </div>

      {isSkill && (
        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <Label className="text-xs text-muted-foreground">
            Descreva para o Agente de IA quando e como ele deve usar este bloco.
          </Label>
          <Textarea
            placeholder="Ex: Use este bloco quando o usuário quiser verificar o status de um pedido através do ID."
            value={skillDescription}
            onChange={(e) => setConfig({ ...config, skillDescription: e.target.value })}
            className="min-h-[80px] text-sm"
          />
        </div>
      )}
    </div>
  );
};
