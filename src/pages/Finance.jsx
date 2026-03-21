/**
 * FINANCE DEPARTMENT
 * Real-time earnings, wallet, transactions, and financial analytics
 */
import React from 'react';
import { useTransactionsV2, useUserGoalsV2 } from '@/lib/velocityHooks';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TrendingUp, Wallet, DollarSign, PieChart } from 'lucide-react';

const style = getDeptStyle('finance');

export default function Finance() {
  const { transactions } = useTransactionsV2();
  const { goals } = useUserGoalsV2();

  const stats = {
    wallet: goals.wallet_balance || 0,
    total: goals.total_earned || 0,
    today: transactions
      .filter(t => new Date(t.timestamp || 0).toDateString() === new Date().toDateString())
      .reduce((s, t) => s + (t.value_usd || 0), 0),
    week: transactions
      .filter(t => {
        const tDate = new Date(t.timestamp || 0);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return tDate >= weekAgo;
      })
      .reduce((s, t) => s + (t.value_usd || 0), 0),
  };

  const bySource = {};
  transactions.slice(0, 50).forEach(t => {
    const source = t.source || 'other';
    bySource[source] = (bySource[source] || 0) + (t.value_usd || 0);
  });

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(16,185,129,0.1)`, border: `1px solid ${style.color}` }}>
              <span className="text-2xl">{style.icon}</span>
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">FINANCE</h1>
              <p className="text-xs text-slate-400">Earnings · Wallet · Transactions · Analytics</p>
            </div>
          </div>
          <Link to="/WalletPage">
            <Button className="btn-cosmic gap-2">
              <Wallet className="w-4 h-4" />
              Wallet
            </Button>
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Wallet Balance</div>
            <div className="text-2xl font-bold text-emerald-400">${stats.wallet.toFixed(0)}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Earned Today</div>
            <div className="text-2xl font-bold text-amber-400">${stats.today.toFixed(0)}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Week Total</div>
            <div className="text-2xl font-bold text-cyan-400">${stats.week.toFixed(0)}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">All-Time</div>
            <div className="text-2xl font-bold text-violet-400">${stats.total.toFixed(0)}</div>
          </Card>
        </div>

        {/* Daily Goal Tracker */}
        {goals.daily_target && (
          <Card className="glass-card p-4 mb-6">
            <h3 className="font-orbitron text-sm font-bold text-white mb-3">Daily Goal</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Target: ${goals.daily_target.toFixed(0)}</span>
                <span className="text-emerald-400 font-bold">{((stats.today / goals.daily_target) * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-800/50 rounded-full h-2 overflow-hidden border border-slate-700/50">
                <div
                  className="bg-gradient-to-r from-emerald-500 to-cyan-500 h-full transition-all"
                  style={{ width: `${Math.min((stats.today / goals.daily_target) * 100, 100)}%` }}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Income Sources */}
        {Object.keys(bySource).length > 0 && (
          <Card className="glass-card p-4 mb-6">
            <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
              <PieChart className="w-4 h-4 text-amber-400" />
              Income Sources (Last 50 Tx)
            </h3>
            <div className="space-y-2">
              {Object.entries(bySource)
                .sort((a, b) => b[1] - a[1])
                .map(([source, amount]) => (
                  <div key={source} className="flex justify-between text-sm p-2 bg-slate-800/30 rounded">
                    <span className="text-slate-400 capitalize">{source}</span>
                    <span className="font-bold text-emerald-400">${amount.toFixed(0)}</span>
                  </div>
                ))}
            </div>
          </Card>
        )}

        {/* Recent Transactions */}
        <Card className="glass-card p-4">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Recent Transactions
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {transactions.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No transactions yet</div>
            ) : (
              transactions.slice(0, 15).map(tx => (
                <div key={tx.id} className="flex justify-between items-center p-2 bg-slate-800/30 rounded text-sm">
                  <div className="flex-1 min-w-0">
                    <div className="text-slate-400 capitalize">{tx.transaction_type}</div>
                    <div className="text-xs text-slate-600">{new Date(tx.timestamp).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-emerald-400">${tx.value_usd?.toFixed(0) || 0}</div>
                    <div className="text-xs text-slate-500 capitalize">{tx.status}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Deep Space Link */}
        <div className="mt-6">
          <Link to="/FinancialDashboard">
            <Button variant="outline" className="w-full gap-2 border-slate-700">
              <span>📊 Financial Analytics</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}