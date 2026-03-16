import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet, Plus, ArrowUpRight, ArrowDownRight, DollarSign, RefreshCw, ReceiptText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import WalletCard from '../components/dashboard/WalletCard';
import ProfitChart from '../components/dashboard/ProfitChart';
import TransactionForm from '../components/wallet/TransactionForm';
import WithdrawalModal from '../components/wallet/WithdrawalModal';
import PlatformBreakdown from '../components/wallet/PlatformBreakdown';
import TaxEstimatePanel from '../components/wallet/TaxEstimatePanel';
import PayoutStatusPanel from '../components/wallet/PayoutStatusPanel';

const categoryColors = {
  arbitrage: 'text-emerald-400', service: 'text-blue-400', lead_gen: 'text-violet-400',
  digital_flip: 'text-amber-400', auction: 'text-rose-400', freelance: 'text-indigo-400',
  resale: 'text-pink-400', other: 'text-slate-400'
};

const PAYOUT_DOT = {
  available: 'bg-emerald-500', cleared: 'bg-emerald-500',
  pending: 'bg-amber-500', in_transit: 'bg-blue-500', processing: 'bg-violet-500'
};

function fmt(n) {
  return (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2 });
}

export default function WalletPage() {
  const [showTxForm, setShowTxForm] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  const { data: userGoals = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
    initialData: [],
  });

  const { data: finData, refetch: refetchFin } = useQuery({
    queryKey: ['financial_summary'],
    queryFn: () => base44.functions.invoke('financialTracker', { action: 'get_summary' }),
    staleTime: 60000
  });

  const fin = finData?.data || {};
  const summary = fin.summary || {};
  const goals = userGoals[0] || {};
  const today = new Date().toDateString();
  const todayEarned = transactions
    .filter(t => t.type === 'income' && new Date(t.created_date).toDateString() === today)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const syncFees = async () => {
    setSyncing(true);
    await base44.functions.invoke('financialTracker', { action: 'sync_platform' });
    await refetchFin();
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    setSyncing(false);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {showTxForm && <TransactionForm onClose={() => setShowTxForm(false)} currentBalance={goals.wallet_balance || 0} />}
      {showWithdraw && <WithdrawalModal onClose={() => setShowWithdraw(false)} currentBalance={goals.wallet_balance || 0} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-emerald-400" />
            Wallet
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Unified financial command center</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={syncFees} disabled={syncing} variant="outline"
            className="border-slate-700 text-slate-400 hover:text-white text-xs h-8 gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            Sync Fees
          </Button>
          <Button size="sm" onClick={() => setShowWithdraw(true)} className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-8">
            <ArrowDownRight className="w-3.5 h-3.5 mr-1" /> Withdraw
          </Button>
          <Button size="sm" onClick={() => setShowTxForm(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
            <Plus className="w-3.5 h-3.5 mr-1" /> Add Transaction
          </Button>
        </div>
      </div>

      {/* Top cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        <WalletCard balance={goals.wallet_balance || 0} totalEarned={goals.total_earned || 0} todayEarned={todayEarned} />

        {/* Net vs Gross */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <ReceiptText className="w-4 h-4 text-violet-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Gross vs Net</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] text-slate-600 mb-0.5">Gross Income</div>
              <div className="text-lg font-bold text-slate-300">${fmt(summary.gross_income)}</div>
            </div>
            <ArrowDownRight className="w-4 h-4 text-rose-400 mb-1" />
            <div className="text-right">
              <div className="text-[10px] text-slate-600 mb-0.5">Net After Fees</div>
              <div className="text-lg font-bold text-emerald-400">${fmt(summary.net_income)}</div>
            </div>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="text-rose-400">-${fmt(summary.total_fees)} platform fees</span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">-${fmt(summary.total_tax_withheld)} tax</span>
          </div>
        </div>

        {/* Expenses */}
        <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <ArrowDownRight className="w-4 h-4 text-rose-400" />
            <span className="text-xs text-slate-500 uppercase tracking-wider">Expenses &amp; Profit</span>
          </div>
          <div className="text-2xl font-bold text-rose-400">${fmt(summary.total_expenses)}</div>
          <div className="pt-1 border-t border-slate-800">
            <div className="text-[10px] text-slate-600 mb-0.5">Net Profit</div>
            <div className={`text-lg font-bold ${(summary.net_profit || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              ${fmt(summary.net_profit)}
            </div>
          </div>
        </div>
      </div>

      {/* Payout Status + Tax side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <PayoutStatusPanel
          transactions={transactions}
          availableFunds={summary.available_funds}
          pendingPayouts={summary.pending_payouts}
        />
        <TaxEstimatePanel taxData={fin.tax} />
      </div>

      {/* Platform Breakdown */}
      {fin.by_platform && Object.keys(fin.by_platform).length > 0 && (
        <div className="mb-4">
          <PlatformBreakdown byPlatform={fin.by_platform} byAccount={fin.by_account || []} />
        </div>
      )}

      {/* Chart */}
      <div className="mb-4">
        <ProfitChart transactions={transactions} />
      </div>

      {/* Transaction History */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Transaction History</h2>
          <span className="text-xs text-slate-500">{transactions.length} records</span>
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
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${tx.type === 'income' ? 'bg-emerald-500/10' : 'bg-rose-500/10'}`}>
                  {tx.type === 'income'
                    ? <ArrowUpRight className="w-4 h-4 text-emerald-400" />
                    : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-white">{tx.description || tx.category || tx.type}</p>
                    {tx.platform && (
                      <span className="text-[10px] text-slate-600 bg-slate-800 px-1.5 py-0.5 rounded">{tx.platform}</span>
                    )}
                    {tx.payout_status && tx.payout_status !== 'available' && (
                      <span className="flex items-center gap-1 text-[10px] text-slate-500">
                        <span className={`w-1.5 h-1.5 rounded-full ${PAYOUT_DOT[tx.payout_status] || 'bg-slate-500'}`} />
                        {tx.payout_status.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-600">
                    {tx.created_date && format(new Date(tx.created_date), 'MMM d, h:mm a')}
                    {tx.category && <span className={`ml-2 ${categoryColors[tx.category]}`}>{tx.category}</span>}
                    {tx.platform_fee > 0 && <span className="ml-2 text-rose-400/70">-${fmt(tx.platform_fee)} fee</span>}
                    {tx.tax_withheld > 0 && <span className="ml-1 text-amber-400/70">-${fmt(tx.tax_withheld)} tax</span>}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-sm font-bold tabular-nums ${tx.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {tx.type === 'income' ? '+' : '-'}${fmt(tx.amount)}
                </span>
                {tx.net_amount && tx.net_amount !== tx.amount && (
                  <div className="text-[10px] text-slate-500">net ${fmt(tx.net_amount)}</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}