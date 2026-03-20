import React from 'react';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, DollarSign, Lock } from 'lucide-react';

const PAYOUT_METHODS = ['bank_transfer', 'paypal', 'stripe', 'wise'];

export default function StepBanking({ data, onChange, onNext, onBack }) {
  const set = (k, v) => onChange({ ...data, [k]: v });

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        <h2 className="text-base font-bold text-white">Banking & Withdrawals</h2>
        <span className="ml-auto text-[10px] text-slate-500">Optional — complete later</span>
      </div>

      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 mb-4 flex gap-2">
        <Lock className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-200/80">
          All banking information is encrypted with AES-256-GCM and stored in your private credential vault. No other user can access this data.
        </div>
      </div>

      <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">

        {/* Preferred method */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Preferred Payout Method</label>
          <div className="flex flex-wrap gap-1.5">
            {PAYOUT_METHODS.map(m => (
              <button key={m} type="button" onClick={() => set('payout_method', m)}
                className={`px-3 py-1 rounded-lg text-xs border capitalize transition-colors ${data.payout_method === m ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                {m.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Bank details */}
        {(!data.payout_method || data.payout_method === 'bank_transfer') && (
          <div className="space-y-3">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Bank Name</label>
              <Input value={data.bank_name || ''} onChange={e => set('bank_name', e.target.value)}
                placeholder="Chase, Wells Fargo, etc." className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Account Number</label>
                <Input type="password" value={data.account_number || ''} onChange={e => set('account_number', e.target.value)}
                  placeholder="••••••••••" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </div>
              <div>
                <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Routing Number</label>
                <Input type="password" value={data.routing_number || ''} onChange={e => set('routing_number', e.target.value)}
                  placeholder="•••••••••" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
              </div>
            </div>
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Account Type</label>
              <div className="flex gap-2">
                {['checking', 'savings'].map(t => (
                  <button key={t} type="button" onClick={() => set('account_type', t)}
                    className={`px-3 py-1 rounded-lg text-xs border capitalize transition-colors ${data.account_type === t ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PayPal */}
        {data.payout_method === 'paypal' && (
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">PayPal Email</label>
            <Input type="email" value={data.paypal_email || ''} onChange={e => set('paypal_email', e.target.value)}
              placeholder="you@email.com" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        )}

        {/* Wise */}
        {data.payout_method === 'wise' && (
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Wise Email</label>
            <Input type="email" value={data.wise_email || ''} onChange={e => set('wise_email', e.target.value)}
              placeholder="you@email.com" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        )}

        {/* Tax */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Tax Classification</label>
          <div className="flex gap-2">
            {[['individual', 'Individual (1099)'], ['business', 'Business (W-9)']].map(([v, l]) => (
              <button key={v} type="button" onClick={() => set('tax_classification', v)}
                className={`px-3 py-1 rounded-lg text-xs border transition-colors ${data.tax_classification === v ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Payout settings */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Min Payout ($)</label>
            <Input type="number" value={data.min_payout ?? 100} onChange={e => set('min_payout', parseFloat(e.target.value) || 100)}
              className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Payout Frequency</label>
            <select value={data.payout_frequency || 'weekly'} onChange={e => set('payout_frequency', e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none h-8">
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="biweekly">Bi-weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>

        {/* Backup contact */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Backup Contact / Email</label>
          <Input type="email" value={data.backup_email || ''} onChange={e => set('backup_email', e.target.value)}
            placeholder="backup@email.com" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </div>

        <div className="text-[10px] text-slate-600 text-center pt-1">
          You can add or update banking details anytime from the Withdrawal Engine dashboard.
        </div>
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
        <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 text-slate-400 h-9 px-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
        <Button onClick={onNext} variant="ghost" size="sm" className="text-slate-500 h-9 px-4">
          Skip for now
        </Button>
        <Button onClick={onNext} size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white h-9">
          Next: Review & Launch <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}