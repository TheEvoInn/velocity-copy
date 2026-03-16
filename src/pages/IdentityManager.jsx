import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { User, Plus, RefreshCw, Zap, Shield, Radio, Users, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import IdentityCard from '../components/identity/IdentityCard';
import IdentityForm from '../components/identity/IdentityForm';
import AutoAccountCreator from '../components/identity/AutoAccountCreator';
import IdentityAuditLog from '../components/identity/IdentityAuditLog';
import AccountLinker from '../components/identity/AccountLinker';
import IdentityManagementDashboard from '../components/identity/IdentityManagementDashboard';

export default function IdentityManager() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(null);
  const [switchingId, setSwitchingId] = useState(null);
  const [selectedForAudit, setSelectedForAudit] = useState(null);
  const [showAccountLinker, setShowAccountLinker] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState(null);

  // Fetch user-specific identities
  const { data: userIdentities = [] } = useQuery({
    queryKey: ['aiIdentities', user?.email],
    queryFn: () => base44.entities.AIIdentity.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
    refetchInterval: 30000
  });

  const { data: identityData, refetch } = useQuery({
    queryKey: ['active_identity', user?.email],
    queryFn: () => base44.functions.invoke('identityEngine', { action: 'get_active' }),
    staleTime: 10000,
    enabled: !!user?.email
  });

  const { data: auditData } = useQuery({
    queryKey: ['identity_audit', selectedForAudit],
    queryFn: () => base44.functions.invoke('identityEngine', {
      action: 'get_audit_log',
      identity_id: selectedForAudit,
      limit: 60
    }),
    enabled: true,
    staleTime: 15000
  });

  const { data: healthData } = useQuery({
    queryKey: ['account_health'],
    queryFn: async () => {
      const res = await base44.functions.invoke('accountHealthMonitor', {
        action: 'check_all_account_health'
      });
      return res.data || {};
    },
    refetchInterval: 60000
  });

  const data = identityData?.data || {};
  const activeIdentity = data.identity;
  // Use user-specific identities instead of all identities
  const allIdentities = userIdentities || [];
  const logs = auditData?.data?.logs || [];

  const handleSave = async (form) => {
    // handleSave is now in IdentityForm component with proper user context
    qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] });
    qc.invalidateQueries({ queryKey: ['active_identity', user?.email] });
    setShowForm(false);
    setEditingIdentity(null);
    refetch();
  };

  const handleSwitch = async (identityId) => {
    setSwitchingId(identityId);
    await base44.functions.invoke('identityEngine', { action: 'switch_identity', identity_id: identityId });
    qc.invalidateQueries({ queryKey: ['active_identity'] });
    qc.invalidateQueries({ queryKey: ['linkedAccounts'] });
    qc.invalidateQueries({ queryKey: ['userGoals'] });
    await refetch();
    setSwitchingId(null);
  };

  const handleEdit = (identity) => {
    setEditingIdentity(identity);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    await base44.entities.AIIdentity.delete(id);
    qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] });
    qc.invalidateQueries({ queryKey: ['active_identity', user?.email] });
    refetch();
  };

  const totalTasksAll = allIdentities.reduce((s, i) => s + (i.tasks_executed || 0), 0);
  const totalEarnedAll = allIdentities.reduce((s, i) => s + (i.total_earned || 0), 0);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <User className="w-5 h-5 text-violet-400" />
            Identity Manager
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage AI personas · Instant role switching · CredentialVault integration
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => refetch()} variant="outline"
            className="border-slate-700 text-slate-400 hover:text-white text-xs h-8 gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setEditingIdentity(null); setShowForm(true); }}
            className="bg-violet-600 hover:bg-violet-500 text-white text-xs h-8 gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Identity
          </Button>
        </div>
      </div>

      {/* Active identity spotlight */}
      {activeIdentity && !showForm && (
        <div className="rounded-2xl border border-emerald-500/25 bg-gradient-to-r from-emerald-950/30 to-slate-900/60 p-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center border border-slate-700"
              style={{ background: `${activeIdentity.color || '#10b981'}22` }}>
              {activeIdentity.avatar_url
                ? <img src={activeIdentity.avatar_url} className="w-full h-full object-cover" alt="" />
                : <User className="w-7 h-7" style={{ color: activeIdentity.color || '#10b981' }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-base font-bold text-white">{activeIdentity.name}</span>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> ACTIVE IDENTITY
                </span>
              </div>
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-3">
                {activeIdentity.role_label && <span>{activeIdentity.role_label}</span>}
                {activeIdentity.email && <span>✉ {activeIdentity.email}</span>}
                <span className="capitalize text-slate-400">{activeIdentity.communication_tone} tone</span>
              </div>
              {activeIdentity.tagline && (
                <div className="text-[11px] text-slate-600 italic mt-1 truncate">{activeIdentity.tagline}</div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-sm font-bold text-white">{activeIdentity.tasks_executed || 0}</div>
                <div className="text-[9px] text-slate-600">tasks</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-emerald-400">${(activeIdentity.total_earned || 0).toFixed(2)}</div>
                <div className="text-[9px] text-slate-600">earned</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-blue-400">{(activeIdentity.linked_account_ids || []).length}</div>
                <div className="text-[9px] text-slate-600">accounts</div>
              </div>
              <Button size="sm" onClick={() => handleEdit(activeIdentity)} variant="outline"
                className="border-slate-600 text-slate-400 hover:text-white text-xs h-8">Edit</Button>
            </div>
          </div>
        </div>
      )}

      {/* Health Check Cards */}
       {healthData?.health_check && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
           <Card className="bg-emerald-950/20 border-emerald-900/30 p-4">
             <p className="text-xs text-slate-400 font-medium">Healthy</p>
             <p className="text-2xl font-bold text-emerald-400 mt-2">{healthData.health_check.healthy}</p>
           </Card>
           <Card className="bg-amber-950/20 border-amber-900/30 p-4">
             <p className="text-xs text-slate-400 font-medium">Warning</p>
             <p className="text-2xl font-bold text-amber-400 mt-2">{healthData.health_check.warning}</p>
           </Card>
           <Card className="bg-red-950/20 border-red-900/30 p-4">
             <p className="text-xs text-slate-400 font-medium">Critical</p>
             <p className="text-2xl font-bold text-red-400 mt-2">{healthData.health_check.critical}</p>
           </Card>
           <Card className="bg-slate-900/50 border-slate-800 p-4">
             <p className="text-xs text-slate-400 font-medium">Total Accounts</p>
             <p className="text-2xl font-bold text-slate-300 mt-2">{healthData.accounts_checked || 0}</p>
           </Card>
         </div>
       )}

       {/* Stats row */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
         {[
           { label: 'Total Identities', value: allIdentities.length, color: 'text-white', icon: Users },
           { label: 'Total Tasks Run', value: totalTasksAll, color: 'text-violet-400', icon: Zap },
           { label: 'Total Earned', value: `$${totalEarnedAll.toFixed(2)}`, color: 'text-emerald-400', icon: TrendingUp },
           { label: 'Vault Credentials', value: allIdentities.reduce((s, i) => s + (i.linked_account_ids?.length || 0), 0), color: 'text-amber-400', icon: Shield },
         ].map((s, i) => (
           <div key={i} className="rounded-xl bg-slate-900/60 border border-slate-800 p-4">
             <div className="flex items-center gap-1.5 mb-1.5">
               <s.icon className={`w-3.5 h-3.5 ${s.color}`} />
               <span className="text-[10px] text-slate-500 uppercase tracking-wider">{s.label}</span>
             </div>
             <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
           </div>
         ))}
       </div>

      {/* Phase 6: New Identity Management Dashboard */}
      <IdentityManagementDashboard />

      {/* Form */}
      {showForm && (
        <IdentityForm
          identity={editingIdentity}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingIdentity(null); }}
        />
      )}

      {/* Identity grid */}
      {allIdentities.length === 0 && !showForm ? (
        <div className="rounded-2xl bg-slate-900/40 border border-slate-800 py-16 text-center">
          <User className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No identities configured yet.</p>
          <p className="text-xs text-slate-600 mt-1">Create your first AI identity to control how the AI presents itself.</p>
          <Button onClick={() => setShowForm(true)} size="sm"
            className="mt-4 bg-violet-600 hover:bg-violet-500 text-white text-xs gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Create First Identity
          </Button>
        </div>
      ) : (
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
           {allIdentities.map(identity => (
             <IdentityCard
               key={identity.id}
               identity={identity}
               onEdit={handleEdit}
               onSwitch={handleSwitch}
               onDelete={handleDelete}
               onManageAccounts={() => {
                 setSelectedIdentity(identity);
                 setShowAccountLinker(true);
               }}
               isSwitching={switchingId === identity.id}
             />
           ))}
         </div>
       )}

       {/* Account Linker Modal */}
       {showAccountLinker && selectedIdentity && (
         <AccountLinker
           identity={selectedIdentity}
           onClose={() => {
             setShowAccountLinker(false);
             setSelectedIdentity(null);
           }}
           onSuccess={() => {
             refetch();
             setShowAccountLinker(false);
           }}
         />
       )}

      {/* Autonomous account creator + audit log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AutoAccountCreator activeIdentity={activeIdentity} onCreated={refetch} />
        <div className="space-y-3">
          {allIdentities.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setSelectedForAudit(null)}
                className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                  !selectedForAudit ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-600 hover:text-slate-400'
                }`}>
                All
              </button>
              {allIdentities.map(id => (
                <button key={id.id} onClick={() => setSelectedForAudit(id.id)}
                  className={`text-[10px] px-2 py-1 rounded-lg border transition-colors ${
                    selectedForAudit === id.id ? 'bg-slate-700 border-slate-600 text-white' : 'border-slate-800 text-slate-600 hover:text-slate-400'
                  }`}>
                  {id.name}
                </button>
              ))}
            </div>
          )}
          <IdentityAuditLog logs={logs} identityId={selectedForAudit} />
        </div>
      </div>

      {/* Critical Alerts */}
       {healthData?.needs_repair && healthData.needs_repair.length > 0 && (
         <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-4">
           <div className="flex items-start gap-3">
             <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 shrink-0" />
             <div>
               <p className="text-sm font-semibold text-red-400">{healthData.needs_repair.length} Account(s) Need Repair</p>
               <p className="text-xs text-red-300/70 mt-1">Autopilot can automatically repair or failover to backup accounts.</p>
             </div>
           </div>
         </div>
       )}

      {/* Security note */}
       <div className="rounded-xl bg-slate-900/40 border border-slate-800/50 p-4">
         <div className="flex items-start gap-3">
           <Shield className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
           <div>
             <p className="text-xs font-semibold text-white mb-1">Identity Security & Propagation</p>
             <p className="text-[11px] text-slate-400 leading-relaxed">
               All credentials tied to identities are encrypted with AES-256-GCM in CredentialVault. Switching identities instantly updates
               AI instructions, LinkedAccount permissions, and all active workflows. The AI injects the active identity into every proposal,
               email, and task — no cached or outdated data is ever used. Every identity switch and credential access is immutably logged.
             </p>
           </div>
         </div>
       </div>
      </div>
      );
      }