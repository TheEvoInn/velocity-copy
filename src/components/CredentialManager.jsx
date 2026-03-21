/**
 * Credential Manager Component
 * UI for managing encrypted credentials with MFA support
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Lock, Plus, Trash2, RotateCw, Eye, EyeOff, Shield, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const PLATFORMS = [
  { value: 'upwork', label: 'Upwork' },
  { value: 'fiverr', label: 'Fiverr' },
  { value: 'amazon', label: 'Amazon' },
  { value: 'ebay', label: 'eBay' },
  { value: 'grant.gov', label: 'Grants.gov' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'generic', label: 'Other' }
];

const CREDENTIAL_TYPES = [
  { value: 'username_password', label: 'Username & Password' },
  { value: 'api_token', label: 'API Token' },
  { value: 'bearer_token', label: 'Bearer Token' },
  { value: 'session_cookie', label: 'Session Cookie' },
  { value: 'oauth_token', label: 'OAuth Token' }
];

const MFA_TYPES = [
  { value: 'none', label: 'None' },
  { value: 'totp', label: 'Time-based (TOTP)' },
  { value: 'sms', label: 'SMS' },
  { value: 'email', label: 'Email' },
  { value: 'backup_code', label: 'Backup Codes' }
];

export default function CredentialManager() {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    credential_name: '',
    platform: 'upwork',
    credential_type: 'username_password',
    credential_value: '',
    mfa_enabled: false,
    mfa_type: 'none',
    mfa_secret: ''
  });
  const [selectedCredential, setSelectedCredential] = useState(null);
  const [revealedCredentials, setRevealedCredentials] = useState(new Set());

  // List credentials
  const { data: credentialsData, isLoading, refetch } = useQuery({
    queryKey: ['credentials'],
    queryFn: async () => {
      const res = await base44.functions.invoke('credentialManager', {
        action: 'list_credentials',
        payload: { active_only: false }
      });
      return res.data;
    }
  });

  // Store credential mutation
  const storeMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('credentialManager', {
        action: 'store_credential',
        payload: formData
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success(`Credential "${formData.credential_name}" stored securely`);
      setFormData({
        credential_name: '',
        platform: 'upwork',
        credential_type: 'username_password',
        credential_value: '',
        mfa_enabled: false,
        mfa_type: 'none',
        mfa_secret: ''
      });
      setShowForm(false);
      refetch();
    },
    onError: (err) => {
      toast.error('Failed to store credential: ' + err.message);
    }
  });

  // Rotate credential mutation
  const rotateMutation = useMutation({
    mutationFn: async (credentialId) => {
      const res = await base44.functions.invoke('credentialManager', {
        action: 'rotate_credential',
        payload: {
          credential_id: credentialId,
          new_value: prompt('Enter new credential value:')
        }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Credential rotated successfully');
      refetch();
    },
    onError: (err) => {
      toast.error('Failed to rotate: ' + err.message);
    }
  });

  // Delete credential mutation
  const deleteMutation = useMutation({
    mutationFn: async (credentialId) => {
      if (!window.confirm('Are you sure? This cannot be undone.')) return;

      const res = await base44.functions.invoke('credentialManager', {
        action: 'delete_credential',
        payload: { credential_id: credentialId }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Credential deleted');
      refetch();
    },
    onError: (err) => {
      toast.error('Failed to delete: ' + err.message);
    }
  });

  const toggleReveal = (credentialId) => {
    const newSet = new Set(revealedCredentials);
    if (newSet.has(credentialId)) {
      newSet.delete(credentialId);
    } else {
      newSet.add(credentialId);
    }
    setRevealedCredentials(newSet);
  };

  const credentials = credentialsData?.credentials || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lock className="w-6 h-6 text-violet-400" />
            Encrypted Credentials
          </h2>
          <p className="text-sm text-slate-400 mt-1">
            Securely store and auto-inject credentials across platforms
          </p>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="gap-2 bg-violet-600 hover:bg-violet-500"
        >
          <Plus className="w-4 h-4" />
          Add Credential
        </Button>
      </div>

      {/* Add Credential Form */}
      {showForm && (
        <Card className="p-6 bg-slate-900/50 border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-4">Store New Credential</h3>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Credential Name</label>
              <input
                type="text"
                value={formData.credential_name}
                onChange={(e) => setFormData({ ...formData, credential_name: e.target.value })}
                placeholder="e.g., Upwork - John Doe"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">Platform</label>
                <select
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-violet-500 focus:outline-none"
                >
                  {PLATFORMS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">Type</label>
                <select
                  value={formData.credential_type}
                  onChange={(e) => setFormData({ ...formData, credential_type: e.target.value })}
                  className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-violet-500 focus:outline-none"
                >
                  {CREDENTIAL_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300">Credential Value</label>
              <textarea
                value={formData.credential_value}
                onChange={(e) => setFormData({ ...formData, credential_value: e.target.value })}
                placeholder="Paste your credential (encrypted immediately)"
                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none h-24"
              />
            </div>

            {/* MFA Section */}
            <div className="border-t border-slate-700 pt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  type="checkbox"
                  id="mfa-enabled"
                  checked={formData.mfa_enabled}
                  onChange={(e) => setFormData({ ...formData, mfa_enabled: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <label htmlFor="mfa-enabled" className="text-sm font-semibold text-slate-300 cursor-pointer flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber-400" />
                  This platform uses MFA
                </label>
              </div>

              {formData.mfa_enabled && (
                <div className="space-y-3 ml-6">
                  <div>
                    <label className="text-xs font-semibold text-slate-300">MFA Type</label>
                    <select
                      value={formData.mfa_type}
                      onChange={(e) => setFormData({ ...formData, mfa_type: e.target.value })}
                      className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white focus:border-violet-500 focus:outline-none"
                    >
                      {MFA_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  {formData.mfa_type === 'totp' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-300">MFA Secret (Base32)</label>
                      <input
                        type="password"
                        value={formData.mfa_secret}
                        onChange={(e) => setFormData({ ...formData, mfa_secret: e.target.value })}
                        placeholder="JBSWY3DPEBLW64TMMQ======"
                        className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:border-violet-500 focus:outline-none font-mono text-sm"
                      />
                      <p className="text-xs text-slate-400 mt-1">Encrypted immediately after submission</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                onClick={() => storeMutation.mutate()}
                disabled={storeMutation.isPending || !formData.credential_name || !formData.credential_value}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500"
              >
                {storeMutation.isPending ? 'Storing...' : 'Store Securely'}
              </Button>
              <Button
                onClick={() => setShowForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Credentials List */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-4 border-violet-400/20 border-t-violet-400 rounded-full animate-spin"></div>
        </div>
      ) : credentials.length === 0 ? (
        <Card className="p-8 text-center bg-slate-900/50 border-slate-800">
          <Lock className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">No credentials stored yet. Add one to get started.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {credentials.map(cred => (
            <Card key={cred.id} className="p-4 bg-slate-900/50 border-slate-800 hover:border-slate-700 transition">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Lock className="w-4 h-4 text-violet-400" />
                    <h4 className="font-semibold text-white">{cred.credential_name}</h4>
                    <Badge variant={cred.is_active ? 'default' : 'secondary'}>
                      {cred.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                    {cred.requires_mfa && (
                      <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                        <Shield className="w-3 h-3 mr-1" />
                        MFA
                      </Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-xs mt-3">
                    <div>
                      <p className="text-slate-400">Platform</p>
                      <p className="text-white font-mono capitalize">{cred.platform}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Type</p>
                      <p className="text-white font-mono capitalize">{cred.credential_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Last Used</p>
                      <p className="text-white">
                        {cred.last_used_at ? new Date(cred.last_used_at).toLocaleDateString() : 'Never'}
                      </p>
                    </div>
                  </div>

                  {cred.total_uses > 0 && (
                    <div className="mt-2 text-xs text-slate-400">
                      <CheckCircle2 className="w-3 h-3 inline mr-1" />
                      Used {cred.total_uses} times
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={() => rotateMutation.mutate(cred.id)}
                    disabled={rotateMutation.isPending}
                    variant="outline"
                    size="icon"
                    title="Rotate credential"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                  <Button
                    onClick={() => deleteMutation.mutate(cred.id)}
                    disabled={deleteMutation.isPending}
                    variant="outline"
                    size="icon"
                    className="text-red-400 hover:text-red-300 hover:border-red-500/30"
                    title="Delete credential"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Security Info */}
      <Card className="p-4 bg-emerald-500/10 border-emerald-500/30">
        <div className="flex gap-3">
          <Shield className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-300 mb-1">End-to-End Encryption</p>
            <p className="text-emerald-200/80">
              All credentials are encrypted with AES-256-GCM. Only you can decrypt them. Never stored in plaintext.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}