import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Zap, Bot, Power, Target, Settings, ChevronDown, ChevronUp, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

const AI_CATEGORIES = [
  { value: 'arbitrage', label: 'Arbitrage' },
  { value: 'service', label: 'Service' },
  { value: 'lead_gen', label: 'Lead Gen' },
  { value: 'digital_flip', label: 'Digital Flip' },
  { value: 'freelance', label: 'Freelance' },
  { value: 'resale', label: 'Resale' },
  { value: 'content', label: 'Content' },
];

export default function AutopilotPanel({ goals, onUpdate }) {
  const [expanded, setExpanded] = useState(false);
  const [aiTarget, setAiTarget] = useState(goals?.ai_daily_target || 500);
  const [userTarget, setUserTarget] = useState(goals?.user_daily_target || 500);
  const [aiInstructions, setAiInstructions] = useState(goals?.ai_instructions || '');
  const [aiCategories, setAiCategories] = useState(goals?.ai_preferred_categories || []);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.UserGoals.update(goals.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      if (onUpdate) onUpdate();
    }
  });

  const toggleAutopilot = () => {
    updateMutation.mutate({ autopilot_enabled: !goals.autopilot_enabled });
  };

  const toggleCategory = (cat) => {
    setAiCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );
  };

  const saveSettings = () => {
    updateMutation.mutate({
      ai_daily_target: parseFloat(aiTarget) || 500,
      user_daily_target: parseFloat(userTarget) || 500,
      ai_instructions: aiInstructions,
      ai_preferred_categories: aiCategories,
      daily_target: (parseFloat(aiTarget) || 500) + (parseFloat(userTarget) || 500)
    });
  };

  const isEnabled = goals?.autopilot_enabled;

  return (
    <div className={`rounded-2xl border transition-colors ${isEnabled ? 'bg-emerald-950/20 border-emerald-700/30' : 'bg-slate-900/80 border-slate-800'}`}>
      {/* Header Row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-xl border ${isEnabled ? 'bg-emerald-500/15 border-emerald-500/30' : 'bg-slate-800 border-slate-700'}`}>
            <Bot className={`w-4 h-4 ${isEnabled ? 'text-emerald-400' : 'text-slate-500'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">AI Autopilot</span>
              {isEnabled && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full">
                  <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500">
              {isEnabled ? `Running every 30 min · Target $${goals.ai_daily_target || 500}/day` : 'Paused — enable to start earning'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch
            checked={!!isEnabled}
            onCheckedChange={toggleAutopilot}
            className="data-[state=checked]:bg-emerald-600"
          />
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded Settings */}
      {expanded && (
        <div className="border-t border-slate-800/50 p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">
                AI Daily Target ($)
              </label>
              <Input
                type="number"
                value={aiTarget}
                onChange={e => setAiTarget(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm h-9"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">
                Your Daily Target ($)
              </label>
              <Input
                type="number"
                value={userTarget}
                onChange={e => setUserTarget(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white text-sm h-9"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-2">
              AI Focus Categories
            </label>
            <div className="flex flex-wrap gap-1.5">
              {AI_CATEGORIES.map(cat => (
                <button
                  key={cat.value}
                  onClick={() => toggleCategory(cat.value)}
                  className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${
                    aiCategories.includes(cat.value)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">
              Custom AI Instructions
            </label>
            <textarea
              value={aiInstructions}
              onChange={e => setAiInstructions(e.target.value)}
              placeholder="E.g. Focus on freelance writing and content creation. Avoid anything requiring upfront payment. Prioritize passive income streams."
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 resize-none focus:outline-none focus:border-emerald-500/50"
            />
          </div>

          <Button
            onClick={saveSettings}
            disabled={updateMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
          >
            <Save className="w-3.5 h-3.5 mr-1.5" />
            {updateMutation.isPending ? 'Saving...' : 'Save Autopilot Settings'}
          </Button>
        </div>
      )}
    </div>
  );
}