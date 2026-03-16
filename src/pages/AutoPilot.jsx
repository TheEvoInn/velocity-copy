import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bot, Zap, Play, RefreshCw, DollarSign, Target, User, TrendingUp, Settings, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import AutopilotPanel from '../components/autopilot/AutopilotPanel';
import AITaskFeed from '../components/autopilot/AITaskFeed';
import DualStreamCard from '../components/autopilot/DualStreamCard';

export default function AutoPilot() {
  const [isManualRunning, setIsManualRunning] = useState(false);
  const [isScanRunning, setIsScanRunning] = useState(false);
  const [platformNotes, setPlatformNotes] = useState('');
  const queryClient = useQueryClient();

  const { data: userGoals = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });

  const { data: aiTasks = [], refetch: refetchTasks } = useQuery({
    queryKey: ['aiTasks'],
    queryFn: () => base44.entities.AITask.list('-created_date', 50),
    initialData: [],
    refetchInterval: 15000, // refresh every 15s
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
    initialData: [],
  });

  const goals = userGoals[0] || {};

  // Calculate stream earnings for today
  const today = new Date().toDateString();
  const todayTxs = transactions.filter(t =>
    t.type === 'income' && new Date(t.created_date).toDateString() === today
  );

  const aiEarnedToday = todayTxs
    .filter(t => t.description?.startsWith('[AI Autopilot]'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const userEarnedToday = todayTxs
    .filter(t => !t.description?.startsWith('[AI Autopilot]'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const todayTasks = aiTasks.filter(t =>
    t.created_date && new Date(t.created_date).toDateString() === today
  );

  const runManualCycle = async () => {
    setIsManualRunning(true);
    try {
      await base44.functions.invoke('aiAutoPilot', {});
      await refetchTasks();
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
    } finally {
      setIsManualRunning(false);
    }
  };

  const runScan = async () => {
    setIsScanRunning(true);
    try {
      await base44.functions.invoke('scanOpportunities', {});
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['activityLogs'] });
    } finally {
      setIsScanRunning(false);
    }
  };

  const savePlatformInfo = async () => {
    if (!goals.id) return;
    await base44.entities.UserGoals.update(goals.id, {
      platform_accounts: { notes: platformNotes }
    });
    queryClient.invalidateQueries({ queryKey: ['userGoals'] });
  };

  React.useEffect(() => {
    if (goals?.platform_accounts?.notes) {
      setPlatformNotes(goals.platform_accounts.notes);
    }
  }, [goals.id]);

  const totalAIEarned = goals.ai_total_earned || 0;
  const totalAITasks = aiTasks.filter(t => t.stream === 'ai_autonomous' && t.status === 'completed').length;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-400" />
            AI Autopilot
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Autonomous profit generation — runs 24/7</p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={runScan}
            disabled={isScanRunning}
            className="border-slate-700 text-slate-400 hover:text-white text-xs h-8"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isScanRunning ? 'animate-spin' : ''}`} />
            Scan Market
          </Button>
          <Button
            size="sm"
            onClick={runManualCycle}
            disabled={isManualRunning || !goals.autopilot_enabled}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
          >
            <Play className={`w-3.5 h-3.5 mr-1.5 ${isManualRunning ? 'animate-pulse' : ''}`} />
            {isManualRunning ? 'Running...' : 'Run Now'}
          </Button>
        </div>
      </div>

      {/* Autopilot Toggle Panel */}
      <AutopilotPanel goals={goals} onUpdate={() => queryClient.invalidateQueries({ queryKey: ['userGoals'] })} />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Bot className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">AI Earned Total</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">${totalAIEarned.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">Tasks Completed</span>
          </div>
          <div className="text-xl font-bold text-amber-400">{totalAITasks}</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">AI Today</span>
          </div>
          <div className="text-xl font-bold text-emerald-400">${aiEarnedToday.toFixed(2)}</div>
        </div>
        <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-4">
          <div className="flex items-center gap-1.5 mb-2">
            <User className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-[10px] text-slate-500 uppercase tracking-wider">You Today</span>
          </div>
          <div className="text-xl font-bold text-blue-400">${userEarnedToday.toFixed(2)}</div>
        </div>
      </div>

      {/* Dual Stream Progress */}
      <DualStreamCard
        aiEarned={aiEarnedToday}
        userEarned={userEarnedToday}
        aiTarget={goals.ai_daily_target || 500}
        userTarget={goals.user_daily_target || 500}
      />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* AI Task Feed */}
        <div>
          <AITaskFeed tasks={aiTasks} isRunning={isManualRunning} />
        </div>

        {/* Platform Info + Instructions */}
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-slate-400" />
              <span className="text-sm font-semibold text-white">Platform Accounts & Context</span>
            </div>
            <p className="text-[10px] text-slate-500 mb-3 leading-relaxed">
              Tell the AI about your accounts, platforms, niche expertise, or any context that helps it make better decisions on your behalf.
            </p>
            <textarea
              value={platformNotes}
              onChange={e => setPlatformNotes(e.target.value)}
              placeholder="E.g. I have an Upwork account (Top Rated). I'm a skilled writer specializing in tech. I have an eBay seller account with 200 reviews. My Etsy store sells digital downloads..."
              rows={5}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-emerald-500/50 mb-3"
            />
            <Button
              onClick={savePlatformInfo}
              className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs h-8"
            >
              Save Context
            </Button>
          </div>

          {/* How It Works */}
          <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5">
            <h3 className="text-xs font-semibold text-white mb-3 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
              How Autopilot Works
            </h3>
            <div className="space-y-2.5">
              {[
                { step: '1', text: 'Every 30 minutes, the AI scans your profile, goals, and open opportunities.' },
                { step: '2', text: 'It selects the highest-value task matching your skills and preferences.' },
                { step: '3', text: 'Executes the task autonomously, logging each step in real time.' },
                { step: '4', text: 'Revenue is calculated and automatically deposited to your wallet.' },
                { step: '5', text: 'Stops when your AI daily target is reached. Resets at midnight.' },
              ].map(item => (
                <div key={item.step} className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-[9px] font-bold text-emerald-400 shrink-0 mt-0.5">
                    {item.step}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}