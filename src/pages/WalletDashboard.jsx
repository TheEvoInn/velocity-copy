/**
 * WALLET DASHBOARD
 * Per-user isolated — real-time balance, transactions, payout management
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserProfile, useUserWallet } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import { Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, Clock, DollarSign, Settings } from 'lucide-react';

function TxRow({ tx }) {
  const isEarning = tx.type === 'earning';
  const isWithdrawal = tx.type === 'withdrawal';
  return (
    <div className="flex items-center justify-between p-3 rounded-xl transition-colors"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center"
          style={{
            background: isEarning ? 'rgba(16,185,129,0.1)' : isWithdrawal ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
            border: `1px solid ${isEarning ? 'rgba(16,185,129,0.25)' : isWithdrawal ? 'rgba(239,68,68,0.25)' : 'rgba(251,191,36,0.25)'}`,
          }}>
          {isEarning ? <ArrowDownRight className="w-4 h-4 text-emerald-400" /> : isWithdrawal ? <ArrowUpRight className="w-4 h-4 text-red-400" /> : <DollarSign className="w-4 h-4 text-amber-400" />}
        </div>
        <div>
          <div className="text-sm text-slate-300">{tx.description || tx.source || tx.type}</div>
          <div className="text-xs text-slate-600 font-mono">{new Date(tx.created_date).toLocaleString()}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-orbitron font-bold text-sm"
          style={{ color: isEarning ? '#10b981' : isWithdrawal ? '#ef4444' : '#f59e0b' }}>
          {isEarning ? '+' : isWithdrawal ? '-' : ''} ${Math.abs(tx.amount || 0).toFixed(2)}
        </div>
        <div className="text-xs capitalize" style={{
          color: tx.status === 'confirmed' ? '#10b98160' : tx.status === 'pending' ? '#f59e0b60' : '#ef444460'
        }}>
          {tx.status}
        </div>
      </div>
    </div>
  );
}

export default function WalletDashboard() {
  const { data: user } = useCurrentUser();
  const { data: profile, upsert } = useUserProfile();
  const { transactions, balance, totalEarned, todayEarnings, weekEarnings, isLoading } = useUserWallet();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState('overview');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawAddress, setWithdrawAddress] = useState(profile?.payout_address || '');
  const [isWithdrawing, setIsWithdrawing] = useState(false);

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || amount > balance) return;
    setIsWithdrawing(true);
    try {
      await base44.entities.WalletTransaction.create({
        user_email: user?.email,
        type: 'withdrawal',
        amount: -amount,
        description: `Withdrawal to ${withdrawAddress || 'wallet'}`,
        status: 'pending',
      });
      await base44.entities.UserProfile.update(profile?.id, {
        wallet_balance: balance - amount,
        payout_address: withdrawAddress,
      });
      qc.invalidateQueries({ queryKey: ['walletTxs'] });
      qc.invalidateQueries({ queryKey: ['userProfile'] });
      setWithdrawAmount('');
    } catch (err) {
      console.error(err);
    }
    setIsWithdrawing(false);
  }

  const earningsBySource = {};
  transactions.filter(tx => tx.type === 'earning').forEach(tx => {
    const src = tx.source || 'other';
    earningsBySource[src] = (earningsBySource[src] || 0) + (tx.amount || 0);
  });

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: 'Transactions' },
    { key: 'withdraw', label: 'Withdraw' },
  ];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
          <Wallet className="w-6 h-6 text-emerald-400" />
        </div>
        <div>
          <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">WALLET</h1>
          <p className="text-xs text-slate-500 font-mono">Per-user isolated earnings · Real-time balance</p>
        </div>
      </div>

      {/* Balance Hero */}
      <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
        style={{ background: 'rgba(10,15,42,0.8)', border: '1px solid rgba(16,185,129,0.25)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(16,185,129,0.06), transparent 60%)' }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent)' }} />
        <div className="relative">
          <div className="text-xs font-orbitron text-emerald-400/60 tracking-widest mb-2">WALLET BALANCE</div>
          <div className="text-5xl font-orbitron font-black text-white mb-1"
            style={{ textShadow: '0 0 30px rgba(16,185,129,0.3)' }}>
            ${balance.toFixed(2)}
          </div>
          <div className="text-xs text-slate-600 font-mono">Total earned: ${totalEarned.toFixed(2)}</div>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'TODAY', value: `$${todayEarnings.toFixed(2)}`, color: '#f9d65c' },
          { label: 'THIS WEEK', value: `$${weekEarnings.toFixed(2)}`, color: '#00e8ff' },
          { label: 'TRANSACTIONS', value: transactions.length, color: '#a855f7' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4 text-center"
            style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}18` }}>
            <div className="text-xs font-orbitron tracking-widest mb-1" style={{ color: `${s.color}70` }}>{s.label}</div>
            <div className="text-xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 mb-5">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{
              background: activeTab === tab.key ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${activeTab === tab.key ? 'rgba(16,185,129,0.35)' : 'rgba(255,255,255,0.06)'}`,
              color: activeTab === tab.key ? '#10b981' : '#64748b',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {Object.keys(earningsBySource).length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-orbitron text-xs text-slate-500 tracking-widest mb-4">EARNINGS BY SOURCE</div>
              <div className="space-y-2">
                {Object.entries(earningsBySource).sort((a, b) => b[1] - a[1]).map(([src, amt]) => {
                  const pct = totalEarned > 0 ? (amt / totalEarned) * 100 : 0;
                  return (
                    <div key={src}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 capitalize">{src}</span>
                        <span className="text-emerald-400 font-mono">${amt.toFixed(2)}</span>
                      </div>
                      <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #00e8ff)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transactions */}
      {activeTab === 'transactions' && (
        <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="font-orbitron text-xs text-slate-500 tracking-widest mb-4">TRANSACTION HISTORY</div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {transactions.length === 0
              ? <p className="text-center text-slate-600 text-xs py-8">No transactions yet</p>
              : transactions.map(tx => <TxRow key={tx.id} tx={tx} />)
            }
          </div>
        </div>
      )}

      {/* Withdraw */}
      {activeTab === 'withdraw' && (
        <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="font-orbitron text-xs text-slate-500 tracking-widest">WITHDRAW FUNDS</div>
          <div>
            <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-2 block">AMOUNT (USD)</label>
            <input
              type="number" value={withdrawAmount}
              onChange={e => setWithdrawAmount(e.target.value)}
              placeholder="0.00" max={balance}
              className="w-full px-4 py-3 rounded-xl font-mono text-white text-sm bg-transparent outline-none"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <div>
            <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-2 block">PAYOUT ADDRESS / ACCOUNT</label>
            <input
              type="text" value={withdrawAddress}
              onChange={e => setWithdrawAddress(e.target.value)}
              placeholder="Crypto address, PayPal email, or bank details..."
              className="w-full px-4 py-3 rounded-xl font-mono text-white text-sm"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
            />
          </div>
          <button
            onClick={handleWithdraw}
            disabled={isWithdrawing || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
            className="w-full py-3 rounded-xl font-orbitron text-xs tracking-widest transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }}>
            {isWithdrawing ? 'PROCESSING...' : 'SUBMIT WITHDRAWAL'}
          </button>
          <p className="text-xs text-slate-600 text-center">Balance after withdrawal: ${Math.max(0, balance - (parseFloat(withdrawAmount) || 0)).toFixed(2)}</p>
        </div>
      )}
    </div>
  );
}