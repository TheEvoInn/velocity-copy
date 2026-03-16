import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Settings, ChevronDown, ChevronUp, Plus, Trash2, Shield } from 'lucide-react';

const REINVEST_CATEGORIES = [
  'digital_flip', 'arbitrage', 'lead_gen', 'service', 'auction', 'resale', 'tool', 'upgrade'
];

const FREQ_OPTIONS = [
  { value: 'instant', label: 'Instant (as soon as eligible)' },
  { value: 'daily', label: 'Daily batch' },
  { value: 'weekly', label: 'Weekly batch' }
];

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

export default function PolicyEditor({ policy, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    min_withdrawal_threshold: policy?.min_withdrawal_threshold ?? 100,
    min_reinvestment_threshold: policy?.min_reinvestment_threshold ?? 50,
    safety_buffer: policy?.safety_buffer ?? 200,
    max_reinvestment_pct: policy?.max_reinvestment_pct ?? 40,
    withdrawal_pct: policy?.withdrawal_pct ?? 60,
    auto_transfer_frequency: policy?.auto_transfer_frequency ?? 'daily',
    preferred_reinvestment_categories: policy?.preferred_reinvestment_categories ?? [],
    daily_withdrawal_limit: policy?.daily_withdrawal_limit ?? 5000,
    daily_reinvestment_limit: policy?.daily_reinvestment_limit ?? 500,
    fraud_detection_enabled: policy?.fraud_detection_enabled ?? true,
    alert_on_delay: policy?.alert_on_delay ?? true,
    max_retry_attempts: policy?.max_retry_attempts ?? 3,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const toggleCat = (cat) => {
    const cats = form.preferred_reinvestment_categories;
    set('preferred_reinvestment_categories', cats.includes(cat) ? cats.filter(c => c !== cat) : [...cats, cat]);
  };

  const handleSave = async () => {
    setSaving(true);
    await base44.functions.invoke('withdrawalEngine', { action: 'update_policy', policy_data: form });
    await onSaved?.();
    setSaving(false);
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Engine Policy Configuration</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-5">
          {/* Thresholds */}
          <div>
            <div className="text-xs font-semibold text-slate-400 mb-3 flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-emerald-400" /> Threshold Controls
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <Field label="Safety Buffer ($)" hint="Always keep this in wallet">
                <Input type="number" value={form.safety_buffer} onChange={e => set('safety_buffer', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Min Withdrawal Threshold ($)" hint="Auto-withdraw above this">
                <Input type="number" value={form.min_withdrawal_threshold} onChange={e => set('min_withdrawal_threshold', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Min Reinvestment Threshold ($)" hint="Auto-reinvest above this">
                <Input type="number" value={form.min_reinvestment_threshold} onChange={e => set('min_reinvestment_threshold', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Withdrawal %" hint="% of eligible funds to withdraw">
                <Input type="number" min="0" max="100" value={form.withdrawal_pct} onChange={e => set('withdrawal_pct', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Max Reinvestment %" hint="% of eligible funds to reinvest">
                <Input type="number" min="0" max="100" value={form.max_reinvestment_pct} onChange={e => set('max_reinvestment_pct', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Auto-Transfer Frequency">
                <select value={form.auto_transfer_frequency} onChange={e => set('auto_transfer_frequency', e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none h-8">
                  {FREQ_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </Field>
              <Field label="Daily Withdrawal Limit ($)">
                <Input type="number" value={form.daily_withdrawal_limit} onChange={e => set('daily_withdrawal_limit', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Daily Reinvestment Limit ($)">
                <Input type="number" value={form.daily_reinvestment_limit} onChange={e => set('daily_reinvestment_limit', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
              <Field label="Max Retry Attempts">
                <Input type="number" min="1" max="5" value={form.max_retry_attempts} onChange={e => set('max_retry_attempts', +e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </Field>
            </div>
          </div>

          {/* Reinvestment categories */}
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Preferred Reinvestment Categories</div>
            <div className="flex flex-wrap gap-2">
              {REINVEST_CATEGORIES.map(cat => {
                const active = form.preferred_reinvestment_categories.includes(cat);
                return (
                  <button key={cat} onClick={() => toggleCat(cat)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      active ? 'bg-violet-600/20 border-violet-500/40 text-violet-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-500'
                    }`}>
                    {cat}
                  </button>
                );
              })}
              {form.preferred_reinvestment_categories.length === 0 && (
                <span className="text-[10px] text-slate-600">None selected = all categories eligible</span>
              )}
            </div>
          </div>

          {/* Safety switches */}
          <div className="flex items-center gap-6">
            {[
              { key: 'fraud_detection_enabled', label: 'Fraud Detection', color: 'text-amber-400' },
              { key: 'alert_on_delay', label: 'Alert on Payout Delay', color: 'text-blue-400' }
            ].map(sw => (
              <label key={sw.key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[sw.key]} onChange={e => set(sw.key, e.target.checked)}
                  className="rounded w-3.5 h-3.5" />
                <span className={`text-xs ${sw.color}`}>{sw.label}</span>
              </label>
            ))}
          </div>

          <Button onClick={handleSave} disabled={saving} size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5">
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Policy'}
          </Button>
        </div>
      )}
    </div>
  );
}