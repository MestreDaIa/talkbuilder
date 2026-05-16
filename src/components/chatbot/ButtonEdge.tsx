import React from 'react';
import { 
  BaseEdge, 
  EdgeLabelRenderer, 
  getBezierPath, 
  useReactFlow,
  type EdgeProps 
} from 'reactflow';
import { X } from 'lucide-react';

export function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}: EdgeProps) {
  const { setEdges } = useReactFlow();
  
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const onEdgeClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setEdges((edges) => edges.filter((edge) => edge.id !== id));
  };

  return (
    <>
      {/* Invisible wider path for easier click/selection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        className="react-flow__edge-interaction"
      />
      <BaseEdge 
        path={edgePath} 
        markerEnd={markerEnd} 
        style={{
          ...style,
          strokeWidth: selected ? 4 : 2,
          stroke: selected ? '#ef4444' : '#94a3b8',
        }} 
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: 1, // Torna o botão sempre visível para facilitar a exclusão
            transition: 'opacity 0.15s ease-in-out',
          }}
          className="nodrag nopan"
        >
          <button
            className="w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white shadow-lg transition-all hover:scale-110 active:scale-90"
            onClick={onEdgeClick}
            onPointerDown={(e) => e.stopPropagation()}
            title="Excluir conexão"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
