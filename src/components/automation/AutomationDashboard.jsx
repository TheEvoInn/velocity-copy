import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Clock, PlayCircle, PauseCircle, Trash2, Zap, RefreshCw,
  CheckCircle, AlertCircle, Calendar
} from 'lucide-react';

export default function AutomationDashboard() {
  const [selectedAutomation, setSelectedAutomation] = useState(null);
  const queryClient = useQueryClient();

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('automationOrchestrator', {
        action: 'get_all_automations'
      });
      return res.data?.automations || [];
    },
    refetchInterval: 60000,
    staleTime: 5000
  });

  const { data: selectedDetails } = useQuery({
    queryKey: ['automationDetails', selectedAutomation],
    queryFn: async () => {
      if (!selectedAutomation) return null;
      const res = await base44.functions.invoke('automationOrchestrator', {
        action: 'get_automation_details',
        automation_id: selectedAutomation
      });
      return res.data?.automation;
    },
    enabled: !!selectedAutomation
  });

  const { data: executionHistory } = useQuery({
    queryKey: ['executionHistory', selectedAutomation],
    queryFn: async () => {
      if (!selectedAutomation) return null;
      const res = await base44.functions.invoke('automationOrchestrator', {
        action: 'get_execution_history',
        automation_id: selectedAutomation
      });
      return res.data;
    },
    enabled: !!selectedAutomation
  });

  const pauseMutation = useMutation({
    mutationFn: (id) =>
      base44.functions.invoke('automationOrchestrator', {
        action: 'pause_automation',
        automation_id: id
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] })
  });

  const resumeMutation = useMutation({
    mutationFn: (id) =>
      base44.functions.invoke('automationOrchestrator', {
        action: 'resume_automation',
        automation_id: id
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['automations'] })
  });

  const deleteMutation = useMutation({
    mutationFn: (id) =>
      base44.functions.invoke('automationOrchestrator', {
        action: 'delete_automation',
        automation_id: id
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automations'] });
      setSelectedAutomation(null);
    }
  });

  const triggerMutation = useMutation({
    mutationFn: (id) =>
      base44.functions.invoke('automationOrchestrator', {
        action: 'trigger_now',
        automation_id: id
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['executionHistory'] })
  });

  if (isLoading) {
    return <div className="text-center py-8 text-slate-400">Loading automations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="glass-card p-4">
          <div className="text-xs text-slate-400">Total Automations</div>
          <div className="text-2xl font-bold text-cyan-400">{automations.length}</div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-xs text-slate-400">Active</div>
          <div className="text-2xl font-bold text-emerald-400">
            {automations.filter(a => a.is_enabled).length}
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-xs text-slate-400">Next Run</div>
          <div className="text-xs text-slate-300 mt-2 truncate">
            {selectedAutomation && selectedDetails
              ? new Date(selectedDetails.next_run).toLocaleTimeString()
              : 'Select automation'}
          </div>
        </Card>
        <Card className="glass-card p-4">
          <div className="text-xs text-slate-400">Success Rate</div>
          <div className="text-2xl font-bold text-amber-400">
            {selectedDetails ? selectedDetails.success_rate + '%' : '-'}
          </div>
        </Card>
      </div>

      {/* Automations List */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-cyan-400" />
            Scheduled Automations
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {automations.map((auto) => (
              <div
                key={auto.id}
                onClick={() => setSelectedAutomation(auto.id)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedAutomation === auto.id
                    ? 'bg-slate-700/40 border-cyan-400/60'
                    : 'bg-slate-800/30 border-slate-700/50 hover:border-cyan-400/30'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-white text-sm">{auto.name}</h3>
                      {auto.is_enabled ? (
                        <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full" />
                      ) : (
                        <span className="inline-block w-2 h-2 bg-slate-500 rounded-full" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400">{auto.description}</p>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                      <Calendar className="w-3 h-3" />
                      {auto.schedule.charAt(0).toUpperCase() + auto.schedule.slice(1)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {auto.is_enabled ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          pauseMutation.mutate(auto.id);
                        }}
                        disabled={pauseMutation.isPending}
                      >
                        <PauseCircle className="w-4 h-4 text-yellow-400" />
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          resumeMutation.mutate(auto.id);
                        }}
                        disabled={resumeMutation.isPending}
                      >
                        <PlayCircle className="w-4 h-4 text-emerald-400" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        triggerMutation.mutate(auto.id);
                      }}
                      disabled={triggerMutation.isPending}
                    >
                      <Zap className="w-4 h-4 text-cyan-400" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(auto.id);
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Details & Execution History */}
      {selectedDetails && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Configuration */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" />
                Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Type</span>
                <span className="text-white font-semibold capitalize">{selectedDetails.type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Schedule</span>
                <span className="text-white font-semibold capitalize">{selectedDetails.schedule}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Execution Time</span>
                <span className="text-white font-semibold">{selectedDetails.execution_time || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Status</span>
                <span className={selectedDetails.is_enabled ? 'text-emerald-400 font-semibold' : 'text-yellow-400 font-semibold'}>
                  {selectedDetails.is_enabled ? 'Enabled' : 'Paused'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Next Run</span>
                <span className="text-white font-semibold">
                  {new Date(selectedDetails.next_run).toLocaleDateString()} {new Date(selectedDetails.next_run).toLocaleTimeString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Stats */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Total Executions</span>
                <span className="text-white font-semibold">{selectedDetails.execution_count || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Success Rate</span>
                <span className="text-emerald-400 font-semibold">{selectedDetails.success_rate || 0}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Last Run</span>
                <span className="text-white font-semibold text-xs">
                  {new Date(selectedDetails.last_run).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Avg Duration</span>
                <span className="text-white font-semibold">~1s</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Execution History */}
      {executionHistory && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-cyan-400" />
              Recent Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {executionHistory.execution_history?.map((exec) => (
                <div key={exec.execution_id} className="p-3 bg-slate-800/30 rounded border border-slate-700/50 text-sm">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {exec.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-red-400" />
                      )}
                      <span className="text-slate-300">{exec.result || 'Executed'}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      {new Date(exec.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}