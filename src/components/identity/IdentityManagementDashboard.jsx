import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Users, Zap, AlertCircle, CheckCircle, Link2, RotateCw } from 'lucide-react';
import { toast } from 'sonner';

export default function IdentityManagementDashboard() {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', role_label: 'Freelancer', tone: 'professional' });
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const queryClient = useQueryClient();

  // Fetch identities
  const { data: identitiesData = {} } = useQuery({
    queryKey: ['activeIdentities'],
    queryFn: async () => {
      const res = await base44.functions.invoke('identityAccountEngine', {
        action: 'get_active_identities',
        payload: {}
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  // Fetch linked accounts
  const { data: accountsData = {} } = useQuery({
    queryKey: ['linkedAccounts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('identityAccountEngine', {
        action: 'get_linked_accounts',
        payload: {}
      });
      return res.data;
    },
    refetchInterval: 30000
  });

  // Fetch account health
  const { data: healthData = {} } = useQuery({
    queryKey: ['accountHealth'],
    queryFn: async () => {
      const res = await base44.functions.invoke('identityAccountEngine', {
        action: 'monitor_account_health',
        payload: {}
      });
      return res.data;
    },
    refetchInterval: 60000
  });

  // Create identity mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('identityAccountEngine', {
        action: 'create_ai_identity',
        payload: data
      });
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`✓ Identity "${data.name}" created`);
      setFormData({ name: '', role_label: 'Freelancer', tone: 'professional' });
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ['activeIdentities'] });
    },
    onError: (error) => {
      toast.error(`Failed to create identity: ${error.message}`);
    }
  });

  const handleCreateIdentity = async () => {
    if (!formData.name.trim()) {
      toast.error('Please enter an identity name');
      return;
    }

    try {
      const user = await base44.auth.me();
      createMutation.mutate({
        user_email: user?.email,
        name: formData.name,
        role_label: formData.role_label,
        communication_tone: formData.tone,
        email: `${formData.name.toLowerCase().replace(/\s+/g, '_')}@profit-matrix.ai`
      });
    } catch (e) {
      toast.error('Failed to get user email');
    }
  };

  const activeCount = identitiesData.active || 0;
  const totalIdentities = identitiesData.total_identities || 0;
  const totalAccounts = accountsData.total_accounts || 0;
  const healthyAccounts = healthData.healthy || 0;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <div className="rounded-lg bg-purple-950/30 border border-purple-500/30 p-3">
          <div className="text-purple-400">Identities</div>
          <div className="text-2xl font-bold text-white mt-1">{totalIdentities}</div>
          <div className="text-purple-600 text-[10px] mt-1">{activeCount} active</div>
        </div>
        <div className="rounded-lg bg-blue-950/30 border border-blue-500/30 p-3">
          <div className="text-blue-400">Linked Accounts</div>
          <div className="text-2xl font-bold text-white mt-1">{totalAccounts}</div>
          <div className="text-blue-600 text-[10px] mt-1">Platforms</div>
        </div>
        <div className="rounded-lg bg-emerald-950/30 border border-emerald-500/30 p-3">
          <div className="text-emerald-400">Healthy</div>
          <div className="text-2xl font-bold text-white mt-1">{healthyAccounts}</div>
          <div className="text-emerald-600 text-[10px] mt-1">Accounts</div>
        </div>
        <div className="rounded-lg bg-amber-950/30 border border-amber-500/30 p-3">
          <div className="text-amber-400">Warnings</div>
          <div className="text-2xl font-bold text-white mt-1">{healthData.warning || 0}</div>
          <div className="text-amber-600 text-[10px] mt-1">Issues</div>
        </div>
      </div>

      {/* Create Identity Panel */}
      {showCreateForm ? (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Create New Identity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Alex Developer"
                className="bg-slate-800 border-slate-700 text-white h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Role</label>
                <select
                  value={formData.role_label}
                  onChange={(e) => setFormData({ ...formData, role_label: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option>Freelancer</option>
                  <option>Designer</option>
                  <option>Writer</option>
                  <option>Developer</option>
                  <option>Marketer</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Tone</label>
                <select
                  value={formData.tone}
                  onChange={(e) => setFormData({ ...formData, tone: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option value="professional">Professional</option>
                  <option value="friendly">Friendly</option>
                  <option value="casual">Casual</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleCreateIdentity}
                disabled={createMutation.isPending}
                className="flex-1 bg-purple-600 hover:bg-purple-500 text-white text-xs h-8"
              >
                {createMutation.isPending ? 'Creating...' : 'Create Identity'}
              </Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                className="text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button
          onClick={() => setShowCreateForm(true)}
          className="w-full bg-purple-600 hover:bg-purple-500 text-white text-sm h-9"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create New Identity
        </Button>
      )}

      {/* Identities List */}
      {identitiesData.identities && identitiesData.identities.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              AI Identities ({totalIdentities})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {identitiesData.identities.map((identity) => (
                <div
                  key={identity.id}
                  onClick={() => setSelectedIdentity(identity)}
                  className="p-3 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-slate-600 cursor-pointer transition-all"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <div className="font-medium text-white">{identity.name}</div>
                      <div className="text-xs text-slate-500">{identity.role_label}</div>
                    </div>
                    <div className="flex items-center gap-1">
                      {identity.is_active && (
                        <div className="px-2 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/30">
                          <span className="text-[10px] text-emerald-400">Active</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 space-y-0.5">
                    <div>Tasks: {identity.tasks_executed} | Earned: ${identity.total_earned}</div>
                    <div>Linked Accounts: {identity.linked_account_ids?.length || 0}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Health Issues */}
      {healthData.issues && healthData.issues.length > 0 && (
        <Card className="bg-red-950/30 border-red-500/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400" />
              Account Issues ({healthData.issues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-xs max-h-48 overflow-y-auto">
              {healthData.issues.slice(0, 5).map((issue, idx) => (
                <div key={idx} className="p-2 rounded bg-slate-800/50 border border-red-500/30">
                  <div className="text-red-400 font-medium">{issue.platform} / {issue.username}</div>
                  <div className="text-slate-400 text-[10px]">{issue.reason}</div>
                </div>
              ))}
              {healthData.issues.length > 5 && (
                <div className="text-xs text-slate-500 text-center py-2">
                  +{healthData.issues.length - 5} more issues
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Linked Accounts by Platform */}
      {accountsData.by_platform && Object.keys(accountsData.by_platform).length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="w-4 h-4 text-blue-400" />
              Accounts by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-xs">
              {Object.entries(accountsData.by_platform).slice(0, 5).map(([platform, accounts]) => (
                <div key={platform} className="border-l-2 border-blue-500/30 pl-3 py-1">
                  <div className="font-medium text-blue-400 capitalize mb-1">{platform}</div>
                  <div className="space-y-1">
                    {accounts.slice(0, 3).map((account, idx) => (
                      <div key={idx} className="text-slate-400 text-[10px]">
                        <span className="text-slate-300">{account.username}</span>
                        {account.rating > 0 && <span className="ml-1">⭐ {account.rating}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Identity Details */}
      {selectedIdentity && (
        <Card className="bg-slate-900/50 border-slate-700 border-emerald-500/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{selectedIdentity.name} - Details</CardTitle>
              <Button
                onClick={() => setSelectedIdentity(null)}
                variant="ghost"
                className="h-6 w-6 p-0"
              >
                ✕
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500">Role</span>
                <div className="font-medium">{selectedIdentity.role_label}</div>
              </div>
              <div>
                <span className="text-slate-500">Status</span>
                <div className="font-medium text-emerald-400">{selectedIdentity.is_active ? 'Active' : 'Inactive'}</div>
              </div>
              <div>
                <span className="text-slate-500">Total Earned</span>
                <div className="font-medium text-emerald-400">${selectedIdentity.total_earned}</div>
              </div>
              <div>
                <span className="text-slate-500">Tasks</span>
                <div className="font-medium">{selectedIdentity.tasks_executed}</div>
              </div>
            </div>
            {selectedIdentity.preferred_platforms?.length > 0 && (
              <div>
                <span className="text-slate-500 block mb-1">Preferred Platforms</span>
                <div className="flex flex-wrap gap-1">
                  {selectedIdentity.preferred_platforms.map((platform) => (
                    <span key={platform} className="px-2 py-0.5 rounded bg-blue-950/30 border border-blue-500/30 text-blue-400">
                      {platform}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}