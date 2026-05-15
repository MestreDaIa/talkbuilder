import { useState, useEffect } from "react";
import { 
  MessageSquare, 
  Hash, 
  ChevronLeft, 
  ChevronRight, 
  Type, 
  Phone, 
  Globe, 
  Code, 
  Image, 
  Film, 
  File, 
  Headphones, 
  ImageUp, 
  SquareArrowOutUpRight, 
  AtSign, 
  Variable,
  Filter,
  Play,
  Webhook,
  Send,
  Hourglass,
} from "lucide-react";
import { NodeType } from "@/types/chatbot";
import { Button } from "@/components/ui/button";

interface NodesSidebarProps {
  onAddNode: (type: NodeType) => void;
}

const nodeTypes: {
  type: NodeType;
  label: string;
  icon: React.ReactNode;
  category: string;
}[] = [
  // Flow
  { type: "start", label: "Start", icon: <Play className="h-5 w-5" />, category: "flow" },
  { type: "webhook", label: "Webhook", icon: <Webhook className="h-5 w-5" />, category: "flow" },
  { type: "http-request", label: "HTTP Request", icon: <Send className="h-5 w-5" />, category: "flow" },
  // Bubbles
  { type: "bubble-text", label: "Texto", icon: <MessageSquare className="h-5 w-5" />, category: "bubbles" },
  { type: "bubble-number", label: "Número", icon: <Hash className="h-5 w-5" />, category: "bubbles" },
  { type: "bubble-video", label: "Video", icon: <Film className="h-5 w-5" />, category: "bubbles" },
  { type: "bubble-image", label: "Imagem", icon: <Image className="h-5 w-5" />, category: "bubbles" },
  { type: "bubble-document", label: "Documento", icon: <File className="h-5 w-5" />, category: "bubbles" },
  { type: "bubble-audio", label: "Audio", icon: <Headphones className="h-5 w-5" />, category: "bubbles" },
  // Inputs
  { type: "input-text", label: "Texto", icon: <Type className="h-5 w-5" />, category: "inputs" },
  { type: "input-number", label: "Número", icon: <Hash className="h-5 w-5" />, category: "inputs" },
  { type: "input-mail", label: "Email", icon: <AtSign className="h-5 w-5" />, category: "inputs" },
  { type: "input-phone", label: "Telefone", icon: <Phone className="h-5 w-5" />, category: "inputs" },
  { type: "input-image", label: "Imagem", icon: <ImageUp className="h-5 w-5" />, category: "inputs" },
  { type: "input-video", label: "Video", icon: <Film className="h-5 w-5" />, category: "inputs" },
  { type: "input-audio", label: "Audio", icon: <Headphones className="h-5 w-5" />, category: "inputs" },
  { type: "input-document", label: "Documento", icon: <File className="h-5 w-5" />, category: "inputs" },
  { type: "input-buttons", label: "Botões", icon: <SquareArrowOutUpRight className="h-5 w-5" />, category: "inputs" },
  { type: "input-webSite", label: "Site", icon: <Globe className="h-5 w-5" />, category: "inputs" },
  // Logic
  { type: "set-variable", label: "Variável", icon: <Variable className="h-5 w-5" />, category: "logic" },
  { type: "condition", label: "Condição", icon: <Filter className="h-5 w-5" />, category: "logic" },
  { type: "script", label: "Script", icon: <Code className="h-5 w-5" />, category: "logic" },
  { type: "wait", label: "Aguardar", icon: <Hourglass className="h-5 w-5" />, category: "logic" },
  { type: "await", label: "Aguardar", icon: <Hourglass className="h-5 w-5" />, category: "logic" },
];

const getCategoryStyle = (category: string): React.CSSProperties => {
  if (category === "flow") return { background: "var(--bot-flow)", color: "var(--bot-flow-fg)" };
  if (category === "bubbles") return { background: "var(--bot-bubbles)", color: "var(--bot-bubbles-fg)" };
  if (category === "inputs") return { background: "var(--bot-inputs)", color: "var(--bot-inputs-fg)" };
  if (category === "logic") return { background: "var(--bot-logic)", color: "var(--bot-logic-fg)" };
  return {};
};

export const NodesSidebar = ({ onAddNode }: NodesSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  
  // Debug to verify node list in console
  useEffect(() => {
    console.log("NodesSidebar mounted. Current node types:", nodeTypes.map(n => n.type));
  }, []);

  const categories = Array.from(new Set(nodeTypes.map((node) => node.category)));

  return (
    <aside
      className={`${!collapsed ? "w-20 flex flex-col" : "w-72 px-3"} relative flex-grow-0 bg-card border-r border-border transition-all duration-300 flex flex-col`}
    >
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 border border-border p-0 z-10 top-4 w-6 h-6 rounded-full bg-card shadow-md text-foreground"
        onClick={() => setCollapsed(!collapsed)}
      >
        {!collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div className="flex overflow-hidden h-full">
        <div className={`${!collapsed ? "flex flex-col gap-3" : "flex flex-col gap-0"} gap-3 w-full h-full overflow-y-auto`}>
          {categories.map((category) => (
            <div key={category} className="flex flex-col gap-2 py-3 px-1 w-full justify-start border-b border-border/50 last:border-0">
              <h4
                className={`${!collapsed ? "hidden" : "flex flex-col"} text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1`}
              >
                {category}
              </h4>
              <div
                className={`${collapsed ? "grid grid-cols-2 gap-1.5" : "flex flex-col gap-2"} flex justify-center items-center w-full px-1`}
              >
                {nodeTypes
                  .filter((node) => node.category === category)
                  .map((node) => (
                    <Button
                      key={node.type}
                      onClick={() => onAddNode(node.type)}
                      style={getCategoryStyle(category)}
                      className={`${collapsed ? "w-full justify-start gap-2 px-2" : "w-12 h-12 p-0"} rounded-lg shadow-sm hover:opacity-90 hover:scale-[1.02] transition-all duration-200 flex items-center cursor-pointer border-0`}
                    >
                      <div className="w-8 h-8 flex items-center justify-center rounded-md shrink-0">
                        {node.icon}
                      </div>
                      <span className={`text-sm font-medium ${collapsed ? "flex" : "hidden"}`}>
                        {node.label}
                      </span>
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
};
