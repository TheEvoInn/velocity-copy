import React, { useState, useCallback, useRef } from 'react';
import { Zap, Plus, Trash2, Play, Save, AlertCircle, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import WorkflowCanvas from './WorkflowCanvas';
import NodeLibrary from './NodeLibrary';
import WorkflowValidator from './WorkflowValidator';
import ExecutionSimulator from './ExecutionSimulator';

export default function VisualWorkflowEditor({ workflowId, onSave }) {
  const [workflow, setWorkflow] = useState({
    name: 'New Workflow',
    nodes: [],
    edges: [],
    triggers: ['manual'],
    status: 'draft'
  });

  const [selectedNode, setSelectedNode] = useState(null);
  const [showNodeLibrary, setShowNodeLibrary] = useState(false);
  const [simulationMode, setSimulationMode] = useState(false);
  const [validationErrors, setValidationErrors] = useState([]);
  const canvasRef = useRef();

  // Add node to canvas
  const handleAddNode = useCallback((nodeType) => {
    const newNode = {
      id: `node_${Date.now()}`,
      type: nodeType.type,
      label: nodeType.label,
      position: { x: 200 + Math.random() * 100, y: 200 + Math.random() * 100 },
      data: {},
      department: nodeType.department
    };

    setWorkflow(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode]
    }));
    setShowNodeLibrary(false);
  }, []);

  // Connect two nodes
  const handleConnect = useCallback((sourceId, targetId, condition = '') => {
    const edgeId = `edge_${sourceId}_${targetId}`;
    
    setWorkflow(prev => ({
      ...prev,
      edges: prev.edges.some(e => e.id === edgeId)
        ? prev.edges
        : [...prev.edges, { id: edgeId, source: sourceId, target: targetId, condition }]
    }));
  }, []);

  // Delete node
  const handleDeleteNode = useCallback((nodeId) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.filter(n => n.id !== nodeId),
      edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId)
    }));
    setSelectedNode(null);
  }, []);

  // Update node data
  const handleUpdateNode = useCallback((nodeId, data) => {
    setWorkflow(prev => ({
      ...prev,
      nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, data } : n)
    }));
  }, []);

  // Validate workflow
  const handleValidate = useCallback(() => {
    const errors = [];

    if (!workflow.name || workflow.name.trim() === '') {
      errors.push('Workflow must have a name');
    }

    if (workflow.nodes.length === 0) {
      errors.push('Workflow must have at least one node');
    }

    // Check for isolated nodes (except triggers)
    const connected = new Set();
    workflow.edges.forEach(edge => {
      connected.add(edge.source);
      connected.add(edge.target);
    });

    workflow.nodes.forEach(node => {
      if (node.type !== 'trigger' && !connected.has(node.id)) {
        errors.push(`Node "${node.label}" is isolated (not connected)`);
      }
    });

    // Check for circular dependencies
    if (hasCircularDependency(workflow.nodes, workflow.edges)) {
      errors.push('Workflow contains circular dependencies');
    }

    setValidationErrors(errors);
    return errors.length === 0;
  }, [workflow]);

  // Check for cycles
  const hasCircularDependency = (nodes, edges) => {
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (nodeId) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = edges
        .filter(e => e.source === nodeId)
        .map(e => e.target);

      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (hasCycle(neighbor)) return true;
        } else if (recursionStack.has(neighbor)) {
          return true;
        }
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        if (hasCycle(node.id)) return true;
      }
    }

    return false;
  };

  // Save workflow
  const handleSave = async () => {
    if (!handleValidate()) return;

    try {
      await onSave(workflow);
      alert('Workflow saved successfully');
    } catch (error) {
      alert('Error saving workflow: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400 mb-1">
              Workflow Architect
            </h1>
            <p className="text-sm text-slate-400">Build conditional automation paths across all departments</p>
          </div>
          <div className="flex gap-3">
            {validationErrors.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-xs text-red-300">{validationErrors.length} error(s)</span>
              </div>
            )}
            <Button
              onClick={() => setSimulationMode(!simulationMode)}
              variant="outline"
              className="gap-2"
            >
              <Play className="w-4 h-4" />
              {simulationMode ? 'Exit Simulation' : 'Simulate'}
            </Button>
            <Button
              onClick={handleSave}
              className="gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600"
            >
              <Save className="w-4 h-4" />
              Save Workflow
            </Button>
          </div>
        </div>

        {/* Main Editor */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="glass-card rounded-2xl p-4 h-[600px] relative overflow-hidden">
              <WorkflowCanvas
                ref={canvasRef}
                workflow={workflow}
                selectedNode={selectedNode}
                onSelectNode={setSelectedNode}
                onConnect={handleConnect}
                onDeleteNode={handleDeleteNode}
                onUpdateNode={handleUpdateNode}
                simulationMode={simulationMode}
              />
            </div>
          </div>

          {/* Right Panel */}
          <div className="space-y-4">
            {/* Node Library */}
            <div className="glass-card rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-violet-400" />
                Node Library
              </h3>
              <NodeLibrary onSelectNode={handleAddNode} />
            </div>

            {/* Selected Node Properties */}
            {selectedNode && (
              <div className="glass-card rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">{selectedNode.label}</h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteNode(selectedNode.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </Button>
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-slate-400">Type</label>
                    <p className="text-white bg-slate-800/50 px-2 py-1 rounded mt-1">{selectedNode.type}</p>
                  </div>
                  <div>
                    <label className="text-slate-400">Department</label>
                    <p className="text-white bg-slate-800/50 px-2 py-1 rounded mt-1">{selectedNode.department}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Validation */}
            {validationErrors.length > 0 && (
              <WorkflowValidator errors={validationErrors} />
            )}

            {/* Simulation Results */}
            {simulationMode && (
              <ExecutionSimulator workflow={workflow} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}