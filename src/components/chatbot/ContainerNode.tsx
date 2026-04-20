import { memo, useState, useRef } from "react";
import { Handle, Position, NodeProps } from 'reactflow';
import { MoreVertical } from "lucide-react";
import { Container, Node, ButtonConfig, ConditionGroup } from "@/types/chatbot";
import { NodeItem } from "./NodeItem";
import { ButtonGroupNodeItem } from "./ButtonGroupNodeItem";
import { ConditionNodeItem } from "./ConditionNodeItem";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface ContainerNodeData {
  container: Container;
  onNodeClick: (nodeId: string) => void;
  onButtonClick?: (nodeId: string, buttonId: string) => void;
  onConditionClick?: (nodeId: string, conditionId: string) => void;
  onAddButton?: (nodeId: string, label: string) => void;
  onUpdateButton?: (nodeId: string, buttonId: string, updates: Partial<ButtonConfig>) => void;
  onDeleteButton?: (nodeId: string, buttonId: string) => void;
  onTest: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onNodeDrop: (nodeId: string, targetContainerId: string, insertIndex?: number) => void;
}

const InsertPreview = () => (
  <div className="rounded-lg p-3 border-2 border-dashed border-green-500 bg-green-500/10 flex items-center justify-center gap-2 transition-all duration-200">
    <span className="text-sm text-green-500 font-medium">
      Solte aqui
    </span>
  </div>
);

export const ContainerNode = memo(({ data }: NodeProps<ContainerNodeData>) => {
  const { 
    container, 
    onNodeClick, 
    onButtonClick,
    onConditionClick,
    onAddButton,
    onUpdateButton,
    onDeleteButton,
    onTest, 
    onDuplicate, 
    onDelete, 
    onNodeDrop 
  } = data;
  const [isDragOver, setIsDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const nodesListRef = useRef<HTMLDivElement>(null);

  const [isEditingContainerNameNode, setIsEditingContainerNameNode] = useState(false);
  const [nameContainerNode, setNameContainerNode] = useState(container.nameContainer || `BLOCO #${container.id.slice(-6)}`);

  // Check if container has a button or condition node - if so, don't show bottom handle
  const hasButtonNode = container.nodes.some(n => n.type === 'input-buttons');
  const hasConditionNode = container.nodes.some(n => n.type === 'condition');
  const hideBottomHandle = hasButtonNode || hasConditionNode;
  
  // Check if container is a start node (no input handle) - webhook CAN have input
  const isEntryNode = container.nodes.some(n => n.type === 'start');
  const hideTopHandle = isEntryNode;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
    
    // Calculate insert index based on mouse Y position
    if (nodesListRef.current && container.nodes.length > 0) {
      const containerRect = nodesListRef.current.getBoundingClientRect();
      const mouseY = e.clientY - containerRect.top;
      
      const nodeElements = nodesListRef.current.querySelectorAll('[data-node-index]');
      let newIndex = container.nodes.length;
      
      nodeElements.forEach((el, idx) => {
        const rect = el.getBoundingClientRect();
        const nodeMiddle = rect.top - containerRect.top + rect.height / 2;
        if (mouseY < nodeMiddle && newIndex === container.nodes.length) {
          newIndex = idx;
        }
      });
      
      setInsertIndex(newIndex);
    } else {
      setInsertIndex(0);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!e.currentTarget.contains(relatedTarget)) {
      setIsDragOver(false);
      setInsertIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    let nodeId = e.dataTransfer.getData('nodeId');
    if (!nodeId) {
      nodeId = e.dataTransfer.getData('text/plain');
    }
    
    if (nodeId) {
      onNodeDrop(nodeId, container.id, insertIndex ?? container.nodes.length);
    }
    
    setIsDragOver(false);
    setInsertIndex(null);
  };

  return (
    <div 
      className={cn(
        'relative bg-card py-1 px-0 rounded-xl shadow-lg border border-border max-w-[300px] transition-all duration-200',
        isDragOver && 'ring-2 ring-green-500 border-green-500 bg-green-50/10'
      )}
    >
      <div
        className="bg-card p-4 rounded-sm"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!hideTopHandle && (
          <Handle type="target" position={Position.Top} className="!bg-green-600 !w-4 !h-4 -top-2" />
        )}

        <div className="flex items-center justify-between mb-4 rounded-md">
        {isEditingContainerNameNode ? (
          <input
            type="text"
            value={nameContainerNode}
            autoFocus
            onChange={(e) => setNameContainerNode(e.target.value)}
            onBlur={() => setIsEditingContainerNameNode(false)}
            placeholder='Renomear Bloco'
            className=" rounded-md p-1.5 pl-2 placeholder:text-black focus:bg-gray-100/5 text-sm w-full focus:outline-none bg-gray-100/5 text-violet-800"
          />
        ) : (
              <h3 onClick={() => setIsEditingContainerNameNode(true)} className="rounded-md p-1.5 w-full pl-2 border border-border/40 text-sm text-foreground px-0.5">{nameContainerNode || <span className='text-muted-foreground italic'>{`Bloco #${container.id.slice(-6)}`}</span>}</h3>
        )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onTest}>
                Testar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDuplicate}>
                Duplicar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                Excluir
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div ref={nodesListRef} className="space-y-2 nodrag nopan">
          {container.nodes.length === 0 ? (
            isDragOver ? <InsertPreview /> : (
              <div className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                Arraste nodes para cá
              </div>
            )
          ) : (
            <>
              {container.nodes.map((node, idx) => (
                <div key={node.id}>
                  {isDragOver && insertIndex === idx && <InsertPreview />}
                  <div data-node-index={idx}>
                    {node.type === 'input-buttons' ? (
                      <ButtonGroupNodeItem
                        node={node}
                        nodeIndex={idx}
                        onGroupClick={() => onNodeClick(node.id)}
                        onButtonClick={(buttonId) => onButtonClick?.(node.id, buttonId)}
                        onAddButton={(label) => onAddButton?.(node.id, label)}
                        onUpdateButton={(buttonId, updates) => onUpdateButton?.(node.id, buttonId, updates)}
                        onDeleteButton={(buttonId) => onDeleteButton?.(node.id, buttonId)}
                      />
                    ) : node.type === 'condition' ? (
                      <ConditionNodeItem
                        node={node}
                        nodeIndex={idx}
                        onGroupClick={() => onNodeClick(node.id)}
                        onConditionClick={(conditionId) => onConditionClick?.(node.id, conditionId)}
                      />
                    ) : (
                      <NodeItem
                        node={node}
                        onClick={() => onNodeClick(node.id)}
                      />
                    )}
                  </div>
                </div>
              ))}
              {isDragOver && insertIndex === container.nodes.length && <InsertPreview />}
            </>
          )}
        </div>

        {/* Handles para outros tipos de nodes (exceto input-buttons e condition que tem handles internos) */}
        {container.nodes.map((node) => {
          if (node.type === 'set-variable') {
            return (
              <div key={node.id}>
                <Handle type="target" position={Position.Left} id={`${node.id}-target`} />
                <Handle type="source" position={Position.Right} id={`${node.id}-source`} />
              </div>
            );
          }
          return null;
        })}

        {!hideBottomHandle && (
          <Handle type="source" position={Position.Bottom} className="!bg-green-600 !w-4 !h-4 -bottom-2" />
        )}
      </div>
    </div>
  );
});

ContainerNode.displayName = 'ContainerNode';
