import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link2, Plus, Shield, Activity, AlertTriangle, CheckCircle2, Clock, XCircle, Pencil, Trash2, Lock, Eye, EyeOff, Save, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PLATFORMS = ['upwork', 'fiverr', 'freelancer', 'toptal', 'guru', 'peopleperhour', '99designs', 'fivesquid', 'truelancer', 'other'];
const HEALTH_CONFIG = {
  healthy: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', label: 'Healthy' },
  warning: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20', label: 'Warning' },
  cooldown: { icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Cooldown' },
  suspended: { icon: XCircle, color: 'text-rose-400', bg: 'bg-rose-500/10 border-rose-500/20', label: 'Suspended' },
  limited: { icon: AlertTriangle, color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', label: 'Limited' },
};

function AccountCard({ account, onEdit, onDelete, onToggleAI }) {
  const health = HEALTH_CONFIG[account.health_status] || HEALTH_CONFIG.healthy;
  const HealthIcon = health.icon;
  const score = account.performance_score || 50;

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white capitalize">{account.platform}</span>
            {account.label && (
              <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">{account.label}</span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">@{account.username}</p>
        </div>
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] font-medium ${health.bg} ${health.color}`}>
          <HealthIcon className="w-3 h-3" />
          {health.label}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="text-center rounded-lg bg-slate-800/50 p-2">
          <div className="text-[9px] text-slate-500">Rating</div>
          <div className="text-sm font-bold text-white">{account.rating?.toFixed(1) || '—'}</div>
        </div>
        <div className="text-center rounded-lg bg-slate-800/50 p-2">
          <div className="text-[9px] text-slate-500">Jobs</div>
          <div className="text-sm font-bold text-white">{account.jobs_completed || 0}</div>
        </div>
        <div className="text-center rounded-lg bg-slate-800/50 p-2">
          <div className="text-[9px] text-slate-500">Score</div>
          <div className={`text-sm font-bold ${score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-rose-400'}`}>{score}</div>
        </div>
      </div>

      {/* Performance bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-slate-600">Performance</span>
          <span className="text-[9px] text-slate-500">{account.applications_today || 0}/{account.daily_application_limit || 10} today</span>
        </div>
        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div className={`h-full rounded-full ${score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-rose-500'}`}
            style={{ width: `${score}%` }} />
        </div>
      </div>

      {account.specialization && (
        <p className="text-[10px] text-slate-500 mb-3 italic">{account.specialization}</p>
      )}

      {account.skills?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {account.skills.slice(0, 4).map((s, i) => (
            <span key={i} className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{s}</span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500">AI Access:</span>
          <button onClick={() => onToggleAI(account)} className={`text-[10px] font-semibold ${account.ai_can_use ? 'text-emerald-400' : 'text-rose-400'}`}>
            {account.ai_can_use ? 'Enabled' : 'Disabled'}
          </button>
        </div>
        <div className="flex gap-1">
          <button onClick={() => onEdit(account)} className="p-1.5 rounded text-slate-600 hover:text-white hover:bg-slate-800">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(account.id)} className="p-1.5 rounded text-slate-600 hover:text-rose-400 hover:bg-rose-500/10">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {account.total_earned > 0 && (
        <div className="mt-2 text-[10px] text-emerald-400">Total earned via this account: ${account.total_earned.toFixed(2)}</div>
      )}
    </div>
  );
}

function AccountForm({ account, onSave, onCancel }) {
  const [form, setForm] = useState({
    platform: account?.platform || 'upwork',
    username: account?.username || '',
    label: account?.label || '',
    specialization: account?.specialization || '',
    skills: account?.skills?.join(', ') || '',
    rating: account?.rating || '',
    jobs_completed: account?.jobs_completed || 0,
    success_rate: account?.success_rate || '',
    hourly_rate: account?.hourly_rate || '',
    daily_application_limit: account?.daily_application_limit || 10,
    profile_url: account?.profile_url || '',
    ai_can_use: account?.ai_can_use !== false,
    notes: account?.notes || '',
  });

  const [showCredential, setShowCredential] = useState(false);
  const [credUsername, setCredUsername] = useState('');
  const [credPassword, setCredPassword] = useState('');
  const [savingCred, setSavingCred] = useState(false);
  const [credSaved, setCredSaved] = useState(false);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSaveCredential = async (linkedAccountId) => {
    if (!credUsername && !credPassword) return;
    setSavingCred(true);
    await base44.functions.invoke('credentialVault', {
      action: 'store',
      platform: form.platform,
      credential_type: 'login',
      credentials: { username: credUsername, password: credPassword },
      linked_account_id: linkedAccountId
    });
    setCredSaved(true);
    setSavingCred(false);
    setCredUsername('');
    setCredPassword('');
  };

  const handleSave = async () => {
    const data = {
      ...form,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      rating: parseFloat(form.rating) || null,
      success_rate: parseFloat(form.success_rate) || null,
      hourly_rate: parseFloat(form.hourly_rate) || null,
      jobs_completed: parseInt(form.jobs_completed) || 0,
    };
    await onSave(data, handleSaveCredential);
  };

  return (
    <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-4 space-y-3">
      <h3 className="text-sm font-semibold text-white">{account ? 'Edit Account' : 'Link New Account'}</h3>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Platform</label>
          <select value={form.platform} onChange={e => set('platform', e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none">
            {PLATFORMS.map(p => <option key={p} value={p} className="capitalize">{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Username / Profile ID</label>
          <Input value={form.username} onChange={e => set('username', e.target.value)} placeholder="your_username"
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Label / Tag</label>
          <Input value={form.label} onChange={e => set('label', e.target.value)} placeholder="e.g. writing profile"
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Profile URL</label>
          <Input value={form.profile_url} onChange={e => set('profile_url', e.target.value)} placeholder="https://..."
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Specialization</label>
          <Input value={form.specialization} onChange={e => set('specialization', e.target.value)} placeholder="What this account is best for"
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div className="col-span-2">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Skills (comma separated)</label>
          <Input value={form.skills} onChange={e => set('skills', e.target.value)} placeholder="writing, SEO, research"
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Rating (0-5)</label>
          <Input type="number" step="0.1" min="0" max="5" value={form.rating} onChange={e => set('rating', e.target.value)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Jobs Completed</label>
          <Input type="number" value={form.jobs_completed} onChange={e => set('jobs_completed', e.target.value)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Success Rate (%)</label>
          <Input type="number" min="0" max="100" value={form.success_rate} onChange={e => set('success_rate', e.target.value)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Daily App Limit</label>
          <Input type="number" value={form.daily_application_limit} onChange={e => set('daily_application_limit', parseInt(e.target.value) || 10)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-9" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input type="checkbox" id="ai_can_use" checked={form.ai_can_use} onChange={e => set('ai_can_use', e.target.checked)} />
        <label htmlFor="ai_can_use" className="text-xs text-slate-400">Allow AI to use this account for automated tasks</label>
      </div>

      {/* Credential Section */}
      <div className="rounded-lg bg-slate-900/60 border border-slate-700 p-3">
        <button onClick={() => setShowCredential(!showCredential)}
          className="flex items-center gap-2 text-xs text-slate-400 hover:text-white w-full">
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          {showCredential ? 'Hide' : 'Add'} Login Credentials (encrypted)
          {credSaved && <span className="text-emerald-400 ml-auto">✓ Saved</span>}
        </button>
        {showCredential && (
          <div className="mt-3 space-y-2">
            <p className="text-[10px] text-slate-500">Credentials are AES-256 encrypted. The AI accesses them only during approved tasks.</p>
            <Input value={credUsername} onChange={e => setCredUsername(e.target.value)} placeholder="Platform username/email"
              className="bg-slate-800 border-slate-600 text-white text-xs h-9" />
            <div className="relative">
              <Input type={showCredential ? 'password' : 'text'} value={credPassword} onChange={e => setCredPassword(e.target.value)} placeholder="Password or API key"
                className="bg-slate-800 border-slate-600 text-white text-xs h-9 pr-8" />
            </div>
            <p className="text-[9px] text-slate-600">⚠️ Credentials are saved after the account is created. Save the account first.</p>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <Button onClick={handleSave} size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8">
          <Save className="w-3.5 h-3.5 mr-1" /> Save Account
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs h-8">Cancel</Button>
      </div>
    </div>
  );
}

export default function AccountManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [scoring, setScoring] = useState(false);

  const { data: accounts = [] } = useQuery({
    queryKey: ['linkedAccounts'],
    queryFn: () => base44.entities.LinkedAccount.list('-performance_score', 50),
    initialData: [],
  });

  const handleSave = async (data, saveCredentialFn) => {
    let savedAccount;
    if (editingAccount) {
      savedAccount = await base44.entities.LinkedAccount.update(editingAccount.id, data);
    } else {
      savedAccount = await base44.entities.LinkedAccount.create(data);
    }
    // Save credential if provided
    if (saveCredentialFn && savedAccount?.id) {
      await saveCredentialFn(savedAccount.id);
    }
    queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
    setShowForm(false);
    setEditingAccount(null);
  };

  const handleDelete = async (id) => {
    await base44.entities.LinkedAccount.delete(id);
    queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setShowForm(true);
  };

  const handleToggleAI = async (account) => {
    await base44.entities.LinkedAccount.update(account.id, { ai_can_use: !account.ai_can_use });
    queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
  };

  const runScoring = async () => {
    setScoring(true);
    await base44.functions.invoke('accountRotationEngine', { action: 'score_accounts' });
    queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
    setScoring(false);
  };

  const aiEnabled = accounts.filter(a => a.ai_can_use);
  const healthy = accounts.filter(a => a.health_status === 'healthy');

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-blue-400" />
            Account Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Manage and rotate linked platform accounts</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runScoring} disabled={scoring} variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs h-8">
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${scoring ? 'animate-spin' : ''}`} />
            Score Accounts
          </Button>
          <Button onClick={() => { setEditingAccount(null); setShowForm(!showForm); }} size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8">
            <Plus className="w-3.5 h-3.5 mr-1" /> Link Account
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Accounts', value: accounts.length, color: 'text-white' },
          { label: 'AI Enabled', value: aiEnabled.length, color: 'text-emerald-400' },
          { label: 'Healthy', value: healthy.length, color: 'text-emerald-400' },
          { label: 'Platforms', value: new Set(accounts.map(a => a.platform)).size, color: 'text-blue-400' },
        ].map((s, i) => (
          <div key={i} className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {showForm && (
        <AccountForm
          account={editingAccount}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingAccount(null); }}
        />
      )}

      {accounts.length === 0 && !showForm ? (
        <div className="text-center py-16 rounded-xl bg-slate-900/40 border border-slate-800">
          <Link2 className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No accounts linked yet.</p>
          <p className="text-xs text-slate-600 mt-1">Link your Upwork, Fiverr, and other profiles to enable AI rotation.</p>
          <Button onClick={() => setShowForm(true)} size="sm" className="mt-4 bg-blue-600 hover:bg-blue-500 text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> Link First Account
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map(a => (
            <AccountCard key={a.id} account={a} onEdit={handleEdit} onDelete={handleDelete} onToggleAI={handleToggleAI} />
          ))}
        </div>
      )}

      {/* Security Note */}
      <div className="rounded-xl bg-slate-900/40 border border-slate-800/50 p-4">
        <div className="flex items-start gap-3">
          <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
          <div>
            <p className="text-xs font-semibold text-white mb-1">Security & Compliance</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              All credentials are encrypted with AES-256-GCM before storage. The AI only accesses credentials when executing approved tasks, 
              and every access is logged. Account rotation ensures platform rate limits and TOS compliance. 
              Enable AI access only for accounts you explicitly authorize.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}