/**
 * FINANCE HUB — Unified Wallet & Financial Command Center
 * All platform financials, autopilot allowance, saved accounts, payout scheduling
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserProfile, useUserWallet } from '@/hooks/useUserData';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Wallet, TrendingUp, ArrowDownRight, ArrowUpRight, DollarSign,
  Bot, Clock, CreditCard, Shield, Link, Plus, RefreshCw,
  Calendar, CheckCircle2, AlertCircle, Zap, BarChart3, Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n) { return Number(n || 0).toFixed(2); }

function StatCard({ label, value, color, icon: Icon, sub }) {
  return (
    <div className="relative rounded-2xl p-4 overflow-hidden"
      style={{ background: 'rgba(10,15,42,0.75)', border: `1px solid ${color}20`, backdropFilter: 'blur(20px)' }}>
      <div className="absolute inset-0 pointer-events-none opacity-5"
        style={{ background: `radial-gradient(ellipse at top left, ${color}, transparent 70%)` }} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-orbitron tracking-widest" style={{ color: `${color}80` }}>{label}</span>
          {Icon && <Icon className="w-3.5 h-3.5" style={{ color }} />}
        </div>
        <div className="text-2xl font-orbitron font-bold" style={{ color, textShadow: `0 0 12px ${color}60` }}>{value}</div>
        {sub && <div className="text-[10px] text-slate-600 mt-1">{sub}</div>}
      </div>
    </div>
  );
}

function TxRow({ tx }) {
  const isIncome = tx.type === 'income' || tx.type === 'earning';
  const isExpense = tx.type === 'expense' || tx.type === 'withdrawal';
  const color = isIncome ? '#10b981' : isExpense ? '#ef4444' : '#f59e0b';
  const Icon = isIncome ? ArrowDownRight : isExpense ? ArrowUpRight : DollarSign;
  return (
    <div className="flex items-center justify-between p-3 rounded-xl"
      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
          style={{ background: `${color}12`, border: `1px solid ${color}30` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div className="min-w-0">
          <div className="text-sm text-slate-300 truncate">{tx.description || tx.platform || tx.category || tx.type}</div>
          <div className="text-xs text-slate-600 font-mono">{tx.platform && <span className="mr-2 capitalize">{tx.platform}</span>}{new Date(tx.created_date).toLocaleString()}</div>
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <div className="font-orbitron font-bold text-sm" style={{ color }}>
          {isIncome ? '+' : isExpense ? '-' : ''}${fmt(Math.abs(tx.net_amount || tx.amount))}
        </div>
        <div className="text-[10px] capitalize" style={{ color: tx.payout_status === 'cleared' ? '#10b98160' : '#f59e0b60' }}>
          {tx.payout_status || tx.status || 'logged'}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
const TABS = [
  { key: 'overview',   label: 'Overview',    icon: BarChart3 },
  { key: 'allowance',  label: 'AI Allowance', icon: Bot },
  { key: 'accounts',   label: 'Accounts',    icon: Link },
  { key: 'payout',     label: 'Payout',      icon: Calendar },
  { key: 'transactions', label: 'Transactions', icon: Clock },
];

const PAYOUT_SCHEDULES = ['manual', 'daily', 'weekly', 'biweekly', 'monthly'];

export default function WalletDashboard() {
  const { data: user } = useCurrentUser();
  const { data: profile, upsert } = useUserProfile();
  const { transactions, balance, totalEarned, todayEarnings, weekEarnings, isLoading } = useUserWallet();
  const qc = useQueryClient();

  const [tab, setTab] = useState('overview');

  // Withdraw state
  const [withdrawAmt, setWithdrawAmt] = useState('');
  const [withdrawAddr, setWithdrawAddr] = useState(profile?.payout_address || '');
  const [withdrawing, setWithdrawing] = useState(false);

  // Allowance state
  const [depositAmt, setDepositAmt] = useState('');
  const [depositing, setDepositing] = useState(false);

  // Payout schedule state
  const [payoutSchedule, setPayoutSchedule] = useState(profile?.payout_schedule || 'manual');
  const [minPayoutAmt, setMinPayoutAmt] = useState(profile?.min_payout_amount || 50);
  const [savingPayout, setSavingPayout] = useState(false);

  // Linked accounts
  const { data: linkedAccounts = [] } = useQuery({
    queryKey: ['linkedAccountsFinance'],
    queryFn: () => base44.entities.LinkedAccount.list('-last_used', 30),
  });

  // UserGoals for autopilot allowance
  const { data: goals } = useQuery({
    queryKey: ['userGoalsFinance'],
    queryFn: () => base44.entities.UserGoals.list().then(r => r[0] || {}),
  });

  // Spending policies
  const { data: spendingPolicies = [] } = useQuery({
    queryKey: ['spendingPoliciesFinance'],
    queryFn: () => base44.entities.SpendingPolicy.list(),
  });

  // Full platform transactions (Strategy, Opportunity earnings)
  const { data: opportunityTxns = [] } = useQuery({
    queryKey: ['opportunityTxnsFinance'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
  });

  const allTxns = [...transactions, ...opportunityTxns]
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 100);

  const totalPlatformIncome = opportunityTxns.filter(t => t.type === 'income').reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);
  const totalPlatformExpense = opportunityTxns.filter(t => t.type === 'expense').reduce((s, t) => s + Math.abs(t.amount || 0), 0);
  const autopilotAllowance = goals?.available_capital || 0;
  const globalPolicy = spendingPolicies.find(p => p.category === 'global');

  // Earnings by source/platform
  const earningsByPlatform = {};
  opportunityTxns.filter(t => t.type === 'income').forEach(t => {
    const k = t.platform || 'other';
    earningsByPlatform[k] = (earningsByPlatform[k] || 0) + (t.net_amount || t.amount || 0);
  });

  async function handleWithdraw() {
    const amount = parseFloat(withdrawAmt);
    if (!amount || amount <= 0) return;
    setWithdrawing(true);
    try {
      await base44.entities.WalletTransaction.create({
        user_email: user?.email, type: 'withdrawal', amount: -amount,
        description: `Withdrawal to ${withdrawAddr || 'wallet'}`, status: 'pending',
      });
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, { wallet_balance: Math.max(0, balance - amount), payout_address: withdrawAddr });
      }
      qc.invalidateQueries({ queryKey: ['walletTxs'] });
      qc.invalidateQueries({ queryKey: ['userProfile'] });
      setWithdrawAmt('');
      toast.success('Withdrawal submitted!');
    } catch (e) { toast.error(e.message); }
    setWithdrawing(false);
  }

  async function handleDepositAllowance() {
    const amount = parseFloat(depositAmt);
    if (!amount || amount <= 0) return;
    setDepositing(true);
    try {
      const newCapital = autopilotAllowance + amount;
      if (goals?.id) {
        await base44.entities.UserGoals.update(goals.id, { available_capital: newCapital });
      }
      // Log as internal transfer
      await base44.entities.Transaction.create({
        type: 'transfer', amount, description: `Autopilot allowance deposit`,
        category: 'other', payout_status: 'available',
      });
      qc.invalidateQueries({ queryKey: ['userGoalsFinance'] });
      qc.invalidateQueries({ queryKey: ['opportunityTxnsFinance'] });
      setDepositAmt('');
      toast.success(`$${fmt(amount)} added to Autopilot Allowance!`);
    } catch (e) { toast.error(e.message); }
    setDepositing(false);
  }

  async function handleSavePayoutSettings() {
    setSavingPayout(true);
    try {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, {
          payout_schedule: payoutSchedule,
          min_payout_amount: Number(minPayoutAmt),
          payout_address: withdrawAddr,
        });
      }
      qc.invalidateQueries({ queryKey: ['userProfile'] });
      toast.success('Payout settings saved!');
    } catch (e) { toast.error(e.message); }
    setSavingPayout(false);
  }

  return (
    <div className="min-h-screen galaxy-bg">
      <div className="max-w-6xl mx-auto p-4 md:p-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)' }}>
              <Wallet className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white tracking-wider">FINANCE HUB</h1>
              <p className="text-xs text-slate-400">Unified wallet · AI allowance · Payout scheduling · Platform earnings</p>
            </div>
          </div>
          <button onClick={() => { qc.invalidateQueries(); }} className="p-2 rounded-xl border border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40 transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* ── Balance Hero ── */}
        <div className="rounded-2xl p-6 mb-6 relative overflow-hidden"
          style={{ background: 'rgba(10,15,42,0.85)', border: '1px solid rgba(16,185,129,0.3)', backdropFilter: 'blur(24px)' }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse at top right, rgba(16,185,129,0.08), transparent 60%)' }} />
          <div className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(16,185,129,0.6), transparent)' }} />
          <div className="relative flex flex-col md:flex-row md:items-end gap-6">
            <div className="flex-1">
              <div className="text-xs font-orbitron text-emerald-400/60 tracking-widest mb-1">TOTAL WALLET BALANCE</div>
              <div className="text-5xl font-orbitron font-black text-white mb-1"
                style={{ textShadow: '0 0 30px rgba(16,185,129,0.4)' }}>
                ${fmt(balance)}
              </div>
              <div className="text-xs text-slate-500 font-mono">All-time platform earnings: <span className="text-emerald-400">${fmt(totalPlatformIncome)}</span></div>
            </div>
            {/* AI Allowance badge */}
            <div className="flex-shrink-0 px-5 py-4 rounded-2xl"
              style={{ background: 'rgba(181,55,242,0.08)', border: '1px solid rgba(181,55,242,0.3)' }}>
              <div className="text-[10px] font-orbitron text-violet-400/70 tracking-widest mb-1 flex items-center gap-1">
                <Bot className="w-3 h-3" /> AUTOPILOT ALLOWANCE
              </div>
              <div className="text-3xl font-orbitron font-bold text-violet-300">${fmt(autopilotAllowance)}</div>
              <div className="text-[10px] text-slate-600 mt-0.5">Available for AI execution tasks</div>
            </div>
          </div>
        </div>

        {/* ── Stats Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="TODAY" value={`$${fmt(todayEarnings)}`} color="#f9d65c" icon={TrendingUp} />
          <StatCard label="THIS WEEK" value={`$${fmt(weekEarnings)}`} color="#00e8ff" icon={BarChart3} />
          <StatCard label="TOTAL EXPENSE" value={`$${fmt(totalPlatformExpense)}`} color="#ef4444" icon={ArrowUpRight} sub="Platform task costs" />
          <StatCard label="NET PROFIT" value={`$${fmt(totalPlatformIncome - totalPlatformExpense)}`} color="#10b981" icon={CheckCircle2} sub="Income minus costs" />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl overflow-x-auto"
          style={{ background: 'rgba(10,15,42,0.6)', border: '1px solid rgba(16,185,129,0.15)' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-orbitron tracking-wide transition-all whitespace-nowrap min-w-0 ${
                  active ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35' : 'text-slate-500 hover:text-slate-300'
                }`}>
                <Icon className="w-3 h-3 shrink-0" />
                <span className="hidden sm:block">{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === 'overview' && (
          <div className="space-y-4">
            {/* Earnings by platform */}
            {Object.keys(earningsByPlatform).length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-orbitron text-xs text-slate-500 tracking-widest mb-4">EARNINGS BY PLATFORM</div>
                <div className="space-y-3">
                  {Object.entries(earningsByPlatform).sort((a, b) => b[1] - a[1]).map(([src, amt]) => {
                    const pct = totalPlatformIncome > 0 ? (amt / totalPlatformIncome) * 100 : 0;
                    return (
                      <div key={src}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-400 capitalize">{src}</span>
                          <span className="text-emerald-400 font-mono">${fmt(amt)} <span className="text-slate-600">({pct.toFixed(0)}%)</span></span>
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #10b981, #00e8ff)' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Spending policies summary */}
            {spendingPolicies.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-orbitron text-xs text-slate-500 tracking-widest mb-4 flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> SPENDING POLICIES
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {spendingPolicies.slice(0, 6).map(p => (
                    <div key={p.id} className="flex items-center justify-between p-3 rounded-xl"
                      style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <div>
                        <div className="text-xs font-semibold text-slate-300 capitalize">{p.category}</div>
                        <div className="text-[10px] text-slate-600">Max/task: ${p.max_per_task} · Max/day: ${p.max_per_day}</div>
                      </div>
                      <div className={`w-2 h-2 rounded-full ${p.enabled ? 'bg-emerald-400' : 'bg-slate-600'}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── AUTOPILOT ALLOWANCE TAB ── */}
        {tab === 'allowance' && (
          <div className="space-y-4">
            {/* Allowance explainer */}
            <div className="p-4 rounded-2xl" style={{ background: 'rgba(181,55,242,0.06)', border: '1px solid rgba(181,55,242,0.25)' }}>
              <div className="flex items-start gap-3">
                <Bot className="w-5 h-5 text-violet-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-sm font-semibold text-violet-300 mb-1">What is Autopilot Allowance?</div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    The Autopilot Allowance is the capital budget the autonomous AI engine uses for real-world task execution — including platform fees, arbitrage purchases, bid costs, and agentic browsing tasks. The AI will never spend beyond this allowance without your approval.
                  </p>
                </div>
              </div>
            </div>

            {/* Current allowance */}
            <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(10,15,42,0.8)', border: '1px solid rgba(181,55,242,0.3)' }}>
              <div className="text-xs font-orbitron text-violet-400/60 tracking-widest mb-2">CURRENT AUTOPILOT ALLOWANCE</div>
              <div className="text-5xl font-orbitron font-black text-violet-300 mb-1"
                style={{ textShadow: '0 0 30px rgba(181,55,242,0.4)' }}>
                ${fmt(autopilotAllowance)}
              </div>
              {globalPolicy && (
                <div className="text-xs text-slate-600">
                  Auto-approve threshold: <span className="text-amber-400">${globalPolicy.auto_approve_threshold}</span>
                  {' · '}Max per task: <span className="text-red-400">${globalPolicy.max_per_task}</span>
                </div>
              )}
            </div>

            {/* Deposit form */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-orbitron text-xs text-slate-500 tracking-widest">ADD FUNDS TO ALLOWANCE</div>
              <div>
                <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-2 block">DEPOSIT AMOUNT (USD)</label>
                <input
                  type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                  placeholder="Enter amount to add..."
                  className="w-full px-4 py-3 rounded-xl font-mono text-white text-sm outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                />
              </div>
              {/* Quick amounts */}
              <div className="flex gap-2 flex-wrap">
                {[25, 50, 100, 250, 500].map(amt => (
                  <button key={amt} onClick={() => setDepositAmt(String(amt))}
                    className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                    style={{ background: depositAmt === String(amt) ? 'rgba(181,55,242,0.2)' : 'rgba(255,255,255,0.04)', border: `1px solid ${depositAmt === String(amt) ? 'rgba(181,55,242,0.5)' : 'rgba(255,255,255,0.08)'}`, color: depositAmt === String(amt) ? '#c084fc' : '#64748b' }}>
                    +${amt}
                  </button>
                ))}
              </div>
              <button
                onClick={handleDepositAllowance}
                disabled={depositing || !depositAmt || parseFloat(depositAmt) <= 0}
                className="w-full py-3 rounded-xl font-orbitron text-xs tracking-widest transition-all disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, rgba(181,55,242,0.2), rgba(181,55,242,0.08))', border: '1px solid rgba(181,55,242,0.4)', color: '#c084fc' }}>
                {depositing ? 'PROCESSING...' : `ADD $${depositAmt || '0.00'} TO AUTOPILOT ALLOWANCE`}
              </button>
              <p className="text-[10px] text-slate-600 text-center">
                The AI engine will autonomously use these funds for approved execution tasks within your spending policy limits.
              </p>
            </div>

            {/* Spending policy quick edit */}
            {globalPolicy && (
              <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="font-orbitron text-xs text-slate-500 tracking-widest flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5" /> GLOBAL SPENDING LIMITS
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  {[
                    { label: 'Auto-approve under', value: `$${globalPolicy.auto_approve_threshold}` },
                    { label: 'Max per task', value: `$${globalPolicy.max_per_task}` },
                    { label: 'Max per day', value: `$${globalPolicy.max_per_day}` },
                    { label: 'Min ROI required', value: `${globalPolicy.min_roi_pct}%` },
                  ].map(s => (
                    <div key={s.label} className="p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="text-slate-500 text-[10px] mb-1">{s.label}</div>
                      <div className="text-amber-400 font-orbitron font-bold">{s.value}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-slate-600">Edit detailed policies in Control → Settings</p>
              </div>
            )}
          </div>
        )}

        {/* ── ACCOUNTS TAB ── */}
        {tab === 'accounts' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-slate-500">{linkedAccounts.length} linked platform accounts</p>
            </div>
            {linkedAccounts.length === 0 ? (
              <div className="text-center py-12 rounded-2xl" style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Link className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-500 text-sm mb-1">No linked accounts yet</p>
                <p className="text-slate-600 text-xs">Connect accounts in Identity Manager</p>
              </div>
            ) : (
              linkedAccounts.map(acc => (
                <div key={acc.id} className="flex items-center justify-between p-4 rounded-2xl"
                  style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                      style={{ background: acc.ai_can_use ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${acc.ai_can_use ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                      <CreditCard className="w-4 h-4" style={{ color: acc.ai_can_use ? '#10b981' : '#64748b' }} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white capitalize">{acc.platform} <span className="text-slate-500 font-normal">· {acc.username}</span></div>
                      <div className="text-xs text-slate-600">
                        {acc.label && <span className="mr-2">{acc.label}</span>}
                        Total earned: <span className="text-emerald-400">${fmt(acc.total_earned)}</span>
                        {acc.jobs_completed > 0 && <span className="ml-2">{acc.jobs_completed} jobs</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-orbitron border capitalize ${
                      acc.health_status === 'healthy' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' :
                      acc.health_status === 'warning' ? 'text-amber-400 bg-amber-500/10 border-amber-500/30' :
                      'text-red-400 bg-red-500/10 border-red-500/30'
                    }`}>{acc.health_status || 'unknown'}</span>
                    {acc.ai_can_use && (
                      <span className="text-[10px] text-violet-400 flex items-center gap-0.5">
                        <Bot className="w-2.5 h-2.5" /> AI enabled
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ── PAYOUT TAB ── */}
        {tab === 'payout' && (
          <div className="space-y-4">
            {/* Schedule */}
            <div className="rounded-2xl p-5 space-y-4" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-orbitron text-xs text-slate-500 tracking-widest flex items-center gap-2">
                <Calendar className="w-3.5 h-3.5" /> PAYOUT SCHEDULE
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {PAYOUT_SCHEDULES.map(s => (
                  <button key={s} onClick={() => setPayoutSchedule(s)}
                    className="py-2.5 rounded-xl text-xs font-orbitron capitalize transition-all"
                    style={{
                      background: payoutSchedule === s ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${payoutSchedule === s ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.07)'}`,
                      color: payoutSchedule === s ? '#10b981' : '#64748b',
                    }}>{s}</button>
                ))}
              </div>
            </div>

            {/* Min payout */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-orbitron text-xs text-slate-500 tracking-widest">MINIMUM PAYOUT AMOUNT</div>
              <input
                type="number" value={minPayoutAmt} onChange={e => setMinPayoutAmt(e.target.value)}
                className="w-full px-4 py-3 rounded-xl font-mono text-white text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <p className="text-xs text-slate-600">Payouts will only trigger when your balance exceeds this threshold.</p>
            </div>

            {/* Payout address */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-orbitron text-xs text-slate-500 tracking-widest">PAYOUT DESTINATION</div>
              <input
                type="text" value={withdrawAddr} onChange={e => setWithdrawAddr(e.target.value)}
                placeholder="Crypto address, PayPal email, bank account..."
                className="w-full px-4 py-3 rounded-xl font-mono text-white text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
            </div>

            {/* Manual withdraw */}
            <div className="rounded-2xl p-5 space-y-3" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="font-orbitron text-xs text-slate-500 tracking-widest">MANUAL WITHDRAWAL</div>
              <input
                type="number" value={withdrawAmt} onChange={e => setWithdrawAmt(e.target.value)}
                placeholder="Amount to withdraw..." max={balance}
                className="w-full px-4 py-3 rounded-xl font-mono text-white text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              />
              <button
                onClick={handleWithdraw}
                disabled={withdrawing || !withdrawAmt || parseFloat(withdrawAmt) <= 0 || parseFloat(withdrawAmt) > balance}
                className="w-full py-3 rounded-xl font-orbitron text-xs tracking-widest transition-all disabled:opacity-50"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.35)', color: '#10b981' }}>
                {withdrawing ? 'PROCESSING...' : `WITHDRAW $${withdrawAmt || '0.00'}`}
              </button>
              <p className="text-xs text-slate-600 text-center">Balance after: ${fmt(Math.max(0, balance - (parseFloat(withdrawAmt) || 0)))}</p>
            </div>

            <button
              onClick={handleSavePayoutSettings}
              disabled={savingPayout}
              className="w-full py-3 rounded-xl font-orbitron text-xs tracking-widest transition-all disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #10b981, #06b6d4)', color: '#000', fontWeight: 700 }}>
              {savingPayout ? 'SAVING...' : 'SAVE PAYOUT SETTINGS'}
            </button>
          </div>
        )}

        {/* ── TRANSACTIONS TAB ── */}
        {tab === 'transactions' && (
          <div className="rounded-2xl p-5" style={{ background: 'rgba(10,15,42,0.75)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center justify-between mb-4">
              <div className="font-orbitron text-xs text-slate-500 tracking-widest">ALL PLATFORM TRANSACTIONS</div>
              <span className="text-xs text-slate-600">{allTxns.length} records</span>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {allTxns.length === 0
                ? <p className="text-center text-slate-600 text-xs py-8">No transactions yet</p>
                : allTxns.map(tx => <TxRow key={tx.id} tx={tx} />)
              }
            </div>
          </div>
        )}

      </div>
    </div>
  );
}