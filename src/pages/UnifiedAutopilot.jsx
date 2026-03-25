/**
 * UNIFIED AUTOPILOT EXECUTION COCKPIT
 * Central operational command surface for autonomous profit engine
 * Combines all Autopilot + Execution controls, real-time task monitoring, and cross-system sync
 * Full parallel operation with: Task Orchestration, Identity Engine, Credential Vault, Wallet, Notifications, User Intervention
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useUserGoals, useAITasksByStatus, useInvalidateQueries } from '@/hooks/useQueryHooks';
import { 
  Bot, Play, RefreshCw, FileText, Power, Zap, Radio, Flame, 
  CheckCircle, AlertTriangle, Clock, List, Activity, BarChart3, Settings, Target, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';

// Sub-components (reuse existing)
import MissionControlHUD from '../components/autopilot/MissionControlHUD';
import IdentityRoutinePanel from '../components/autopilot/IdentityRoutinePanel';
import RiskManagementPanel from '../components/autopilot/RiskManagementPanel';
import ProfitTargetPanel from '../components/autopilot/ProfitTargetPanel';
import AITaskFeed from '../components/autopilot/AITaskFeed';
import DualStreamCard from '../components/autopilot/DualStreamCard';
import AutopilotActivationDiagnostics from '../components/autopilot/AutopilotActivationDiagnostics';
import AutoExecuteRuleBuilder from '../components/autopilot/AutoExecuteRuleBuilder';
import RealtimeCommandHub from '../components/autopilot/RealtimeCommandHub';
import AgenticBrowserControl from '../components/autopilot/AgenticBrowserControl';

const STATUS_COLORS = {
  queued: '#f9d65c', running: '#00e8ff', completed: '#10b981',
  failed: '#ef4444', cancelled: '#64748b',
};

// Task row component - combined from Execution
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

// Unified navigation tabs
const TABS = [
  { key: 'command', label: 'Command Hub', icon: '⚡', section: 'autopilot' },
  { key: 'hud', label: 'Mission HUD', icon: '🛰️', section: 'autopilot' },
  { key: 'execution', label: 'Task Execution', icon: '▶️', section: 'execution' },
  { key: 'queue', label: 'Task Queue', icon: '📋', section: 'execution' },
  { key: 'identities', label: 'Identity Routines', icon: '🤖', section: 'autopilot' },
  { key: 'targets', label: 'Profit Targets', icon: '🎯', section: 'autopilot' },
  { key: 'risk', label: 'Risk Controls', icon: '🛡️', section: 'autopilot' },
  { key: 'rules', label: 'Auto-Execute Rules', icon: '⚙️', section: 'autopilot' },
  { key: 'feed', label: 'Task Feed', icon: '⚡', section: 'autopilot' },
  { key: 'browser', label: 'Agentic Browser', icon: '🌐', section: 'execution' },
  { key: 'diagnostics', label: 'System Health', icon: '🔧', section: 'autopilot' },
];

export default function UnifiedAutopilot() {
  const [activeTab, setActiveTab] = useState('command');
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [isScanRunning, setIsScanRunning] = useState(false);
  const [isForceRunning, setIsForceRunning] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [lastRunResult, setLastRunResult] = useState(null);
  const [executionFilter, setExecutionFilter] = useState('active');
  
  const qc = useQueryClient();
  const { invalidateAll } = useInvalidateQueries();

  // Standardized query hooks - unified data fetching
  const { data: userGoalsList = [], isLoading: goalsLoading } = useUserGoals();
  const { data: aiTasks = [], isLoading: tasksLoading, refetch: refetchTasks } = useAITasksByStatus();

  // Platform state via orchestrator - real-time sync
  const { data: platformState, refetch: refetchState } = useQuery({
    queryKey: ['platformState'],
    queryFn: async () => {
      const res = await base44.functions.invoke('unifiedOrchestrator', { action: 'get_status' });
      return res?.data?.state;
    },
    refetchInterval: 5000, // Every 5s for real-time sync
  });

  const goals = userGoalsList[0] || {};
  const today = new Date().toDateString();
  const todayTxs = aiTasks.filter(t => new Date(t.created_date).toDateString() === today);
  const isAutopilotOn = platformState?.autopilot_enabled || goals?.autopilot_enabled;

  // Task filtering - unified across all execution states
  const queued = aiTasks.filter(t => t.status === 'queued');
  const running = aiTasks.filter(t => t.status === 'running');
  const completed = aiTasks.filter(t => t.status === 'completed');
  const failed = aiTasks.filter(t => t.status === 'failed');
  const todayCompleted = completed.filter(t => new Date(t.created_date).toDateString() === today);
  const totalEarned = completed.reduce((s, t) => s + (t.earnings || 0), 0);

  // Execution filters
  const executionTasks = {
    active: [...running, ...queued],
    completed,
    failed,
    all: aiTasks,
  };

  // Master mutations - unified control surface
  const toggleMutation = useMutation({
    mutationFn: async (enabled) => {
      await base44.functions.invoke('unifiedOrchestrator', { action: 'toggle_autopilot', enabled });
    },
    onSuccess: () => { refetchState(); invalidateAll(); },
  });

  const runManualCycle = async () => {
    setIsManualRunning(true);
    setLastRunResult(null);
    try {
      const res = await base44.functions.invoke('unifiedOrchestrator', { action: 'full_cycle' });
      setLastRunResult(res?.data);
      await refetchTasks();
      invalidateAll();
      refetchState();
    } finally {
      setIsManualRunning(false);
    }
  };

  const runForceRun = async () => {
    setIsForceRunning(true);
    setLastRunResult(null);
    try {
      const res = await base44.functions.invoke('unifiedOrchestrator', { action: 'force_run' });
      setLastRunResult(res?.data);
      await refetchTasks();
      invalidateAll();
      refetchState();
    } finally {
      setIsForceRunning(false);
    }
  };

  const createAccountAutonomously = async () => {
    setIsCreatingAccount(true);
    try {
      // Get first active identity
      const identities = await base44.entities.AIIdentity.filter({ is_active: true }, null, 1).catch(() => []);
      if (!identities.length) {
        alert('No active AI identity found. Create one in Identity Manager.');
        return;
      }

      const identity = identities[0];

      // Create test opportunity for account creation
      const opportunity = {
        title: 'Auto-Create Account - Upwork',
        platform: 'upwork',
        url: 'https://www.upwork.com/signup',
        opportunity_type: 'signup',
        category: 'service'
      };

      // Invoke account creation engine
      const result = await base44.functions.invoke('autonomousAccountCreationEngine', {
        action: 'auto_create_account',
        identityId: identity.id,
        opportunity
      });

      if (result.data?.success) {
        setLastRunResult({ success: true, message: '✅ Account created successfully', account: result.data.account });
        await invalidateAll();
      } else {
        setLastRunResult({ success: false, message: '❌ Account creation failed: ' + result.data?.error });
      }
    } catch (error) {
      setLastRunResult({ success: false, message: '❌ Error: ' + error.message });
    } finally {
      setIsCreatingAccount(false);
    }
  };

  const runScan = async () => {
    setIsScanRunning(true);
    try {
      await base44.functions.invoke('unifiedOrchestrator', { action: 'scan_opportunities' });
      invalidateAll();
    } finally {
      setIsScanRunning(false);
    }
  };

  // Real-time platform sync effect
  useEffect(() => {
    const syncInterval = setInterval(() => {
      refetchTasks();
      refetchState();
    }, 5000);
    return () => clearInterval(syncInterval);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── UNIFIED MISSION CONTROL HEADER ── */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: isAutopilotOn ? 'rgba(16,185,129,0.2)' : 'rgba(100,116,139,0.15)',
                border: `1px solid ${isAutopilotOn ? 'rgba(16,185,129,0.5)' : 'rgba(100,116,139,0.3)'}`,
                boxShadow: isAutopilotOn ? '0 0 24px rgba(16,185,129,0.4)' : 'none',
                transition: 'all 0.5s ease',
              }}>
              <span className="text-2xl">{isAutopilotOn ? '🛰️' : '🤖'}</span>
            </div>
            {isAutopilotOn && (
              <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-950"
                style={{ boxShadow: '0 0 8px #10b981', animation: 'pulse-glow 1.5s ease-in-out infinite' }} />
            )}
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold tracking-widest text-white text-glow-emerald">
              UNIFIED AUTOPILOT COCKPIT
            </h1>
            <p className="text-xs text-slate-500 tracking-wide mt-0.5">
              {isAutopilotOn ? '⚡ Autonomous engine running · All systems synchronized' : '⏸ Engine paused · Awaiting activation'}
            </p>
          </div>
        </div>

        {/* Master controls */}
        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
          {/* Master toggle */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{
              background: isAutopilotOn ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isAutopilotOn ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.1)'}`,
            }}>
            <Radio className={`w-3.5 h-3.5 ${isAutopilotOn ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
            <span className="text-xs font-orbitron tracking-wide text-slate-300">AUTOPILOT</span>
            <Switch
              checked={!!isAutopilotOn}
              onCheckedChange={(v) => toggleMutation.mutate(v)}
              disabled={toggleMutation.isPending}
            />
          </div>

          <Button size="sm" variant="outline"
            onClick={runScan} disabled={isScanRunning}
            className="border-slate-700/60 text-slate-400 hover:text-white text-xs h-9 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${isScanRunning ? 'animate-spin' : ''}`} />
            Scan Market
          </Button>

          <Button size="sm"
            onClick={runManualCycle} disabled={isManualRunning || isForceRunning}
            className="btn-cosmic text-white text-xs h-9 gap-1.5">
            <Play className={`w-3.5 h-3.5 ${isManualRunning ? 'animate-pulse' : ''}`} />
            {isManualRunning ? 'Running...' : 'Run Cycle'}
          </Button>

          <Button size="sm"
            onClick={runForceRun} disabled={isManualRunning || isForceRunning}
            className="text-white text-xs h-9 gap-1.5"
            style={{ background: 'linear-gradient(135deg, #dc2626, #ea580c)', border: '1px solid rgba(220,38,38,0.5)' }}
            title="Force Run: Bypasses scheduling, executes all queued tasks immediately">
            <Flame className={`w-3.5 h-3.5 ${isForceRunning ? 'animate-pulse' : ''}`} />
            {isForceRunning ? 'Force Running...' : '⚡ Force Run'}
          </Button>

          <Button size="sm"
            onClick={createAccountAutonomously} disabled={isCreatingAccount}
            className="text-white text-xs h-9 gap-1.5"
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #a855f7)', border: '1px solid rgba(139,92,246,0.5)' }}
            title="Create account on platform autonomously">
            <Zap className={`w-3.5 h-3.5 ${isCreatingAccount ? 'animate-pulse' : ''}`} />
            {isCreatingAccount ? 'Creating...' : 'Create Account'}
          </Button>

          <Link to="/AutopilotLogs">
            <Button size="sm" variant="outline"
              className="border-slate-700/60 text-slate-400 hover:text-white text-xs h-9 gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Logs
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Last Run Result Banner ── */}
      {lastRunResult && (
        <div className="mb-4 px-4 py-3 rounded-xl text-xs"
          style={{
            background: lastRunResult.success ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)',
            border: `1px solid ${lastRunResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
          <div className="flex items-center justify-between">
            <span className={lastRunResult.success ? 'text-emerald-400' : 'text-red-400'}>
              {lastRunResult.force_run ? '⚡ Force Run' : '🤖 Cycle'} completed
              {lastRunResult.success
                ? ` — ${lastRunResult.queued || 0} queued, ${lastRunResult.executed || 0} executed`
                : ` — Error: ${lastRunResult.errors?.[0] || 'Unknown error'}`}
            </span>
            <button onClick={() => setLastRunResult(null)} className="text-slate-500 hover:text-white ml-4">✕</button>
          </div>
          {lastRunResult.errors?.length > 0 && lastRunResult.success && (
            <p className="text-amber-500 mt-1">{lastRunResult.errors.length} warning(s): {lastRunResult.errors[0]}</p>
          )}
        </div>
      )}

      {/* ── UNIFIED EXECUTION STATS ── */}
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

      {/* ── UNIFIED TAB NAVIGATION ── */}
      <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-orbitron tracking-wide whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === tab.key ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: activeTab === tab.key ? '#10b981' : '#94a3b8',
              boxShadow: activeTab === tab.key ? '0 0 12px rgba(16,185,129,0.2)' : 'none',
            }}
          >
            <span>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── UNIFIED TAB CONTENT ── */}
      <div className="space-y-4">
        
        {/* AUTOPILOT TABS */}
        {activeTab === 'command' && <RealtimeCommandHub />}

        {activeTab === 'hud' && (
          <>
            <MissionControlHUD
              platformState={platformState}
              aiEarnedToday={todayTxs.reduce((s, t) => s + (t.earnings || 0), 0)}
              userEarnedToday={0}
              totalAITasks={completed.length}
              goals={goals}
            />
            <DualStreamCard
              aiEarned={todayTxs.reduce((s, t) => s + (t.earnings || 0), 0)}
              userEarned={0}
              aiTarget={goals.ai_daily_target || 500}
              userTarget={goals.user_daily_target || 500}
            />
          </>
        )}

        {activeTab === 'identities' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">IDENTITY EXECUTION ROUTINES</h2>
                <p className="text-xs text-slate-500 mt-0.5">Toggle automated strategies per AI identity</p>
              </div>
              <Link to="/AIIdentityStudio">
                <Button size="sm" variant="outline" className="border-slate-700/60 text-slate-400 hover:text-white text-xs h-8">
                  Manage Identities
                </Button>
              </Link>
            </div>
            <IdentityRoutinePanel />
          </div>
        )}

        {activeTab === 'targets' && (
          <ProfitTargetPanel goals={goals} onUpdate={() => invalidateAll()} />
        )}

        {activeTab === 'risk' && (
          <RiskManagementPanel goals={goals} onUpdate={() => invalidateAll()} />
        )}

        {activeTab === 'rules' && (
          <div>
            <div className="mb-4">
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">AUTO-EXECUTE RULES</h2>
              <p className="text-xs text-slate-500 mt-0.5">Create rules to automatically trigger task creation when opportunity conditions are met</p>
            </div>
            <AutoExecuteRuleBuilder />
          </div>
        )}

        {activeTab === 'feed' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">LIVE TASK FEED</h2>
              <Button size="sm" variant="outline"
                onClick={() => refetchTasks()}
                className="border-slate-700/60 text-slate-400 hover:text-white text-xs h-8 gap-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
            <AITaskFeed tasks={aiTasks} isRunning={isManualRunning} />
          </div>
        )}

        {activeTab === 'browser' && (
          <div>
            <div className="mb-4">
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">AGENTIC BROWSER AUTOMATION</h2>
              <p className="text-xs text-slate-500 mt-0.5">Self-hosted browser automation powered by Playwright + LLM intelligence</p>
            </div>
            <AgenticBrowserControl task={{ url: 'https://www.upwork.com/signup', credentials: { email: 'test@example.com', password: 'secure', full_name: 'AI Agent' } }} />
          </div>
        )}

        {activeTab === 'diagnostics' && (
          <div>
            <div className="mb-4">
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">SYSTEM DIAGNOSTICS</h2>
              <p className="text-xs text-slate-500 mt-0.5">Monitor activation status and repair any issues preventing Autopilot from starting</p>
            </div>
            <AutopilotActivationDiagnostics />
          </div>
        )}

        {/* EXECUTION TABS */}
        {activeTab === 'execution' && (
          <div>
            <div className="mb-4">
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">REAL-TIME TASK EXECUTION</h2>
              <p className="text-xs text-slate-500 mt-0.5">Monitor all active and pending tasks with live progress tracking</p>
            </div>
            <div className="flex gap-2 mb-4">
              {['active', 'completed', 'failed', 'all'].map(filter => (
                <button key={filter}
                  onClick={() => setExecutionFilter(filter)}
                  className="px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide whitespace-nowrap transition-all"
                  style={{
                    background: executionFilter === filter ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${executionFilter === filter ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    color: executionFilter === filter ? '#3b82f6' : '#64748b',
                  }}>
                  {filter === 'active' && `Active (${running.length + queued.length})`}
                  {filter === 'completed' && `Completed (${completed.length})`}
                  {filter === 'failed' && `Failed (${failed.length})`}
                  {filter === 'all' && `All (${aiTasks.length})`}
                </button>
              ))}
            </div>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (executionTasks[executionFilter] || []).length === 0 ? (
              <div className="text-center py-16">
                <List className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                <p className="font-orbitron text-sm text-slate-600">No tasks in this category</p>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                  {(executionTasks[executionFilter] || []).map(task => <TaskRow key={task.id} task={task} />)}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'queue' && (
          <div>
            <div className="mb-4">
              <h2 className="font-orbitron text-sm font-bold text-white tracking-wide">TASK QUEUE MANAGEMENT</h2>
              <p className="text-xs text-slate-500 mt-0.5">Detailed view of all queued and executing tasks with full controls</p>
            </div>
            {tasksLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden"
                style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
                  {[...running, ...queued].length === 0 ? (
                    <p className="text-center text-slate-600 py-8">No tasks in queue</p>
                  ) : (
                    [...running, ...queued].map(task => <TaskRow key={task.id} task={task} />)
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}