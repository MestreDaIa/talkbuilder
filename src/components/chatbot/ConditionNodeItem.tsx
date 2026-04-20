import { useState, useRef, useEffect } from "react";
import { Handle, Position } from "reactflow";
import { Filter, Settings, Plus, GripVertical, Trash2 } from "lucide-react";
import { Node, ConditionGroup, ConditionComparison } from "@/types/chatbot";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ConditionNodeItemProps {
  node: Node;
  onGroupClick: () => void;
  onConditionClick: (conditionId: string) => void;
  nodeIndex: number;
}

const operatorLabels: Record<string, string> = {
  equals: "=",
  not_equals: "≠",
  contains: "∋",
  not_contains: "∌",
  greater_than: ">",
  less_than: "<",
  is_set: "✓",
  is_empty: "∅",
  starts_with: "^",
  ends_with: "$",
  matches_regex: "~",
  not_matches_regex: "!~",
};

const getConditionSummary = (condition: ConditionGroup): string => {
  if (!condition.comparisons.length) return "Configure...";
  
  const parts = condition.comparisons.map(comp => {
    const op = operatorLabels[comp.operator] || comp.operator;
    if (["is_set", "is_empty"].includes(comp.operator)) {
      return `${comp.variableName} ${op}`;
    }
    return `${comp.variableName} ${op} ${comp.value || "?"}`;
  });
  
  const joiner = condition.logicalOperator === "AND" ? " E " : " OU ";
  return parts.join(joiner);
};

export const ConditionNodeItem = ({
  node,
  onGroupClick,
  onConditionClick,
  nodeIndex,
}: ConditionNodeItemProps) => {
  const conditions: ConditionGroup[] = node.config.conditions || [];

  return (
    <div className="relative bg-purple-100 border border-purple-300 rounded-lg overflow-visible" style={{ width: 280 }}>
      {/* Header */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          onGroupClick();
        }}
        className="flex items-center justify-between px-3 py-2 bg-purple-200 border-b border-purple-300 cursor-pointer hover:bg-purple-300 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-purple-700" />
          <span className="text-sm font-medium text-purple-700">Condição</span>
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
          className="p-1 rounded-md hover:bg-purple-400/30 cursor-grab active:cursor-grabbing transition-all"
          title="Arraste para mover para outro bloco"
        >
          <GripVertical className="h-3.5 w-3.5 text-purple-600" />
        </div>
      </div>

      {/* Conditions list */}
      <div className="p-2 space-y-1.5">
        {conditions.map((condition, idx) => (
          <div
            key={condition.id}
            className="group relative flex items-center"
          >
            <div
              onClick={(e) => {
                e.stopPropagation();
                onConditionClick(condition.id);
              }}
              className={cn(
                "flex-1 px-3 py-2 bg-white border border-purple-200 rounded-md",
                "text-xs text-purple-800 font-medium cursor-pointer",
                "hover:border-purple-400 hover:bg-purple-50 transition-colors",
                "flex items-center gap-2"
              )}
            >
              <span className="text-purple-600 font-semibold">SE</span>
              <span className="flex-1 truncate">
                {condition.comparisons.length > 0 ? (
                  condition.comparisons.map((comp, compIdx) => (
                    <span key={comp.id}>
                      {compIdx > 0 && (
                        <span className="text-purple-500 mx-1">
                          {condition.logicalOperator === "AND" ? "E" : "OU"}
                        </span>
                      )}
                      <span className="bg-orange-400 text-white px-1 py-0.5 rounded text-[10px]">
                        {comp.variableName || "?"}
                      </span>
                      <span className="mx-1">{operatorLabels[comp.operator]}</span>
                      {!["is_set", "is_empty"].includes(comp.operator) && (
                        <span className="bg-muted px-1 py-0.5 rounded text-[10px]">
                          {comp.value || "?"}
                        </span>
                      )}
                    </span>
                  ))
                ) : (
                  <span className="text-muted-foreground">Configure...</span>
                )}
              </span>
            </div>
            
            {/* Condition handle - positioned at container edge (half in, half out) */}
            <Handle
              type="source"
              position={Position.Right}
              id={`${node.id}-cond-${condition.id}`}
              style={{ 
                position: 'absolute',
                right: 0,
                top: '50%',
                transform: 'translate(50%, -50%)',
              }}
              className="!bg-purple-500 !w-3 !h-3"
            />
          </div>
        ))}

        {/* Add new condition button */}
        {conditions.length === 0 && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onGroupClick();
            }}
            className={cn(
              "flex-1 px-3 py-2 bg-white border border-dashed border-purple-300 rounded-md",
              "text-xs text-purple-600 font-medium cursor-pointer",
              "hover:border-purple-400 hover:bg-purple-50 transition-colors",
              "flex items-center justify-center gap-2"
            )}
          >
            <Plus className="h-3 w-3" />
            Adicionar condição
          </div>
        )}

        {/* Else/Default handle */}
        <div className="relative flex items-center mt-3 pt-2 border-t border-dashed border-purple-300">
          <div className="flex-1 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-md text-xs text-gray-500 font-medium">
            Senão
          </div>
          <Handle
            type="source"
            position={Position.Right}
            id={`${node.id}-else`}
            style={{ 
              position: 'absolute',
              right: 0,
              top: '50%',
              transform: 'translate(50%, -50%)',
            }}
            className="!bg-gray-400 !w-3 !h-3"
          />
        </div>
      </div>
    </div>
  );
};
