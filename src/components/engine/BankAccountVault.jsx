import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Building2, Plus, Trash2, Star, Lock, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

export default function BankAccountVault({ policy, onSaved }) {
  const [expanded, setExpanded] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    label: '', bank_name: '', account_type: 'checking',
    routing: '', account_number: '', confirm_number: '',
    allocation_pct: 100, priority: 1, is_primary: false
  });
  const [error, setError] = useState('');

  const accounts = policy?.bank_accounts || [];
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const validate = () => {
    if (!form.bank_name.trim()) return 'Enter bank name';
    if (!/^\d{9}$/.test(form.routing)) return 'Routing must be 9 digits';
    if (!/^\d{4,17}$/.test(form.account_number)) return 'Account number must be 4–17 digits';
    if (form.account_number !== form.confirm_number) return 'Account numbers do not match';
    const totalPct = accounts.reduce((s, a) => s + (a.allocation_pct || 0), 0) + form.allocation_pct;
    if (totalPct > 100) return `Total allocation ${totalPct}% exceeds 100%`;
    return null;
  };

  const handleAdd = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');

    const newAccount = {
      label: form.label || form.bank_name,
      bank_name: form.bank_name,
      account_type: form.account_type,
      last_four: form.account_number.slice(-4),
      routing_last_four: form.routing.slice(-4),
      allocation_pct: form.allocation_pct,
      priority: form.priority,
      is_primary: accounts.length === 0 || form.is_primary
    };

    const updatedAccounts = [...accounts, newAccount];
    await base44.functions.invoke('withdrawalEngine', {
      action: 'update_policy',
      policy_data: { bank_accounts: updatedAccounts }
    });
    await onSaved?.();
    setShowAdd(false);
    setForm({ label: '', bank_name: '', account_type: 'checking', routing: '', account_number: '', confirm_number: '', allocation_pct: 100, priority: 1, is_primary: false });
    setSaving(false);
  };

  const handleRemove = async (index) => {
    const updated = accounts.filter((_, i) => i !== index);
    await base44.functions.invoke('withdrawalEngine', {
      action: 'update_policy',
      policy_data: { bank_accounts: updated }
    });
    await onSaved?.();
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-amber-400" />
          <span className="text-sm font-semibold text-white">Bank Accounts</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{accounts.length} saved</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-3">
          <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-500/20 rounded-lg px-3 py-2">
            <Lock className="w-3 h-3 text-amber-400 mt-0.5 shrink-0" />
            <p className="text-[10px] text-amber-300/70">
              Bank details are stored encrypted. Only last 4 digits are displayed. Actual credentials are secured in CredentialVault.
            </p>
          </div>

          {/* Existing accounts */}
          <div className="space-y-2">
            {accounts.map((acc, i) => {
              const totalPct = accounts.reduce((s, a) => s + (a.allocation_pct || 0), 0);
              return (
                <div key={i} className="flex items-center justify-between bg-slate-800/60 rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-white">{acc.bank_name}</span>
                        {acc.is_primary && <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-full">Primary</span>}
                        <span className="text-[10px] text-slate-500">{acc.account_type}</span>
                      </div>
                      <div className="text-[10px] text-slate-600">
                        ****{acc.last_four} · {acc.allocation_pct || 100}% allocation · Priority {acc.priority || 1}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleRemove(i)}
                    className="p-1.5 text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Add form */}
          {showAdd ? (
            <div className="bg-slate-800/40 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Bank Name *</label>
                  <Input value={form.bank_name} onChange={e => set('bank_name', e.target.value)} placeholder="Chase, BofA..."
                    className="bg-slate-900 border-slate-700 text-white text-xs h-8" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Label</label>
                  <Input value={form.label} onChange={e => set('label', e.target.value)} placeholder="My checking"
                    className="bg-slate-900 border-slate-700 text-white text-xs h-8" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Routing (9 digits) *</label>
                  <Input value={form.routing} onChange={e => set('routing', e.target.value.replace(/\D/g, '').slice(0, 9))}
                    placeholder="123456789" className="bg-slate-900 border-slate-700 text-white text-xs h-8 font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Account Number *</label>
                  <Input value={form.account_number} onChange={e => set('account_number', e.target.value.replace(/\D/g, '').slice(0, 17))}
                    placeholder="Account number" className="bg-slate-900 border-slate-700 text-white text-xs h-8 font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Confirm Account *</label>
                  <Input value={form.confirm_number} onChange={e => set('confirm_number', e.target.value.replace(/\D/g, '').slice(0, 17))}
                    placeholder="Re-enter number" className="bg-slate-900 border-slate-700 text-white text-xs h-8 font-mono" />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 block mb-1">Allocation %</label>
                  <Input type="number" min="1" max="100" value={form.allocation_pct}
                    onChange={e => set('allocation_pct', +e.target.value)}
                    className="bg-slate-900 border-slate-700 text-white text-xs h-8" />
                </div>
              </div>
              <div className="flex gap-2 items-center">
                <div className="flex gap-2">
                  {['checking', 'savings'].map(t => (
                    <button key={t} onClick={() => set('account_type', t)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                        form.account_type === t ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}>{t}</button>
                  ))}
                </div>
                <label className="flex items-center gap-1.5 ml-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_primary} onChange={e => set('is_primary', e.target.checked)} className="rounded" />
                  <span className="text-xs text-slate-400">Set as primary</span>
                </label>
              </div>
              {error && (
                <div className="flex items-center gap-2 text-rose-400 text-xs">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </div>
              )}
              <div className="flex gap-2">
                <Button onClick={handleAdd} disabled={saving} size="sm"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> {saving ? 'Saving...' : 'Save Account'}
                </Button>
                <Button onClick={() => setShowAdd(false)} variant="outline" size="sm"
                  className="border-slate-700 text-slate-400 text-xs h-8">Cancel</Button>
              </div>
            </div>
          ) : (
            <Button onClick={() => setShowAdd(true)} variant="outline" size="sm"
              className="w-full border-dashed border-slate-700 text-slate-500 hover:text-white text-xs h-8 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add Bank Account
            </Button>
          )}
        </div>
      )}
    </div>
  );
}