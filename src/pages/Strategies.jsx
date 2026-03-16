import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BookOpen, Zap, Target, Shield, TrendingUp, Play, Pause, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

const variantConfig = {
  fastest: { icon: Zap, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Fastest' },
  safest: { icon: Shield, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Safest' },
  highest_yield: { icon: TrendingUp, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Highest Yield' },
};

function StrategyCard({ strategy }) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const variant = variantConfig[strategy.variant] || variantConfig.fastest;
  const Icon = variant.icon;

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Strategy.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['strategies'] })
  });

  const toggleStep = (i) => {
    const steps = [...(strategy.steps || [])];
    steps[i] = { ...steps[i], completed: !steps[i].completed };
    updateMutation.mutate({ id: strategy.id, data: { steps } });
  };

  const updateStatus = (status) => {
    updateMutation.mutate({ id: strategy.id, data: { status } });
  };

  const completedSteps = (strategy.steps || []).filter(s => s.completed).length;
  const totalSteps = (strategy.steps || []).length;

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${variant.bg} border`}>
              <Icon className={`w-3.5 h-3.5 ${variant.color}`} />
            </div>
            <Badge variant="outline" className={`${variant.bg} border ${variant.color} text-[10px]`}>
              {variant.label}
            </Badge>
            <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-400">
              {strategy.status}
            </Badge>
          </div>
          {strategy.target_daily_profit && (
            <span className="text-xs font-bold text-emerald-400">${strategy.target_daily_profit}/day</span>
          )}
        </div>
        
        <h3 className="font-semibold text-white text-sm mb-1">{strategy.title}</h3>
        <p className="text-xs text-slate-400 mb-3 line-clamp-2">{strategy.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs">
            {strategy.starting_capital === 0 && (
              <span className="text-emerald-500 font-medium">$0 start</span>
            )}
            {strategy.time_to_first_dollar && (
              <span className="text-slate-500">First $: {strategy.time_to_first_dollar}</span>
            )}
            {totalSteps > 0 && (
              <span className="text-slate-500">{completedSteps}/{totalSteps} steps</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {strategy.status === 'draft' && (
              <Button size="sm" onClick={() => updateStatus('active')} className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white">
                <Play className="w-3 h-3 mr-1" /> Start
              </Button>
            )}
            {strategy.status === 'active' && (
              <Button size="sm" onClick={() => updateStatus('paused')} variant="outline" className="h-7 text-xs border-slate-700 text-slate-400">
                <Pause className="w-3 h-3 mr-1" /> Pause
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setExpanded(!expanded)} className="h-7 text-xs text-slate-400">
              {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </Button>
          </div>
        </div>
      </div>

      {expanded && strategy.steps && strategy.steps.length > 0 && (
        <div className="border-t border-slate-800 p-4 space-y-2">
          {strategy.steps.map((step, i) => (
            <button
              key={i}
              onClick={() => toggleStep(i)}
              className="w-full flex items-start gap-3 p-2.5 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors text-left"
            >
              {step.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-600 mt-0.5 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-slate-600 font-medium">{step.day}</span>
                <p className={`text-xs ${step.completed ? 'text-slate-500 line-through' : 'text-slate-300'}`}>
                  {step.action}
                </p>
                {step.expected_outcome && (
                  <p className="text-[10px] text-slate-600 mt-0.5">→ {step.expected_outcome}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Strategies() {
  const { data: strategies = [] } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => base44.entities.Strategy.list('-created_date', 50),
    initialData: [],
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-400" />
            Strategies
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">{strategies.length} strategies generated</p>
        </div>
        <Link to="/Chat">
          <Button size="sm" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
            <Zap className="w-3.5 h-3.5 mr-1" /> Generate Strategy
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {strategies.map(s => <StrategyCard key={s.id} strategy={s} />)}
      </div>

      {strategies.length === 0 && (
        <div className="text-center py-16">
          <BookOpen className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No strategies yet.</p>
          <p className="text-xs text-slate-600 mt-1">Ask the AI to generate a profit strategy for you.</p>
          <Link to="/Chat">
            <Button size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
              <Zap className="w-3.5 h-3.5 mr-1" /> Generate Now
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}