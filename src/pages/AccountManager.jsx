import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock, Plus, Shield, AlertTriangle, CheckCircle2, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CredentialVaultCard from '@/components/credentials/CredentialVaultCard';
import CredentialVaultForm from '@/components/credentials/CredentialVaultForm';

const PERMISSION_LEVELS = {
  view_only: { label: 'View Only', color: '#3b82f6', icon: '👁️' },
  limited_automation: { label: 'Limited Automation', color: '#f59e0b', icon: '⚡' },
  full_automation: { label: 'Full Automation', color: '#10b981', icon: '🤖' },
};

export default function AccountManager() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingCredential, setEditingCredential] = useState(null);
  const [loading, setLoading] = useState(false);

  const { data: credentials = [], isLoading, refetch } = useQuery({
    queryKey: ['platformCredentials'],
    queryFn: async () => {
      const result = await base44.functions.invoke('credentialVaultManager', {
        action: 'list',
      });
      return result.data.credentials || [];
    },
    initialData: [],
  });

  const handleSave = async (data) => {
    setLoading(true);
    try {
      if (editingCredential) {
        await base44.functions.invoke('credentialVaultManager', {
          action: 'update',
          credentialId: editingCredential.id,
          payload: data,
        });
      } else {
        await base44.functions.invoke('credentialVaultManager', {
          action: 'store',
          payload: data,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['platformCredentials'] });
      setShowForm(false);
      setEditingCredential(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (credentialId) => {
    if (confirm('Are you sure? This credential will be permanently deleted.')) {
      await base44.functions.invoke('credentialVaultManager', {
        action: 'delete',
        credentialId,
      });
      queryClient.invalidateQueries({ queryKey: ['platformCredentials'] });
    }
  };

  const handleEdit = (credential) => {
    setEditingCredential(credential);
    setShowForm(true);
  };

  const handleToggleFullAuto = async (credential) => {
    await base44.functions.invoke('credentialVaultManager', {
      action: 'update',
      credentialId: credential.id,
      payload: { fully_auto_enabled: !credential.fully_auto_enabled },
    });
    queryClient.invalidateQueries({ queryKey: ['platformCredentials'] });
  };

  // Stats
  const totalCredentials = credentials.length;
  const activeCredentials = credentials.filter(c => c.is_active).length;
  const fullAutoEnabled = credentials.filter(c => c.fully_auto_enabled).length;
  const permissionBreakdown = {
    view_only: credentials.filter(c => c.permission_level === 'view_only').length,
    limited_automation: credentials.filter(c => c.permission_level === 'limited_automation').length,
    full_automation: credentials.filter(c => c.permission_level === 'full_automation').length,
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Lock className="w-6 h-6 text-amber-400" />
            Credential Vault
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Securely store and manage your third-party platform credentials with granular Autopilot permissions
          </p>
        </div>
        <Button
          onClick={() => { setEditingCredential(null); setShowForm(!showForm); }}
          className="bg-blue-600 hover:bg-blue-500 text-white h-9 gap-2"
        >
          <Plus className="w-4 h-4" /> Add Credential
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Credentials', value: totalCredentials, color: '#a855f7', icon: '📦' },
          { label: 'Active', value: activeCredentials, color: '#10b981', icon: '✓' },
          { label: 'Full Auto', value: fullAutoEnabled, color: '#10b981', icon: '🤖' },
          { label: 'Limited', value: permissionBreakdown.limited_automation, color: '#f59e0b', icon: '⚡' },
          { label: 'View-Only', value: permissionBreakdown.view_only, color: '#3b82f6', icon: '👁️' },
        ].map((stat, i) => (
          <div
            key={i}
            className="rounded-xl p-3 border"
            style={{
              background: `${stat.color}08`,
              borderColor: `${stat.color}30`,
            }}
          >
            <div className="flex items-start justify-between mb-1">
              <span className="text-2xl">{stat.icon}</span>
              <span className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </span>
            </div>
            <p className="text-[10px] text-slate-500">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <CredentialVaultForm
          credential={editingCredential}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingCredential(null); }}
        />
      )}

      {/* Credentials Grid */}
      {isLoading ? (
        <div className="text-center py-12 text-slate-500">Loading credentials...</div>
      ) : credentials.length === 0 && !showForm ? (
        <div className="text-center py-16 rounded-xl bg-slate-900/40 border border-slate-800">
          <Lock className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-base text-slate-300 font-semibold">No credentials stored yet</p>
          <p className="text-sm text-slate-500 mt-1 mb-4">
            Add your first platform credential to enable secure Autopilot access
          </p>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white gap-2"
          >
            <Plus className="w-4 h-4" /> Add First Credential
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {credentials.map(credential => (
            <CredentialVaultCard
              key={credential.id}
              credential={credential}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onToggleFullAuto={handleToggleFullAuto}
            />
          ))}
        </div>
      )}

      {/* Security Information */}
      <div className="space-y-4">
        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-white text-sm">🔒 Encryption & Security</h3>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
                <li>All credentials encrypted with AES-256-GCM at rest</li>
                <li>Each credential isolated to your user account</li>
                <li>Credentials never transmitted in plain text</li>
                <li>Autopilot decrypts only when needed for task execution</li>
                <li>Complete access audit log maintained for compliance</li>
                <li>No admins can view your passwords or sensitive data</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-white text-sm">📋 Permission Levels Explained</h3>
              <div className="space-y-2">
                {Object.entries(PERMISSION_LEVELS).map(([level, config]) => (
                  <div key={level} className="text-xs text-slate-400">
                    <p className="font-semibold text-slate-200">{config.icon} {config.label}</p>
                    {level === 'view_only' && (
                      <p className="ml-4">Autopilot can log in and read data only. Cannot apply, submit, or make changes.</p>
                    )}
                    {level === 'limited_automation' && (
                      <p className="ml-4">Autopilot can prepare work and fill forms. You manually approve all submissions.</p>
                    )}
                    {level === 'full_automation' && (
                      <p className="ml-4">Autopilot has unrestricted access. Can apply, submit, communicate, and execute tasks hands-off.</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-slate-900/60 border border-slate-800 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-cyan-400 mt-0.5 shrink-0" />
            <div className="space-y-2">
              <h3 className="font-semibold text-white text-sm">✓ Legal & Compliance</h3>
              <p className="text-xs text-slate-400">
                By adding credentials and granting permissions, you confirm that:
              </p>
              <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside ml-2">
                <li>You own these accounts and have authority to connect them</li>
                <li>You grant the Profit Engine explicit permission to access and operate these accounts</li>
                <li>You understand the autonomy level you are enabling</li>
                <li>You authorize the Autopilot to act on your behalf within the selected permissions</li>
                <li>All activity is logged and auditable for compliance purposes</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}