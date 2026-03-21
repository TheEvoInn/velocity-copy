import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useUserGoals, useCryptoWallets, useAITasks } from '@/hooks/useQueryHooks';
import { Zap, Radio, Target, TrendingUp } from 'lucide-react';

export default function CockpitControlPanel() {
  const { data: goals = [], isLoading: goalsLoading } = useUserGoals();
  const { data: wallets = [], isLoading: walletsLoading } = useCryptoWallets();
  const { data: tasks = [], isLoading: tasksLoading } = useAITasks();
  
  const [autopilotMode, setAutopilotMode] = useState('continuous');

  const goal = goals?.[0] || {};
  const totalBalance = wallets?.reduce((sum, w) => sum + (w?.balance?.total_balance_usd || 0), 0) || 0;
  const activeTasks = tasks?.filter(t => t?.status === 'executing')?.length || 0;

  const handleAutopilotChange = async (mode) => {
    setAutopilotMode(mode);
    try {
      await base44.functions.invoke('unifiedOrchestrator', {
        action: 'set_autopilot_mode',
        mode
      });
    } catch (error) {
      console.error('Failed to change autopilot mode:', error);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent p-6 border-t border-cyan-400/20 z-10">
      <div className="max-w-6xl mx-auto">
        {/* Main Control Row */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {/* Autopilot Control */}
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Radio className="w-4 h-4 text-cyan-400" />
              <span className="font-orbitron text-xs text-slate-400">AUTOPILOT</span>
            </div>
            <div className="space-y-2">
              {['continuous', 'event-driven', 'manual'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => handleAutopilotChange(mode)}
                  disabled={tasksLoading}
                  className={`w-full px-2 py-1 text-xs rounded font-orbitron transition-all disabled:opacity-50 ${
                    autopilotMode === mode
                      ? 'bg-cyan-400/30 border border-cyan-400 text-cyan-400'
                      : 'bg-slate-800/50 border border-slate-700 text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {mode.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Energy/Wallet */}
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="font-orbitron text-xs text-slate-400">ENERGY CORE</span>
            </div>
            <div className="text-2xl font-bold text-amber-400 mb-2">
              {walletsLoading ? '--' : `$${totalBalance.toFixed(0)}`}
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-amber-400 to-amber-500 h-2 rounded-full"
                style={{ width: `${Math.min(totalBalance > 0 ? 75 : 0, 100)}%` }}
              />
            </div>
            <div className="text-xs text-slate-500 mt-1">Available capital</div>
          </div>

          {/* Task Queue */}
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-violet-400" />
              <span className="font-orbitron text-xs text-slate-400">TASK QUEUE</span>
            </div>
            <div className="text-2xl font-bold text-violet-400 mb-2">
              {tasksLoading ? '--' : activeTasks}
            </div>
            <div className="text-xs text-slate-500">Active executions</div>
          </div>

          {/* Daily Target */}
          <div className="glass-card p-4 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <span className="font-orbitron text-xs text-slate-400">TARGET</span>
            </div>
            <div className="text-2xl font-bold text-emerald-400 mb-2">
              {goalsLoading ? '--' : `$${goal?.daily_target || 0}`}
            </div>
            <div className="text-xs text-slate-500">Daily profit goal</div>
          </div>
        </div>

        {/* System Status Bar */}
        <div className="flex items-center gap-4 text-xs font-orbitron">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-slate-400">SYSTEMS OPERATIONAL</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>
            <span className="text-slate-400">LINK ACTIVE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
            <span className="text-slate-400">SCANNING...</span>
          </div>
        </div>
      </div>
    </div>
  );
}