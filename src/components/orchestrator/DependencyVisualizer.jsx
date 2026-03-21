/**
 * Dependency Visualizer
 * Shows multi-step automation dependencies as a graph
 */
import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function DependencyVisualizer({ graph = { nodes: [], edges: [] }, automations = [] }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !graph.nodes || graph.nodes.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = 'rgba(5, 7, 20, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Simple layout: arrange by system
    const systems = [...new Set(graph.nodes.map(n => n.system))];
    const nodePositions = {};
    const nodeWidth = 160;
    const nodeHeight = 50;
    const padding = 40;

    // Position nodes by system
    systems.forEach((system, idx) => {
      const systemNodes = graph.nodes.filter(n => n.system === system);
      const x = padding + idx * (nodeWidth + 60);
      systemNodes.forEach((node, nidx) => {
        const y = padding + nidx * (nodeHeight + 40);
        nodePositions[node.id] = { x, y };
      });
    });

    // Draw edges
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.3)';
    ctx.lineWidth = 2;
    graph.edges?.forEach(edge => {
      const from = nodePositions[edge.source];
      const to = nodePositions[edge.target];
      if (from && to) {
        ctx.beginPath();
        ctx.moveTo(from.x + nodeWidth / 2, from.y + nodeHeight / 2);
        ctx.lineTo(to.x + nodeWidth / 2, to.y + nodeHeight / 2);
        ctx.stroke();
      }
    });

    // Draw nodes
    graph.nodes?.forEach(node => {
      const pos = nodePositions[node.id];
      if (!pos) return;

      // Node background
      ctx.fillStyle = node.color + '20';
      ctx.strokeStyle = node.color + '80';
      ctx.lineWidth = 2;
      ctx.fillRect(pos.x, pos.y, nodeWidth, nodeHeight);
      ctx.strokeRect(pos.x, pos.y, nodeWidth, nodeHeight);

      // Node text
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(node.label.substring(0, 20), pos.x + nodeWidth / 2, pos.y + nodeHeight / 2 - 5);

      ctx.font = '9px sans-serif';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillText(node.system, pos.x + nodeWidth / 2, pos.y + nodeHeight / 2 + 10);
    });
  }, [graph]);

  if (!graph.nodes || graph.nodes.length === 0) {
    return (
      <Card className="p-8 bg-slate-900/50 border-slate-800 flex flex-col items-center justify-center h-64">
        <AlertCircle className="w-8 h-8 text-slate-500 mb-3" />
        <p className="text-slate-400">No automations configured yet</p>
      </Card>
    );
  }

  // Group nodes by system
  const systemGroups = {};
  graph.nodes.forEach(node => {
    if (!systemGroups[node.system]) systemGroups[node.system] = [];
    systemGroups[node.system].push(node);
  });

  return (
    <div className="space-y-4">
      {/* Canvas Visualization */}
      <Card className="p-4 bg-slate-900/50 border-slate-800">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full border border-slate-700 rounded-lg bg-slate-950"
        />
      </Card>

      {/* System Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {Object.entries(systemGroups).map(([system, nodes]) => (
          <Card key={system} className="p-3 bg-slate-800/50 border-slate-700">
            <p className="text-xs font-semibold text-slate-400 mb-2">{system}</p>
            <div className="space-y-1">
              {nodes.map(node => (
                <div key={node.id} className="flex items-center gap-2">
                  {node.type === 'trigger' ? (
                    <Activity className="w-3 h-3 text-amber-400" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  )}
                  <span className="text-[10px] text-slate-300 truncate">
                    {node.label}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}