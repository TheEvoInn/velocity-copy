import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Lock, Key, Eye, EyeOff, Trash2, RefreshCw, CheckCircle2, AlertCircle, Clock, ShieldCheck, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import CredentialRotationPanel from '../credentials/CredentialRotationPanel';

export default function CredentialManager() {
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [rotatingCred, setRotatingCred] = useState(null);
  const queryClient = useQueryClient();

  // Load PlatformCredentials (Vault) for rotation oversight
  const { data: platformCreds = [] } = useQuery({
    queryKey: ['platformCredentials'],
    queryFn: () => base44.functions.invoke('credentialVaultManager', { action: 'list', payload: {} }).then(r => r.data?.credentials || []),
    refetchInterval: 30000,
  });

  const overdueCount = platformCreds.filter(c => c.next_rotation_due && new Date(c.next_rotation_due) < new Date()).length;

  // Fetch identities
  const { data: identities } = useQuery({
    queryKey: ['ai_identities'],
    queryFn: async () => {
      const res = await base44.entities.AIIdentity.list('-created_date', 100);
      return res;
    }
  });

  // Fetch credentials for selected identity
  const { data: credentials, isLoading } = useQuery({
    queryKey: ['identity_credentials', selectedIdentity],
    queryFn: async () => {
      if (!selectedIdentity) return null;

      const res = await base44.functions.invoke('moduleCredentialAdapter', {
        action: 'get_all_active_for_identity',
        payload: { identity_id: selectedIdentity }
      });

      return res.data;
    },
    enabled: !!selectedIdentity
  });

  // Fetch audit log
  const { data: auditLog } = useQuery({
    queryKey: ['secret_audit_log', selectedIdentity],
    queryFn: async () => {
      if (!selectedIdentity) return [];

      const res = await base44.functions.invoke('secretManager', {
        action: 'audit_log',
        payload: { identity_id: selectedIdentity, limit: 20 }
      });

      return res.data?.logs || [];
    },
    enabled: !!selectedIdentity,
    refetchInterval: 10000
  });

  // Add credential mutation
  const addCredentialMutation = useMutation({
    mutationFn: async (credentialData) => {
      const res = await base44.functions.invoke('credentialInterceptor', {
        action: 'on_user_credential_provided',
        payload: {
          identity_id: selectedIdentity,
          platform: credentialData.platform,
          secret_type: credentialData.secret_type,
          secret_value: credentialData.secret_value,
          account_identifier: credentialData.account_identifier,
          notes: 'User-provided credential'
        }
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Credential stored securely');
      setNewCredential({ platform: '', secret_type: 'password', secret_value: '', account_identifier: '' });
      setAddingCredential(false);
      queryClient.invalidateQueries({ queryKey: ['identity_credentials'] });
      queryClient.invalidateQueries({ queryKey: ['secret_audit_log'] });
    },
    onError: (error) => {
      toast.error(`Failed to store credential: ${error.message}`);
    }
  });

  // Replace credential mutation
  const replaceCredentialMutation = useMutation({
    mutationFn: async (credentialData) => {
      const res = await base44.functions.invoke('secretManager', {
        action: 'replace',
        payload: credentialData
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Credential replaced successfully');
      queryClient.invalidateQueries({ queryKey: ['identity_credentials'] });
      queryClient.invalidateQueries({ queryKey: ['secret_audit_log'] });
    },
    onError: (error) => {
      toast.error(`Failed to replace credential: ${error.message}`);
    }
  });

  const handleAddCredential = () => {
    if (!newCredential.platform || !newCredential.secret_value) {
      toast.error('Platform and credential value required');
      return;
    }

    addCredentialMutation.mutate(newCredential);
  };

  const handleReplaceCredential = (credentialId) => {
    replaceCredentialMutation.mutate({
      audit_log_id: credentialId,
      new_secret_value: '',
      reason: 'User replacement from credential manager'
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white mb-2">🔐 Credential Manager</h2>
        <p className="text-sm text-slate-400">
          Centralized credential management with automatic encryption and audit logging
        </p>
      </div>

      {/* Identity Selection */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <p className="text-xs text-slate-500 mb-3">Select Identity</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {identities?.map(identity => (
            <button
              key={identity.id}
              onClick={() => setSelectedIdentity(identity.id)}
              className={`p-3 rounded-lg text-left transition-colors ${
                selectedIdentity === identity.id
                  ? 'bg-emerald-600/30 border border-emerald-500'
                  : 'bg-slate-800/50 border border-slate-700 hover:bg-slate-800'
              }`}
            >
              <p className="font-semibold text-white text-sm">{identity.name}</p>
              <p className="text-xs text-slate-400">{identity.role_label}</p>
            </button>
          ))}
        </div>
      </Card>

      {/* ── Platform Credential Vault — Rotation Overview ── */}
      {platformCreds.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              Platform Credential Vault
            </h3>
            {overdueCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/25">
                {overdueCount} overdue
              </span>
            )}
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {platformCreds.map(c => {
              const overdue = c.next_rotation_due && new Date(c.next_rotation_due) < new Date();
              return (
                <div key={c.id} className={`flex items-center justify-between p-2.5 rounded-lg border ${
                  overdue ? 'bg-red-500/8 border-red-500/20' : 'bg-slate-800/40 border-slate-700'
                }`}>
                  <div>
                    <span className="text-xs font-semibold text-white capitalize">{c.platform}</span>
                    <span className="text-slate-500 text-xs ml-2">{c.account_label}</span>
                    {overdue && <span className="text-[10px] text-red-400 ml-2">⚠ Rotation overdue</span>}
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => setRotatingCred(c)}
                    className="h-7 px-2 text-xs gap-1 text-cyan-400 hover:bg-cyan-500/10">
                    <RotateCcw className="w-3 h-3" /> Rotate
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Rotation Modal */}
      {rotatingCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6" style={{ background: 'rgba(10,15,42,0.97)', border: '1px solid rgba(0,232,255,0.25)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-orbitron text-sm text-white tracking-wider">ROTATE CREDENTIAL</h3>
              <button onClick={() => setRotatingCred(null)} className="text-slate-500 hover:text-white text-lg">&times;</button>
            </div>
            <CredentialRotationPanel credential={rotatingCred} onClose={() => { setRotatingCred(null); queryClient.invalidateQueries({ queryKey: ['platformCredentials'] }); }} />
          </div>
        </div>
      )}

      {selectedIdentity && (
        <>          {/* Add New Credential */}
          <Card className="bg-emerald-950/20 border-emerald-900/30 p-4">
            <button
              onClick={() => setAddingCredential(!addingCredential)}
              className="w-full text-left font-semibold text-emerald-400 flex items-center gap-2"
            >
              <Key className="w-4 h-4" />
              {addingCredential ? 'Cancel' : 'Add New Credential'}
            </button>

            {addingCredential && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="text-xs text-slate-400 block mb-1">Platform</label>
                  <Input
                    placeholder="e.g., upwork, gmail, fiverr"
                    value={newCredential.platform}
                    onChange={(e) => setNewCredential({ ...newCredential, platform: e.target.value })}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Credential Type</label>
                  <select
                    value={newCredential.secret_type}
                    onChange={(e) => setNewCredential({ ...newCredential, secret_type: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg text-white text-sm p-2"
                  >
                    <option value="password">Password</option>
                    <option value="api_key">API Key</option>
                    <option value="email_password">Email Password</option>
                    <option value="oauth_token">OAuth Token</option>
                    <option value="bearer_token">Bearer Token</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Account (Email/Username)</label>
                  <Input
                    placeholder="your@email.com or username"
                    value={newCredential.account_identifier}
                    onChange={(e) => setNewCredential({ ...newCredential, account_identifier: e.target.value })}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <div>
                  <label className="text-xs text-slate-400 block mb-1">Credential Value</label>
                  <Input
                    type="password"
                    placeholder="Enter credential"
                    value={newCredential.secret_value}
                    onChange={(e) => setNewCredential({ ...newCredential, secret_value: e.target.value })}
                    className="bg-slate-900 border-slate-700"
                  />
                </div>

                <Button
                  onClick={handleAddCredential}
                  disabled={addCredentialMutation.isPending}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  {addCredentialMutation.isPending ? 'Storing...' : 'Store Securely'}
                </Button>
              </div>
            )}
          </Card>

          {/* Credentials List */}
          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-400" />
              Active Credentials
            </h3>

            {isLoading ? (
              <p className="text-sm text-slate-400">Loading credentials...</p>
            ) : credentials?.credential_summary && Object.keys(credentials.credential_summary).length > 0 ? (
              <div className="space-y-4">
                {Object.entries(credentials.credential_summary).map(([platform, creds]) => (
                  <div key={platform} className="border border-slate-800 rounded-lg p-3">
                    <p className="font-semibold text-white mb-2">{platform}</p>
                    <div className="space-y-2">
                      {creds.map((cred, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-slate-800/50 p-2 rounded text-xs">
                          <div className="flex-1">
                            <span className="text-slate-400">{cred.secret_type}</span>
                            {cred.account_identifier && (
                              <span className="text-slate-500 ml-2">({cred.account_identifier})</span>
                            )}
                            {cred.needs_rotation && (
                              <span className="text-amber-400 ml-2 flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                Rotation Due
                              </span>
                            )}
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleReplaceCredential(cred.id)}
                            className="text-slate-400 hover:text-emerald-400"
                          >
                            <RefreshCw className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">No credentials for this identity yet</p>
            )}
          </Card>

          {/* Audit Log */}
          <Card className="bg-slate-900/50 border-slate-800 p-4">
            <h3 className="font-semibold text-white mb-4">Credential Audit Log</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auditLog?.length > 0 ? (
                auditLog.map((log, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs bg-slate-800/30 p-2 rounded border border-slate-700">
                    {log.status === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1">
                      <p className="text-slate-300">
                        <span className="text-emerald-400">{log.event_type}</span>
                        {' • '}
                        <span className="text-slate-400">{log.platform} ({log.secret_type})</span>
                      </p>
                      <p className="text-slate-500 mt-1">
                        {new Date(log.created_date).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-slate-500">No audit events yet</p>
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}