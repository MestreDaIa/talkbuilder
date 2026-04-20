import { useState, useRef, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Settings, Plus, GripVertical } from "lucide-react";
import { Node, ButtonConfig } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ButtonGroupNodeItemProps {
  node: Node;
  onGroupClick: () => void;
  onButtonClick: (buttonId: string) => void;
  onAddButton: (label: string) => void;
  onUpdateButton: (buttonId: string, updates: Partial<ButtonConfig>) => void;
  onDeleteButton: (buttonId: string) => void;
  nodeIndex: number;
}

export const ButtonGroupNodeItem = ({
  node,
  onGroupClick,
  onButtonClick,
  onAddButton,
  onUpdateButton,
  onDeleteButton,
  nodeIndex,
}: ButtonGroupNodeItemProps) => {
  const [newButtonLabel, setNewButtonLabel] = useState("");
  const [editingButtonId, setEditingButtonId] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const buttons: ButtonConfig[] = node.config.buttons || [];
  const saveVariable = node.config.saveVariable;
  const isMultipleChoice = node.config.isMultipleChoice;

  const handleAddButton = () => {
    if (newButtonLabel.trim()) {
      onAddButton(newButtonLabel.trim());
      setNewButtonLabel("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddButton();
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, buttonId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (editingLabel.trim()) {
        onUpdateButton(buttonId, { label: editingLabel.trim() });
      }
      setEditingButtonId(null);
    } else if (e.key === "Escape") {
      setEditingButtonId(null);
    }
  };

  const startEditing = (button: ButtonConfig) => {
    setEditingButtonId(button.id);
    setEditingLabel(button.label);
  };

  useEffect(() => {
    if (editingButtonId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingButtonId]);

  // Base position for handles - adjust based on node structure
  const baseHandleTop = 90; // Start position for first button handle
  const handleSpacing = 44; // Space between each button handle

  return (
    <div className="relative bg-accent/10 border border-accent/30 rounded-lg overflow-visible" style={{ width: 280 }}>
      {/* Header - Click to open group config */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onGroupClick();
        }}
        className="flex items-center justify-between px-3 py-2 bg-orange-500/20 border-b border-accent/30 cursor-pointer hover:bg-orange-500/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-medium text-orange-600">Botões</span>
          {saveVariable && (
            <span className="text-xs bg-orange-200 text-orange-700 px-1.5 py-0.5 rounded">
              {saveVariable}
            </span>
          )}
          {isMultipleChoice && (
            <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">
              Múltipla
            </span>
          )}
        </div>
        {/* Drag Handle */}
        <div
          draggable
          onDragStart={(e) => {
            e.stopPropagation();
            e.dataTransfer.setData("nodeId", node.id);
            e.dataTransfer.setData("text/plain", node.id);
            e.dataTransfer.effectAllowed = "move";
          }}
          onClick={(e) => e.stopPropagation()}
          className="p-1 rounded-md hover:bg-orange-500/30 cursor-grab active:cursor-grabbing transition-all"
          title="Arraste para mover para outro bloco"
        >
          <GripVertical className="h-3.5 w-3.5 text-orange-600" />
        </div>
      </div>

      {/* Buttons list */}
      <div className="p-2 space-y-1.5">
        {buttons.map((button) => (
          <div
            key={button.id}
            className="group relative flex items-center"
          >
            {editingButtonId === button.id ? (
              <Input
                ref={inputRef}
                value={editingLabel}
                onChange={(e) => setEditingLabel(e.target.value)}
                onKeyDown={(e) => handleEditKeyDown(e, button.id)}
                onBlur={() => {
                  if (editingLabel.trim()) {
                    onUpdateButton(button.id, { label: editingLabel.trim() });
                  }
                  setEditingButtonId(null);
                }}
                className="h-8 text-xs flex-1"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onButtonClick(button.id);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startEditing(button);
                }}
                className={cn(
                  "flex-1 px-3 py-2 bg-white border border-gray-200 rounded-md",
                  "text-xs text-gray-700 font-medium cursor-pointer",
                  "hover:border-orange-400 hover:bg-orange-50 transition-colors",
                  "flex items-center justify-between gap-2"
                )}
              >
                <span className="truncate">{button.label}</span>
                <span className="text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                  clique para editar
                </span>
              </div>
            )}
            
            {/* Individual button handle - positioned at container edge (half in, half out) */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${node.id}-btn-${button.id}`}
              style={{ 
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translate(50%, -50%)',
              }}
              className="!bg-orange-500 !w-3 !h-3"
            />
          </div>
        ))}

        {/* Default/Fallback handle */}
        <div className="relative flex items-center mt-3 pt-2 border-t border-dashed border-gray-300">
          <div className="flex-1 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-md text-xs text-gray-500 font-medium">
            Padrão
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id={`${node.id}-default`}
            style={{ 
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translate(50%, -50%)',
            }}
            className="!bg-gray-400 !w-3 !h-3"
          />
        </div>

        {/* Add new button inline - at the bottom */}
        <div className="flex items-center gap-1 mt-3 pt-2 border-t border-gray-200">
          <Input
            value={newButtonLabel}
            onChange={(e) => setNewButtonLabel(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Novo botão..."
            className="h-8 text-xs flex-1"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAddButton();
            }}
            disabled={!newButtonLabel.trim()}
            className={cn(
              "h-8 w-8 flex items-center justify-center rounded-md border",
              "transition-colors",
              newButtonLabel.trim()
                ? "bg-orange-500 text-white border-orange-500 hover:bg-orange-600"
                : "bg-gray-100 text-gray-400 border-gray-200"
            )}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
