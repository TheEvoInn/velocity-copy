import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, AlertCircle, Loader2, DollarSign, CreditCard, Wallet } from 'lucide-react';

export default function PaymentVerifier({ onVerified }) {
  const [method, setMethod] = useState('manual');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [form, setForm] = useState({ amount: '', reference: '', description: '', payment_intent_id: '', order_id: '' });

  const verify = async () => {
    setLoading(true);
    setResult(null);
    try {
      let action, payload;
      if (method === 'stripe') {
        action = 'verify_stripe_payment';
        payload = { payment_intent_id: form.payment_intent_id };
      } else if (method === 'paypal') {
        action = 'verify_paypal_payment';
        payload = { order_id: form.order_id };
      } else {
        action = 'confirm_manual_payment';
        payload = { amount: parseFloat(form.amount), description: form.description, reference: form.reference };
      }

      const res = await base44.functions.invoke('payoutVerifier', { action, payload });
      setResult(res.data);
      if (res.data?.verified || res.data?.success) onVerified?.();
    } catch (e) {
      setResult({ error: e.message });
    }
    setLoading(false);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
        <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Verify & Deposit Payment
      </h3>

      {/* Method tabs */}
      <div className="flex gap-1 bg-slate-800/50 rounded-lg p-1">
        {[['manual', 'Manual'], ['stripe', 'Stripe'], ['paypal', 'PayPal']].map(([val, label]) => (
          <button key={val} onClick={() => setMethod(val)}
            className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${method === val ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            {label}
          </button>
        ))}
      </div>

      {method === 'manual' && (
        <div className="space-y-2">
          <Input value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
            placeholder="Amount received (USD)" type="number" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
          <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="Description (e.g. Textbroker article payment)" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
          <Input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
            placeholder="Reference / confirmation # (optional)" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
        </div>
      )}

      {method === 'stripe' && (
        <Input value={form.payment_intent_id} onChange={e => setForm(f => ({ ...f, payment_intent_id: e.target.value }))}
          placeholder="Stripe Payment Intent ID (pi_...)" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
      )}

      {method === 'paypal' && (
        <Input value={form.order_id} onChange={e => setForm(f => ({ ...f, order_id: e.target.value }))}
          placeholder="PayPal Order ID" className="bg-slate-800 border-slate-700 text-white text-sm h-8" />
      )}

      <Button onClick={verify} disabled={loading} size="sm"
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 gap-1.5">
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
        {loading ? 'Verifying...' : 'Verify & Deposit'}
      </Button>

      {result && (
        <div className={`flex items-start gap-2 p-3 rounded-lg text-xs ${result.verified || result.success ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-300' : 'bg-red-950/40 border border-red-500/30 text-red-300'}`}>
          {result.verified || result.success
            ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
          <span>{result.message || result.error || 'Unknown result'}</span>
        </div>
      )}
    </div>
  );
}