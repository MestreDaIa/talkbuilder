import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Brain, Zap, Database } from "lucide-react";

interface SkillConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

/**
 * Skill toggle + "Tipo de Resultado" (Context Data | Live Data).
 * - Context Data: pode ser reutilizado como memória de conversa.
 * - Live Data: nunca reutilizar cache; Runtime reexecuta antes de operações
 *   críticas (ex.: agendar, cancelar, pagar).
 */
export const SkillConfig = ({ config, setConfig }: SkillConfigProps) => {
  const isSkill = config.isSkill ?? false;
  const skillDescription = config.skillDescription || "";
  const resultType: "context" | "live" = config.resultType || "context";

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
        <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              {resultType === "live"
                ? <Zap className="h-3.5 w-3.5 text-amber-500" />
                : <Database className="h-3.5 w-3.5 text-primary" />}
              Tipo de Resultado
            </Label>
            <Select
              value={resultType}
              onValueChange={(v) => setConfig({ ...config, resultType: v })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="context">
                  Context Data — pode virar memória (produto, cliente, escolha…)
                </SelectItem>
                <SelectItem value="live">
                  Live Data — volátil, sempre reconsultar (estoque, agenda, saldo…)
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {resultType === "live"
                ? "O Runtime nunca reutilizará esta resposta. Antes de qualquer operação crítica (agendar, pagar, cancelar), esta skill será reexecutada automaticamente."
                : "Os dados retornados poderão ser registrados na memória da conversa via Context Manager."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
