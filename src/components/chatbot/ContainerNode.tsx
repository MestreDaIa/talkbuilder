import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, NodeProps } from 'reactflow';
import { MoreVertical } from "lucide-react";
import { Container, ButtonConfig, ConditionGroup } from "@/types/chatbot";
import { NodeItem } from "./NodeItem";
import { ButtonGroupNodeItem } from "./ButtonGroupNodeItem";
import { ConditionNodeItem } from "./ConditionNodeItem";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ContainerNodeData {
  container: Container;
  onNodeClick: (nodeId: string) => void;
  onRenameContainer?: (containerId: string, nameContainer?: string) => void;
  onButtonClick?: (nodeId: string, buttonId: string) => void;
  onConditionClick?: (nodeId: string, conditionId: string) => void;
  onAddButton?: (nodeId: string, label: string) => void;
  onUpdateButton?: (nodeId: string, buttonId: string, updates: Partial<ButtonConfig>) => void;
  onDeleteButton?: (nodeId: string, buttonId: string) => void;
  onTest: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onDeleteNode: (nodeId: string) => void;
  onDuplicateNode: (nodeId: string) => void;
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
    onRenameContainer,
    onButtonClick,
    onConditionClick,
    onAddButton,
    onUpdateButton,
    onDeleteButton,
    onTest,
    onDuplicate,
    onDelete,
    onDeleteNode,
    onDuplicateNode,
    onNodeDrop,
  } = data;
  const [isDragOver, setIsDragOver] = useState(false);
  const [insertIndex, setInsertIndex] = useState<number | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const nodesListRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isEditingContainerNameNode, setIsEditingContainerNameNode] = useState(false);
  const fallbackContainerName = `BLOCO #${container.id.slice(-6)}`;
  const [nameContainerNode, setNameContainerNode] = useState(container.nameContainer || fallbackContainerName);

  useEffect(() => {
    if (!isEditingContainerNameNode) {
      setNameContainerNode(container.nameContainer || fallbackContainerName);
    }
  }, [container.nameContainer, fallbackContainerName, isEditingContainerNameNode]);

  const commitContainerName = () => {
    const normalizedName = nameContainerNode.trim();
    setNameContainerNode(normalizedName || fallbackContainerName);
    setIsEditingContainerNameNode(false);
    onRenameContainer?.(container.id, normalizedName || undefined);
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      window.addEventListener('pointerdown', handlePointerDown);
    }

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMenuOpen]);

  const handleMenuAction = (action: () => void) => {
    setIsMenuOpen(false);
    action();
  };

  const hasButtonNode = container.nodes.some(n => n.type === 'input-buttons');
  const hasConditionNode = container.nodes.some(n => n.type === 'condition');
  const hideBottomHandle = hasButtonNode || hasConditionNode;

  const isEntryNode = container.nodes.some(n => n.type === 'start');
  const hideTopHandle = isEntryNode;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);

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
        'relative bg-card py-1 px-0 rounded-xl shadow-xl border border-border w-[290px] transition-all duration-200',
        'ring-1 ring-primary/10 hover:ring-primary/30',
        isDragOver && 'ring-2 ring-green-500 border-green-500 bg-green-500/5',
        (data.container.id && (data as any).selected) ? 'ring-2 ring-primary border-primary shadow-primary/20 z-[100]' : 'z-10'
      )}
    >
      <div
        className="bg-card p-4 pr-6 rounded-lg"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {!hideTopHandle && (
          <Handle type="target" position={Position.Top} className="!bg-green-600 !w-4 !h-4 -top-2" />
        )}

        <div className="flex items-center justify-between gap-2 mb-4 rounded-md nodrag pointer-events-auto min-w-0">
          {isEditingContainerNameNode ? (
            <input
              type="text"
              value={nameContainerNode}
              autoFocus
              onChange={(e) => setNameContainerNode(e.target.value)}
              onBlur={commitContainerName}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur();
                }
                if (e.key === 'Escape') {
                  setNameContainerNode(container.nameContainer || fallbackContainerName);
                  setIsEditingContainerNameNode(false);
                }
              }}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder='Renomear Bloco'
              className="rounded-md p-1.5 pl-2 placeholder:text-black focus:bg-gray-100/5 text-sm w-full focus:outline-none bg-gray-100/5 text-violet-800 text-left"
            />
          ) : (
            <h3
              onClick={(e) => {
                e.stopPropagation();
                setIsEditingContainerNameNode(true);
              }}
              title={nameContainerNode || `Bloco #${container.id.slice(-6)}`}
              className="rounded-md p-1.5 w-full min-w-0 pl-2 border border-border/40 text-sm text-foreground px-0.5 cursor-text text-left truncate whitespace-nowrap overflow-hidden"
            >
              {nameContainerNode || <span className='text-muted-foreground italic text-left'>{`Bloco #${container.id.slice(-6)}`}</span>}
            </h3>
          )}

          <div ref={menuRef} className="relative ml-2 shrink-0 nodrag nopan">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 nodrag"
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
              onClick={(e) => {
                e.stopPropagation();
                setIsMenuOpen((prev) => !prev);
              }}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>

            {isMenuOpen && (
              <div className="absolute right-0 top-10 z-50 min-w-36 overflow-hidden rounded-md border border-border bg-popover shadow-md">
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction(onTest);
                  }}
                >
                  Testar
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-popover-foreground hover:bg-accent hover:text-accent-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction(onDuplicate);
                  }}
                >
                  Duplicar
                </button>
                <button
                  type="button"
                  className="block w-full px-3 py-2 text-left text-sm text-destructive hover:bg-accent"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleMenuAction(onDelete);
                  }}
                >
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>

        <div ref={nodesListRef} className="space-y-2 nodrag nopan pointer-events-auto">
          {container.nodes.length === 0 ? (
            isDragOver ? <InsertPreview /> : (
              <div className="text-xs text-muted-foreground text-center py-8 border-2 border-dashed rounded-lg">
                Arraste nodes para cá
              </div>
            )
          ) : (
            <>
              {container.nodes.map((node, idx) => (
                <div key={node.id} className="pointer-events-auto">
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
                        onDelete={() => onDeleteNode(node.id)}
                        onDuplicate={() => onDuplicateNode(node.id)}
                      />
                    ) : node.type === 'condition' ? (
                      <ConditionNodeItem
                        node={node}
                        nodeIndex={idx}
                        onGroupClick={() => onNodeClick(node.id)}
                        onConditionClick={(conditionId) => onConditionClick?.(node.id, conditionId)}
                        onDelete={() => onDeleteNode(node.id)}
                        onDuplicate={() => onDuplicateNode(node.id)}
                      />
                    ) : (
                      <NodeItem
                        node={node}
                        onClick={() => onNodeClick(node.id)}
                        onDelete={() => onDeleteNode(node.id)}
                        onDuplicate={() => onDuplicateNode(node.id)}
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
        {/* Removidos handles específicos de set-variable para usar os handles padrão do container */}

        {!hideBottomHandle && (
          <Handle type="source" position={Position.Bottom} className="!bg-green-600 !w-4 !h-4 -bottom-2" />
        )}
      </div>
    </div>
  );
});

ContainerNode.displayName = 'ContainerNode';
