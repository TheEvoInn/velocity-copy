import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Shield, AlertTriangle, DollarSign, Percent, Save, Sliders } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';

const RISK_LEVELS = [
  { key: 'conservative', label: 'Conservative', color: '#10b981', desc: 'Low risk · Stable returns', icon: '🛡️' },
  { key: 'moderate', label: 'Moderate', color: '#3b82f6', desc: 'Balanced risk/reward', icon: '⚖️' },
  { key: 'aggressive', label: 'Aggressive', color: '#ef4444', desc: 'High risk · High reward', icon: '🔥' },
];

export default function RiskManagementPanel({ goals, onUpdate }) {
  const qc = useQueryClient();
  const [riskTolerance, setRiskTolerance] = useState(goals?.risk_tolerance || 'moderate');
  const [maxDailySpend, setMaxDailySpend] = useState(500);
  const [minProfitThreshold, setMinProfitThreshold] = useState(10);
  const [skipCaptcha, setSkipCaptcha] = useState(true);
  const [skipKyc, setSkipKyc] = useState(false);
  const [minSuccessProb, setMinSuccessProb] = useState(60);
  const [emergencyStop, setEmergencyStop] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (goals) {
      setRiskTolerance(goals.risk_tolerance || 'moderate');
      setMaxDailySpend(goals.available_capital || 500);
      setMinProfitThreshold(goals.daily_target || 10);
    }
  }, [goals?.id, goals?.risk_tolerance, goals?.available_capital, goals?.daily_target]);

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.UserGoals.update(goals.id, {
      risk_tolerance: riskTolerance,
      available_capital: maxDailySpend,
      daily_target: minProfitThreshold,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userGoals'] });
      if (onUpdate) onUpdate();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: (error) => {
      console.error('Failed to save risk profile:', error);
    },
  });

  const selectedRisk = RISK_LEVELS.find(r => r.key === riskTolerance);

  return (
    <div className="glass-card rounded-2xl p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', boxShadow: '0 0 12px rgba(239,68,68,0.2)' }}>
          <Shield className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <h3 className="font-orbitron text-sm font-bold tracking-wide text-white">RISK MANAGEMENT</h3>
          <p className="text-[10px] text-slate-500">Autonomous risk controls & guardrails</p>
        </div>
      </div>

      {/* Risk Level Selector */}
      <div>
        <p className="text-[10px] font-orbitron tracking-widest text-slate-500 mb-2">RISK PROFILE</p>
        <div className="grid grid-cols-3 gap-2">
          {RISK_LEVELS.map(level => (
            <button
              key={level.key}
              onClick={() => setRiskTolerance(level.key)}
              className="p-3 rounded-xl text-center transition-all"
              style={{
                background: riskTolerance === level.key ? `${level.color}15` : 'rgba(255,255,255,0.03)',
                border: `1px solid ${riskTolerance === level.key ? level.color + '50' : 'rgba(255,255,255,0.08)'}`,
                boxShadow: riskTolerance === level.key ? `0 0 16px ${level.color}25` : 'none',
              }}
            >
              <div className="text-xl mb-1">{level.icon}</div>
              <div className="text-xs font-semibold" style={{ color: riskTolerance === level.key ? level.color : '#94a3b8' }}>
                {level.label}
              </div>
              <div className="text-[9px] text-slate-600 mt-0.5">{level.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Numeric Guards */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-orbitron tracking-widest text-slate-500 block mb-1.5">
            MAX DAILY SPEND ($)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              type="number"
              value={maxDailySpend}
              onChange={e => setMaxDailySpend(Number(e.target.value))}
              className="pl-7 bg-slate-900/60 border-slate-700/60 text-white text-sm h-9"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-orbitron tracking-widest text-slate-500 block mb-1.5">
            MIN PROFIT THRESHOLD ($)
          </label>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
              type="number"
              value={minProfitThreshold}
              onChange={e => setMinProfitThreshold(Number(e.target.value))}
              className="pl-7 bg-slate-900/60 border-slate-700/60 text-white text-sm h-9"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] font-orbitron tracking-widest text-slate-500 block mb-1.5">
            MIN SUCCESS PROBABILITY (%)
          </label>
          <div className="relative">
            <Percent className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <Input
             type="number"
             min={0} max={100}
             value={minSuccessProb}
             onChange={e => setMinSuccessProb(Number(e.target.value))}
             className="pl-7 bg-slate-900/60 border-slate-700/60 text-white text-sm h-9"
            />
          </div>
        </div>
        <div className="flex items-end">
          <div className="w-full h-9 rounded-lg flex items-center justify-center text-xs font-orbitron tracking-wide"
            style={{
              background: `${selectedRisk?.color}15`,
              border: `1px solid ${selectedRisk?.color}30`,
              color: selectedRisk?.color,
            }}>
            {selectedRisk?.icon} {selectedRisk?.label?.toUpperCase()}
          </div>
        </div>
      </div>

      {/* Toggle Guards */}
      <div className="space-y-2.5">
        <p className="text-[10px] font-orbitron tracking-widest text-slate-500">EXECUTION GUARDS</p>
        {[
          { label: 'Skip CAPTCHA-required tasks', sub: 'Avoids tasks needing human CAPTCHA solving', value: skipCaptcha, setter: setSkipCaptcha, color: '#f59e0b' },
          { label: 'Skip KYC-required tasks', sub: 'Bypass tasks requiring identity verification', value: skipKyc, setter: setSkipKyc, color: '#a855f7' },
        ].map(item => (
          <div key={item.label} className="flex items-center justify-between p-3 rounded-xl"
            style={{
              background: item.value ? `${item.color}08` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${item.value ? item.color + '25' : 'rgba(255,255,255,0.06)'}`,
            }}>
            <div>
              <p className="text-xs font-medium text-white">{item.label}</p>
              <p className="text-[10px] text-slate-500">{item.sub}</p>
            </div>
            <Switch checked={item.value} onCheckedChange={item.setter} />
          </div>
        ))}
      </div>

      {/* Emergency Stop */}
      <div className="p-3 rounded-xl transition-all"
        style={{
          background: emergencyStop ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${emergencyStop ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)'}`,
          boxShadow: emergencyStop ? '0 0 20px rgba(239,68,68,0.2)' : 'none',
        }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <div>
              <p className="text-xs font-semibold text-white">Emergency Stop</p>
              <p className="text-[10px] text-slate-500">Immediately halt ALL autonomous execution</p>
            </div>
          </div>
          <Switch
            checked={emergencyStop}
            onCheckedChange={setEmergencyStop}
          />
        </div>
        {emergencyStop && (
          <p className="text-[11px] text-red-300 mt-2 font-orbitron tracking-wide">
            ⚠ ALL AUTOPILOT ROUTINES HALTED
          </p>
        )}
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || !goals?.id}
        className="w-full text-xs h-9 font-orbitron tracking-wide"
        style={{ background: 'linear-gradient(135deg, #7c3aed, #2563eb)', boxShadow: '0 0 16px rgba(124,58,237,0.3)' }}
      >
        <Save className="w-3.5 h-3.5 mr-1.5" />
        {saved ? '✓ SAVED' : saveMutation.isPending ? 'SAVING...' : 'SAVE RISK PROFILE'}
      </Button>
    </div>
  );
}