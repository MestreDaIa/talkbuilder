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
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Container, Node, NodeConfig, Edge, ButtonConfig } from "@/types/chatbot";
import { ContainerNode } from "./ContainerNode";
import { NodeConfigDialog } from "./NodeConfigDialog";
import { ButtonEdge } from "./ButtonEdge";
import { SingleButtonConfig } from "./nodesConfigs/NodesInputsConfig/SingleButtonConfig";
import { toast } from "sonner";

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

  // Expose viewport center getter
  useEffect(() => {
    if (onGetCenterPosition) {
      onGetCenterPosition(() => {
        const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
        if (!reactFlowBounds) return { x: 300, y: 200 };

        const screenCenterX = reactFlowBounds.width / 2;
        const screenCenterY = reactFlowBounds.height / 2;

        const flowPosition = reactFlowInstance.screenToFlowPosition({
          x: screenCenterX + reactFlowBounds.left,
          y: screenCenterY + reactFlowBounds.top
        });

        return flowPosition;
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

    const newContainer: Container = {
      id: `container-${Date.now()}`,
      nodes: containerToDuplicate.nodes.map(node => ({
        ...node,
        id: `node-${Date.now()}-${Math.random()}`
      })),
      position: {
        x: containerToDuplicate.position.x + 320,
        y: containerToDuplicate.position.y
      }
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
      setEdges((eds) => {
        const newEdges = addEdge(params, eds);
        if (onEdgesChangeProp) {
          onEdgesChangeProp(newEdges.map(e => ({
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

  // Update ReactFlow nodes when containers change
  useEffect(() => {
    const flowNodes: FlowNode[] = containers.map((container) => ({
      id: container.id,
      type: 'container',
      position: container.position,
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
    }));
    setNodes(flowNodes);
  }, [containers, handleNodeClick, handleButtonClick, handleAddButton, handleUpdateButton, handleDeleteButton, onTest, handleDuplicate, handleDelete, handleNodeDrop, setNodes]);

  // Update edges from props (including empty array)
  useEffect(() => {
    const flowEdges = propEdges.map((e, idx) => ({
      id: `edge-${idx}`,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      type: 'buttonedge',
    }));
    setEdges(flowEdges);
  }, [propEdges, setEdges]);

  // Sync edge deletions from ReactFlow back to parent
  const handleEdgesChangeWrapper = useCallback((changes: any) => {
    onEdgesChange(changes);
    // After applying changes, sync with parent state
    setTimeout(() => {
      setEdges((currentEdges) => {
        if (onEdgesChangeProp) {
          onEdgesChangeProp(currentEdges.map(e => ({
            source: e.source,
            target: e.target,
            sourceHandle: e.sourceHandle || undefined
          })));
        }
        return currentEdges;
      });
    }, 0);
  }, [onEdgesChange, onEdgesChangeProp, setEdges]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChangeWrapper}
        onEdgesChange={handleEdgesChangeWrapper}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ type: 'buttonedge' }}
        proOptions={{ hideAttribution: true }}
        fitView
        className="flex flex-grow h-full"
      >
        <Background className="bg-cyan-950/80 flex-1 w-full" />
        <Controls position="bottom-left" className="z-10" />
        <MiniMap className="bg-card" />
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
