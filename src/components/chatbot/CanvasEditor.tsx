import React, { useCallback, useState, useEffect, useRef } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  Connection,
  Edge as FlowEdge,
  Node as FlowNode,
  NodeTypes,
  EdgeTypes,
  NodeDragHandler,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Container, Node, NodeConfig, Edge, ButtonConfig } from "@/types/chatbot";
import { ContainerNode } from "./ContainerNode";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { ButtonEdge } from "./ButtonEdge";
import { SingleButtonConfig } from "./nodesConfigs/NodesInputsConfig/SingleButtonConfig";
import { toast } from "sonner";
import { Copy, Trash2, X, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CanvasEditorProps {
  containers: Container[];
  onContainersChange: (containers: Container[]) => void;
  onTest: (container: Container) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  edges?: Edge[];
  onGetCenterPosition?: (getter: () => { x: number; y: number }) => void;
}

const nodeTypes: NodeTypes = {
  container: ContainerNode,
};

const edgeTypes: EdgeTypes = {
  buttonedge: ButtonEdge,
};

const defaultEdgeOptions = {
  type: 'buttonedge',
  focusable: true,
  selectable: true,
};

// Inner component that has access to useReactFlow
const CanvasContent = ({ 
  containers, 
  onContainersChange, 
  onTest, 
  onEdgesChangeProp, 
  propEdges,
  onGetCenterPosition 
}: {
  containers: Container[];
  onContainersChange: (containers: Container[]) => void;
  onTest: (container: Container) => void;
  onEdgesChangeProp?: (edges: Edge[]) => void;
  propEdges: Edge[];
  onGetCenterPosition?: (getter: () => { x: number; y: number }) => void;
}) => {
  const [selectedNode, setSelectedNode] = useState<{ containerId: string; node: Node } | null>(null);
  const [selectedButton, setSelectedButton] = useState<{
    nodeId: string;
    containerId: string;
    button: ButtonConfig;
  } | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const containersRef = useRef(containers);
  const reactFlowInstance = useReactFlow();
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [selectionBox, setSelectionBox] = useState<{ start: { x: number; y: number }; end: { x: number; y: number } } | null>(null);
  const [showMultiSelectMenu, setShowMultiSelectMenu] = useState<{ x: number; y: number } | null>(null);
  const [selectedContainerIds, setSelectedContainerIds] = useState<string[]>([]);
  const [accumulatedSelectedIds, setAccumulatedSelectedIds] = useState<Set<string>>(new Set());

  // Expose viewport center getter
  useEffect(() => {
    if (onGetCenterPosition) {
      onGetCenterPosition(() => {
        const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
        if (!reactFlowBounds) return { x: 300, y: 200 };

        const center = reactFlowInstance.screenToFlowPosition({
          x: reactFlowBounds.left + reactFlowBounds.width / 2,
          y: reactFlowBounds.top + reactFlowBounds.height / 2
        });

        return center;
      });
    }
  }, [reactFlowInstance, onGetCenterPosition]);

  // Keep ref in sync
  useEffect(() => {
    containersRef.current = containers;
  }, [containers]);

  // Persist position when node drag ends
  const onNodeDragStop: NodeDragHandler = useCallback((event, node) => {
    const updatedContainers = containersRef.current.map(container => {
      if (container.id === node.id) {
        return { ...container, position: node.position };
      }
      return container;
    });
    onContainersChange(updatedContainers);
  }, [onContainersChange]);

  const findNodeInContainers = useCallback((nodeId: string) => {
    for (const container of containers) {
      const node = container.nodes.find(n => n.id === nodeId);
      if (node) {
        return { containerId: container.id, node };
      }
    }
    return null;
  }, [containers]);

  const handleNodeClick = useCallback((nodeId: string) => {
    const result = findNodeInContainers(nodeId);
    if (result) {
      setSelectedNode(result);
    }
  }, [findNodeInContainers]);

  const handleDuplicate = useCallback((containerId: string) => {
    const containerToDuplicate = containers.find(c => c.id === containerId);
    if (!containerToDuplicate) return;

    const baseName =
      containerToDuplicate.nameContainer ||
      `BLOCO #${containerToDuplicate.id.slice(-6)}`;

    const newContainer: Container = {
      id: `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nameContainer: `${baseName} - copy`,
      nodes: containerToDuplicate.nodes.map(node => ({
        ...node,
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      })),
      position: {
        x: containerToDuplicate.position.x + 320,
        y: containerToDuplicate.position.y,
      },
    };

    onContainersChange([...containers, newContainer]);
    toast.success("Bloco duplicado!");
  }, [containers, onContainersChange]);

  const handleDelete = useCallback((containerId: string) => {
    const updatedContainers = containers.filter(c => c.id !== containerId);
    onContainersChange(updatedContainers);
    toast.success("Bloco excluído!");
  }, [containers, onContainersChange]);

  const handleNodeDrop = useCallback((nodeId: string, targetContainerId: string, insertIndex?: number) => {
    const sourceData = findNodeInContainers(nodeId);
    if (!sourceData || sourceData.containerId === targetContainerId) return;

    const updatedContainers = containers.map(container => {
      if (container.id === sourceData.containerId) {
        return {
          ...container,
          nodes: container.nodes.filter(n => n.id !== nodeId)
        };
      }
      if (container.id === targetContainerId) {
        const newNodes = [...container.nodes];
        const idx = insertIndex ?? newNodes.length;
        newNodes.splice(idx, 0, sourceData.node);
        return { ...container, nodes: newNodes };
      }
      return container;
    });

    onContainersChange(updatedContainers);
    toast.success("Node movido!");
  }, [containers, findNodeInContainers, onContainersChange]);

  const handleSaveConfig = useCallback((config: NodeConfig) => {
    if (!selectedNode) return;

    const updatedContainers = containers.map(container => {
      if (container.id === selectedNode.containerId) {
        return {
          ...container,
          nodes: container.nodes.map(node =>
            node.id === selectedNode.node.id
              ? { ...node, config }
              : node
          )
        };
      }
      return container;
    });

    onContainersChange(updatedContainers);
    toast.success("Configuração salva!");
  }, [selectedNode, containers, onContainersChange]);

  // Button group handlers - open individual button config
  const handleButtonClick = useCallback((nodeId: string, buttonId: string) => {
    const result = findNodeInContainers(nodeId);
    if (result && result.node.type === 'input-buttons') {
      const buttons = (result.node.config.buttons || []) as ButtonConfig[];
      const button = buttons.find(b => b.id === buttonId);
      if (button) {
        setSelectedButton({
          nodeId,
          containerId: result.containerId,
          button,
        });
      }
    }
  }, [findNodeInContainers]);

  const handleAddButton = useCallback((nodeId: string, label: string) => {
    const updatedContainers = containers.map(container => ({
      ...container,
      nodes: container.nodes.map(node => {
        if (node.id === nodeId && node.type === 'input-buttons') {
          const currentButtons = node.config.buttons || [];
          const newButton = {
            id: `btn-${Date.now()}`,
            label,
          };
          return {
            ...node,
            config: {
              ...node.config,
              buttons: [...currentButtons, newButton],
            },
          };
        }
        return node;
      }),
    }));
    onContainersChange(updatedContainers);
  }, [containers, onContainersChange]);

  const handleUpdateButton = useCallback((nodeId: string, buttonId: string, updates: Partial<{ label: string; value: string; description: string }>) => {
    const updatedContainers = containers.map(container => ({
      ...container,
      nodes: container.nodes.map(node => {
        if (node.id === nodeId && node.type === 'input-buttons') {
          const currentButtons = (node.config.buttons || []) as Array<{ id: string; label: string; value?: string; description?: string }>;
          return {
            ...node,
            config: {
              ...node.config,
              buttons: currentButtons.map(btn =>
                btn.id === buttonId ? { ...btn, ...updates } : btn
              ),
            },
          };
        }
        return node;
      }),
    }));
    onContainersChange(updatedContainers);
  }, [containers, onContainersChange]);

  const handleDeleteButton = useCallback((nodeId: string, buttonId: string) => {
    const updatedContainers = containers.map(container => ({
      ...container,
      nodes: container.nodes.map(node => {
        if (node.id === nodeId && node.type === 'input-buttons') {
          const currentButtons = (node.config.buttons || []) as Array<{ id: string }>;
          return {
            ...node,
            config: {
              ...node.config,
              buttons: currentButtons.filter(btn => btn.id !== buttonId),
            },
          };
        }
        return node;
      }),
    }));
    onContainersChange(updatedContainers);
    toast.success("Botão removido!");
  }, [containers, onContainersChange]);

  // Handler to save individual button (must be after handleUpdateButton)
  const handleSaveButton = useCallback((updates: Partial<ButtonConfig>) => {
    if (!selectedButton) return;
    handleUpdateButton(selectedButton.nodeId, selectedButton.button.id, updates);
    setSelectedButton(null);
  }, [selectedButton, handleUpdateButton]);

  // Handler to delete button from config modal (must be after handleDeleteButton)
  const handleDeleteButtonFromConfig = useCallback(() => {
    if (!selectedButton) return;
    handleDeleteButton(selectedButton.nodeId, selectedButton.button.id);
    setSelectedButton(null);
  }, [selectedButton, handleDeleteButton]);

  const handleNodesChangeWrapper = useCallback((changes: any) => {
    onNodesChange(changes);
  }, [onNodesChange]);

  const onConnect = useCallback(
    (params: Connection | FlowEdge) => {
      setEdges((eds: FlowEdge[]) => {
        const newEdges = addEdge({ ...params, type: 'buttonedge' }, eds);
        if (onEdgesChangeProp) {
          onEdgesChangeProp(newEdges.map((e: FlowEdge) => ({
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined
          })));
        }
        return newEdges;
      });
    },
    [setEdges, onEdgesChangeProp]
  );

  // Update ReactFlow nodes when containers change.
  // IMPORTANT: depend ONLY on `containers` to avoid re-creating flowNodes on
  // every parent render (which caused containers to "disappear" right after
  // being added because handlers/refs were churned each render).
  useEffect(() => {
    setNodes((currentNodes: FlowNode[]) => {
      const next: FlowNode[] = containers.map((container) => {
        const existing = currentNodes.find((n: FlowNode) => n.id === container.id);
        return {
          id: container.id,
          type: 'container',
          position: existing?.position ?? container.position,
          data: {
            container,
            onNodeClick: handleNodeClick,
            onButtonClick: handleButtonClick,
            onAddButton: handleAddButton,
            onUpdateButton: handleUpdateButton,
            onDeleteButton: handleDeleteButton,
            onTest: () => onTest(container),
            onDuplicate: () => handleDuplicate(container.id),
            onDelete: () => handleDelete(container.id),
            onNodeDrop: handleNodeDrop,
          },
        } as unknown as FlowNode;
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containers]);

  // Update edges from props (including empty array)
  useEffect(() => {
    setEdges((currentEdges) => {
      const flowEdges = propEdges.map((e, idx) => {
        // Try to keep existing ID if possible to avoid ReactFlow re-rendering
        const existing = currentEdges.find(ce => ce.source === e.source && ce.target === e.target && ce.sourceHandle === e.sourceHandle);
        return {
          id: existing?.id || `edge-${e.source}-${e.target}-${e.sourceHandle || 'default'}-${idx}`,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle,
          type: 'buttonedge',
          selected: existing?.selected || false,
        };
      });
      return flowEdges;
    });
  }, [propEdges, setEdges]);

  // Sync edge deletions from ReactFlow back to parent
  const handleEdgesChangeWrapper = useCallback((changes: any) => {
    onEdgesChange(changes);
    
    // Notify parent whenever edges change
    // We use a small delay to ensure the state has been updated by useEdgesState
    setTimeout(() => {
      const currentEdges = reactFlowInstance.getEdges();
      if (onEdgesChangeProp) {
        onEdgesChangeProp(currentEdges.map((e: FlowEdge) => ({
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle || undefined
        })));
      }
    }, 0);
  }, [onEdgesChange, onEdgesChangeProp, reactFlowInstance]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  const getRelativePos = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement)
      .closest('.react-flow')
      ?.getBoundingClientRect();
    if (!rect) return { x: event.clientX, y: event.clientY };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const onPaneMouseDown = useCallback((event: React.MouseEvent) => {
    // Right click (button 2) starts selection
    if (event.button === 2) {
      const pos = getRelativePos(event);
      setSelectionBox({ start: pos, end: pos });
      setIsSelectionActive(true);
      setShowMultiSelectMenu(null);
      setAccumulatedSelectedIds(new Set());
    } else {
      // Left click on pane clears selection
      setSelectedContainerIds([]);
      setAccumulatedSelectedIds(new Set());
      setShowMultiSelectMenu(null);
    }
  }, []);

  const onPaneMouseMove = useCallback((event: React.MouseEvent) => {
    if (isSelectionActive && selectionBox) {
      const pos = getRelativePos(event);
      const newSelectionBox = { ...selectionBox, end: pos };
      setSelectionBox(newSelectionBox);

      // Perform real-time selection to accumulate nodes
      const rect = (event.currentTarget as HTMLElement)
        .closest('.react-flow')
        ?.getBoundingClientRect();
      
      if (rect) {
        const startFlow = reactFlowInstance.screenToFlowPosition({
          x: newSelectionBox.start.x + rect.left,
          y: newSelectionBox.start.y + rect.top,
        });
        const endFlow = reactFlowInstance.screenToFlowPosition({
          x: pos.x + rect.left,
          y: pos.y + rect.top,
        });

        const minX = Math.min(startFlow.x, endFlow.x);
        const maxX = Math.max(startFlow.x, endFlow.x);
        const minY = Math.min(startFlow.y, endFlow.y);
        const maxY = Math.max(startFlow.y, endFlow.y);

        const nodesInBox = nodes.filter((node) => {
          const { x, y } = node.position;
          const nodeWidth = 305;
          const nodeHeight = 200;
          return x < maxX && x + nodeWidth > minX && y < maxY && y + nodeHeight > minY;
        });

        if (nodesInBox.length > 0) {
          setAccumulatedSelectedIds(prev => {
            const next = new Set(prev);
            nodesInBox.forEach(node => next.add(node.id));
            return next;
          });
        }
      }

      // Auto-scroll when near edges
      const flowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (flowBounds) {
        const threshold = 50;
        const scrollSpeed = 10;
        let dx = 0;
        let dy = 0;

        if (event.clientX < flowBounds.left + threshold) dx = scrollSpeed;
        else if (event.clientX > flowBounds.right - threshold) dx = -scrollSpeed;

        if (event.clientY < flowBounds.top + threshold) dy = scrollSpeed;
        else if (event.clientY > flowBounds.bottom - threshold) dy = -scrollSpeed;

        if (dx !== 0 || dy !== 0) {
          const { x, y, zoom } = reactFlowInstance.getViewport();
          reactFlowInstance.setViewport({ x: x + dx, y: y + dy, zoom }, { duration: 0 });
        }
      }
    }
  }, [isSelectionActive, selectionBox, reactFlowInstance, nodes]);

  const onPaneMouseUp = useCallback((event: React.MouseEvent) => {
    if (isSelectionActive && selectionBox) {
      const finalSelectedIds = Array.from(accumulatedSelectedIds);
      setSelectedContainerIds(finalSelectedIds);

      if (finalSelectedIds.length > 0) {
        setShowMultiSelectMenu({ x: event.clientX, y: event.clientY });
      }

      setIsSelectionActive(false);
      setSelectionBox(null);
    }
  }, [isSelectionActive, selectionBox, accumulatedSelectedIds]);

  const handleMultiDelete = useCallback(() => {
    if (selectedContainerIds.length === 0) return;
    const updatedContainers = containers.filter(c => !selectedContainerIds.includes(c.id));
    onContainersChange(updatedContainers);
    setSelectedContainerIds([]);
    setShowMultiSelectMenu(null);
    toast.success(`${selectedContainerIds.length} blocos excluídos!`);
  }, [selectedContainerIds, containers, onContainersChange]);

  const handleMultiDuplicate = useCallback(() => {
    if (selectedContainerIds.length === 0) return;
    
    const containersToDuplicate = containers.filter(c => selectedContainerIds.includes(c.id));
    const newContainers: Container[] = containersToDuplicate.map(c => ({
      ...c,
      id: `container-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      nameContainer: c.nameContainer ? `${c.nameContainer} - cópia` : undefined,
      position: { x: c.position.x + 50, y: c.position.y + 50 },
      nodes: c.nodes.map(node => ({
        ...node,
        id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      }))
    }));

    onContainersChange([...containers, ...newContainers]);
    setSelectedContainerIds([]);
    setShowMultiSelectMenu(null);
    toast.success(`${newContainers.length} blocos duplicados!`);
  }, [selectedContainerIds, containers, onContainersChange]);

  return (
    <>

      <ReactFlow
        nodes={nodes.map(n => ({
          ...n,
          selected: selectedContainerIds.includes(n.id)
        }))}
        edges={edges}
        onNodesChange={handleNodesChangeWrapper}
        onEdgesChange={handleEdgesChangeWrapper}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        proOptions={{ hideAttribution: true }}
        fitView
        className="flex flex-grow h-full"
        onMouseDown={onPaneMouseDown}
        onMouseMove={onPaneMouseMove}
        onMouseUp={onPaneMouseUp}
        onContextMenu={handleContextMenu}
        deleteKeyCode={null} // Desabilita delete nativo para evitar conflitos se desejar
      >
        <Background className="bg-cyan-950/80 flex-1 w-full" />
        <Controls position="bottom-left" className="z-10" />
        <MiniMap className="bg-card" />

        {selectionBox && (
          <div
            className="absolute border-2 border-primary bg-primary/10 pointer-events-none z-50"
            style={{
              left: Math.min(selectionBox.start.x, selectionBox.end.x),
              top: Math.min(selectionBox.start.y, selectionBox.end.y),
              width: Math.abs(selectionBox.start.x - selectionBox.end.x),
              height: Math.abs(selectionBox.start.y - selectionBox.end.y),
            }}
          />
        )}

        {showMultiSelectMenu && (
          <Panel position="top-right" className="m-4">
            <div 
              className="flex items-center gap-1 p-1.5 bg-card border border-border rounded-lg shadow-2xl animate-in fade-in zoom-in duration-200"
              onMouseDown={(e) => {
                e.stopPropagation();
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
            >
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="xs" className="px-2 h-8 gap-1 hover:bg-primary/10">
                    <span className="text-xs font-medium text-muted-foreground mr-1">
                      {selectedContainerIds.length} selecionados
                    </span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="start">
                  <div className="p-2 border-b bg-muted/30">
                    <h4 className="text-xs font-semibold">Blocos Selecionados</h4>
                  </div>
                  <ScrollArea className="h-64">
                    <div className="p-1">
                      {selectedContainerIds.map((id) => {
                        const container = containers.find(c => c.id === id);
                        return (
                          <div key={id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded-sm">
                            <Checkbox 
                              id={`select-${id}`}
                              checked={selectedContainerIds.includes(id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedContainerIds(prev => [...prev, id]);
                                  setAccumulatedSelectedIds(prev => new Set(prev).add(id));
                                } else {
                                  setSelectedContainerIds(prev => prev.filter(i => i !== id));
                                  setAccumulatedSelectedIds(prev => {
                                    const next = new Set(prev);
                                    next.delete(id);
                                    return next;
                                  });
                                }
                              }}
                            />
                            <label 
                              htmlFor={`select-${id}`}
                              className="text-xs truncate flex-1 cursor-pointer"
                            >
                              {container?.nameContainer || `Bloco ${id.slice(-4)}`}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>

              <div className="w-[1px] h-4 bg-border mx-1" />

              <Button 
                variant="ghost" 
                size="xs" 
                className="h-8 gap-1.5 px-2 hover:bg-primary/10 hover:text-primary"
                onClick={handleMultiDuplicate}
              >
                <Copy className="w-3.5 h-3.5" />
                Duplicar
              </Button>
              <Button 
                variant="ghost" 
                size="xs" 
                className="h-8 gap-1.5 px-2 hover:bg-destructive/10 hover:text-destructive"
                onClick={handleMultiDelete}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </Button>
              <Button 
                variant="ghost" 
                size="icon-xs" 
                className="h-8 w-8 ml-1"
                onClick={() => {
                  setShowMultiSelectMenu(null);
                  setSelectedContainerIds([]);
                  setAccumulatedSelectedIds(new Set());
                }}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </Panel>
        )}
      </ReactFlow>

      <NodeConfigDialog
        node={selectedNode?.node || null}
        open={selectedNode !== null}
        onClose={() => setSelectedNode(null)}
        onSave={handleSaveConfig}
        containers={containers}
      />

      <SingleButtonConfig
        button={selectedButton?.button || null}
        open={selectedButton !== null}
        onClose={() => setSelectedButton(null)}
        onSave={handleSaveButton}
        onDelete={handleDeleteButtonFromConfig}
      />
    </>
  );
};

export const CanvasEditor = ({ containers, onContainersChange, onTest, onEdgesChange: onEdgesChangeProp, edges: propEdges = [], onGetCenterPosition }: CanvasEditorProps) => {
  return (
    <main className="flex flex-1 w-full h-full bg-gray-950">
      <ReactFlowProvider>
        <CanvasContent
          containers={containers}
          onContainersChange={onContainersChange}
          onTest={onTest}
          onEdgesChangeProp={onEdgesChangeProp}
          propEdges={propEdges}
          onGetCenterPosition={onGetCenterPosition}
        />
      </ReactFlowProvider>
    </main>
  );
};
