import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SkillConfig } from "../SkillConfig";

interface HumanHandoffConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const HumanHandoffConfig = ({ config, setConfig }: HumanHandoffConfigProps) => {
  const message = config.message || "Aguarde um momento, estou transferindo você para um atendente humano...";
  const department = config.department || "";

  return (
    <div className="p-4 space-y-5">
      <div className="space-y-2">
        <Label>Mensagem de Transferência</Label>
        <Textarea 
          placeholder="Mensagem que o usuário verá antes de ser transferido..."
          value={message}
          onChange={(e) => setConfig({ ...config, message: e.target.value })}
          className="min-h-[100px]"
        />
      </div>

      <div className="space-y-2">
        <Label>Departamento / Fila (Opcional)</Label>
        <Input 
          placeholder="Ex: Suporte, Vendas..."
          value={department}
          onChange={(e) => setConfig({ ...config, department: e.target.value })}
        />
      </div>

      <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
        <p className="text-xs text-blue-700 leading-relaxed">
          Este nó encerra a automação e sinaliza para sua plataforma de atendimento que este chat precisa de atenção humana.
        </p>
      </div>
      <SkillConfig config={config} setConfig={setConfig} />
    </div>
  );
};
