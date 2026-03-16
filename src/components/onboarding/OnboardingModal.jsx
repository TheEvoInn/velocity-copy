import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Zap, ArrowRight, Target, DollarSign, Clock, Shield } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usePersistentUserData } from '@/hooks/usePersistentUserData';

const SKILLS = [
  "Writing", "Design", "Coding", "Marketing", "Sales", "Social Media",
  "Data Analysis", "Research", "Photography", "Video Editing",
  "SEO", "Customer Service", "Teaching", "Translation", "Accounting"
];

export default function OnboardingModal({ onComplete }) {
  const [step, setStep] = useState(0);
  const [goals, setGoals] = useState({
    daily_target: 1000,
    available_capital: 0,
    risk_tolerance: 'moderate',
    preferred_categories: [],
    skills: [],
    hours_per_day: 8,
    wallet_balance: 0,
    total_earned: 0,
    onboarded: true
  });

  const queryClient = useQueryClient();
  const { updateField } = usePersistentUserData();

  const createMutation = useMutation({
    mutationFn: async (data) => {
      const result = await base44.entities.UserGoals.create(data);
      // Save onboarding completion permanently
      await updateField('onboarding_completed', true);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userGoals'] });
      onComplete();
    }
  });

  const toggleSkill = (skill) => {
    setGoals(prev => ({
      ...prev,
      skills: prev.skills.includes(skill) 
        ? prev.skills.filter(s => s !== skill) 
        : [...prev.skills, skill]
    }));
  };

  const steps = [
    // Step 0: Welcome
    <div key={0} className="text-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-emerald-500/20 flex items-center justify-center mx-auto mb-6">
        <Zap className="w-8 h-8 text-emerald-400" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Profit Engine AI</h2>
      <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto">
        Your AI-powered profit engine is ready. Let's configure it to match your goals and start generating opportunities.
      </p>
      <Button onClick={() => setStep(1)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8">
        Get Started <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>,
    
    // Step 1: Capital & Target
    <div key={1}>
      <div className="flex items-center gap-2 mb-6">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Financial Setup</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Starting Capital ($)</label>
          <Input
            type="number"
            value={goals.available_capital}
            onChange={e => setGoals(prev => ({ ...prev, available_capital: parseFloat(e.target.value) || 0 }))}
            className="bg-slate-800 border-slate-700 text-white"
            placeholder="0 if starting from scratch"
          />
          <p className="text-[10px] text-slate-600 mt-1">Enter 0 to get $0-start strategies only</p>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Daily Profit Target ($)</label>
          <Input
            type="number"
            value={goals.daily_target}
            onChange={e => setGoals(prev => ({ ...prev, daily_target: parseFloat(e.target.value) || 1000 }))}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Hours Available Per Day</label>
          <Input
            type="number"
            value={goals.hours_per_day}
            onChange={e => setGoals(prev => ({ ...prev, hours_per_day: parseFloat(e.target.value) || 8 }))}
            className="bg-slate-800 border-slate-700 text-white"
          />
        </div>
      </div>
      <Button onClick={() => setStep(2)} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white">
        Next <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>,

    // Step 2: Risk & Skills
    <div key={2}>
      <div className="flex items-center gap-2 mb-6">
        <Shield className="w-5 h-5 text-amber-400" />
        <h2 className="text-lg font-bold text-white">Risk & Skills</h2>
      </div>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 block mb-1.5">Risk Tolerance</label>
          <Select value={goals.risk_tolerance} onValueChange={v => setGoals(prev => ({ ...prev, risk_tolerance: v }))}>
            <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="conservative">Conservative — Low risk, steady gains</SelectItem>
              <SelectItem value="moderate">Moderate — Balanced risk/reward</SelectItem>
              <SelectItem value="aggressive">Aggressive — Maximum velocity, higher risk</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-2">Your Skills (select all that apply)</label>
          <div className="flex flex-wrap gap-2">
            {SKILLS.map(skill => (
              <button
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  goals.skills.includes(skill)
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                }`}
              >
                {skill}
              </button>
            ))}
          </div>
        </div>
      </div>
      <Button 
        onClick={() => createMutation.mutate(goals)} 
        disabled={createMutation.isPending}
        className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        <Zap className="w-4 h-4 mr-2" /> Launch Profit Engine
      </Button>
    </div>
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6">
        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-6 justify-center">
          {[0, 1, 2].map(i => (
            <div key={i} className={`h-1 rounded-full transition-all ${
              i <= step ? 'bg-emerald-500 w-8' : 'bg-slate-700 w-4'
            }`} />
          ))}
        </div>
        {steps[step]}
      </div>
    </div>
  );
}