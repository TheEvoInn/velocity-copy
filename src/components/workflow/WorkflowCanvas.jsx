import React, { useState, useRef, useEffect, forwardRef } from 'react';
import { AlertCircle, CheckCircle2, GitBranch } from 'lucide-react';

const NODE_COLORS = {
  trigger: 'from-amber-500 to-amber-600',
  condition: 'from-blue-500 to-blue-600',
  action: 'from-emerald-500 to-emerald-600',
  notification: 'from-cyan-500 to-cyan-600',
  crypto: 'from-purple-500 to-purple-600',
  email: 'from-pink-500 to-pink-600'
};

const WorkflowCanvas = forwardRef(({
  workflow,
  selectedNode,
  onSelectNode,
  onConnect,
  onDeleteNode,
  onUpdateNode,
  simulationMode
}, ref) => {
  const canvasRef = useRef();
  const [isDragging, setIsDragging] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState(null);
  const [nodes, setNodes] = useState(workflow.nodes);

  useEffect(() => {
    setNodes(workflow.nodes);
  }, [workflow.nodes]);

  const handleNodeMouseDown = (e, nodeId) => {
    setIsDragging(nodeId);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - dragOffset.x;
    const y = e.clientY - rect.top - dragOffset.y;

    setNodes(prev =>
      prev.map(n =>
        n.id === isDragging
          ? { ...n, position: { x: Math.max(0, x), y: Math.max(0, y) } }
          : n
      )
    );
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(null);
    }
  };

  const handleNodeClick = (node) => {
    onSelectNode(node);
  };

  const handleConnectStart = (e, nodeId) => {
    e.stopPropagation();
    setConnecting(nodeId);
  };

  const handleConnectEnd = (e, targetId) => {
    e.stopPropagation();
    if (connecting && connecting !== targetId) {
      onConnect(connecting, targetId);
    }
    setConnecting(null);
  };

  return (
    <div
      ref={canvasRef}
      className="w-full h-full bg-gradient-to-br from-slate-950 to-slate-900 rounded-xl relative overflow-hidden border border-slate-800"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{ backgroundImage: 'radial-gradient(circle, rgba(124,58,237,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}
    >
      {/* Connection Lines */}
      <svg className="absolute inset-0 pointer-events-none" width="100%" height="100%">
        {workflow.edges.map(edge => {
          const source = nodes.find(n => n.id === edge.source);
          const target = nodes.find(n => n.id === edge.target);

          if (!source || !target) return null;

          const x1 = source.position.x + 60;
          const y1 = source.position.y + 40;
          const x2 = target.position.x + 60;
          const y2 = target.position.y + 40;

          return (
            <g key={edge.id}>
              <path
                d={`M ${x1} ${y1} Q ${(x1 + x2) / 2} ${Math.max(y1, y2)} ${x2} ${y2}`}
                stroke="rgba(124,58,237,0.4)"
                strokeWidth="2"
                fill="none"
              />
              {edge.condition && (
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 5}
                  className="text-xs fill-violet-300"
                  textAnchor="middle"
                >
                  {edge.condition}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      {nodes.map(node => (
        <div
          key={node.id}
          className={`absolute w-32 cursor-move transition-all ${
            selectedNode?.id === node.id ? 'ring-2 ring-violet-400' : ''
          }`}
          style={{
            left: `${node.position.x}px`,
            top: `${node.position.y}px`,
            transform: 'translate(0, 0)'
          }}
          onMouseDown={e => handleNodeMouseDown(e, node.id)}
        >
          <div
            className={`bg-gradient-to-br ${NODE_COLORS[node.type] || NODE_COLORS.action} rounded-lg p-3 shadow-lg hover:shadow-xl transition-shadow cursor-pointer group`}
            onClick={() => handleNodeClick(node)}
          >
            {/* Node Header */}
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-white/60 group-hover:bg-white transition-colors" />
              <span className="text-xs font-semibold text-white truncate">{node.label}</span>
            </div>

            {/* Node Type Badge */}
            <div className="text-xs text-white/70 bg-black/20 px-2 py-1 rounded mb-2 truncate">
              {node.type}
            </div>

            {/* Connection Points */}
            <div className="flex justify-between">
              {/* Input connector */}
              <div
                className="w-3 h-3 rounded-full bg-white/40 hover:bg-white transition-colors cursor-pointer"
                onMouseDown={e => handleConnectStart(e, node.id)}
                onMouseUp={e => handleConnectEnd(e, node.id)}
                title="Drag to connect"
              />
              {/* Output connector */}
              <div
                className="w-3 h-3 rounded-full bg-white/40 hover:bg-white transition-colors cursor-pointer"
                onMouseDown={e => handleConnectStart(e, node.id)}
                onMouseUp={e => handleConnectEnd(e, node.id)}
                title="Drag to connect"
              />
            </div>
          </div>

          {/* Simulation Status */}
          {simulationMode && (
            <div className="absolute -bottom-8 left-0 right-0 flex justify-center">
              {node.executionStatus === 'success' && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              )}
              {node.executionStatus === 'error' && (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
            </div>
          )}
        </div>
      ))}

      {/* Empty State */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <GitBranch className="w-12 h-12 text-slate-600 mx-auto mb-3 opacity-50" />
            <p className="text-slate-500 text-sm">No nodes yet. Add one from the library →</p>
          </div>
        </div>
      )}
    </div>
  );
});

WorkflowCanvas.displayName = 'WorkflowCanvas';

export default WorkflowCanvas;