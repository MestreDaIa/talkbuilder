import React, { useState } from "react";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface JsonViewerProps {
  data: any;
  level?: number;
  path?: string;
}

export const JsonViewer = ({ data, level = 0, path = "" }: JsonViewerProps) => {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const [copiedPath, setCopiedPath] = useState(false);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const handleCopyPath = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(path);
    setCopiedPath(true);
    toast.success(`Caminho copiado: ${path}`, { duration: 1500 });
    setTimeout(() => setCopiedPath(false), 1500);
  };

  const isObject = data !== null && typeof data === "object";
  const isArray = Array.isArray(data);

  if (!isObject) {
    return (
      <span className="inline-flex items-center group">
        <span className={typeof data === "string" ? "text-green-500" : "text-blue-500"}>
          {typeof data === "string" ? `"${data}"` : String(data)}
        </span>
        {path && (
          <button
            onClick={handleCopyPath}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
            title="Copiar caminho da propriedade"
          >
            {copiedPath ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </button>
        )}
      </span>
    );
  }

  const entries = Object.entries(data);
  const isEmpty = entries.length === 0;

  return (
    <div className="flex flex-col">
      <div 
        className="flex items-center cursor-pointer hover:bg-muted/50 py-0.5 px-1 rounded group"
        onClick={toggleExpand}
      >
        <span className="mr-1 text-muted-foreground">
          {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </span>
        <span className="font-semibold text-foreground/80">
          {isArray ? `Array [${entries.length}]` : `Object {${entries.length}}`}
        </span>
        {path && (
          <button
            onClick={handleCopyPath}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-muted rounded"
            title="Copiar caminho da propriedade"
          >
            {copiedPath ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </button>
        )}
      </div>

      {isExpanded && !isEmpty && (
        <div className="ml-4 border-l border-border pl-2 my-0.5">
          {entries.map(([key, value]) => {
            const currentPath = path ? (isArray ? `${path}[${key}]` : `${path}.${key}`) : key;
            return (
              <div key={key} className="flex flex-col py-0.5">
                <div className="flex items-start">
                  <span className="text-purple-500 font-medium mr-1 shrink-0">{key}:</span>
                  <JsonViewer data={value} level={level + 1} path={currentPath} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      {isExpanded && isEmpty && (
        <div className="ml-6 text-muted-foreground italic text-[10px]">empty</div>
      )}
    </div>
  );
};
