import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Shield, ChevronDown, ChevronUp, Save, Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const CATEGORY_LABELS = {
  global: '🌐 Global (all categories)',
  arbitrage: '📊 Arbitrage',
  auction: '🔨 Auction',
  digital_flip: '🔄 Digital Flip',
  freelance: '💼 Freelance',
  resale: '🛒 Resale',
  tool: '🔧 Tools',
  fee: '💳 Fees',
  upgrade: '⬆️ Upgrades',
};

function PolicyRow({ policy, onSave }) {
  const [expanded, setExpanded] = useState(false);
  const [vals, setVals] = useState({
    max_per_task: policy.max_per_task ?? 50,
    max_per_day: policy.max_per_day ?? 200,
    auto_approve_threshold: policy.auto_approve_threshold ?? 10,
    min_roi_pct: policy.min_roi_pct ?? 20,
    max_daily_transactions: policy.max_daily_transactions ?? 10,
    max_chain_depth: policy.max_chain_depth ?? 3,
    conditional_approval_roi_threshold: policy.conditional_approval_roi_threshold ?? 50,
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setVals(prev => ({ ...prev, [k]: parseFloat(v) || 0 }));

  const handleSave = async () => {
    setSaving(true);
    await onSave(policy.id, vals);
    setSaving(false);
  };

  return (
    <div className="rounded-xl bg-slate-800/60 border border-slate-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div>
          <span className="text-xs font-semibold text-white">{CATEGORY_LABELS[policy.category] || policy.category}</span>
          <span className="text-[10px] text-slate-500 ml-2">Max/task: ${vals.max_per_task} · Auto-approve: &lt;${vals.auto_approve_threshold}</span>
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 border-t border-slate-700/50 pt-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {[
              { key: 'max_per_task', label: 'Max Per Task ($)' },
              { key: 'max_per_day', label: 'Max Per Day ($)' },
              { key: 'auto_approve_threshold', label: 'Auto-Approve Under ($)' },
              { key: 'min_roi_pct', label: 'Min ROI Required (%)' },
              { key: 'max_daily_transactions', label: 'Max Daily Transactions' },
              { key: 'max_chain_depth', label: 'Max Chain Depth' },
              { key: 'conditional_approval_roi_threshold', label: 'Conditional Approve ROI (%)' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="text-[9px] text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
                <Input
                  type="number"
                  value={vals[key]}
                  onChange={e => set(key, e.target.value)}
                  className="bg-slate-900 border-slate-600 text-white text-xs h-7"
                />
              </div>
            ))}
          </div>
          <Button onClick={handleSave} disabled={saving} size="sm" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-7">
            {saving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

export default function SpendingPolicyEditor() {
  const queryClient = useQueryClient();
  const [initializing, setInitializing] = useState(false);
  const [open, setOpen] = useState(false);

  const { data: policies = [] } = useQuery({
    queryKey: ['spendingPolicies'],
    queryFn: () => base44.entities.SpendingPolicy.list(),
    initialData: [],
  });

  const handleInit = async () => {
    setInitializing(true);
    await base44.functions.invoke('initSpendingPolicies', {});
    queryClient.invalidateQueries({ queryKey: ['spendingPolicies'] });
    setInitializing(false);
  };

  const handleSave = async (id, data) => {
    await base44.entities.SpendingPolicy.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['spendingPolicies'] });
  };

  const sorted = [...policies].sort((a, b) => {
    if (a.category === 'global') return -1;
    if (b.category === 'global') return 1;
    return a.category.localeCompare(b.category);
  });

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Spending Policies & Caps</span>
          <span className="text-[10px] text-slate-500">{policies.length} rules active</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="border-t border-slate-800 p-4">
          {policies.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-xs text-slate-500 mb-3">No spending policies found. Initialize defaults to get started.</p>
              <Button onClick={handleInit} disabled={initializing} size="sm" className="bg-blue-600 hover:bg-blue-500 text-white text-xs">
                {initializing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <RefreshCw className="w-3.5 h-3.5 mr-1" />}
                Initialize Default Policies
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-[10px] text-slate-500 mb-3">
                Set per-category caps for AI spending. The AI will never exceed these limits and all requests above the auto-approve threshold go to the review queue.
              </p>
              {sorted.map(p => (
                <PolicyRow key={p.id} policy={p} onSave={handleSave} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}