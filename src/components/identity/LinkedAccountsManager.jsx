import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Database, Plus, Edit2, Trash2, ExternalLink, User, Star } from 'lucide-react';
import { toast } from 'sonner';
import AutoAccountCreationPanel from './AutoAccountCreationPanel';

const PLATFORMS = [
  { value: 'upwork', label: 'Upwork' },
  { value: 'fiverr', label: 'Fiverr' },
  { value: 'freelancer', label: 'Freelancer.com' },
  { value: 'toptal', label: 'Toptal' },
  { value: 'github', label: 'GitHub' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'slack', label: 'Slack' },
  { value: 'other', label: 'Other' }
];

export default function LinkedAccountsManager({ identity, onAccountsAdded }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [syncedFromAutopilot, setSyncedFromAutopilot] = useState(new Set());
  const [newAccount, setNewAccount] = useState({
    platform: 'upwork',
    username: '',
    profile_url: '',
    specialization: '',
    skills: '',
    hourly_rate: '',
    notes: ''
  });

  // Subscribe to auto-created accounts from Autopilot
  useEffect(() => {
    if (!identity?.id) return;
    const unsubscribe = base44.entities.LinkedAccount.subscribe((event) => {
      if (event.type === 'create' && event.data?.platform) {
        // Auto-sync newly created accounts
        setSyncedFromAutopilot(prev => new Set([...prev, event.id]));
        queryClient.invalidateQueries({ queryKey: ['linkedAccounts', identity?.id] });
        toast.success(`✓ Auto-created account synced: ${event.data.platform}`);
      }
    });
    return unsubscribe;
  }, [identity?.id, queryClient]);

  const { data: linkedAccounts = [] } = useQuery({
    queryKey: ['linkedAccounts', identity?.id],
    queryFn: () => base44.entities.LinkedAccount.filter({ 
      _or: [
        { id: { $in: identity?.linked_account_ids || [] } },
        { created_by: identity?.created_by }
      ]
    }, '-created_date', 50),
    enabled: !!identity?.id
  });

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const accountData = {
        ...data,
        skills: data.skills.split(',').map(s => s.trim()).filter(Boolean),
        hourly_rate: data.hourly_rate ? parseFloat(data.hourly_rate) : undefined,
        health_status: 'healthy',
        ai_can_use: true
      };

      if (editingAccount?.id) {
        return await base44.entities.LinkedAccount.update(editingAccount.id, accountData);
      } else {
        const created = await base44.entities.LinkedAccount.create(accountData);
        // Multi-sync: Link to AIIdentity immediately
        if (identity?.id) {
          await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
            linked_account_ids: [...(identity.linked_account_ids || []), created.id]
          }).catch(() => null);
        }
        return created;
      }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      setNewAccount({ platform: 'upwork', username: '', profile_url: '', specialization: '', skills: '', hourly_rate: '', notes: '' });
      setEditingAccount(null);
      setShowForm(false);
      toast.success(editingAccount ? 'Account updated' : 'Account added & synced to identity');
      // Notify parent wizard of new account
      onAccountsAdded?.([result?.id]);
    },
    onError: (err) => toast.error(`Error: ${err.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.LinkedAccount.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['linkedAccounts'] });
      toast.success('Account removed');
    },
    onError: (err) => toast.error(`Error: ${err.message}`)
  });

  const handleSave = () => {
    if (!newAccount.platform || !newAccount.username) {
      toast.error('Platform and username required');
      return;
    }
    saveMutation.mutate(newAccount);
  };

  const handleEdit = (account) => {
    setEditingAccount(account);
    setNewAccount({
      platform: account.platform,
      username: account.username,
      profile_url: account.profile_url || '',
      specialization: account.specialization || '',
      skills: account.skills?.join(', ') || '',
      hourly_rate: account.hourly_rate || '',
      notes: account.notes || ''
    });
    setShowForm(true);
  };

  return (
    <div className="space-y-6">
      {/* Auto-Account Creation */}
      <AutoAccountCreationPanel
        identity={identity}
        onAccountCreated={(accountIds) => {
          queryClient.invalidateQueries({ queryKey: ['linkedAccounts', identity?.id] });
          onAccountsAdded?.(accountIds);
        }}
      />

      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Database className="w-5 h-5 text-blue-400" />
            Linked Accounts
          </h3>
          <Button
            onClick={() => {
              setEditingAccount(null);
              setNewAccount({ platform: 'upwork', username: '', profile_url: '', specialization: '', skills: '', hourly_rate: '', notes: '' });
              setShowForm(!showForm);
            }}
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Link Account
          </Button>
        </div>

        {/* Add/Edit Account Form */}
        {showForm && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Platform *</label>
                <Select value={newAccount.platform} onValueChange={(v) => setNewAccount(p => ({ ...p, platform: v }))}>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PLATFORMS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Username *</label>
                <Input
                  value={newAccount.username}
                  onChange={(e) => setNewAccount(p => ({ ...p, username: e.target.value }))}
                  placeholder="Your account username"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Profile URL</label>
              <Input
                value={newAccount.profile_url}
                onChange={(e) => setNewAccount(p => ({ ...p, profile_url: e.target.value }))}
                placeholder="https://..."
                className="bg-slate-700 border-slate-600"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Specialization</label>
                <Input
                  value={newAccount.specialization}
                  onChange={(e) => setNewAccount(p => ({ ...p, specialization: e.target.value }))}
                  placeholder="e.g., Web Development"
                  className="bg-slate-700 border-slate-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Hourly Rate ($)</label>
                <Input
                  type="number"
                  value={newAccount.hourly_rate}
                  onChange={(e) => setNewAccount(p => ({ ...p, hourly_rate: e.target.value }))}
                  placeholder="50"
                  className="bg-slate-700 border-slate-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Skills (comma separated)</label>
              <Textarea
                value={newAccount.skills}
                onChange={(e) => setNewAccount(p => ({ ...p, skills: e.target.value }))}
                placeholder="React, Node.js, MongoDB, ..."
                className="bg-slate-700 border-slate-600 h-16 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Notes</label>
              <Textarea
                value={newAccount.notes}
                onChange={(e) => setNewAccount(p => ({ ...p, notes: e.target.value }))}
                placeholder="Any additional info about this account..."
                className="bg-slate-700 border-slate-600 h-16 text-sm"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
              >
                {saveMutation.isPending ? 'Saving...' : editingAccount ? 'Update Account' : 'Add Account'}
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="border-slate-700 text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Accounts List */}
        {linkedAccounts.length === 0 ? (
          <div className="text-center py-12">
            <User className="w-12 h-12 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">No accounts linked yet.</p>
            <p className="text-slate-600 text-xs mt-1">Link your first account to enable multi-platform execution.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {linkedAccounts.map(account => (
              <Card key={account.id} className="bg-slate-800/50 border-slate-700 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-semibold text-white">{account.username}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-slate-400">{account.platform}</p>
                      {syncedFromAutopilot.has(account.id) && (
                        <span className="text-[10px] bg-emerald-600/30 text-emerald-300 px-2 py-0.5 rounded">auto-synced</span>
                      )}
                    </div>
                  </div>
                  <Star className={`w-4 h-4 ${account.ai_can_use ? 'text-amber-400 fill-amber-400' : 'text-slate-600'}`} />
                </div>

                {account.specialization && (
                  <p className="text-sm text-slate-300 mb-2">{account.specialization}</p>
                )}

                {account.hourly_rate && (
                  <p className="text-xs text-emerald-400 mb-2">${account.hourly_rate}/hr</p>
                )}

                {account.skills?.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-1">
                    {account.skills.slice(0, 3).map((skill, i) => (
                      <span key={i} className="text-[10px] bg-slate-700 text-slate-300 px-2 py-1 rounded">
                        {skill}
                      </span>
                    ))}
                    {account.skills.length > 3 && (
                      <span className="text-[10px] text-slate-500">+{account.skills.length - 3} more</span>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-4">
                  {account.profile_url && (
                    <a href={account.profile_url} target="_blank" rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-slate-700 hover:bg-slate-600 text-white text-xs rounded transition-colors">
                      <ExternalLink className="w-3 h-3" /> View
                    </a>
                  )}
                  <button
                    onClick={() => handleEdit(account)}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 text-xs rounded transition-colors"
                  >
                    <Edit2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate(account.id)}
                    disabled={deleteMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs rounded transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}