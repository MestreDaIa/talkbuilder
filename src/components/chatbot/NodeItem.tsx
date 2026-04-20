import { useCallback } from "react";
import {
  MessageSquare,
  Hash,
  Film,
  Headphones,
  File,
  Type,
  Image,
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
} from "lucide-react";
import { Node, NodeType } from "@/types/chatbot";
import { renderTextSegments } from "@/lib/textParser";
import { cn } from "@/lib/utils";

interface NodeItemProps {
  node: Node;
  onClick: () => void;
}

const nodeIcons: Record<NodeType, React.ReactNode> = {
  // Flow
  "start": <Play className="h-4 w-4" />,
  "webhook": <Webhook className="h-4 w-4" />,
  "http-request": <Send className="h-4 w-4" />,
  // Bubbles
  "bubble-text": <MessageSquare className="h-4 w-4" />,
  "bubble-number": <Hash className="h-4 w-4" />,
  "bubble-image": <Image className="h-4 w-4" />,
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
};

const nodeColors: Record<NodeType, string> = {
  // Flow
  "start": "bg-green-100 border-green-300 text-green-700",
  "webhook": "bg-blue-100 border-blue-300 text-blue-700",
  "http-request": "bg-orange-100 border-orange-300 text-orange-700",
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
};

const nodeLabels: Record<NodeType, string> = {
  // Flow
  "start": "Início do Fluxo",
  "webhook": "Webhook",
  "http-request": "HTTP Request",
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
};

export const NodeItem = ({ node, onClick }: NodeItemProps) => {
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

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "nodrag nopan",
        nodeColors[node.type],
        "rounded-lg p-0 cursor-pointer transition-all duration-200 select-none border relative overflow-hidden group  border-border/60"
      )}
    >
      {/* Drag Handle - sempre visível */}
      <div
        draggable
        onDragStart={handleDragStart}
        onMouseDown={handleDragHandleMouseDown}
        onClick={(e) => e.stopPropagation()}
        className="nodrag nopan absolute top-0 right-0 p-1 rounded-md bg-muted/80 hover:bg-muted border border-border/50 cursor-grab active:cursor-grabbing transition-all opacity-100 hover:opacity-100 z-10"
        title="Arraste para mover para outro bloco"
      >
        <MoveIcon className="h-3.5 w-3.5 p-0  text-muted-foreground rounded-none" />
      </div>

      <div className="flex items-center justify-center gap-2 pr-8 rounded-md px-1 min-h-[40px]">
        {nodeIcons[node.type]}
        <div className="flex-1 min-w-0 flex py-1 px-1 overflow-hidden max-w-[90%] flex-col gap-1">
          <p className="text-xs font-semibold text-left w-full">{nodeLabels[node.type]}</p>

          {hasVideoPreview ? (
            <div className="mt-2">
              <video
                src={node.config["VideoURL"]}
                aria-description={node.config["VideoAlt"] || "Preview"}
                controls
                autoPlay={false}
                className="w-full h-auto rounded border max-h-36 object-cover"
              />
            </div>
          ) : hasImagePreview ? (
            <div className="mt-2">
              <img
                src={node.config["ImageURL"]}
                alt={node.config["ImageAlt"] || "Preview"}
                className="w-full h-auto rounded border max-h-36 object-cover"
              />
            </div>
          ) : hasDocumentPreview ? (
            <div className="mt-2 p-2 bg-muted rounded border">
              <p className="text-xs">{node.config["FileName"] || "Documento anexado"}</p>
            </div>
          ) : hasAudioPreview ? (
            <div className="mt-2 p-2 bg-muted rounded border flex items-center gap-2">
              <Headphones className="h-4 w-4 text-primary" />
              <audio
                src={node.config["AudioURL"]}
                controls
                className="flex-1 h-8"
                style={{ maxWidth: '100%' }}
              />
            </div>
          ) : hasButtonsPreview ? (
            <div className="mt-2 space-y-1">
              {(node.config.buttons as Array<{ id: string; label: string; saveVariable?: string }>).map((button) => (
                <div
                  key={button.id}
                  className="px-2 py-1.5 bg-white border rounded text-xs text-gray-700 font-medium text-center"
                >
                  {button.label}
                </div>
              ))}
            </div>
          ) : hasSetVariablePreview ? (
            <div className="mt-2 p-2 bg-purple-50 rounded border border-purple-200">
              <p className="text-xs font-semibold text-purple-700">
                {node.config.variableName} = {node.config.value || "(vazio)"}
              </p>
            </div>
          ) : hasScriptPreview ? (
            <div className="mt-2 p-3 space-y-2 border border-red-600">
              <div className="flex items-center gap-2">
                
                <span className="text-sm font-medium text-purple-700">
                  {node.config.executeOnServer ? 'Vai executar do lado do servidor' : 'Vai executar do lado do cliente'}
                </span>
              </div>
              <pre className="text-xs bg-black/20 p-2 rounded overflow-hidden text-ellipsis whitespace-nowrap text-gray-700">
                {node.config.code?.substring(0, 50) || "// código vazio"}
                {node.config.code?.length > 50 ? '...' : ''}
              </pre>
            </div>
          ) : (
            messageValue && (
              <p className="text-xs text-black text-left max-w-[180px] h-auto leading-relaxed text-wrap py-0">
                {renderTextSegments(messageValue as string, {
                  variableClassName: "bg-orange-400 px-1 py-0.5 text-white rounded",
                  linkClassName: "text-blue-600 underline hover:text-blue-800"
                })}
              </p>
            )
          )}
        </div>
      </div>
    </div>
  );
};