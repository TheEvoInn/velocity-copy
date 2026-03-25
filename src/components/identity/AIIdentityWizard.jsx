import React, { useState, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Check } from 'lucide-react';

/**
 * AI Identity Wizard with Bidirectional Tab Sync
 * Profile → Brand → Accounts → Keys → Data
 * Auto-syncs data forward/backward across tabs
 */
export default function AIIdentityWizard({ identity, onTabChange, currentTab = 'profile' }) {
  const queryClient = useQueryClient();
  const [wizardData, setWizardData] = useState({
    profile: { name: '', role_label: '', email: '', bio: '' },
    brand: { primary_color: '', secondary_color: '', formality_level: '', vocabulary_style: [] },
    accounts: { linked_account_ids: [], account_count: 0 },
    keys: { credential_count: 0, vault_secured: false },
    data: { kyc_verified: false, brand_synced: false, autopilot_ready: false }
  });
  const [syncState, setSyncState] = useState({});

  // Load identity data into wizard on mount
  useEffect(() => {
    if (identity) {
      setWizardData(prev => ({
        ...prev,
        profile: {
          name: identity.name || '',
          role_label: identity.role_label || '',
          email: identity.email || '',
          bio: identity.bio || ''
        },
        brand: {
          primary_color: identity.brand_assets?.primary_color || '',
          secondary_color: identity.brand_assets?.secondary_color || '',
          formality_level: identity.brand_assets?.formality_level || '',
          vocabulary_style: identity.brand_assets?.vocabulary_style || []
        },
        accounts: {
          linked_account_ids: identity.linked_account_ids || [],
          account_count: identity.linked_account_ids?.length || 0
        },
        keys: {
          credential_count: 0,
          vault_secured: identity.bank_vault_credential_id ? true : false
        },
        data: {
          kyc_verified: identity.kyc_verified_data?.kyc_tier !== 'none',
          brand_synced: !!identity.brand_assets?.ai_persona_instructions,
          autopilot_ready: identity.onboarding_complete || false
        }
      }));
    }
  }, [identity]);

  // Multi-sync mutation: sync to Profile
  const syncProfileMutation = useMutation({
    mutationFn: async (profileData) => {
      return await base44.entities.AIIdentity.update(identity.id, {
        name: profileData.name,
        role_label: profileData.role_label,
        email: profileData.email,
        bio: profileData.bio
      });
    },
    onSuccess: () => {
      setSyncState(prev => ({ ...prev, profile: 'synced' }));
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      // Auto-trigger brand sync
      setTimeout(() => {
        setSyncState(prev => ({ ...prev, brand: 'ready' }));
        onTabChange?.('brand');
      }, 500);
    },
    onError: (e) => {
      toast.error(`Profile sync failed: ${e.message}`);
      setSyncState(prev => ({ ...prev, profile: 'failed' }));
    }
  });

  // Multi-sync mutation: sync to Brand
  const syncBrandMutation = useMutation({
    mutationFn: async (brandData) => {
      return await base44.entities.AIIdentity.update(identity.id, {
        brand_assets: {
          primary_color: brandData.primary_color,
          secondary_color: brandData.secondary_color,
          formality_level: brandData.formality_level,
          vocabulary_style: brandData.vocabulary_style
        }
      });
    },
    onSuccess: () => {
      setSyncState(prev => ({ ...prev, brand: 'synced' }));
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      // Auto-trigger accounts sync
      setTimeout(() => {
        setSyncState(prev => ({ ...prev, accounts: 'ready' }));
        onTabChange?.('accounts');
      }, 500);
    },
    onError: (e) => {
      toast.error(`Brand sync failed: ${e.message}`);
      setSyncState(prev => ({ ...prev, brand: 'failed' }));
    }
  });

  // Multi-sync mutation: sync accounts back
  const syncAccountsMutation = useMutation({
    mutationFn: async () => {
      const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { id: { $in: wizardData.accounts.linked_account_ids } },
        undefined,
        100
      ).catch(() => []);

      return await base44.entities.AIIdentity.update(identity.id, {
        linked_account_ids: linkedAccounts.map(a => a.id),
        onboarding_status: wizardData.accounts.account_count > 0 ? 'in_progress' : 'pending'
      });
    },
    onSuccess: () => {
      setSyncState(prev => ({ ...prev, accounts: 'synced' }));
      queryClient.invalidateQueries({ queryKey: ['linkedAccounts', identity.id] });
      // Auto-trigger keys sync
      setTimeout(() => {
        setSyncState(prev => ({ ...prev, keys: 'ready' }));
        onTabChange?.('credentials');
      }, 500);
    },
    onError: (e) => {
      toast.error(`Accounts sync failed: ${e.message}`);
      setSyncState(prev => ({ ...prev, accounts: 'failed' }));
    }
  });

  // Multi-sync mutation: sync keys back
  const syncKeysMutation = useMutation({
    mutationFn: async () => {
      const credentials = await base44.asServiceRole.entities.CredentialVault.filter(
        { linked_account_id: { $in: wizardData.accounts.linked_account_ids } },
        undefined,
        100
      ).catch(() => []);

      return await base44.entities.AIIdentity.update(identity.id, {
        total_earned: identity.total_earned || 0
      });
    },
    onSuccess: () => {
      setSyncState(prev => ({ ...prev, keys: 'synced' }));
      queryClient.invalidateQueries({ queryKey: ['identityCredentials', identity.id] });
      // Auto-trigger data sync
      setTimeout(() => {
        setSyncState(prev => ({ ...prev, data: 'ready' }));
        onTabChange?.('data');
      }, 500);
    },
    onError: (e) => {
      toast.error(`Keys sync failed: ${e.message}`);
      setSyncState(prev => ({ ...prev, keys: 'failed' }));
    }
  });

  // Multi-sync mutation: final data sync
  const syncDataMutation = useMutation({
    mutationFn: async () => {
      return await base44.entities.AIIdentity.update(identity.id, {
        onboarding_complete: true,
        onboarding_status: 'complete',
        is_active: true
      });
    },
    onSuccess: () => {
      setSyncState(prev => ({ ...prev, data: 'synced' }));
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      toast.success('✓ AI Identity fully synced and ready!');
    },
    onError: (e) => {
      toast.error(`Final sync failed: ${e.message}`);
      setSyncState(prev => ({ ...prev, data: 'failed' }));
    }
  });

  const handleProfileSync = useCallback(() => {
    syncProfileMutation.mutate(wizardData.profile);
  }, [wizardData.profile, syncProfileMutation]);

  const handleBrandSync = useCallback(() => {
    syncBrandMutation.mutate(wizardData.brand);
  }, [wizardData.brand, syncBrandMutation]);

  const handleAccountsSync = useCallback(() => {
    syncAccountsMutation.mutate();
  }, [syncAccountsMutation]);

  const handleKeysSync = useCallback(() => {
    syncKeysMutation.mutate();
  }, [syncKeysMutation]);

  const handleDataSync = useCallback(() => {
    syncDataMutation.mutate();
  }, [syncDataMutation]);

  // Update linked accounts when auto-created
  const addAutoCreatedAccount = useCallback((accountId) => {
    setWizardData(prev => ({
      ...prev,
      accounts: {
        ...prev.accounts,
        linked_account_ids: [...prev.accounts.linked_account_ids, accountId],
        account_count: prev.accounts.linked_account_ids.length + 1
      }
    }));
    setSyncState(prev => ({ ...prev, accounts: 'updated' }));
  }, []);

  return (
    <div className="space-y-6">
      {/* Wizard Progress */}
      <Card className="bg-slate-900 border-slate-800 p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white">Setup Wizard Progress</h3>
          <div className="text-xs text-slate-400">
            Step {Object.values(syncState).filter(v => v === 'synced').length} of 5
          </div>
        </div>
        <div className="flex items-center gap-2">
          {['profile', 'brand', 'accounts', 'keys', 'data'].map((step, idx) => (
            <div key={step} className="flex items-center flex-1">
              <button
                onClick={() => onTabChange?.(step)}
                className={`flex-1 py-2 px-3 rounded text-xs font-medium transition-all ${
                  syncState[step] === 'synced'
                    ? 'bg-emerald-600 text-white'
                    : syncState[step] === 'ready' || syncState[step] === 'updated'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {syncState[step] === 'synced' ? (
                  <span className="flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" /> {step}
                  </span>
                ) : (
                  step
                )}
              </button>
              {idx < 4 && <ChevronRight className="w-4 h-4 text-slate-600" />}
            </div>
          ))}
        </div>
      </Card>

      {/* Sync Status Indicators */}
      <div className="grid grid-cols-5 gap-2">
        {['profile', 'brand', 'accounts', 'keys', 'data'].map(step => (
          <div key={step} className="text-center">
            <div className={`text-xs font-medium mb-1 ${
              syncState[step] === 'synced' ? 'text-emerald-400' :
              syncState[step] === 'ready' ? 'text-blue-400' :
              syncState[step] === 'failed' ? 'text-red-400' :
              'text-slate-500'
            }`}>
              {syncState[step] || 'pending'}
            </div>
          </div>
        ))}
      </div>

      {/* Navigation & Sync Controls */}
      <div className="flex gap-3 justify-between">
        <Button
          variant="outline"
          className="border-slate-700 text-slate-400 text-sm"
          onClick={() => onTabChange?.('profile')}
        >
          <ChevronLeft className="w-4 h-4" /> Prev
        </Button>
        
        <div className="flex gap-2">
          {currentTab === 'profile' && (
            <Button
              onClick={handleProfileSync}
              disabled={syncProfileMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-2"
            >
              {syncProfileMutation.isPending ? 'Syncing...' : 'Sync Profile'} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {currentTab === 'brand' && (
            <Button
              onClick={handleBrandSync}
              disabled={syncBrandMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-2"
            >
              {syncBrandMutation.isPending ? 'Syncing...' : 'Sync Brand'} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {currentTab === 'accounts' && (
            <Button
              onClick={handleAccountsSync}
              disabled={syncAccountsMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-2"
            >
              {syncAccountsMutation.isPending ? 'Syncing...' : 'Sync Accounts'} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {currentTab === 'credentials' && (
            <Button
              onClick={handleKeysSync}
              disabled={syncKeysMutation.isPending}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm gap-2"
            >
              {syncKeysMutation.isPending ? 'Syncing...' : 'Sync Keys'} <ChevronRight className="w-4 h-4" />
            </Button>
          )}
          {currentTab === 'data' && (
            <Button
              onClick={handleDataSync}
              disabled={syncDataMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm gap-2"
            >
              {syncDataMutation.isPending ? 'Finalizing...' : '✓ Complete Setup'} <Check className="w-4 h-4" />
            </Button>
          )}
        </div>

        <Button
          variant="outline"
          className="border-slate-700 text-slate-400 text-sm"
          onClick={() => onTabChange?.('data')}
        >
          Next <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Export wizard data for parent components */}
      <div className="hidden" data-wizard-state={JSON.stringify({
        wizardData,
        syncState,
        addAutoCreatedAccount
      })}>
        {/* Hidden container for passing wizard state */}
      </div>
    </div>
  );
}