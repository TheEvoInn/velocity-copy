import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
import { Bot, Cpu, Zap, Target, ChevronDown, ChevronUp, User } from 'lucide-react';

const STRATEGIES = [
  { key: 'freelance', label: 'Freelance Jobs', icon: '💼', color: '#3b82f6', desc: 'Auto-apply to matching job listings' },
  { key: 'content', label: 'Content Creation', icon: '✍️', color: '#a855f7', desc: 'Generate & sell AI-written content' },
  { key: 'arbitrage', label: 'Arbitrage', icon: '⚡', color: '#f59e0b', desc: 'Buy low, sell high opportunities' },
  { key: 'lead_gen', label: 'Lead Generation', icon: '🎯', color: '#10b981', desc: 'Identify and qualify leads' },
  { key: 'digital_flip', label: 'Digital Flip', icon: '🔄', color: '#06b6d4', desc: 'Resell digital assets & domains' },
  { key: 'resale', label: 'Resale', icon: '🛒', color: '#ec4899', desc: 'Physical product resell plays' },
  { key: 'contest', label: 'Contests & Grants', icon: '🏆', color: '#f59e0b', desc: 'Auto-enter eligible competitions' },
];

function StrategyToggle({ strategy, enabled, onToggle, identityColor }) {
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl transition-all"
      style={{
        background: enabled ? `${strategy.color}10` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${enabled ? strategy.color + '30' : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      <span className="text-lg">{strategy.icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-white">{strategy.label}</p>
        <p className="text-[10px] text-slate-500 truncate">{strategy.desc}</p>
      </div>
      <Switch
        checked={enabled}
        onCheckedChange={onToggle}
        className="shrink-0"
        style={{ '--switch-active-color': strategy.color }}
      />
    </div>
  );
}

function IdentityCard({ identity, index }) {
  const [expanded, setExpanded] = useState(index === 0);
  const qc = useQueryClient();

  const enabledStrategies = identity.auto_select_for_task_types || [];
  const enabledCategories = identity.preferred_categories || [];

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.AIIdentity.update(identity.id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['identities'] }),
  });

  const toggleStrategy = (key) => {
    const current = identity.auto_select_for_task_types || [];
    const updated = current.includes(key) ? current.filter(k => k !== key) : [...current, key];
    updateMutation.mutate({ auto_select_for_task_types: updated });
  };

  const toggleActive = () => {
    updateMutation.mutate({ is_active: !identity.is_active });
  };

  const color = identity.color || '#7c3aed';
  const activeCount = enabledStrategies.length;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{
        border: `1px solid ${identity.is_active ? color + '40' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: identity.is_active ? `0 0 20px ${color}20` : 'none',
      }}>
      {/* Identity Header */}
      <div className="flex items-center gap-3 p-4"
        style={{ background: identity.is_active ? `${color}10` : 'rgba(15,21,53,0.6)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0"
          style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
          {identity.icon || identity.name?.[0] || '🤖'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-white truncate">{identity.name}</p>
            {identity.is_active && (
              <span className="text-[9px] font-orbitron px-1.5 py-0.5 rounded-full"
                style={{ background: `${color}20`, border: `1px solid ${color}40`, color }}>
                ACTIVE
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-500 truncate">{identity.role_label || 'AI Agent'} · {activeCount} strategies enabled</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={!!identity.is_active} onCheckedChange={toggleActive} />
          <button onClick={() => setExpanded(v => !v)}
            className="p-1 rounded-lg text-slate-500 hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Strategy Toggles */}
      {expanded && (
        <div className="p-4 pt-3 border-t space-y-2" style={{ borderColor: color + '15' }}>
          <p className="text-[10px] font-orbitron tracking-widest text-slate-500 mb-2">EXECUTION STRATEGIES</p>
          {STRATEGIES.map(strategy => (
            <StrategyToggle
              key={strategy.key}
              strategy={strategy}
              enabled={enabledStrategies.includes(strategy.key)}
              onToggle={() => toggleStrategy(strategy.key)}
              identityColor={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function IdentityRoutinePanel() {
  const { data: identities = [] } = useQuery({
    queryKey: ['identities'],
    queryFn: () => base44.entities.AIIdentity.list(),
    initialData: [],
  });

  if (identities.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-6 text-center">
        <Bot className="w-8 h-8 text-slate-600 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No identities found.</p>
        <p className="text-xs text-slate-600 mt-1">Create an identity in the Control Hub to assign execution strategies.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {identities.map((identity, i) => (
        <IdentityCard key={identity.id} identity={identity} index={i} />
      ))}
    </div>
  );
}