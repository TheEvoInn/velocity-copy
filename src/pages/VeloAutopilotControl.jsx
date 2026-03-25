/**
 * AUTOPILOT HUB — VELO AI
 * AI Assistant: APEX
 * Master switch, task queue, execution logs, and workflow management
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useIdentitySyncAcrossApp } from '@/hooks/useIdentitySyncAcrossApp';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Power, Zap, AlertTriangle, CheckCircle, Clock, XCircle, Cpu, Settings, Brain, Play, RefreshCw, Globe } from 'lucide-react';
import { Link as RouterLink } from 'react-router-dom';

export default function VeloAutopilotControl() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useIdentitySyncAcrossApp();

  const [autopilotEnabled, setAutopilotEnabled] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [dailyTarget, setDailyTarget] = useState(100);
  const [riskTolerance, setRiskTolerance] = useState('moderate');
  const { activeIdentity } = useActiveIdentity();

  const { data: goals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ['aiTasks', user?.email],
    queryFn: () => base44.entities.AITask.filter({ created_by: user?.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  const { data: execLogs = [] } = useQuery({
    queryKey: ['taskExecutionLogs', user?.email],
    queryFn: () => base44.entities.EngineAuditLog.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
    staleTime: 5000,
  });

  const toggleAutopilotMutation = useMutation({
    mutationFn: (enabled) =>
      base44.entities.UserGoals.update(goals?.id, { autopilot_enabled: enabled }),
    onSuccess: (_, enabled) => {
      setAutopilotEnabled(enabled);
      qc.invalidateQueries({ queryKey: ['userGoals'] });
    },
  });

  useEffect(() => {
    if (goals?.autopilot_enabled !== undefined) setAutopilotEnabled(goals.autopilot_enabled);
    if (goals?.daily_target) setDailyTarget(goals.daily_target);
    if (goals?.risk_tolerance) setRiskTolerance(goals.risk_tolerance);
  }, [goals?.autopilot_enabled, goals?.daily_target, goals?.risk_tolerance]);

  const saveSettingsMutation = useMutation({
    mutationFn: (data) => {
      if (!goals?.id) return base44.entities.UserGoals.create({ ...data, created_by: user?.email });
      return base44.entities.UserGoals.update(goals.id, data);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['userGoals'] }),
  });

  // Real-time subscriptions
  useEffect(() => {
    if (!user?.email) return;
    const u1 = base44.entities.AITask.subscribe(() => qc.invalidateQueries({ queryKey: ['aiTasks', user.email] }));
    const u2 = base44.entities.EngineAuditLog.subscribe(() => qc.invalidateQueries({ queryKey: ['taskExecutionLogs', user.email] }));
    const u3 = base44.entities.UserGoals.subscribe(() => qc.invalidateQueries({ queryKey: ['userGoals', user.email] }));
    return () => { u1(); u2(); u3(); };
  }, [user?.email, qc]);

  const getStatusColor = (status) => {
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
      default: return <Clock className="w-4 h-4" />;
    }
  };

  // Queued discoveries — WorkOpportunity records pending execution
  const { data: queuedDiscoveries = [], refetch: refetchDiscoveries } = useQuery({
    queryKey: ['queuedDiscoveries', user?.email],
    queryFn: () => base44.entities.WorkOpportunity.filter(
      { created_by: user?.email, autopilot_queued: true },
      '-created_date', 50
    ).catch(() => []),
    enabled: !!user?.email,
    refetchInterval: 10000,
  });

  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState(null);

  // Real-time sub for WorkOpportunity
  useEffect(() => {
    if (!user?.email) return;
    const u4 = base44.entities.WorkOpportunity.subscribe(() => {
      qc.invalidateQueries({ queryKey: ['queuedDiscoveries', user.email] });
    });
    return () => u4();
  }, [user?.email, qc]);

  async function executeQueuedOpportunities() {
    setExecuting(true);
    setExecResult(null);
    // Convert each queued opportunity to an AITask and trigger execution
    let dispatched = 0;
    for (const opp of queuedDiscoveries.slice(0, 10)) {
      // Create AITask from opportunity
      await base44.entities.AITask.create({
        task_type: 'url_analysis',
        task_name: opp.title,
        url: opp.url || '',
        status: 'queued',
        priority: opp.score || 50,
        analysis_config: { analyze_forms: true, detect_captcha: true, extract_metadata: true, ai_enabled: true },
        config: {
          opportunity_id: opp.id,
          category: opp.category,
          platform: opp.platform,
          estimated_pay: opp.estimated_pay,
          can_ai_complete: opp.can_ai_complete,
        },
        created_at: new Date().toISOString(),
      }).catch(() => null);
      // Mark opportunity as executing
      await base44.entities.WorkOpportunity.update(opp.id, { status: 'executing', autopilot_queued: false }).catch(() => null);
      dispatched++;
    }
    // Trigger the autopilot cycle to pick up the new tasks
    const res = await base44.functions.invoke('autopilotCycle', {
      action: 'process_queue',
      user_email: user?.email,
    }).catch(() => null);
    setExecResult({ dispatched, engine_response: res?.data });
    qc.invalidateQueries({ queryKey: ['aiTasks', user?.email] });
    qc.invalidateQueries({ queryKey: ['queuedDiscoveries', user?.email] });
    refetchDiscoveries();
    setExecuting(false);
  }

  const filteredTasks = filterStatus === 'all' ? tasks : tasks.filter(t => t.status === filterStatus);

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #fbbf24, #f97316)' }} />
              <div>
                <h1 className="font-orbitron text-3xl font-bold text-white">AUTOPILOT HUB</h1>
                <p className="text-[10px] font-mono tracking-widest text-amber-400/70">VELO AI · AI: APEX</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm ml-5">Master execution engine — tasks, workflows, strategies, and autonomous operations</p>
          </div>
          {activeIdentity && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
              style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.25)' }}>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-amber-300 font-mono">Identity: {activeIdentity.name}</span>
            </div>
          )}
        </div>

        {/* APEX AI Status */}
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)' }}>
          <Brain className="w-5 h-5 text-amber-400 shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-orbitron text-amber-400 tracking-wider">APEX EXECUTION ENGINE</span>
            <p className="text-xs text-slate-500 mt-0.5">Managing task queue · Executing workflows · Syncing with Identity, Discovery, Finance · Reporting to Command Hub</p>
          </div>
          <span className={`text-xs font-mono px-2 py-1 rounded-lg border shrink-0 ${
            autopilotEnabled ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-slate-500 border-slate-600/30 bg-slate-800/40'
          }`}>{autopilotEnabled ? 'LIVE' : 'IDLE'}</span>
        </div>

        {/* Identity Check */}
        {!activeIdentity && (
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.3)' }}>
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-400" />
              <div>
                <span className="text-orange-400 font-orbitron text-xs tracking-wider block">NO ACTIVE IDENTITY</span>
                <p className="text-xs text-slate-500">Autopilot requires an active VELO AI identity to execute tasks</p>
              </div>
            </div>
            <RouterLink to="/VeloIdentityHub">
              <Button size="sm" variant="outline" className="text-orange-400 border-orange-400/40 text-xs">
                Go to Identity Hub
              </Button>
            </RouterLink>
          </div>
        )}

        {/* Master Switch */}
        <Card className={`glass-card border-2 transition-all ${autopilotEnabled ? 'border-emerald-500/60' : 'border-slate-700/50'}`}>
          <CardContent className="p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-orbitron text-2xl font-bold text-white mb-1">Master Autopilot Switch</h2>
                <p className="text-slate-400 text-sm">
                  {autopilotEnabled
                    ? `✓ APEX is LIVE — Executing tasks autonomously using ${activeIdentity?.name || 'active identity'}`
                    : '● APEX is IDLE — Enable to start autonomous task execution'}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className={`text-3xl font-bold font-orbitron ${autopilotEnabled ? 'text-emerald-400' : 'text-slate-500'}`}>
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
                  <Power className={`w-7 h-7 transition-all ${autopilotEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Queued Discoveries Ready for Execution */}
        {queuedDiscoveries.length > 0 && (
          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(249,214,92,0.04)', border: '1px solid rgba(249,214,92,0.3)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-amber-400" />
                <span className="font-orbitron text-amber-400 text-sm tracking-wider">QUEUED DISCOVERIES</span>
                <span className="text-xs px-2 py-0.5 rounded-full font-orbitron font-bold"
                  style={{ background: 'rgba(249,214,92,0.15)', color: '#f9d65c', border: '1px solid rgba(249,214,92,0.3)' }}>
                  {queuedDiscoveries.length}
                </span>
              </div>
              <button
                onClick={executeQueuedOpportunities}
                disabled={executing || !autopilotEnabled}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all disabled:opacity-40"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#10b981' }}>
                {executing
                  ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Dispatching...</>
                  : <><Play className="w-3.5 h-3.5" /> Execute All Now</>}
              </button>
            </div>
            {!autopilotEnabled && (
              <p className="text-xs text-orange-400 mb-3">⚠️ Enable Autopilot above to execute queued discoveries</p>
            )}
            {execResult && (
              <div className="mb-3 px-3 py-2 rounded-xl text-xs font-orbitron"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                ✓ {execResult.dispatched} tasks dispatched to APEX execution engine
              </div>
            )}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {queuedDiscoveries.map(opp => (
                <div key={opp.id} className="flex items-center justify-between px-3 py-2 rounded-xl"
                  style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(249,214,92,0.1)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-medium truncate">{opp.title}</div>
                    <div className="text-[10px] text-slate-500">{opp.platform} · {opp.category?.replace(/_/g, ' ')} · ${opp.estimated_pay || 0}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    {opp.can_ai_complete && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-orbitron"
                        style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>AI</span>
                    )}
                    <span className="text-[10px] font-orbitron text-amber-400">{opp.score || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {[
            { label: 'Total Tasks', value: stats.total, color: '#818cf8' },
            { label: 'Completed', value: stats.completed, color: '#10b981' },
            { label: 'Executing', value: stats.executing, color: '#00e8ff' },
            { label: 'Queued', value: stats.queued, color: '#fbbf24' },
            { label: 'Failed', value: stats.failed, color: '#ef4444' },
          ].map(s => (
            <Card key={s.label} className="glass-card" style={{ borderColor: s.color + '30' }}>
              <CardContent className="p-4">
                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{s.label}</div>
                <div className="text-3xl font-bold font-orbitron" style={{ color: s.color }}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>


        <Tabs defaultValue="queue" className="space-y-4">
          <TabsList className="glass-card flex-wrap h-auto gap-1">
            <TabsTrigger value="queue">Task Queue ({filteredTasks.length})</TabsTrigger>
            <TabsTrigger value="logs">Execution Logs</TabsTrigger>
            <TabsTrigger value="policies">Policies & Rules</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="space-y-4">
            <div className="flex gap-2 mb-4 flex-wrap">
              {['all', 'queued', 'executing', 'completed', 'failed'].map(status => (
                <button key={status} onClick={() => setFilterStatus(status)}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                    filterStatus === status ? 'bg-amber-500 text-black' : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'
                  }`}>
                  {status === 'all' ? 'All Tasks' : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>

            {loadingTasks ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="text-center py-12">
                  <Cpu className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400">No tasks in this status. {!autopilotEnabled && 'Enable Autopilot to begin.'}</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <Card key={task.id} className="glass-card">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`${getStatusColor(task.status)} font-bold text-xs uppercase`}>{task.status}</span>
                            <h4 className="font-orbitron text-white text-sm">{task.task_name || task.task_type}</h4>
                          </div>
                          <p className="text-xs text-slate-400 mb-2">{task.url || task.task_type}</p>
                          <div className="flex gap-4 text-xs text-slate-500">
                            <div>Priority: <span className="text-white">{task.priority || 50}</span></div>
                            <div>Retries: <span className="text-white">{task.retry_count || 0}</span></div>
                            <div>Created: <span className="text-white">{new Date(task.created_at || task.created_date).toLocaleDateString()}</span></div>
                          </div>
                        </div>
                        <div className={getStatusColor(task.status)}>{getStatusIcon(task.status)}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-3">
            {execLogs.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="text-center py-12">
                  <p className="text-slate-400">No execution logs yet.</p>
                </CardContent>
              </Card>
            ) : execLogs.slice(0, 20).map(log => (
              <Card key={log.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="font-orbitron text-white text-sm mb-1">{log.action_type}</div>
                      <p className="text-xs text-slate-400">{log.ai_reasoning || log.details || 'No details'}</p>
                    </div>
                    <span className={`text-xs font-bold ${
                      log.status === 'success' ? 'text-emerald-400' :
                      log.status === 'failed' ? 'text-red-400' : 'text-amber-400'
                    }`}>{log.status?.toUpperCase()}</span>
                  </div>
                  {log.amount && <div className="text-sm font-semibold text-cyan-400 mb-2">${log.amount.toFixed(2)}</div>}
                  <div className="text-[10px] text-slate-600">{new Date(log.created_date).toLocaleString()}</div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-amber-400" />
                  APEX Execution Policies
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { title: 'Auto-Queue Opportunities', desc: 'Automatically add matching opportunities from Discovery Hub to the task queue' },
                  { title: 'Auto-Execute Ready Tasks', desc: 'Execute tasks as soon as all dependencies are met' },
                  { title: 'Retry Failed Tasks', desc: 'Automatically retry failed tasks up to 3 times with backoff' },
                ].map(policy => (
                  <div key={policy.title} className="p-4 rounded-xl bg-slate-900/50 border border-slate-700/50 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-white mb-1">{policy.title}</div>
                      <p className="text-xs text-slate-400">{policy.desc}</p>
                    </div>
                    <Switch defaultChecked />
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-amber-400" />
                  APEX Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">Daily Profit Target ($)</label>
                    <input type="number" value={dailyTarget}
                      onChange={e => setDailyTarget(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm focus:border-amber-500/50 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-white block mb-2">Risk Tolerance</label>
                    <select value={riskTolerance} onChange={e => setRiskTolerance(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm focus:border-amber-500/50 focus:outline-none">
                      <option value="conservative">Conservative</option>
                      <option value="moderate">Moderate</option>
                      <option value="aggressive">Aggressive</option>
                    </select>
                  </div>
                </div>
                <Button
                  onClick={() => saveSettingsMutation.mutate({ daily_target: dailyTarget, risk_tolerance: riskTolerance })}
                  disabled={saveSettingsMutation.isPending}
                  className="w-full bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30">
                  {saveSettingsMutation.isPending ? 'Saving…' : 'Save APEX Settings'}
                </Button>

                <div className="border-t border-slate-700/50 pt-4">
                  <p className="text-xs font-orbitron text-slate-600 tracking-widest mb-3">SYSTEM CONNECTIONS</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    {[
                      { label: 'Identity Hub', status: 'Synced', color: '#10b981' },
                      { label: 'Discovery Hub', status: 'Synced', color: '#10b981' },
                      { label: 'Finance Command', status: 'Synced', color: '#10b981' },
                      { label: 'Credential Vault', status: 'Synced', color: '#10b981' },
                      { label: 'Notification Center', status: 'Active', color: '#10b981' },
                      { label: 'Command Hub', status: 'Reporting', color: '#10b981' },
                    ].map(s => (
                      <div key={s.label} className="flex items-center justify-between p-2 rounded-lg bg-slate-800/50 border border-slate-700/40">
                        <span className="text-slate-300">{s.label}</span>
                        <span className="font-semibold" style={{ color: s.color }}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}