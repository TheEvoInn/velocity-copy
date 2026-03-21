/**
 * WALLET PAGE
 * Real-time wallet balance, transactions, payouts, and financial management
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useUserGoalsV2, useTransactionsV2 } from '@/lib/velocityHooks';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, TrendingUp, Wallet, Zap } from 'lucide-react';

export default function WalletPage() {
  const { goals } = useUserGoalsV2();
  const { transactions } = useTransactionsV2();
  const [showWithdraw, setShowWithdraw] = useState(false);

  const stats = {
    wallet: goals.wallet_balance || 0,
    total: goals.total_earned || 0,
    pending: transactions.filter(t => t.status === 'pending').reduce((s, t) => s + (t.value_usd || 0), 0),
    week: transactions
      .filter(t => {
        const tDate = new Date(t.timestamp || 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return tDate >= weekAgo;
      })
      .reduce((s, t) => s + (t.value_usd || 0), 0),
  };

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-emerald-500/10 border border-emerald-500/30">
            <Wallet className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-white">Wallet</h1>
            <p className="text-xs text-slate-400">Manage Your Earnings & Payouts</p>
          </div>
        </div>

        {/* Main Balance Card */}
        <Card className="glass-card-bright p-6 mb-6 border-emerald-500/30">
          <div className="text-center">
            <div className="text-sm text-slate-400 mb-2">Available Balance</div>
            <div className="text-5xl font-bold text-emerald-400 mb-4">${stats.wallet.toFixed(0)}</div>
            <Button className="btn-cosmic mx-auto mb-4" onClick={() => setShowWithdraw(true)}>
              <Zap className="w-4 h-4 mr-2" />
              Withdraw
            </Button>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-700/50">
              <div>
                <div className="text-xs text-slate-500">Week Total</div>
                <div className="text-lg font-bold text-cyan-400">${stats.week.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">Pending</div>
                <div className="text-lg font-bold text-amber-400">${stats.pending.toFixed(0)}</div>
              </div>
              <div>
                <div className="text-xs text-slate-500">All-Time</div>
                <div className="text-lg font-bold text-violet-400">${stats.total.toFixed(0)}</div>
              </div>
            </div>
          </div>
        </Card>

        {/* Transaction History */}
        <Card className="glass-card p-4 mb-6">
          <h3 className="font-orbitron text-sm font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Recent Transactions
          </h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-8">No transactions yet</div>
            ) : (
              transactions.slice(0, 20).map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-3 bg-slate-800/40 rounded-lg border border-slate-700/50 hover:border-slate-700 transition">
                  <div>
                    <div className="text-sm font-semibold text-white capitalize">{tx.transaction_type}</div>
                    <div className="text-xs text-slate-400">{new Date(tx.timestamp).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">${(tx.value_usd || 0).toFixed(0)}</div>
                    <div className="text-xs capitalize" style={{
                      color: tx.status === 'completed' ? '#10b981' : tx.status === 'pending' ? '#f59e0b' : '#ef4444'
                    }}>
                      {tx.status}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Withdrawal Modal */}
        {showWithdraw && (
          <Card className="glass-card-bright p-6 mb-6 border-cyan-500/30">
            <h3 className="font-orbitron text-sm font-bold text-white mb-4">Withdraw Funds</h3>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-2">Amount (USD)</label>
                <input type="number" placeholder="0.00" className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm" />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-2">Payment Method</label>
                <select className="w-full bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm">
                  <option>Bank Account</option>
                  <option>Crypto Wallet</option>
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setShowWithdraw(false)}>Cancel</Button>
                <Button className="flex-1 btn-cosmic">Withdraw</Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}