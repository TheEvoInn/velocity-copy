import React from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

export default function MicroTransactionHistory({ department }) {
  const transactions = [
    { id: 1, type: 'earning', amount: '$45.50', source: 'Job submission', timestamp: '2 min ago', status: 'completed' },
    { id: 2, type: 'earning', amount: '$120.00', source: 'Arbitrage profit', timestamp: '15 min ago', status: 'completed' },
    { id: 3, type: 'spend', amount: '-$10.00', source: 'Capital allocation', timestamp: '28 min ago', status: 'completed' },
    { id: 4, type: 'earning', amount: '$73.25', source: 'Landing page sale', timestamp: '1 hour ago', status: 'completed' },
    { id: 5, type: 'earning', amount: '$210.00', source: 'Crypto staking', timestamp: '2 hours ago', status: 'completed' },
    { id: 6, type: 'spend', amount: '-$50.00', source: 'Mining investment', timestamp: '3 hours ago', status: 'completed' },
  ];

  const totalEarnings = transactions
    .filter(t => t.type === 'earning')
    .reduce((sum, t) => sum + parseFloat(t.amount.replace('$', '')), 0);

  const totalSpend = transactions
    .filter(t => t.type === 'spend')
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount.replace('-$', ''))), 0);

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30 p-4">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="text-xs text-slate-400">Total Earnings</div>
              <div className="text-2xl font-bold text-emerald-400">${totalEarnings.toFixed(2)}</div>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-red-500/5 border-red-500/30 p-4">
          <div className="flex items-center gap-3">
            <ArrowDownLeft className="w-6 h-6 text-red-400" />
            <div>
              <div className="text-xs text-slate-400">Total Spend</div>
              <div className="text-2xl font-bold text-red-400">${totalSpend.toFixed(2)}</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Transaction List */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Recent Transactions</h3>
        <div className="space-y-2">
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between p-3 bg-slate-800/30 rounded">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  tx.type === 'earning' ? 'bg-emerald-500' : 'bg-red-500'
                }`} />
                <div>
                  <p className="text-sm text-white">{tx.source}</p>
                  <p className="text-xs text-slate-500">{tx.timestamp}</p>
                </div>
              </div>
              <span className={`font-semibold ${
                tx.type === 'earning' ? 'text-emerald-400' : 'text-red-400'
              }`}>
                {tx.amount}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}