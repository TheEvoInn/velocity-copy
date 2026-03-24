import React from 'react';
import { Button } from '@/components/ui/button';
import { Zap, ArrowRight, Bot, Shield, DollarSign, Rocket, Workflow } from 'lucide-react';

export default function StepWelcome({ onNext }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto mb-6 w-20 h-20">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-600/30 to-cyan-500/20 border border-violet-500/30 flex items-center justify-center">
          <Zap className="w-9 h-9 text-violet-400" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
          <Rocket className="w-3 h-3 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white mb-1 font-orbitron">Welcome to VELOCITY</h2>
      <p className="text-sm text-violet-300 mb-6">PROFIT ENGINE — Setup Required</p>

      <p className="text-sm text-slate-400 mb-8 max-w-sm mx-auto leading-relaxed">
        To activate your VELOCITY Autopilot, we need to configure your identity, compliance status, preferences, and payment details. This takes about <strong className="text-white">5 minutes</strong> and only happens once.
      </p>

      <div className="grid grid-cols-2 gap-3 mb-8 text-left">
        {[
          { icon: Bot, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', label: 'AI Identity', desc: 'Create your Autopilot persona' },
          { icon: Shield, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'KYC Compliance', desc: 'Verify for high-value tasks' },
          { icon: Zap, color: 'text-cyan-400', bg: 'bg-cyan-500/10 border-cyan-500/20', label: 'Autopilot Config', desc: 'Set risk & earning targets' },
          { icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Banking Setup', desc: 'Link your payout account' },
          { icon: Workflow, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20', label: 'Workflows', desc: 'AI-matched strategy templates' },
        ].map(({ icon: Icon, color, bg, label, desc }) => (
          <div key={label} className={`rounded-xl border p-3 ${bg}`}>
            <Icon className={`w-4 h-4 ${color} mb-1.5`} />
            <div className="text-xs font-semibold text-white">{label}</div>
            <div className="text-[10px] text-slate-500">{desc}</div>
          </div>
        ))}
      </div>

      <Button onClick={onNext} className="w-full bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white h-11 font-semibold">
        Begin Setup <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}