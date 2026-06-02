import { NodeConfig } from "@/types/chatbot";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Brain, Sparkles, Target, Brackets } from "lucide-react";
import { AI_PROVIDERS, API_KEY_PLACEHOLDERS_BY_PROVIDER, MODELS_BY_PROVIDER } from "./constants";
import { KnowledgeBaseSection } from "./KnowledgeBaseSection";
import { useState } from "react";
import { VariableModal } from "../../VariableModal";
import { useVariables } from "@/context/VariablesContext";

interface AgentConfigProps {
  config: NodeConfig;
  setConfig: (config: NodeConfig) => void;
}

export const AgentConfig = ({ config, setConfig }: AgentConfigProps) => {
  const provider = config.provider || "openai";
  const model = config.model || MODELS_BY_PROVIDER[provider]?.[0] || "";
  const apiKey = config.apiKey || "";
  const objective = config.objective || "";
  const instructions = config.instructions || "";
  const startMode = config.startMode || "automatic";
  const welcomeMessage = config.welcomeMessage || "";
  const toolCallingEnabled = config.toolCallingEnabled ?? true;
  const memoryEnabled = config.memoryEnabled ?? true;
  const exitKeywords = config.exitKeywords || "sair,exit,parar,encerrar,voltar";
  const apiKeyPlaceholder = API_KEY_PLACEHOLDERS_BY_PROVIDER[provider] || "Cole sua chave de API...";

  const selectedProvider = AI_PROVIDERS.find(p => p.id === provider);

  return (
    <div className="p-4 space-y-6">
      <div className="flex items-center gap-2 pb-2 border-b">
        <Brain className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-sm">Configurações do Agente Autônomo</h3>
      </div>

      <div className="space-y-4 pb-4 border-b">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Comportamento de Início
        </Label>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Modo de Início</Label>
            <Select 
              value={startMode} 
              onValueChange={(v) => setConfig({ ...config, startMode: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatic">Agente Inicia</SelectItem>
                <SelectItem value="manual">Aguardar Usuário</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {startMode === "automatic" && (
            <div className="space-y-2">
              <Label>Mensagem de Boas-vindas</Label>
              <Input 
                placeholder="Ex: Olá! Como posso ajudar?"
                value={welcomeMessage}
                onChange={(e) => setConfig({ ...config, welcomeMessage: e.target.value })}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Provedor de IA</Label>
          <Select 
            value={provider} 
            onValueChange={(v) => {
              const defaultModel = MODELS_BY_PROVIDER[v]?.[0] || "";
              setConfig({ ...config, provider: v, model: defaultModel });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AI_PROVIDERS.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Select
            value={model}
            onValueChange={(v) => setConfig({ ...config, model: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione um modelo" />
            </SelectTrigger>
            <SelectContent>
              {MODELS_BY_PROVIDER[provider]?.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {selectedProvider?.needsApiKey && (
        <div className="space-y-2">
          <Label>Chave de API (API Key)</Label>
          <Input 
            type="password"
            placeholder={apiKeyPlaceholder}
            value={apiKey}
            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-muted-foreground" />
          <Label>Objetivo do Agente</Label>
        </div>
        <Input 
          placeholder="Ex: Vender planos de assinatura e tirar dúvidas sobre preços."
          value={objective}
          onChange={(e) => setConfig({ ...config, objective: e.target.value })}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-muted-foreground" />
          <Label>Instruções e Comportamento</Label>
        </div>
        <Textarea 
          placeholder="Ex: Seja cordial, use emojis, e sempre tente levar o usuário para o checkout se ele parecer interessado."
          value={instructions}
          onChange={(e) => setConfig({ ...config, instructions: e.target.value })}
          className="min-h-[120px]"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          Controle de Saída
        </Label>
        <div className="space-y-1">
          <Label className="text-xs">Palavras-chave para encerrar (separadas por vírgula)</Label>
          <Input 
            placeholder="Ex: sair, exit, parar"
            value={exitKeywords}
            onChange={(e) => setConfig({ ...config, exitKeywords: e.target.value })}
          />
          <p className="text-[10px] text-muted-foreground">
            Quando o usuário digitar uma dessas palavras, o agente será encerrado e o fluxo continuará.
          </p>
        </div>
      </div>

      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm">Habilitar Skills (Tool Calling)</Label>
            <p className="text-[11px] text-muted-foreground">O agente poderá usar outros blocos configurados como "Skills"</p>
          </div>
          <Switch 
            checked={toolCallingEnabled} 
            onCheckedChange={(v) => setConfig({ ...config, toolCallingEnabled: v })} 
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm">Memória Persistente</Label>
            <p className="text-[11px] text-muted-foreground">Lembrar de conversas anteriores com este usuário</p>
          </div>
          <Switch 
            checked={memoryEnabled} 
            onCheckedChange={(v) => setConfig({ ...config, memoryEnabled: v })} 
          />
        </div>
      </div>
      
      <KnowledgeBaseSection config={config} setConfig={setConfig} />

      <div className="p-3 bg-muted/30 border rounded-md">
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          <strong>Dica:</strong> Para que este agente seja realmente autônomo, configure blocos de ação (como Sheets ou Redirect) e ative a opção "Habilitar como Skill" neles. O agente saberá usá-los quando necessário.
        </p>
      </div>
    </div>
  );
};
