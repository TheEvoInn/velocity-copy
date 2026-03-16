import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import WalletCard from '../components/dashboard/WalletCard';
import ProfitChart from '../components/dashboard/ProfitChart';
import TransactionForm from '../components/wallet/TransactionForm';

const categoryColors = {
  arbitrage: "text-emerald-400", service: "text-blue-400", lead_gen: "text-violet-400",
  digital_flip: "text-amber-400", auction: "text-rose-400", freelance: "text-indigo-400",
  resale: "text-pink-400", other: "text-slate-400"
};

export default function WalletPage() {
  const [showTxForm, setShowTxForm] = useState(false);

  const { data: userGoals = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
    initialData: [],
  });

  const goals = userGoals[0] || {};
  const today = new Date().toDateString();
  const todayEarned = transactions
    .filter(t => t.type === 'income' && new Date(t.created_date).toDateString() === today)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalIncome = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.amount || 0), 0);
  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} currentBalance={goals.wallet_balance || 0} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Wallet
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Financial command center</p>
        </div>
        <Button size="sm" onClick={() => setShowTxForm(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> Add Transaction
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <WalletCard balance={goals.wallet_balance || 0} totalEarned={goals.total_earned || 0} todayEarned={todayEarned} />
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Total Income</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Total Expenses</span>
          </div>
          <div className="text-2xl font-bold text-rose-400">${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
        </div>
      </div>

      <ProfitChart transactions={transactions} />

      {/* Transaction History */}
      <div className="mt-6 rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800">
          <h2 className="text-sm font-semibold text-white">Transaction History</h2>
        </div>
        <div className="divide-y divide-slate-800/50">
          {transactions.length === 0 && (
            <div className="p-8 text-center">
              <DollarSign className="w-8 h-8 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No transactions yet.</p>
            </div>
          )}
          {transactions.map(tx => (
            <div key={tx.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-800/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  tx.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'
                }`}>
                  {tx.type === 'income' 
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    : <ArrowDownRight className="w-4 h-4 text-rose-400" />
                  }
                </div>
                <div>
                  <p className="text-sm text-white">{tx.description || tx.category || tx.type}</p>
                  <p className="text-[10px] text-slate-600">
                    {tx.created_date && format(new Date(tx.created_date), 'MMM d, h:mm a')}
                    {tx.category && <span className={`ml-2 ${categoryColors[tx.category]}`}>{tx.category}</span>}
                  </p>
                </div>
              </div>
              <span className={`text-sm font-bold tabular-nums ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {tx.type === 'income' ? '+' : '-'}${tx.amount?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}