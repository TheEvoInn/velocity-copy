import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Play, RefreshCw, FileText, Power, Zap, Radio, Flame } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Link } from 'react-router-dom';

// Sub-components
import MissionControlHUD from '../components/autopilot/MissionControlHUD';
import IdentityRoutinePanel from '../components/autopilot/IdentityRoutinePanel';
import RiskManagementPanel from '../components/autopilot/RiskManagementPanel';
import ProfitTargetPanel from '../components/autopilot/ProfitTargetPanel';
import AITaskFeed from '../components/autopilot/AITaskFeed';
import DualStreamCard from '../components/autopilot/DualStreamCard';

const TABS = [
  { key: 'hud', label: 'Mission HUD', icon: '🛰️' },
  { key: 'identities', label: 'Identity Routines', icon: '🤖' },
  { key: 'targets', label: 'Profit Targets', icon: '🎯' },
  { key: 'risk', label: 'Risk Controls', icon: '🛡️' },
  { key: 'feed', label: 'Task Feed', icon: '⚡' },
];

export default function AutoPilot() {
  const [activeTab, setActiveTab] = useState('hud');
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [isScanRunning, setIsScanRunning] = useState(false);
  const [isForceRunning, setIsForceRunning] = useState(false);
  const [lastRunResult, setLastRunResult] = useState(null);
  const qc = useQueryClient();

  const { data: userGoalsList = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });

  const { data: aiTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['aiTasks'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user?.email) return [];
      return base44.entities.AITask.filter({ created_by: user.email }, '-created_date', 50);
    },
    initialData: [],
    refetchInterval: 15000,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: async () => {
      const user = await base44.auth.me();
      if (!user?.email) return [];
      return base44.entities.Transaction.filter({ created_by: user.email }, '-created_date', 100);
    },
    initialData: [],
  });

  // Platform state via orchestrator
  const { data: platformState, refetch: refetchState } = useQuery({
    queryKey: ['platformState'],
    queryFn: async () => {
      const res = await base44.functions.invoke('unifiedOrchestrator', { action: 'get_status' });
      return res?.data?.state;
    },
    refetchInterval: 8000,
  });

  const goals = userGoalsList[0] || {};
  const today = new Date().toDateString();
  const todayTxs = transactions.filter(t => t.type === 'income' && new Date(t.created_date).toDateString() === today);
  const aiEarnedToday = todayTxs.filter(t => t.description?.startsWith('[AI Autopilot]')).reduce((s, t) => s + (t.amount || 0), 0);
  const userEarnedToday = todayTxs.filter(t => !t.description?.startsWith('[AI Autopilot]')).reduce((s, t) => s + (t.amount || 0), 0);
  const totalAITasks = aiTasks.filter(t => t.stream === 'ai_autonomous' && t.status === 'completed').length;
  const isAutopilotOn = platformState?.autopilot_enabled || goals?.autopilot_enabled;

  // Toggle autopilot
  const toggleMutation = useMutation({
    mutationFn: async (enabled) => {
      await base44.functions.invoke('unifiedOrchestrator', { action: 'toggle_autopilot', enabled });
    },
    onSuccess: () => { refetchState(); qc.invalidateQueries({ queryKey: ['userGoals'] }); },
  });

  const runManualCycle = async () => {
    setIsManualRunning(true);
    setLastRunResult(null);
    try {
      const res = await base44.functions.invoke('unifiedOrchestrator', { action: 'full_cycle' });
      setLastRunResult(res?.data);
      await refetchTasks();
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['userGoals'] });
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
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['userGoals'] });
      refetchState();
    } finally {
      setIsForceRunning(false);
    }
  };

  const runScan = async () => {
    setIsScanRunning(true);
    try {
      await base44.functions.invoke('unifiedOrchestrator', { action: 'scan_opportunities' });
      qc.invalidateQueries({ queryKey: ['opportunities'] });
    } finally {
      setIsScanRunning(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* ── Mission Control Header ── */}
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
              AUTOPILOT
            </h1>
            <p className="text-xs text-slate-500 tracking-wide mt-0.5">
              {isAutopilotOn ? '⚡ Autonomous engine running · All routines active' : '⏸ Engine paused · Awaiting activation'}
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
            title="Force Run: Bypasses scheduling, forces execution of all queued tasks immediately">
            <Flame className={`w-3.5 h-3.5 ${isForceRunning ? 'animate-pulse' : ''}`} />
            {isForceRunning ? 'Force Running...' : '⚡ Force Run'}
          </Button>

          <Link to="/AutopilotLogs">
            <Button size="sm" variant="outline"
              className="border-slate-700/60 text-slate-400 hover:text-white text-xs h-9 gap-1.5">
              <FileText className="w-3.5 h-3.5" /> Logs
            </Button>
          </Link>
        </div>
      </div>

      {/* ── Tab Navigation ── */}
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

      {/* ── Tab Content ── */}
      <div className="space-y-4">

        {activeTab === 'hud' && (
          <>
            <MissionControlHUD
              platformState={platformState}
              aiEarnedToday={aiEarnedToday}
              userEarnedToday={userEarnedToday}
              totalAITasks={totalAITasks}
              goals={goals}
            />
            <DualStreamCard
              aiEarned={aiEarnedToday}
              userEarned={userEarnedToday}
              aiTarget={goals.ai_daily_target || 500}
              userTarget={goals.user_daily_target || 500}
            />
            {/* How It Works */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-orbitron text-xs tracking-widest text-slate-400 mb-4">HOW AUTOPILOT WORKS</h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {[
                  { step: '01', text: 'Scans market every 30 min for high-value opportunities', color: '#f59e0b' },
                  { step: '02', text: 'Matches opportunities to the best identity & strategy', color: '#3b82f6' },
                  { step: '03', text: 'Executes tasks autonomously, logging every step', color: '#a855f7' },
                  { step: '04', text: 'Revenue deposited to wallet automatically', color: '#10b981' },
                  { step: '05', text: 'Stops at daily target threshold. Resets at midnight', color: '#06b6d4' },
                ].map(item => (
                  <div key={item.step} className="text-center p-3 rounded-xl"
                    style={{ background: `${item.color}08`, border: `1px solid ${item.color}20` }}>
                    <div className="font-orbitron text-2xl font-bold mb-1" style={{ color: item.color, opacity: 0.6 }}>
                      {item.step}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
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
          <ProfitTargetPanel goals={goals} onUpdate={() => qc.invalidateQueries({ queryKey: ['userGoals'] })} />
        )}

        {activeTab === 'risk' && (
          <RiskManagementPanel goals={goals} onUpdate={() => qc.invalidateQueries({ queryKey: ['userGoals'] })} />
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
      </div>
    </div>
  );
}