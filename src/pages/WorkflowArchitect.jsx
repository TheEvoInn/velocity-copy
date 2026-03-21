import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Plus, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import VisualWorkflowEditor from '@/components/workflow/VisualWorkflowEditor';

export default function WorkflowArchitect() {
  const [mode, setMode] = useState('list'); // list or editor
  const [currentWorkflow, setCurrentWorkflow] = useState(null);

  // Fetch workflows
  const { data: workflows = [] } = useQuery({
    queryKey: ['workflows'],
    queryFn: async () => {
      try {
        return await base44.entities.Workflow.list();
      } catch {
        return [];
      }
    }
  });

  // Save workflow mutation
  const saveWorkflow = useMutation({
    mutationFn: async (workflow) => {
      if (workflow.id) {
        return await base44.entities.Workflow.update(workflow.id, workflow);
      } else {
        return await base44.entities.Workflow.create(workflow);
      }
    },
    onSuccess: () => {
      setMode('list');
      setCurrentWorkflow(null);
    }
  });

  const handleCreateNew = () => {
    setCurrentWorkflow(null);
    setMode('editor');
  };

  const handleEdit = (workflow) => {
    setCurrentWorkflow(workflow);
    setMode('editor');
  };

  const handleDelete = async (id) => {
    if (confirm('Are you sure you want to delete this workflow?')) {
      try {
        await base44.entities.Workflow.delete(id);
      } catch (error) {
        alert('Error deleting workflow: ' + error.message);
      }
    }
  };

  if (mode === 'editor') {
    return (
      <VisualWorkflowEditor
        workflowId={currentWorkflow?.id}
        onSave={saveWorkflow.mutate}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-orbitron font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">
              Workflow Architect
            </h1>
            <p className="text-slate-400 mt-2">Design conditional automation paths across all departments</p>
          </div>
          <Button
            onClick={handleCreateNew}
            className="gap-2 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-500 hover:to-violet-600"
          >
            <Plus className="w-4 h-4" />
            Create Workflow
          </Button>
        </div>

        {/* Workflows Grid */}
        {workflows.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center">
            <div className="text-slate-500 mb-4">
              <List className="w-12 h-12 mx-auto opacity-50 mb-4" />
              <p className="text-lg mb-4">No workflows yet</p>
              <p className="text-sm text-slate-600 mb-6">Create your first workflow to start automating across departments</p>
              <Button
                onClick={handleCreateNew}
                className="gap-2 bg-gradient-to-r from-violet-600 to-violet-700"
              >
                <Plus className="w-4 h-4" />
                Create First Workflow
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {workflows.map(workflow => (
              <div
                key={workflow.id}
                className="glass-card rounded-2xl p-4 hover:border-violet-500/50 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-white truncate">{workflow.name}</h3>
                    <p className="text-xs text-slate-500 mt-1">{workflow.description || 'No description'}</p>
                  </div>
                  <div className={`px-2 py-1 rounded text-xs font-semibold ${
                    workflow.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
                    workflow.status === 'draft' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-600/20 text-slate-400'
                  }`}>
                    {workflow.status}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-700/50">
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Nodes</div>
                    <div className="text-lg font-bold text-violet-400">{workflow.nodes?.length || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Runs</div>
                    <div className="text-lg font-bold text-blue-400">{workflow.execution_stats?.total_runs || 0}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xs text-slate-500">Success</div>
                    <div className="text-lg font-bold text-emerald-400">{workflow.execution_stats?.success_rate?.toFixed(0) || 0}%</div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(workflow)}
                    className="flex-1 px-3 py-2 text-xs font-semibold text-white bg-violet-600/20 hover:bg-violet-600/40 rounded transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(workflow.id)}
                    className="flex-1 px-3 py-2 text-xs font-semibold text-red-400 bg-red-600/10 hover:bg-red-600/20 rounded transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Banner */}
        <div className="mt-8 glass-card rounded-2xl p-6 border-l-4 border-violet-500">
          <h3 className="font-semibold text-white mb-2">💡 Pro Tips</h3>
          <ul className="text-sm text-slate-400 space-y-1">
            <li>• Create triggers that respond to opportunities, transactions, or scheduled times</li>
            <li>• Use conditional logic (IF/AND/OR) to create dynamic execution paths</li>
            <li>• Connect nodes from different departments to create cross-team automations</li>
            <li>• Test workflows in simulation mode before activating them</li>
            <li>• Monitor execution in the Deep Space view for each department</li>
          </ul>
        </div>
      </div>
    </div>
  );
}