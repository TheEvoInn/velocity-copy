/**
 * Task Orchestrator Page
 * Centralized interface for multi-step automations and department dependencies
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import ConfigurationWizard from '@/components/orchestrator/ConfigurationWizard';
import DependencyVisualizer from '@/components/orchestrator/DependencyVisualizer';

export default function TaskOrchestrator() {
  const [showWizard, setShowWizard] = useState(false);
  const [selectedAutomation, setSelectedAutomation] = useState(null);

  // Load automations and dependency graph
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['automation_graph'],
    queryFn: async () => {
      const res = await base44.functions.invoke('taskOrchestratorEngine', {
        action: 'get_automation_graph'
      });
      return res.data;
    }
  });

  const automations = data?.automations || [];
  const graph = data?.dependency_graph || { nodes: [], edges: [] };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/50 flex items-center justify-center">
              <Zap className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white text-glow-violet">Task Orchestrator</h1>
              <p className="text-xs text-slate-400">Multi-step automations & department coordination</p>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Active Automations</p>
            <p className="text-2xl font-bold text-white">{automations.filter(a => a.enabled).length}</p>
          </Card>
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Departments Involved</p>
            <p className="text-2xl font-bold text-white">
              {new Set(graph.nodes?.map(n => n.system) || []).size}
            </p>
          </Card>
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Total Triggers</p>
            <p className="text-2xl font-bold text-white">{graph.nodes?.filter(n => n.type === 'trigger').length || 0}</p>
          </Card>
          <Card className="p-4 bg-slate-800/50 border-slate-700">
            <p className="text-xs text-slate-400 mb-1">Actions Defined</p>
            <p className="text-2xl font-bold text-white">{graph.nodes?.filter(n => n.type === 'action').length || 0}</p>
          </Card>
        </div>

        {/* Main Content */}
        {showWizard ? (
          <Card className="p-6 bg-slate-900/50 border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Configuration Wizard</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setShowWizard(false);
                  refetch();
                }}
              >
                Close
              </Button>
            </div>
            <ConfigurationWizard
              onComplete={() => {
                setShowWizard(false);
                refetch();
              }}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Dependency Graph */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Dependency Graph</h2>
              </div>
              {isLoading ? (
                <Card className="p-8 bg-slate-900/50 border-slate-800 flex items-center justify-center">
                  <p className="text-slate-400">Loading automations...</p>
                </Card>
              ) : (
                <DependencyVisualizer graph={graph} automations={automations} />
              )}
            </div>

            {/* Automation List & Controls */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Automations</h2>
                <Button
                  onClick={() => setShowWizard(true)}
                  size="sm"
                  className="bg-violet-600 hover:bg-violet-500 gap-2"
                >
                  <Plus className="w-4 h-4" />
                  New
                </Button>
              </div>

              <div className="space-y-2">
                {automations.length === 0 ? (
                  <Card className="p-4 bg-slate-800/50 border-slate-700 text-center">
                    <AlertCircle className="w-5 h-5 text-slate-500 mx-auto mb-2" />
                    <p className="text-sm text-slate-400">No automations yet</p>
                    <p className="text-xs text-slate-500 mt-1">Create one to get started</p>
                  </Card>
                ) : (
                  automations.map(automation => (
                    <Card
                      key={automation.id}
                      onClick={() => setSelectedAutomation(automation)}
                      className={`p-3 cursor-pointer transition-all border ${
                        selectedAutomation?.id === automation.id
                          ? 'bg-violet-500/10 border-violet-500/50'
                          : 'bg-slate-800/50 border-slate-700 hover:border-slate-600'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="text-sm font-semibold text-white flex-1">
                            {automation.trigger_name}
                          </h4>
                          <Badge
                            className="text-xs flex-shrink-0"
                            variant={automation.enabled ? 'default' : 'secondary'}
                          >
                            {automation.enabled ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-400">{automation.description}</p>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Trigger:</span>
                          <Badge variant="secondary" className="text-xs">
                            {automation.trigger_type}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-500">Targets:</span>
                          <div className="flex gap-1 flex-wrap">
                            {automation.target_systems?.map((target, idx) => (
                              <Badge key={idx} variant="secondary" className="text-xs">
                                {target.system}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>

              {/* Selected Automation Details */}
              {selectedAutomation && (
                <Card className="p-4 bg-slate-800/50 border-slate-700 mt-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Details</h3>
                  <div className="space-y-2 text-xs">
                    <div>
                      <p className="text-slate-400">Trigger Condition:</p>
                      <p className="text-slate-300 font-mono">
                        {selectedAutomation.trigger_condition?.operator} {selectedAutomation.trigger_condition?.threshold}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-400">Total Actions:</p>
                      <p className="text-slate-300">{selectedAutomation.target_systems?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-slate-400 mb-1">Stats:</p>
                      <div className="grid grid-cols-2 gap-1 text-slate-300">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3 h-3 text-amber-400" />
                          <span>{selectedAutomation.total_triggers || 0} triggered</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span>{selectedAutomation.successful_triggers || 0} success</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}