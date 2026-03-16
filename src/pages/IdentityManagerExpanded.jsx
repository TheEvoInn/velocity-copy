import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Plus, Trash2, Power, Settings, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import IdentityCreator from '@/components/identity/IdentityCreator';
import IdentityCard from '@/components/identity/IdentityCard';
import AccountLinker from '@/components/identity/AccountLinker';

export default function IdentityManagerExpanded() {
  const [showCreator, setShowCreator] = useState(false);
  const [showAccountLinker, setShowAccountLinker] = useState(false);
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [accountHealthCheck, setAccountHealthCheck] = useState(null);

  // Fetch identities
  const { data: identitiesData, isLoading, refetch } = useQuery({
    queryKey: ['identities'],
    queryFn: async () => {
      const res = await base44.functions.invoke('identityManager', {
        action: 'list_identities'
      });
      return res.data || {};
    },
    refetchInterval: 30000
  });

  // Fetch active identity
  const { data: activeIdentity } = useQuery({
    queryKey: ['active_identity'],
    queryFn: async () => {
      const res = await base44.functions.invoke('identityManager', {
        action: 'get_active_identity'
      });
      return res.data?.identity || null;
    }
  });

  // Fetch account health
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

  // Switch identity mutation
  const switchIdentityMutation = useMutation({
    mutationFn: async (identityId) => {
      const res = await base44.functions.invoke('identityManager', {
        action: 'switch_active_identity',
        identity_id: identityId
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
    }
  });

  // Delete identity mutation
  const deleteIdentityMutation = useMutation({
    mutationFn: async (identityId) => {
      const res = await base44.functions.invoke('identityManager', {
        action: 'delete_identity',
        identity_id: identityId
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
    }
  });

  // Create identity mutation
  const createIdentityMutation = useMutation({
    mutationFn: async (data) => {
      const res = await base44.functions.invoke('identityManager', {
        action: 'create_identity',
        data
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
      setShowCreator(false);
    }
  });

  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const identities = identitiesData?.identities || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Identity Manager</h1>
          <p className="text-sm text-slate-400 mt-1">Create and manage multiple personas for autonomous profit generation</p>
        </div>
        <Button onClick={() => setShowCreator(true)} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4 mr-2" />
          New Identity
        </Button>
      </div>

      {/* Identity Creator Modal */}
      {showCreator && (
        <IdentityCreator
          onClose={() => setShowCreator(false)}
          onCreate={(data) => createIdentityMutation.mutate(data)}
          isLoading={createIdentityMutation.isPending}
        />
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

      {/* Health Summary */}
      {healthData?.health_check && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <p className="text-2xl font-bold text-slate-300 mt-2">{healthData.accounts_checked}</p>
          </Card>
        </div>
      )}

      {/* Identities Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white">Active Identities ({identities.length})</h2>
        
        {identities.length === 0 ? (
          <Card className="bg-slate-900/50 border-slate-800 p-8 text-center">
            <p className="text-slate-400">No identities created yet. Create your first persona to get started.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {identities.map((identity) => (
              <IdentityCard
                key={identity.id}
                identity={identity}
                isActive={identity.is_active}
                isHealthy={healthData?.health_check?.healthy || 0 > 0}
                onSwitch={() => switchIdentityMutation.mutate(identity.id)}
                onDelete={() => {
                  if (confirm(`Delete identity "${identity.name}"?`)) {
                    deleteIdentityMutation.mutate(identity.id);
                  }
                }}
                onManageAccounts={() => {
                  setSelectedIdentity(identity);
                  setShowAccountLinker(true);
                }}
                isLoading={switchIdentityMutation.isPending || deleteIdentityMutation.isPending}
              />
            ))}
          </div>
        )}
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
    </div>
  );
}