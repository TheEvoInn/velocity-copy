/**
 * PayoutVerifierPanel — verify real PayPal/Stripe payments and deposit to wallet
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, RefreshCw, DollarSign, AlertTriangle, Loader2 } from 'lucide-react';

export default function PayoutVerifierPanel() {
  const [txId, setTxId] = useState('');
  const [provider, setProvider] = useState('stripe');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState(null);
  const [recentPayments, setRecentPayments] = useState(null);

  const verifyPayment = async () => {
    if (!txId.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await base44.functions.invoke('payoutVerifier', {
      action: 'verify_payment',
      payload: { transaction_id: txId.trim(), provider },
    });
    setResult(res.data);
    setLoading(false);
  };

  const syncPayments = async () => {
    setSyncing(true);
    const res = await base44.functions.invoke('payoutVerifier', {
      action: 'sync_payments',
      payload: { days: 7 },
    });
    setRecentPayments(res.data);
    setSyncing(false);
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-400" />
          Verify Real Payments
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={syncPayments}
          disabled={syncing}
          className="text-xs text-slate-400 hover:text-white h-7"
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          <span className="ml-1">Sync Last 7 Days</span>
        </Button>
      </div>

      {recentPayments && (
        <div className={`p-3 rounded-lg text-xs ${recentPayments.total_synced > 0 ? 'bg-emerald-950/40 border border-emerald-500/20 text-emerald-400' : 'bg-slate-800/50 text-slate-400'}`}>
          {recentPayments.total_synced > 0
            ? `✅ Synced ${recentPayments.total_synced} new payment(s) to wallet`
            : 'No new payments found in the last 7 days'}
          {recentPayments.errors?.length > 0 && (
            <div className="text-amber-400 mt-1">{recentPayments.errors.map(e => `${e.provider}: ${e.error}`).join(' | ')}</div>
          )}
        </div>
      )}

      {/* Manual verify */}
      <div className="space-y-2">
        <p className="text-xs text-slate-500">Manually verify a transaction ID:</p>
        <div className="flex gap-2">
          <select
            value={provider}
            onChange={e => setProvider(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-white text-xs rounded-md px-2 h-9"
          >
            <option value="stripe">Stripe</option>
            <option value="paypal">PayPal</option>
          </select>
          <Input
            value={txId}
            onChange={e => setTxId(e.target.value)}
            placeholder="Transaction / Payment Intent ID"
            className="flex-1 bg-slate-800 border-slate-700 text-white text-xs h-9"
          />
          <Button
            size="sm"
            onClick={verifyPayment}
            disabled={loading || !txId.trim()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white h-9 shrink-0 text-xs"
          >
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Verify'}
          </Button>
        </div>
      </div>

      {result && (
        <div className={`p-3 rounded-lg border text-xs space-y-1 ${result.verified ? 'bg-emerald-950/40 border-emerald-500/20' : 'bg-red-950/30 border-red-500/20'}`}>
          <div className="flex items-center gap-2">
            {result.verified
              ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              : <XCircle className="w-4 h-4 text-red-400" />}
            <span className={`font-semibold ${result.verified ? 'text-emerald-400' : 'text-red-400'}`}>
              {result.verified ? 'Payment Verified & Deposited' : 'Payment Not Verified'}
            </span>
          </div>
          {result.amount > 0 && (
            <p className="text-slate-300">Amount: <span className="text-white font-bold">${result.amount} {result.currency}</span></p>
          )}
          <p className="text-slate-400">Status: <Badge variant="outline" className="text-xs ml-1">{result.status}</Badge></p>
          {result.error && <p className="text-red-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{result.error}</p>}
        </div>
      )}
    </div>
  );
}