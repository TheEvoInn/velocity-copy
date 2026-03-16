import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Target, Plus, TrendingUp, Calendar, DollarSign, Pencil, CheckCircle2, Trash2, BarChart3, Zap, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';

const PERIOD_CONFIG = {
  daily: { label: 'Daily', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  weekly: { label: 'Weekly', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  monthly: { label: 'Monthly', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  quarterly: { label: 'Quarterly', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
  yearly: { label: 'Yearly', color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20' },
  custom: { label: 'Custom', color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/20' },
};

function GoalCard({ goal, transactions, onEdit, onDelete }) {
  const cfg = PERIOD_CONFIG[goal.period] || PERIOD_CONFIG.custom;
  const progress = goal.target_amount > 0 ? Math.min(100, (goal.current_amount / goal.target_amount) * 100) : 0;

  // Calculate real current from transactions
  const now = new Date();
  let periodStart = new Date();
  if (goal.period === 'daily') periodStart.setHours(0, 0, 0, 0);
  else if (goal.period === 'weekly') { periodStart.setDate(now.getDate() - now.getDay()); periodStart.setHours(0,0,0,0); }
  else if (goal.period === 'monthly') periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (goal.period === 'quarterly') periodStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  else if (goal.period === 'yearly') periodStart = new Date(now.getFullYear(), 0, 1);
  else if (goal.start_date) periodStart = new Date(goal.start_date);

  const periodEarned = transactions
    .filter(t => t.type === 'income' && new Date(t.created_date) >= periodStart)
    .reduce((s, t) => s + (t.amount || 0), 0);

  const realProgress = goal.target_amount > 0 ? Math.min(100, (periodEarned / goal.target_amount) * 100) : 0;
  const aiPct = goal.ai_allocation_pct || 60;

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${cfg.bg} ${cfg.color} mb-2`}>
            <Calendar className="w-3 h-3" />
            {cfg.label}
          </div>
          <div className="text-xl font-bold text-white">${goal.target_amount?.toLocaleString()}</div>
          <div className="text-xs text-slate-500">target</div>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(goal)} className="p-1.5 rounded-lg text-slate-600 hover:text-white hover:bg-slate-800 transition-colors">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(goal.id)} className="p-1.5 rounded-lg text-slate-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-slate-400">${periodEarned.toFixed(2)} earned</span>
          <span className={`text-xs font-bold ${cfg.color}`}>{realProgress.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${realProgress >= 100 ? 'bg-emerald-400' : 'bg-gradient-to-r from-emerald-600 to-emerald-400'}`}
            style={{ width: `${realProgress}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-slate-800/50 p-2 text-center">
          <div className="text-[9px] text-slate-500 mb-0.5">AI handles</div>
          <div className="text-sm font-bold text-emerald-400">{aiPct}%</div>
        </div>
        <div className="rounded-lg bg-slate-800/50 p-2 text-center">
          <div className="text-[9px] text-slate-500 mb-0.5">Remaining</div>
          <div className="text-sm font-bold text-white">${Math.max(0, goal.target_amount - periodEarned).toFixed(0)}</div>
        </div>
      </div>

      {goal.notes && <p className="text-[10px] text-slate-600 mt-2">{goal.notes}</p>}
    </div>
  );
}

function GoalForm({ goal, onSave, onCancel }) {
  const [form, setForm] = useState({
    period: goal?.period || 'daily',
    target_amount: goal?.target_amount || 100,
    ai_allocation_pct: goal?.ai_allocation_pct || 60,
    start_date: goal?.start_date || new Date().toISOString().split('T')[0],
    end_date: goal?.end_date || '',
    notes: goal?.notes || '',
    auto_renew: goal?.auto_renew !== false,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">{goal ? 'Edit Goal' : 'New Goal'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Period</label>
          <select value={form.period} onChange={e => set('period', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50">
            {Object.entries(PERIOD_CONFIG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Target ($)</label>
          <Input type="number" value={form.target_amount} onChange={e => set('target_amount', parseFloat(e.target.value) || 0)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">AI Allocation (%)</label>
          <Input type="number" min="0" max="100" value={form.ai_allocation_pct} onChange={e => set('ai_allocation_pct', parseFloat(e.target.value) || 60)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Start Date</label>
          <Input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Notes</label>
        <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional goal notes..."
          className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="auto_renew" checked={form.auto_renew} onChange={e => set('auto_renew', e.target.checked)} className="rounded" />
        <label htmlFor="auto_renew" className="text-xs text-slate-400">Auto-renew this goal each period</label>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => onSave(form)} size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
          <Save className="w-3.5 h-3.5 mr-1" /> Save Goal
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs h-8">Cancel</Button>
      </div>
    </div>
  );
}

export default function GoalCenter() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);

  const { data: goals = [] } = useQuery({
    queryKey: ['earningGoals'],
    queryFn: () => base44.entities.EarningGoal.list('-created_date', 50),
    initialData: [],
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 200),
    initialData: [],
  });

  const { data: userGoals = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });

  const profile = userGoals[0] || {};

  const handleSave = async (form) => {
    if (editingGoal) {
      await base44.entities.EarningGoal.update(editingGoal.id, form);
    } else {
      await base44.entities.EarningGoal.create({ ...form, current_amount: 0, status: 'active' });
    }
    queryClient.invalidateQueries({ queryKey: ['earningGoals'] });
    setShowForm(false);
    setEditingGoal(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.EarningGoal.delete(id);
    queryClient.invalidateQueries({ queryKey: ['earningGoals'] });
  };

  const handleEdit = (goal) => {
    setEditingGoal(goal);
    setShowForm(true);
  };

  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  // Lifetime stats
  const totalEarned = profile.total_earned || 0;
  const aiEarned = profile.ai_total_earned || 0;

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-400" />
            Goal Center
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Track your earning goals across all time periods</p>
        </div>
        <Button onClick={() => { setEditingGoal(null); setShowForm(!showForm); }} size="sm"
          className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
          <Plus className="w-3.5 h-3.5 mr-1" /> New Goal
        </Button>
      </div>

      {/* Lifetime Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Earned', value: `$${totalEarned.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-400' },
          { label: 'AI Earned', value: `$${aiEarned.toFixed(2)}`, icon: Zap, color: 'text-violet-400' },
          { label: 'You Earned', value: `$${(totalEarned - aiEarned).toFixed(2)}`, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'Active Goals', value: activeGoals.length, icon: Target, color: 'text-amber-400' },
        ].map((stat, i) => (
          <div key={i} className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">{stat.label}</span>
            </div>
            <div className={`text-xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Goal Form */}
      {showForm && (
        <GoalForm
          goal={editingGoal}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingGoal(null); }}
        />
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            Active Goals ({activeGoals.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeGoals.map(g => (
              <GoalCard key={g.id} goal={g} transactions={transactions} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}

      {goals.length === 0 && !showForm && (
        <div className="text-center py-16 rounded-xl bg-slate-900/40 border border-slate-800">
          <Target className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No goals set yet.</p>
          <p className="text-xs text-slate-600 mt-1">Create your first earning goal to track progress.</p>
          <Button onClick={() => setShowForm(true)} size="sm" className="mt-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Create Goal
          </Button>
        </div>
      )}

      {completedGoals.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Completed ({completedGoals.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {completedGoals.slice(0, 6).map(g => (
              <GoalCard key={g.id} goal={g} transactions={transactions} onEdit={handleEdit} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}