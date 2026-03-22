import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Target, Bot, User, Save, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function ProfitTargetPanel({ goals, onUpdate }) {
  const qc = useQueryClient();
  const [aiTarget, setAiTarget] = useState(goals?.ai_daily_target || 500);
  const [userTarget, setUserTarget] = useState(goals?.user_daily_target || 500);
  const [aiInstructions, setAiInstructions] = useState(goals?.ai_instructions || '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (goals?.id) {
      setAiTarget(goals.ai_daily_target || 500);
      setUserTarget(goals.user_daily_target || 500);
      setAiInstructions(goals.ai_instructions || '');
    }
  }, [goals?.id]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ai = parseFloat(aiTarget) || 500;
      const user = parseFloat(userTarget) || 500;
      const data = {
        ai_daily_target: ai,
        user_daily_target: user,
        ai_instructions: aiInstructions,
        daily_target: ai + user,
      };

      if (goals?.id) {
        return base44.entities.UserGoals.update(goals.id, data);
      } else {
        return base44.entities.UserGoals.create(data);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userGoals'] });
      if (onUpdate) onUpdate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const totalTarget = (parseFloat(aiTarget) || 0) + (parseFloat(userTarget) || 0);
  const aiPct = totalTarget > 0 ? ((parseFloat(aiTarget) || 0) / totalTarget) * 100 : 50;

  return (
    <div className="glass-card rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', boxShadow: '0 0 12px rgba(245,158,11,0.2)' }}>
          <Target className="w-4 h-4 text-amber-400" />
        </div>
        <div>
          <h3 className="font-orbitron text-sm font-bold tracking-wide text-white">PROFIT TARGETS</h3>
          <p className="text-[10px] text-slate-500">Daily mission objectives</p>
        </div>
        <div className="ml-auto font-orbitron text-lg font-bold text-amber-400"
          style={{ textShadow: '0 0 20px rgba(245,158,11,0.6)' }}>
          ${totalTarget.toFixed(0)}<span className="text-xs text-slate-500">/day</span>
        </div>
      </div>

      {/* Split bar visualization */}
      <div>
        <div className="flex justify-between text-[10px] text-slate-500 mb-1">
          <span className="font-orbitron">AI STREAM</span>
          <span className="font-orbitron">USER STREAM</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden flex"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <div className="h-full transition-all duration-500"
            style={{ width: `${aiPct}%`, background: 'linear-gradient(90deg, #10b981, #06b6d4)', boxShadow: '2px 0 8px rgba(16,185,129,0.5)' }} />
          <div className="h-full flex-1"
            style={{ background: 'linear-gradient(90deg, #3b82f6, #a855f7)' }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-emerald-400 font-orbitron">{aiPct.toFixed(0)}% AI</span>
          <span className="text-[10px] text-blue-400 font-orbitron">{(100 - aiPct).toFixed(0)}% YOU</span>
        </div>
      </div>

      {/* Target Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-orbitron tracking-widest text-emerald-400/70 mb-1.5">
            <Bot className="w-3 h-3" /> AI DAILY TARGET
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 text-sm font-bold">$</span>
            <Input
              type="number"
              value={aiTarget}
              onChange={e => setAiTarget(e.target.value)}
              className="pl-6 bg-slate-900/60 border-emerald-500/25 text-white text-sm h-10 focus:border-emerald-500/60"
            />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-[10px] font-orbitron tracking-widest text-blue-400/70 mb-1.5">
            <User className="w-3 h-3" /> YOUR DAILY TARGET
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 text-sm font-bold">$</span>
            <Input
              type="number"
              value={userTarget}
              onChange={e => setUserTarget(e.target.value)}
              className="pl-6 bg-slate-900/60 border-blue-500/25 text-white text-sm h-10 focus:border-blue-500/60"
            />
          </div>
        </div>
      </div>

      {/* AI Instructions */}
      <div>
        <label className="text-[10px] font-orbitron tracking-widest text-slate-500 block mb-1.5">
          CUSTOM AI MISSION BRIEF
        </label>
        <textarea
          value={aiInstructions}
          onChange={e => setAiInstructions(e.target.value)}
          placeholder="E.g. Focus on freelance writing and tech content. Avoid anything requiring upfront payment. Prioritize passive income opportunities over $50..."
          rows={3}
          className="w-full rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none transition-colors"
          style={{
            background: 'rgba(15,21,53,0.6)',
            border: '1px solid rgba(124,58,237,0.2)',
          }}
          onFocus={e => e.target.style.borderColor = 'rgba(124,58,237,0.5)'}
          onBlur={e => e.target.style.borderColor = 'rgba(124,58,237,0.2)'}
        />
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full text-xs h-9 font-orbitron tracking-wide"
        style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)', boxShadow: '0 0 16px rgba(245,158,11,0.3)' }}
      >
        <Save className="w-3.5 h-3.5 mr-1.5" />
        {saved ? '✓ TARGETS LOCKED' : saveMutation.isPending ? 'SAVING...' : 'LOCK IN TARGETS'}
      </Button>
    </div>
  );
}