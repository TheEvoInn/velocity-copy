/**
 * IDENTITY MANAGER — Enhanced Dashboard
 * Shows active AI personas, assigned credentials, platform authorization matrix,
 * success metrics. Full 2-way sync via useUserIdentities hook.
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useUserIdentities } from '@/hooks/useUserData';
import { Plus, RefreshCw, Shield, Radio, Power, Users, Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import IdentityPersonaCard from '@/components/identity/IdentityPersonaCard';
import IdentityMetricsPanel from '@/components/identity/IdentityMetricsPanel';
import IdentityCreateForm from '@/components/identity/IdentityCreateForm';
import IdentityOnboardingWizard from '@/components/identity/IdentityOnboardingWizard';
import IdentityHealthBadge, { getIdentityHealthStatus } from '@/components/identity/IdentityHealthBadge';

export default function IdentityManager() {
  const qc = useQueryClient();
  const { identities, activeIdentity, update, create, remove, switchTo, isSwitching, refetch, isLoading } = useUserIdentities();

  const [showForm, setShowForm] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(null);
  const [filter, setFilter] = useState('all'); // all | active | inactive

  // Fetch all linked accounts for all identities at once
  const allLinkedIds = [...new Set(identities.flatMap(i => i.linked_account_ids || []))];
  const { data: allLinkedAccounts = [] } = useQuery({
    queryKey: ['allLinkedAccounts', allLinkedIds.join(',')],
    queryFn: () => base44.entities.LinkedAccount.list('-created_date', 100),
    refetchInterval: 20000,
    initialData: [],
  });

  // Fetch audit logs for activity feed
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['identityAuditLogs'],
    queryFn: async () => {
      const res = await base44.functions.invoke('identityEngine', { action: 'get_audit_log', limit: 20 });
      return res.data?.logs || [];
    },
    refetchInterval: 30000,
    initialData: [],
  });

  const filteredIdentities = identities.filter(i =>
    filter === 'all' ? true : filter === 'active' ? i.is_active : !i.is_active
  );

  async function handleSave(formData) {
    if (editingIdentity?.id) {
      update({ id: editingIdentity.id, data: formData });
    } else {
      create(formData);
    }
    setShowForm(false);
    setEditingIdentity(null);
  }

  function handleEdit(identity) {
    setEditingIdentity(identity);
    setShowForm(true);
  }

  async function handleSwitch(id) {
    switchTo(id);
    // Also propagate via identityEngine for full sync
    try {
      await base44.functions.invoke('identityEngine', { action: 'switch_identity', identity_id: id });
      qc.invalidateQueries({ queryKey: ['identities'] });
      qc.invalidateQueries({ queryKey: ['active_identity'] });
    } catch {}
  }

  async function handleDelete(id) {
    if (!id) return;
    remove(id);
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.3)' }}>
            <Shield className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">IDENTITY VAULT</h1>
            <p className="text-xs text-slate-500 font-mono">
              {identities.length} personas · {allLinkedAccounts.length} linked accounts · live 2-way sync
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { refetch(); qc.invalidateQueries({ queryKey: ['allLinkedAccounts'] }); }}
            className="p-2.5 rounded-xl transition-all"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: '#64748b' }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => { setEditingIdentity(null); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}>
            <Plus className="w-3.5 h-3.5" /> New Identity
          </button>
        </div>
      </div>

      {/* ── ACTIVE IDENTITY SPOTLIGHT ── */}
      {activeIdentity && (
        <div className="rounded-2xl p-5 mb-6 relative overflow-hidden"
          style={{
            background: `rgba(10,15,42,0.8)`,
            border: `1.5px solid ${activeIdentity.color || '#a855f7'}40`,
            boxShadow: `0 0 30px ${activeIdentity.color || '#a855f7'}10`,
          }}>
          <div className="absolute inset-0 pointer-events-none opacity-5"
            style={{ background: `radial-gradient(ellipse at left, ${activeIdentity.color || '#a855f7'}, transparent 60%)` }} />
          <div className="relative flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl"
                style={{ background: `${activeIdentity.color || '#a855f7'}15`, border: `1px solid ${activeIdentity.color || '#a855f7'}30` }}>
                {activeIdentity.icon || activeIdentity.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-orbitron text-lg font-bold text-white">{activeIdentity.name}</span>
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full"
                    style={{ background: `${activeIdentity.color || '#a855f7'}15`, color: activeIdentity.color || '#a855f7', border: `1px solid ${activeIdentity.color || '#a855f7'}30` }}>
                    <Radio className="w-2 h-2 animate-pulse" /> ACTIVE
                  </span>
                </div>
                <div className="text-xs text-slate-400">{activeIdentity.role_label}</div>
                {activeIdentity.tagline && <div className="text-xs text-slate-600 italic mt-0.5">{activeIdentity.tagline}</div>}
              </div>
            </div>
            <div className="flex items-center gap-6">
              {[
                { label: 'Tasks', value: activeIdentity.tasks_executed || 0, color: '#00e8ff' },
                { label: 'Earned', value: `$${(activeIdentity.total_earned || 0).toFixed(0)}`, color: '#10b981' },
                { label: 'Platforms', value: (activeIdentity.linked_account_ids || []).length, color: '#f9d65c' },
                { label: 'Tone', value: activeIdentity.communication_tone || 'professional', color: '#a855f7' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-sm font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[9px] text-slate-600 font-orbitron tracking-widest mt-0.5">{s.label.toUpperCase()}</div>
                </div>
              ))}
              <button onClick={() => handleEdit(activeIdentity)}
                className="px-3 py-1.5 rounded-xl text-xs font-orbitron transition-all"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8' }}>
                Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AGGREGATE METRICS ── */}
      <IdentityMetricsPanel identities={identities} linkedAccounts={allLinkedAccounts} />

      {/* ── FILTER TABS ── */}
      <div className="flex gap-2 mb-5">
        {[
          { key: 'all', label: `All (${identities.length})` },
          { key: 'active', label: 'Active' },
          { key: 'inactive', label: 'Inactive' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setFilter(tab.key)}
            className="px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{
              background: filter === tab.key ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${filter === tab.key ? 'rgba(168,85,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
              color: filter === tab.key ? '#a855f7' : '#64748b',
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── IDENTITY GRID ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-7 h-7 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredIdentities.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="font-orbitron text-lg text-slate-600 mb-2">No Identities Yet</p>
          <p className="text-xs text-slate-700 mb-6 max-w-sm mx-auto">
            Create an AI persona to define how the Autopilot presents itself across platforms — name, tone, skills, and authorized accounts.
          </p>
          <button onClick={() => setShowForm(true)}
            className="px-6 py-3 rounded-xl font-orbitron text-sm tracking-widest transition-all"
            style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}>
            <Plus className="w-4 h-4 inline mr-2" /> Create First Identity
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
          {filteredIdentities.map(identity => (
            <IdentityPersonaCard
              key={identity.id}
              identity={identity}
              linkedAccounts={allLinkedAccounts.filter(a => (identity.linked_account_ids || []).includes(a.id))}
              onSwitch={handleSwitch}
              onDelete={handleDelete}
              onUpdate={update}
              isSwitching={isSwitching}
            />
          ))}
        </div>
      )}

      {/* ── ACTIVITY LOG ── */}
      {auditLogs.length > 0 && (
        <div className="rounded-2xl overflow-hidden"
          style={{ background: 'rgba(10,15,42,0.65)', border: '1px solid rgba(168,85,247,0.12)' }}>
          <div className="px-5 py-3 border-b flex items-center gap-2" style={{ borderColor: 'rgba(168,85,247,0.1)' }}>
            <Activity className="w-4 h-4 text-violet-400" />
            <span className="font-orbitron text-xs tracking-widest text-violet-400/70">IDENTITY ACTIVITY LOG</span>
          </div>
          <div className="p-4 space-y-1.5 max-h-48 overflow-y-auto">
            {auditLogs.slice(0, 10).map((log, i) => (
              <div key={log.id || i} className="flex items-center justify-between px-3 py-2 rounded-xl text-xs"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                  <span className="text-slate-400 truncate max-w-xs">{log.subject || log.content_preview || 'Identity event'}</span>
                </div>
                <span className="text-slate-600 font-mono shrink-0 ml-2">
                  {log.created_date ? new Date(log.created_date).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Security Notice */}
      <div className="mt-5 rounded-2xl p-4 flex items-start gap-3"
        style={{ background: 'rgba(10,15,42,0.5)', border: '1px solid rgba(168,85,247,0.12)' }}>
        <Shield className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
        <p className="text-xs text-slate-500 leading-relaxed">
          All credentials tied to identities are encrypted (AES-256-GCM) in CredentialVault. Switching an identity instantly propagates to Autopilot, Execution, and all active workflows — no stale data. Every switch and credential access is immutably logged.
        </p>
      </div>

      {/* ── CREATE / EDIT FORM MODAL ── */}
      {showForm && (
        <IdentityCreateForm
          identity={editingIdentity}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingIdentity(null); }}
        />
      )}
    </div>
  );
}