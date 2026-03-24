import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useIdentitySyncAcrossApp } from '@/hooks/useIdentitySyncAcrossApp';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, Zap, AlertTriangle, CheckCircle, Clock, XCircle, Cpu, LogOut, Settings, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

export default function VeloAutopilotControl() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useIdentitySyncAcrossApp(); // Real-time sync

  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');

  // Fetch user goals (contains autopilot_enabled flag)
  const { data: goals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  // Fetch all active tasks
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['aiTasks', user?.email],
    queryFn: () => base44.entities.AITask.filter({ created_by: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch task execution logs
  const { data: execLogs = [] } = useQuery({
    queryKey: ['taskExecutionLogs', user?.email],
    queryFn: () => base44.entities.EngineAuditLog.filter({ created_by: user?.email }),
    enabled: !!user?.email,
    staleTime: 5000,
  });

  // Toggle autopilot mutation
  const toggleAutopilotMutation = useMutation({
    mutationFn: (enabled) => 
      base44.entities.UserGoals.update(goals?.id, { autopilot_enabled: enabled }),
    onSuccess: (_, enabled) => {
      setAutopilotEnabled(enabled);
      qc.invalidateQueries({ queryKey: ['userGoals'] });
    },
  });

  useEffect(() => {
    if (goals?.autopilot_enabled !== undefined) {
      setAutopilotEnabled(goals.autopilot_enabled);
    }
  }, [goals?.autopilot_enabled]);

  const getTaskStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'text-emerald-400';
      case 'executing': return 'text-cyan-400';
      case 'failed': return 'text-red-400';
      case 'queued': return 'text-amber-400';
      default: return 'text-slate-400';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'executing': return <Cpu className="w-4 h-4 animate-spin" />;
      case 'failed': return <XCircle className="w-4 h-4" />;
      case 'queued': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const filteredTasks = filterStatus === 'all' 
    ? tasks 
    : tasks.filter(t => t.status === filterStatus);

  const stats = {
    total: tasks.length,
    completed: tasks.filter(t => t.status === 'completed').length,
    executing: tasks.filter(t => t.status === 'executing').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="font-orbitron text-4xl font-bold text-white flex items-center gap-3">
              <Zap className="w-10 h-10 text-amber-400" />
              VELO Autopilot Control
            </h1>
            <p className="text-slate-400">Master switch, task queue, and real-time execution hub</p>
          </div>
        </div>

        {/* Master Switch */}
        <Card className={`glass-card border-2 transition-all ${
          autopilotEnabled ? 'border-emerald-500/60' : 'border-slate-700/50'
        }`}>
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-orbitron text-2xl font-bold text-white mb-1">Master Autopilot Switch</h2>
                <p className="text-slate-400">
                  {autopilotEnabled 
                    ? '✓ Autopilot is LIVE and executing tasks autonomously' 
                    : '● Autopilot is OFF. Enable to start autonomous execution'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-3xl font-bold ${autopilotEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
                    {autopilotEnabled ? 'ON' : 'OFF'}
                  </div>
                  <div className={`text-xs font-orbitron tracking-wider ${autopilotEnabled ? 'text-emerald-500' : 'text-slate-500'}`}>
                    {autopilotEnabled ? 'LIVE' : 'IDLE'}
                  </div>
                </div>
                <button
                  onClick={() => toggleAutopilotMutation.mutate(!autopilotEnabled)}
                  disabled={toggleAutopilotMutation.isPending || !goals?.id}
                  className="relative w-16 h-16 rounded-2xl flex items-center justify-center transition-all"
                  style={{
                    background: autopilotEnabled 
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.05))'
                      : 'rgba(255,255,255,0.05)',
                    border: `2px solid ${autopilotEnabled ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)'}`,
                    boxShadow: autopilotEnabled ? '0 0 20px rgba(16,185,129,0.3)' : 'none',
                  }}
                >
                  <Power className={`w-7 h-7 transition-all ${
                    autopilotEnabled ? 'text-emerald-400' : 'text-slate-500'
                  }`} />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card border-cyan-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Tasks</div>
              <div className="text-3xl font-bold text-cyan-400">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-emerald-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Completed</div>
              <div className="text-3xl font-bold text-emerald-400">{stats.completed}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-amber-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Executing</div>
              <div className="text-3xl font-bold text-amber-400">{stats.executing}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-red-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Failed</div>
              <div className="text-3xl font-bold text-red-400">{stats.failed}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList className="glass-card">
            <TabsTrigger value="queue">Task Queue ({filteredTasks.length})</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
            <TabsTrigger value="policies">Policies & Rules</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Task Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            <div className="flex gap-2 mb-4">
              {['all', 'queued', 'executing', 'completed', 'failed'].map(status => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    filterStatus === status
                      ? 'bg-violet-500 text-white'
                      : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}
                >
                  {status === 'all' ? 'All Tasks' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {loadingTasks ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card className="glass-card text-center py-12">
                <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No tasks in this status.</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <Card key={task.id} className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`${getTaskStatusColor(task.status)} font-bold text-xs uppercase`}>
                              {task.status}
                            </span>
                            <h4 className="font-orbitron text-white">{task.task_name || task.task_type}</h4>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{task.url || task.task_type}</p>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <div>Priority: <span className="text-white">{task.priority || 50}</span></div>
                            <div>Retries: <span className="text-white">{task.retry_count || 0}</span></div>
                            <div>Created: <span className="text-white">{new Date(task.created_at).toLocaleDateString()}</span></div>
                          </div>
                        </div>
                        <div className={`${getTaskStatusColor(task.status)}`}>
                          {getStatusIcon(task.status)}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            <div className="space-y-3">
              {execLogs.slice(0, 20).map(log => (
                <Card key={log.id} className="glass-card">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-orbitron text-white text-sm mb-1">{log.action_type}</div>
                        <p className="text-xs text-slate-400">{log.ai_reasoning || log.details || 'No details'}</p>
                      </div>
                      <span className={`text-xs font-bold ${
                        log.status === 'success' ? 'text-emerald-400' :
                        log.status === 'failed' ? 'text-red-400' :
                        'text-amber-400'
                      }`}>
                        {log.status?.toUpperCase()}
                      </span>
                    </div>
                    {log.amount && (
                      <div className="text-sm font-semibold text-cyan-400 mb-2">
                        ${log.amount.toFixed(2)}
                      </div>
                    )}
                    <div className="text-[10px] text-slate-600">
                      {new Date(log.created_date).toLocaleString()}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Policies Tab */}
          <TabsContent value="policies" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Execution Policies</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <div className="text-sm font-semibold text-white mb-1">Auto-Queue Opportunities</div>
                  <p className="text-xs text-slate-400 mb-3">Automatically add matching opportunities to the task queue</p>
                  <Switch defaultChecked />
                </div>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <div className="text-sm font-semibold text-white mb-1">Auto-Execute Ready Tasks</div>
                  <p className="text-xs text-slate-400 mb-3">Execute tasks as soon as all dependencies are met</p>
                  <Switch defaultChecked />
                </div>
                <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-700/50">
                  <div className="text-sm font-semibold text-white mb-1">Retry Failed Tasks</div>
                  <p className="text-xs text-slate-400 mb-3">Automatically retry failed tasks up to N times</p>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-violet-400" />
                  Autopilot Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Daily Profit Target</label>
                  <input 
                    type="number" 
                    defaultValue={goals?.daily_target || 100}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Risk Tolerance</label>
                  <select className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm">
                    <option>Conservative</option>
                    <option selected={goals?.risk_tolerance === 'moderate'}>Moderate</option>
                    <option>Aggressive</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}