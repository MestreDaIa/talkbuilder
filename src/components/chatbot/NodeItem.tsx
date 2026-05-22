import { useCallback, useState } from "react";
import {
  MessageSquare,
  Hash,
  Film,
  Headphones,
  File,
  Type,
  Image as ImageIcon,
  Globe,
  AtSign,
  ImageUp,
  SquareArrowOutUpRight,
  Phone,
  Variable,
  Code,
  GripVertical,
  Filter,
  Play,
  Webhook,
  Send,
  MoveIcon,
  Hourglass,
  ExternalLink,
  Redo2,
  Cpu,
  Brain,
  Table,
  UserRound,
  MoreVertical,
  Copy,
  Trash2,
} from "lucide-react";
import { Node, NodeType } from "@/types/chatbot";
import { renderTextSegments } from "@/lib/textParser";
import { RichText } from "@/lib/richText";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NodeItemProps {
  node: Node;
  onClick: () => void;
  onDelete?: () => void;
  onDuplicate?: () => void;
}

const nodeIcons: Record<NodeType, React.ReactNode> = {
  // Flow
  "start": <Play className="h-4 w-4" />,
  "webhook": <Webhook className="h-4 w-4" />,
  "http-request": <Send className="h-4 w-4" />,
  "redirect": <ExternalLink className="h-4 w-4" />,
  "go-to": <Redo2 className="h-4 w-4" />,
  // Bubbles
  "bubble-text": <MessageSquare className="h-4 w-4" />,
  "bubble-number": <Hash className="h-4 w-4" />,
  "bubble-image": <ImageIcon className="h-4 w-4" />,
  "bubble-video": <Film className="h-4 w-4" />,
  "bubble-audio": <Headphones className="h-4 w-4" />,
  "bubble-document": <File className="h-4 w-4" />,
  // Inputs
  "input-text": <Type className="h-4 w-4" />,
  "input-number": <Hash className="h-4 w-4" />,
  "input-phone": <Phone className="h-4 w-4" />,
  "input-mail": <AtSign className="h-4 w-4" />,
  "input-image": <ImageUp className="h-4 w-4" />,
  "input-video": <Film className="h-4 w-4" />,
  "input-audio": <Headphones className="h-4 w-4" />,
  "input-document": <File className="h-4 w-4" />,
  "input-webSite": <Globe className="h-4 w-4" />,
  "input-buttons": <SquareArrowOutUpRight className="h-4 w-4" />,
  // Logic
  "set-variable": <Variable className="h-4 w-4" />,
  "script": <Code className="h-4 w-4" />,
  "condition": <Filter className="h-4 w-4" />,
  "wait": <Hourglass className="h-4 w-4" />,
  "await": <Hourglass className="h-4 w-4" />,
  // AI
  "ai-node": <Cpu className="h-4 w-4" />,
  "ai-agent": <Brain className="h-4 w-4" />,
  // Integrations
  "google-sheets": <Table className="h-4 w-4" />,
  "human-handoff": <UserRound className="h-4 w-4" />,
};

const nodeCategories: Record<NodeType, string> = {
  "start": "Fluxo",
  "webhook": "Fluxo",
  "http-request": "Fluxo",
  "redirect": "Fluxo",
  "go-to": "Fluxo",
  "bubble-text": "Bubble",
  "bubble-number": "Bubble",
  "bubble-image": "Bubble",
  "bubble-video": "Bubble",
  "bubble-audio": "Bubble",
  "bubble-document": "Bubble",
  "input-text": "Input",
  "input-number": "Input",
  "input-phone": "Input",
  "input-mail": "Input",
  "input-image": "Input",
  "input-video": "Input",
  "input-audio": "Input",
  "input-document": "Input",
  "input-webSite": "Input",
  "input-buttons": "Input",
  "set-variable": "Lógica",
  "script": "Lógica",
  "condition": "Lógica",
  "wait": "Lógica",
  "await": "Lógica",
  "ai-node": "AI",
  "ai-agent": "AI",
  "google-sheets": "Integração",
  "human-handoff": "Integração",
};

const nodeColors: Record<NodeType, string> = {
  // Flow
  "start": "bg-green-100 border-green-300 text-green-700",
  "webhook": "bg-blue-100 border-blue-300 text-blue-700",
  "http-request": "bg-orange-100 border-orange-300 text-orange-700",
  "redirect": "bg-green-100 border-green-300 text-green-700",
  "go-to": "bg-green-100 border-green-300 text-green-700",
  // Bubbles
  "bubble-text": "bg-primary/10 border-primary/30 text-primary",
  "bubble-number": "bg-primary/10 border-primary/30 text-primary",
  "bubble-video": "bg-primary/10 border-primary/30 text-primary",
  "bubble-image": "bg-primary/10 border-primary/30 text-primary",
  "bubble-document": "bg-primary/10 border-primary/30 text-primary",
  "bubble-audio": "bg-primary/10 border-primary/30 text-primary",
  // Inputs
  "input-text": "bg-accent/10 border-accent/30 text-orange-600",
  "input-number": "bg-accent/10 border-accent/30 text-orange-600",
  "input-audio": "bg-accent/10 border-accent/30 text-orange-600",
  "input-mail": "bg-accent/10 border-accent/30 text-orange-600",
  "input-phone": "bg-accent/10 border-accent/30 text-orange-600",
  "input-image": "bg-accent/10 border-accent/30 text-orange-600",
  "input-video": "bg-accent/10 border-accent/30 text-orange-600",
  "input-document": "bg-accent/10 border-accent/30 text-orange-600",
  "input-webSite": "bg-accent/10 border-accent/30 text-orange-600",
  "input-buttons": "bg-accent/10 border-accent/30 text-orange-600",
  // Logic
  "set-variable": "bg-purple-100 border-purple-300 text-purple-700",
  "script": "bg-purple-100 border-purple-300 text-purple-700",
  "condition": "bg-purple-100 border-purple-300 text-purple-700",
  "wait": "bg-purple-100 border-purple-300 text-purple-700",
  "await": "bg-purple-100 border-purple-300 text-purple-700",
  "ai-node": "bg-cyan-100 border-cyan-300 text-cyan-700",
  "ai-agent": "bg-indigo-100 border-indigo-300 text-indigo-700",
  "google-sheets": "bg-orange-100 border-orange-300 text-orange-700",
  "human-handoff": "bg-orange-100 border-orange-300 text-orange-700",
};

const nodeLabels: Record<NodeType, string> = {
  // Flow
  "start": "Início do Fluxo",
  "webhook": "Webhook",
  "http-request": "HTTP Request",
  "redirect": "Redirecionar para Fluxo",
  "go-to": "Ir para Bloco",
  // Bubbles
  "bubble-text": "Bot envia Mensagem de Texto",
  "bubble-number": "Bot envia Mensagem de Número",
  "bubble-video": "Bot envia Mensagem de Video",
  "bubble-image": "Bot envia Mensagem de Imagem",
  "bubble-audio": "Bot envia Mensagem de Audio",
  "bubble-document": "Bot envia Mensagem de Arquivo",
  // Inputs
  "input-text": "Usuário Responde com Texto",
  "input-number": "Usuário Responde com Número",
  "input-mail": "Usuário Responde com Email",
  "input-phone": "Usuário Responde com Telefone",
  "input-image": "Usuário Responde com Imagem",
  "input-audio": "Usuário Responde com Audio",
  "input-video": "Usuário Responde com Video",
  "input-document": "Usuário Responde com Documento",
  "input-webSite": "Usuário Responde com Link",
  "input-buttons": "Usuário Responde seleção de botão",
  // Logic
  "set-variable": "Definir Variável",
  "script": "Executar Script",
  "condition": "Condição",
  "wait": "Aguardar",
  "await": "Aguardar",
  "ai-node": "Inteligência Artificial",
  "ai-agent": "Agente IA (Autônomo)",
  "google-sheets": "Google Sheets / Excel",
  "human-handoff": "Transbordo Humano",
};

export const NodeItem = ({ node, onClick, onDelete, onDuplicate }: NodeItemProps) => {
  const normalizedType = String(node.type).toLowerCase();
  const effectiveType = normalizedType === "wait" || normalizedType === "await" ? "wait" : node.type;

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.stopPropagation();
    e.dataTransfer.setData('nodeId', node.id);
    e.dataTransfer.setData('text/plain', node.id);
    e.dataTransfer.effectAllowed = 'move';
  }, [node.id]);

  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  const configValue = Object.values(node.config || {});
  const messageValue = configValue.find(
    (value) =>
      typeof value === "string" &&
      value.trim() !== "" &&
      !value.includes("não configurada") &&
      !value.includes("Nova mensagem") &&
      !value.includes("medium")
  );

  const hasImagePreview = node.type === "bubble-image" && node.config["ImageURL"];
  const hasVideoPreview = node.type === "bubble-video" && node.config["VideoURL"];
  const hasDocumentPreview = node.type === "bubble-document" && node.config["FileURL"];
  const hasAudioPreview = node.type === "bubble-audio" && node.config["AudioURL"];
  const hasButtonsPreview = false; // Handled by ButtonGroupNodeItem now
  const hasSetVariablePreview = node.type === "set-variable" && node.config.variableName;
  const hasScriptPreview = node.type === "script" && node.config.code;
  const hasWaitPreview = effectiveType === "wait" && node.config.waitTime;
  const hasRedirectPreview = node.type === "redirect" && node.config.targetFlow;
  const hasGoToPreview = node.type === "go-to" && node.config.targetContainerId;
  const hasAIPreview = node.type === "ai-node" && node.config.provider;
  const hasAgentPreview = node.type === "ai-agent" && node.config.provider;
  const hasSheetsPreview = node.type === "google-sheets" && node.config.spreadsheetId;
  const hasHandoffPreview = node.type === "human-handoff";

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "nodrag nopan",
        nodeColors[effectiveType],
        "rounded-lg p-0 cursor-pointer transition-all duration-200 select-none border relative overflow-hidden group border-border/60"
      )}
    >
      {/* Standardized Header */}
      <div className={cn(
        "flex items-center justify-between px-3 py-1.5 border-b border-border/40",
        nodeColors[effectiveType].split(' ')[0], // Use the background color part
        "bg-opacity-20"
      )}>
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="shrink-0 scale-75">
            {nodeIcons[effectiveType]}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-70 truncate">
            {nodeCategories[effectiveType]}
          </span>
        </div>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* Drag Handle */}
          <div
            draggable
            onDragStart={handleDragStart}
            onMouseDown={handleDragHandleMouseDown}
            onClick={(e) => e.stopPropagation()}
            className="p-1 rounded hover:bg-black/5 cursor-grab active:cursor-grabbing"
            title="Arraste para mover"
          >
            <MoveIcon className="h-3 w-3 opacity-60" />
          </div>

          {/* Ellipsis Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded hover:bg-black/5"
              >
                <MoreVertical className="h-3 w-3 opacity-60" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-32">
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate?.();
                }}
                className="gap-2"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Duplicar</span>
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.();
                }}
                className="gap-2 text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="p-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-left w-full truncate opacity-90">
              {nodeLabels[effectiveType]}
            </p>
            {node.config.isSkill && (
              <div title="Ativado como Skill para IA">
                <Brain className="h-3 w-3 text-primary shrink-0" />
              </div>
            )}
          </div>

          {/* Content Preview */}
          {hasVideoPreview ? (
            <div className="mt-2 max-h-[150px] overflow-hidden">
              <video
                src={node.config["VideoURL"]}
                aria-description={node.config["VideoAlt"] || "Preview"}
                controls
                autoPlay={false}
                className="w-full h-auto rounded border max-h-[150px] object-cover"
              />
            </div>
          ) : hasImagePreview ? (
            <div className="mt-2 max-h-[150px] overflow-hidden">
              <img
                src={node.config["ImageURL"]}
                alt={node.config["ImageAlt"] || "Preview"}
                className="w-full h-auto rounded border max-h-[150px] object-cover"
              />
            </div>
          ) : hasDocumentPreview ? (
            <div className="mt-2 p-2 bg-muted/50 rounded border max-h-[150px] overflow-y-auto">
              <p className="text-xs">{node.config["FileName"] || "Documento anexado"}</p>
            </div>
          ) : hasAudioPreview ? (
            <div className="mt-2 p-2 bg-muted/50 rounded border flex items-center gap-2 max-h-[150px] overflow-hidden">
              <Headphones className="h-4 w-4 text-primary" />
              <audio
                src={node.config["AudioURL"]}
                controls
                className="flex-1 h-8"
                style={{ maxWidth: '100%' }}
              />
            </div>
          ) : hasSetVariablePreview ? (
            <div className="mt-2 p-2 bg-purple-50/50 rounded border border-purple-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-purple-700">
                {node.config.variableName} = {node.config.value || "(vazio)"}
              </p>
            </div>
          ) : hasScriptPreview ? (
            <div className="mt-2 p-3 space-y-2 border border-red-600/30 max-h-[150px] overflow-y-auto bg-red-50/10">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-purple-700">
                  {node.config.executeOnServer ? 'Lado do servidor' : 'Lado do cliente'}
                </span>
              </div>
              <pre className="text-[10px] bg-black/5 p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap text-gray-700">
                {node.config.code?.substring(0, 50) || "// código vazio"}
                {node.config.code?.length > 50 ? '...' : ''}
              </pre>
            </div>
          ) : hasWaitPreview ? (
            <div className="mt-2 p-2 bg-purple-50/50 rounded border border-purple-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-purple-700">
                Aguardar {node.config.waitTime} {node.config.timeUnit === 'seconds' ? 'segundo(s)' : node.config.timeUnit === 'minutes' ? 'minuto(s)' : 'hora(s)'}
              </p>
            </div>
          ) : hasRedirectPreview ? (
            <div className="mt-2 p-2 bg-green-50/50 rounded border border-green-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-green-700">
                Fluxo: {node.config.targetFlowName || node.config.targetFlow}
              </p>
            </div>
          ) : hasGoToPreview ? (
            <div className="mt-2 p-2 bg-green-50/50 rounded border border-green-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-green-700">
                Pular para: {node.config.targetContainerName || (node.config.targetContainerId ? `Bloco ${node.config.targetContainerId.slice(-4)}` : 'Não selecionado')}
              </p>
            </div>
          ) : hasAIPreview ? (
            <div className="mt-2 p-2 bg-cyan-50/50 rounded border border-cyan-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-cyan-700">
                AI: {node.config.provider} ({node.config.model || "padrão"})
              </p>
              <p className="text-[10px] text-cyan-600 truncate mt-1">
                {node.config.systemPrompt?.substring(0, 40)}...
              </p>
            </div>
          ) : hasAgentPreview ? (
            <div className="mt-2 p-2 bg-indigo-50/50 rounded border border-indigo-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-indigo-700">
                Agente: {node.config.provider}
              </p>
              <p className="text-[10px] text-indigo-600 truncate mt-1">
                {node.config.objective?.substring(0, 40)}...
              </p>
            </div>
          ) : hasSheetsPreview ? (
            <div className="mt-2 p-2 bg-orange-50/50 rounded border border-orange-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-orange-700">
                Sheets: {node.config.action === 'insert' ? 'Inserir' : node.config.action === 'update' ? 'Atualizar' : 'Obter'}
              </p>
              <p className="text-[10px] text-orange-600 truncate mt-1">
                Tab: {node.config.tabName || "(não definida)"}
              </p>
            </div>
          ) : hasHandoffPreview ? (
            <div className="mt-2 p-2 bg-orange-50/50 rounded border border-orange-200/50 max-h-[150px] overflow-y-auto">
              <p className="text-xs font-semibold text-orange-700">
                Transferir para Humano
              </p>
              {node.config.department && (
                <p className="text-[10px] text-orange-600 truncate mt-1">
                  Depto: {node.config.department}
                </p>
              )}
            </div>
          ) : (
            messageValue && (
              <div className="mt-1 overflow-hidden">
                <RichText
                  as="p"
                  className="text-xs text-black text-left w-full leading-relaxed py-0 break-all line-clamp-2 rich-bubble-preview"
                  value={messageValue as string}
                  variableClassName="bg-orange-400 px-1 py-0.5 text-white rounded"
                  linkClassName="text-blue-600 underline hover:text-blue-800"
                />
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
};
