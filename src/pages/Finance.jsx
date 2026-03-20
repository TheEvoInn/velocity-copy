/**
 * DEPARTMENT 3: Finance & Compliance
 * Handles wallet, transactions, KYC, legal identity, payouts, and financial tracking.
 * Communicates with: Execution (confirms earnings), Discovery (filters by KYC need),
 * Control (validates identity), Command Center (shows balances).
 */
import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { Landmark, DollarSign, TrendingUp, TrendingDown, Shield, CreditCard, Plus, ArrowUpRight, ArrowDownLeft, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TransactionForm from '@/components/wallet/TransactionForm';
import ProfitChart from '@/components/dashboard/ProfitChart';
import FinancialDashboard from '@/components/financial/FinancialDashboard';
import RiskComplianceDashboard from '@/components/risk/RiskComplianceDashboard';
import PayoutVerifierPanel from '@/components/wallet/PayoutVerifierPanel';
import { Link } from 'react-router-dom';

const TX_TYPE_CONFIG = {
  income:     { icon: ArrowDownLeft, color: 'text-emerald-400', bg: 'bg-emerald-500/15', sign: '+' },
  expense:    { icon: ArrowUpRight,  color: 'text-red-400',     bg: 'bg-red-500/15',     sign: '-' },
  transfer:   { icon: ArrowUpRight,  color: 'text-blue-400',    bg: 'bg-blue-500/15',    sign: '~' },
  investment: { icon: TrendingUp,    color: 'text-purple-400',  bg: 'bg-purple-500/15',  sign: '↗' },
};

export default function Finance() {
  const { transactions, walletBalance, todayEarned, totalEarned, userGoals, DeptBus, DEPT_EVENTS } = useDepartmentSync();
  const queryClient = useQueryClient();
  const [showTxForm, setShowTxForm] = useState(false);
  const [txFilter, setTxFilter] = useState('all');

  const filtered = txFilter === 'all' ? transactions : transactions.filter(t => t.type === txFilter);

  const totalExpenses = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amount || 0), 0);
  const pendingPayouts = transactions.filter(t => t.payout_status === 'pending').reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const platformFees = transactions.reduce((s, t) => s + (t.platform_fee || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {showTxForm && (
        <TransactionForm
          onClose={() => {
            setShowTxForm(false);
            queryClient.invalidateQueries({ queryKey: ['transactions'] });
            DeptBus.emit(DEPT_EVENTS.TRANSACTION_RECORDED, { source: 'manual' });
          }}
          currentBalance={userGoals.wallet_balance || 0}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
            <Landmark className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Finance & Compliance</h1>
            <p className="text-xs text-slate-500">Wallet · Transactions · KYC · Payouts</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => setShowTxForm(true)}
            className="bg-emerald-700/80 hover:bg-emerald-600 text-white text-xs h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Log Transaction
          </Button>
          <Link to="/KYCManagement">
            <Button size="sm" variant="outline"
              className="border-slate-700 text-slate-300 text-xs h-8 gap-1.5 hover:bg-slate-800">
              <Shield className="w-3.5 h-3.5" /> KYC
            </Button>
          </Link>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Wallet Balance', value: `$${walletBalance.toFixed(2)}`, icon: CreditCard, color: 'text-emerald-400', large: true },
          { label: "Today's Earnings", value: `$${todayEarned.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Pending Payouts', value: `$${pendingPayouts.toFixed(2)}`, icon: DollarSign, color: 'text-amber-400' },
          { label: 'Platform Fees', value: `$${platformFees.toFixed(2)}`, icon: TrendingDown, color: 'text-red-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Profit Chart */}
      <div className="mb-5">
        <ProfitChart transactions={transactions} />
      </div>

      {/* Transaction Ledger */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Transaction Ledger
          </h2>
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            {['all', 'income', 'expense', 'transfer', 'investment'].map(t => (
              <button key={t} onClick={() => setTxFilter(t)}
                className={`px-2 py-0.5 rounded-md text-xs font-medium transition-colors capitalize ${
                  txFilter === t ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5 max-h-80 overflow-y-auto">
          {filtered.slice(0, 50).map(tx => {
            const cfg = TX_TYPE_CONFIG[tx.type] || TX_TYPE_CONFIG.income;
            const Icon = cfg.icon;
            return (
              <div key={tx.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-colors">
                <div className={`w-7 h-7 rounded-lg ${cfg.bg} flex items-center justify-center shrink-0`}>
                  <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white font-medium truncate">{tx.description || tx.platform || tx.type}</p>
                  <p className="text-xs text-slate-500">{tx.platform} · {new Date(tx.created_date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-semibold ${cfg.color}`}>
                    {cfg.sign}${(tx.net_amount ?? tx.amount ?? 0).toFixed(2)}
                  </p>
                  {tx.platform_fee > 0 && (
                    <p className="text-xs text-slate-600">fee: ${tx.platform_fee.toFixed(2)}</p>
                  )}
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-8 text-slate-500 text-sm">No transactions yet.</div>
          )}
        </div>
      </div>

      {/* Financial Intelligence */}
      <div className="mb-5">
        <FinancialDashboard />
      </div>

      {/* Payout Verifier — PayPal & Stripe */}
      <div className="mb-5">
        <PayoutVerifierPanel />
      </div>

      {/* Risk & Compliance */}
      <RiskComplianceDashboard />
    </div>
  );
}