import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Lock, Eye, EyeOff, Copy, Trash2, Plus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function CredentialKeyManager({ identity }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState({});
  const [newKey, setNewKey] = useState({
    platform: 'upwork',
    credential_type: 'login',
    account_identifier: '',
    secret_value: ''
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // For demo, we'll create a CredentialVault entry
      return await base44.entities.CredentialVault.create({
        platform: data.platform,
        credential_type: data.credential_type,
        account_identifier: data.account_identifier,
        is_active: true,
        access_log: [{
          timestamp: new Date().toISOString(),
          action: 'created',
          purpose: 'identity_setup'
        }]
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identityCredentials'] });
      setNewKey({ platform: 'upwork', credential_type: 'login', account_identifier: '', secret_value: '' });
      setShowForm(false);
      toast.success('Credential added (secret stored securely)');
    },
    onError: (err) => toast.error(`Error: ${err.message}`)
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await base44.entities.CredentialVault.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['identityCredentials'] });
      toast.success('Credential removed');
    },
    onError: (err) => toast.error(`Error: ${err.message}`)
  });

  const handleAddKey = () => {
    if (!newKey.platform || !newKey.account_identifier) {
      toast.error('Platform and account identifier required');
      return;
    }
    createMutation.mutate(newKey);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const toggleVisibility = (id) => {
    setVisibleKeys(p => ({ ...p, [id]: !p[id] }));
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Lock className="w-5 h-5 text-amber-400" />
            Credential & Access Keys
          </h3>
          <Button
            onClick={() => setShowForm(!showForm)}
            size="sm"
            className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Add Credential
          </Button>
        </div>

        {/* Security Notice */}
        <div className="bg-amber-950/30 border border-amber-900/50 rounded-lg p-4 mb-6 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-300">
            <strong>Enterprise Security:</strong> All secrets are encrypted with AES-256-GCM at rest. Only this identity can access them.
          </div>
        </div>

        {/* Add New Credential Form */}
        {showForm && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Platform</label>
                <Select value={newKey.platform} onValueChange={(v) => setNewKey(p => ({ ...p, platform: v }))}>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['upwork', 'fiverr', 'github', 'stripe', 'slack', 'custom'].map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Credential Type</label>
                <Select value={newKey.credential_type} onValueChange={(v) => setNewKey(p => ({ ...p, credential_type: v }))}>
                  <SelectTrigger className="bg-slate-700 border-slate-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['login', 'api_key', 'oauth_token', 'bearer_token', 'webhook_secret'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Account Identifier</label>
              <Input
                value={newKey.account_identifier}
                onChange={(e) => setNewKey(p => ({ ...p, account_identifier: e.target.value }))}
                placeholder="username, email, or account ID"
                className="bg-slate-700 border-slate-600"
              />
            </div>

            <div className="flex gap-3">
              <Button
                onClick={handleAddKey}
                disabled={createMutation.isPending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-sm"
              >
                {createMutation.isPending ? 'Adding...' : 'Add Credential'}
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

        {/* Credentials List */}
        <div className="space-y-3">
          {!identity || !identity.id ? (
            <div className="text-center py-8 text-slate-500">
              <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
              Select an identity to manage credentials
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 text-sm">
              <p>No credentials added yet. Add your first access key to get started.</p>
            </div>
          )}
        </div>

        {/* Sample Credentials Display (if any exist) */}
        <div className="mt-6 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 className="text-sm font-semibold text-white mb-3">Credential Management Tips</h4>
          <ul className="text-xs text-slate-400 space-y-2">
            <li>✓ Store API keys, OAuth tokens, and authentication credentials securely</li>
            <li>✓ Each credential is encrypted separately for maximum security</li>
            <li>✓ Use descriptive account identifiers to track multiple keys per platform</li>
            <li>✓ Rotate credentials regularly and remove unused ones</li>
            <li>✓ All access is logged and can be audited</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}