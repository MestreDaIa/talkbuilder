import { useState } from "react";
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
];

const getCategoryColor = (category: string, nodeType: NodeType) => {
  if (category === "flow") return "bg-green-600/80 border-green-950 text-white";
  if (category === "bubbles") return "bg-indigo-950 border-blue-500 text-blue-500";
  if (category === "inputs") return "bg-orange-600/80 border-indigo-950 text-white";
  if (category === "logic") return "bg-purple-600/80 border-purple-950 text-white";
  return "";
};

const getIconColor = (category: string) => {
  if (category === "flow") return "text-green-950 group-hover:text-green-600/80";
  if (category === "bubbles") return "text-blue-500";
  if (category === "inputs") return "text-indigo-950 group-hover:text-orange-600/80";
  if (category === "logic") return "text-purple-950 group-hover:text-purple-600/80";
  return "";
};

export const NodesSidebar = ({ onAddNode }: NodesSidebarProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const categories = Array.from(new Set(nodeTypes.map((node) => node.category)));

  return (
    <aside className={`${!collapsed ? "w-20 flex flex-col" : "w-72 px-3"} relative flex-grow-0 bg-sidebar transition-all duration-300 flex flex-col`}>
      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 border p-0 z-10 top-4 w-6 h-6 rounded-full bg-background shadow-md"
        onClick={() => setCollapsed(!collapsed)}
      >
        {!collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <div className="flex overflow-hidden h-full">
        <div className={`${!collapsed ? "flex flex-col gap-3" : "flex flex-col gap-0 uppercase text-muted-foreground"} gap-3 w-full h-full overflow-y-auto`}>
          {categories.map((category) => (
            <div key={category} className="flex flex-col gap-2 py-3 px-1 w-full justify-start">
              <h4 className={`${!collapsed ? 'hidden' : "flex flex-col"} text-left text-sm font-medium`}>{category}</h4>
              <div className={`${collapsed ? 'grid grid-cols-2 gap-1' : "flex flex-col gap-2"} flex justify-center items-center w-full`}>
                {nodeTypes.filter((node) => node.category === category).map((node) => (
                  <Button
                    key={node.type}
                    onClick={() => onAddNode(node.type)}
                    className={`${getCategoryColor(category, node.type)} ${collapsed ? "w-full" : "w-fit"} rounded-lg gap-0 group hover:bg-muted transition-all duration-200 flex items-center justify-start p-0 cursor-pointer border`}
                  >
                    <div className={`${getIconColor(category)} p-0 w-10 h-10 items-center flex justify-center rounded-md group-hover:scale-110 transition-transform`}>
                      {node.icon}
                    </div>
                    <span className={`text-sm font-medium ${collapsed ? "flex" : "hidden"}`}>{node.label}</span>
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
