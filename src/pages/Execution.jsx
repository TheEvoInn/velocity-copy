/**
 * EXECUTION — Per-user isolated task queue, monitoring, and browser automation
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserTasks } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Play, CheckCircle, AlertTriangle, Clock, RefreshCw, Zap, List, Activity } from 'lucide-react';

const STATUS_COLORS = {
  queued: '#f9d65c', running: '#00e8ff', completed: '#10b981',
  failed: '#ef4444', cancelled: '#64748b',
};

function TaskRow({ task }) {
  const color = STATUS_COLORS[task.status] || '#64748b';
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}15` }}>
      <div className="w-2 h-2 rounded-full shrink-0" style={{
        background: color,
        boxShadow: task.status === 'running' ? `0 0 6px ${color}` : 'none',
        animation: task.status === 'running' ? 'pulse-glow 1.5s ease-in-out infinite' : 'none',
      }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-300 truncate">{task.task_type || task.current_step || 'Task'}</div>
        {task.current_step && task.status === 'running' && (
          <div className="text-xs text-slate-600 truncate">{task.current_step}</div>
        )}
      </div>
      {task.progress > 0 && (
        <div className="w-16 hidden md:block">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full" style={{ width: `${task.progress}%`, background: color }} />
          </div>
          <div className="text-xs text-center mt-0.5" style={{ color: `${color}80` }}>{task.progress}%</div>
        </div>
      )}
      <div className="text-right shrink-0">
        {task.earnings > 0 && (
          <div className="font-orbitron text-xs font-bold text-emerald-400">+${task.earnings.toFixed(2)}</div>
        )}
        <div className="text-xs capitalize" style={{ color }}>{task.status}</div>
      </div>
    </div>
  );
}

export default function Execution() {
  const { data: user } = useCurrentUser();
  const { data: tasks = [], refetch, isLoading } = useUserTasks();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('active');
  const [isRunning, setIsRunning] = useState(false);

  const queued = tasks.filter(t => t.status === 'queued');
  const running = tasks.filter(t => t.status === 'running');
  const completed = tasks.filter(t => t.status === 'completed');
  const failed = tasks.filter(t => t.status === 'failed');
  const todayCompleted = completed.filter(t =>
    new Date(t.updated_date || t.created_date).toDateString() === new Date().toDateString()
  );
  const totalEarned = completed.reduce((s, t) => s + (t.earnings || 0), 0);

  async function forceRun() {
    setIsRunning(true);
    try {
      await base44.functions.invoke('unifiedOrchestrator', { action: 'force_run', user_email: user?.email });
      qc.invalidateQueries({ queryKey: ['taskExecutions'] });
      refetch();
    } catch {}
    setIsRunning(false);
  }

  const TABS = [
    { key: 'active', label: `Active (${running.length + queued.length})` },
    { key: 'completed', label: `Completed (${completed.length})` },
    { key: 'failed', label: `Failed (${failed.length})`, warn: failed.length > 0 },
    { key: 'all', label: 'All Tasks' },
  ];

  const tabTasks = {
    active: [...running, ...queued],
    completed,
    failed,
    all: tasks,
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <Play className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">EXECUTION</h1>
            <p className="text-xs text-slate-500 font-mono">Per-user task queue · Browser automation · Live monitoring</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => refetch()}
            className="p-2 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={forceRun} disabled={isRunning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron transition-all"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)', color: '#ef4444' }}>
            {isRunning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {isRunning ? 'Running...' : 'Force Run'}
          </button>
          <Link to="/AutoPilot">
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron cursor-pointer transition-all"
              style={{ background: 'rgba(0,232,255,0.08)', border: '1px solid rgba(0,232,255,0.3)', color: '#00e8ff' }}>
              <Activity className="w-3.5 h-3.5" /> Autopilot
            </div>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
        {[
          { label: 'QUEUED', value: queued.length, color: '#f9d65c' },
          { label: 'RUNNING', value: running.length, color: '#00e8ff', pulse: running.length > 0 },
          { label: 'TODAY ✓', value: todayCompleted.length, color: '#10b981' },
          { label: 'FAILED', value: failed.length, color: '#ef4444' },
          { label: 'EARNED', value: `$${totalEarned.toFixed(0)}`, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-3"
            style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}20` }}>
            <div className="text-xs font-orbitron tracking-widest mb-1" style={{ color: `${s.color}70` }}>{s.label}</div>
            <div className="text-xl font-orbitron font-bold flex items-center gap-1.5" style={{ color: s.color }}>
              {s.value}
              {s.pulse && (
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color, animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === tab.key ? 'rgba(59,130,246,0.35)' : tab.warn ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'}`,
              color: activeTab === tab.key ? '#3b82f6' : tab.warn ? '#ef4444' : '#64748b',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Task List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (tabTasks[activeTab] || []).length === 0 ? (
        <div className="text-center py-16">
          <List className="w-12 h-12 text-slate-700 mx-auto mb-4" />
          <p className="font-orbitron text-sm text-slate-600">No tasks in this category</p>
          {activeTab === 'active' && (
            <p className="text-xs text-slate-700 mt-2">Activate Autopilot or run a cycle to queue tasks</p>
          )}
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
            {(tabTasks[activeTab] || []).map(task => <TaskRow key={task.id} task={task} />)}
          </div>
        </div>
      )}
    </div>
  );
}