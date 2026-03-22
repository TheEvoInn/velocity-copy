/**
 * FINANCE — Per-user isolated earnings, wallet, transactions
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCurrentUser, useUserWallet, useUserProfile } from '@/hooks/useUserData';
import { TrendingUp, Wallet, DollarSign, PieChart, ArrowDownRight, ArrowUpRight, BarChart3 } from 'lucide-react';

function TxRow({ tx }) {
  const isEarning = tx.type === 'earning' || tx.type === 'bonus';
  const color = isEarning ? '#10b981' : tx.type === 'withdrawal' ? '#ef4444' : '#f59e0b';
  return (
    <div className="flex items-center justify-between p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-3">
        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
          {isEarning
            ? <ArrowDownRight className="w-3.5 h-3.5" style={{ color }} />
            : <ArrowUpRight className="w-3.5 h-3.5" style={{ color }} />}
        </div>
        <div>
          <div className="text-xs text-slate-300 leading-tight">{tx.description || tx.source || tx.type}</div>
          <div className="text-xs text-slate-600 font-mono">{new Date(tx.created_date).toLocaleDateString()}</div>
        </div>
      </div>
      <div className="text-right">
        <div className="font-orbitron text-sm font-bold" style={{ color }}>
          {isEarning ? '+' : '-'}${Math.abs(tx.amount || 0).toFixed(2)}
        </div>
        <div className="text-xs capitalize" style={{ color: `${color}60` }}>{tx.status}</div>
      </div>
    </div>
  );
}

export default function Finance() {
  const { data: user } = useCurrentUser();
  const { data: profile } = useUserProfile();
  const { transactions, balance, totalEarned, todayEarnings, weekEarnings, isLoading } = useUserWallet();
  const [activeTab, setActiveTab] = useState('overview');

  const dailyTarget = profile?.daily_earning_target || 100;
  const progress = dailyTarget > 0 ? Math.min((todayEarnings / dailyTarget) * 100, 100) : 0;

  const bySource = {};
  transactions.filter(t => t.type === 'earning').forEach(tx => {
    const src = tx.source || 'other';
    bySource[src] = (bySource[src] || 0) + (tx.amount || 0);
  });

  const TABS = [
    { key: 'overview', label: 'Overview' },
    { key: 'transactions', label: `Transactions (${transactions.length})` },
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
          <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">FINANCE</h1>
          <p className="text-xs text-slate-500 font-mono">Per-user isolated · Real-time earnings & wallet</p>
        </div>
      </div>

      {/* Balance Hero */}
      <div className="rounded-2xl p-6 mb-5 relative overflow-hidden"
        style={{ background: 'rgba(10,15,42,0.8)', border: '1px solid rgba(16,185,129,0.25)' }}>
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at top right, rgba(16,185,129,0.06), transparent 60%)' }} />
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.5), transparent)' }} />
        <div className="relative">
          <div className="text-xs font-orbitron text-emerald-400/60 tracking-widest mb-1">WALLET BALANCE</div>
          <div className="text-5xl font-orbitron font-black text-white mb-1"
            style={{ textShadow: '0 0 30px rgba(16,185,129,0.3)' }}>
            ${balance.toFixed(2)}
          </div>
          <div className="text-xs text-slate-600 font-mono">All-time earned: ${totalEarned.toFixed(2)}</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'TODAY', value: `$${todayEarnings.toFixed(2)}`, color: '#f9d65c' },
          { label: 'THIS WEEK', value: `$${weekEarnings.toFixed(2)}`, color: '#00e8ff' },
          { label: 'ALL-TIME', value: `$${totalEarned.toFixed(2)}`, color: '#a855f7' },
          { label: 'DAILY TARGET', value: `$${dailyTarget}`, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl p-4"
            style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}18` }}>
            <div className="text-xs font-orbitron tracking-widest mb-1" style={{ color: `${s.color}70` }}>{s.label}</div>
            <div className="text-xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Daily Goal Progress */}
      <div className="rounded-2xl p-4 mb-5"
        style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(16,185,129,0.15)' }}>
        <div className="flex justify-between items-center mb-2">
          <span className="font-orbitron text-xs text-slate-500 tracking-widest">DAILY GOAL PROGRESS</span>
          <span className="font-orbitron text-sm" style={{ color: progress >= 100 ? '#10b981' : '#f9d65c' }}>
            {progress.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          <div className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: progress >= 100 ? '#10b981' : 'linear-gradient(90deg, #00e8ff, #10b981)',
              boxShadow: `0 0 8px ${progress >= 100 ? '#10b981' : '#00e8ff'}60`,
            }} />
        </div>
        <div className="mt-1.5 text-xs text-slate-600">${todayEarnings.toFixed(2)} of ${dailyTarget} target</div>
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
          {Object.keys(bySource).length > 0 ? (
            <div className="rounded-2xl p-5"
              style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-4 h-4 text-amber-400" />
                <span className="font-orbitron text-xs text-slate-400 tracking-widest">EARNINGS BY SOURCE</span>
              </div>
              <div className="space-y-2.5">
                {Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([src, amt]) => {
                  const pct = totalEarned > 0 ? (amt / totalEarned) * 100 : 0;
                  return (
                    <div key={src}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-400 capitalize">{src}</span>
                        <span className="text-emerald-400 font-mono">${amt.toFixed(2)}</span>
                      </div>
                      <div className="h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #00e8ff)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center"
              style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <DollarSign className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="font-orbitron text-sm text-slate-600">No earnings recorded yet</p>
              <p className="text-xs text-slate-700 mt-1">Activate Autopilot to start earning</p>
            </div>
          )}
          <div className="flex gap-3">
            <Link to="/WalletDashboard" className="flex-1">
              <div className="w-full py-3 rounded-xl text-center font-orbitron text-xs tracking-widest transition-all"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981' }}>
                FULL WALLET →
              </div>
            </Link>
            <Link to="/WithdrawalEngine" className="flex-1">
              <div className="w-full py-3 rounded-xl text-center font-orbitron text-xs tracking-widest transition-all"
                style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', color: '#3b82f6' }}>
                WITHDRAW →
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Transactions */}
      {activeTab === 'transactions' && (
        <div className="rounded-2xl p-5"
          style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="space-y-2 max-h-[480px] overflow-y-auto">
            {transactions.length === 0
              ? <p className="text-center text-slate-600 text-xs py-10">No transactions yet</p>
              : transactions.map(tx => <TxRow key={tx.id} tx={tx} />)
            }
          </div>
        </div>
      )}
    </div>
  );
}