import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { User, Lock, Database, Settings2, Plus, Search, Palette } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';

import IdentityProfileBuilder from '../components/identity/IdentityProfileBuilder';
import CredentialKeyManager from '../components/identity/CredentialKeyManager';
import IdentityDataExplorer from '../components/identity/IdentityDataExplorer';
import LinkedAccountsManager from '../components/identity/LinkedAccountsManager';
import BrandAssetsEditor from '../components/identity/BrandAssetsEditor';

export default function AIIdentityStudio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewIdentityForm, setShowNewIdentityForm] = useState(false);

  // Fetch all user identities
  const { data: identities = [], isLoading } = useQuery({
    queryKey: ['identities', user?.email],
    queryFn: () => base44.entities.AIIdentity.filter({ created_by: user?.email }, '-created_date', 100),
    enabled: !!user?.email,
  });

  // Subscribe to real-time identity changes
  useEffect(() => {
    const unsubscribe = base44.entities.AIIdentity.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        queryClient.invalidateQueries({ queryKey: ['identities', user?.email] });
      } else if (event.type === 'delete') {
        queryClient.invalidateQueries({ queryKey: ['identities', user?.email] });
      }
    });
    return unsubscribe;
  }, [user?.email, queryClient]);

  // Fetch credential vault entries for this identity
  const { data: credentials = [] } = useQuery({
    queryKey: ['identityCredentials', selectedIdentity?.id],
    queryFn: () => base44.entities.CredentialVault.filter({ 
      linked_account_id: { $exists: true }
    }, '-created_date', 100),
    enabled: !!selectedIdentity?.id,
  });

  // Subscribe to credential changes
  useEffect(() => {
    if (!selectedIdentity?.id) return;
    const unsubscribe = base44.entities.CredentialVault.subscribe((event) => {
      queryClient.invalidateQueries({ queryKey: ['identityCredentials', selectedIdentity?.id] });
    });
    return unsubscribe;
  }, [selectedIdentity?.id, queryClient]);

  const filteredIdentities = identities.filter(id => 
    id.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    id.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleIdentityCreated = () => {
    setShowNewIdentityForm(false);
    queryClient.invalidateQueries({ queryKey: ['identities', user?.email] });
    // Also sync KYC, goals, and withdrawal policies
    queryClient.invalidateQueries({ queryKey: ['kycVerification'] });
    queryClient.invalidateQueries({ queryKey: ['userGoals'] });
    queryClient.invalidateQueries({ queryKey: ['withdrawalPolicy'] });
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <User className="w-8 h-8 text-violet-400" />
            AI Identity Studio
          </h1>
          <p className="text-sm text-slate-400">Create, customize, and manage AI identities with full control over accounts, credentials, and data.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar: Identity List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sticky top-6">
              <div className="mb-4">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600" />
                  <Input
                    placeholder="Search identities..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-9 bg-slate-800 border-slate-700 text-white text-sm"
                  />
                </div>
                <Button
                  onClick={() => setShowNewIdentityForm(true)}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm h-9 gap-2"
                >
                  <Plus className="w-4 h-4" /> New Identity
                </Button>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {isLoading ? (
                  <div className="text-xs text-slate-500 p-3 text-center">Loading...</div>
                ) : filteredIdentities.length === 0 ? (
                  <div className="text-xs text-slate-500 p-3 text-center">No identities found</div>
                ) : (
                  filteredIdentities.map(identity => (
                    <button
                      key={identity.id}
                      onClick={() => setSelectedIdentity(identity)}
                      className={`w-full text-left p-3 rounded-lg border transition-all text-xs ${
                        selectedIdentity?.id === identity.id
                          ? 'bg-violet-600/20 border-violet-500 text-white'
                          : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {identity.color && (
                          <div className="w-2 h-2 rounded-full shrink-0" style={{ background: identity.brand_assets?.primary_color || identity.color }} />
                        )}
                        <div className="font-semibold text-white truncate">{identity.name}</div>
                        {identity.brand_assets?.ai_persona_instructions && (
                          <Palette className="w-2.5 h-2.5 text-violet-400 shrink-0" title="Brand assets configured" />
                        )}
                      </div>
                      <div className="text-slate-500 truncate text-[10px]">{identity.role_label}</div>
                      {identity.brand_assets?.graphic_style?.length > 0 && (
                        <div className="text-violet-500 text-[9px] truncate">{identity.brand_assets.graphic_style.slice(0,2).join(', ')}</div>
                      )}
                      <div className="text-slate-600 text-[9px] mt-1">
                        {identity.tasks_executed || 0} tasks · ${(identity.total_earned || 0).toFixed(2)}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {!selectedIdentity && !showNewIdentityForm ? (
              <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-12 text-center">
                <User className="w-16 h-16 text-slate-700 mx-auto mb-4" />
                <h2 className="text-lg font-semibold text-white mb-2">No Identity Selected</h2>
                <p className="text-sm text-slate-500 mb-6">Create or select an identity to begin customization</p>
                <Button
                  onClick={() => setShowNewIdentityForm(true)}
                  className="bg-violet-600 hover:bg-violet-500 text-white gap-2"
                >
                  <Plus className="w-4 h-4" /> Create Your First Identity
                </Button>
              </div>
            ) : showNewIdentityForm ? (
              <div>
                <Button
                  onClick={() => setShowNewIdentityForm(false)}
                  variant="outline"
                  className="mb-4 border-slate-700 text-slate-400 hover:text-white"
                >
                  ← Back to List
                </Button>
                <IdentityProfileBuilder
                  onComplete={handleIdentityCreated}
                  onCancel={() => setShowNewIdentityForm(false)}
                />
              </div>
            ) : (
              <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-5 bg-slate-900 border-b border-slate-800 rounded-none mb-6">
                  <TabsTrigger value="profile" className="flex items-center gap-2">
                    <User className="w-4 h-4" /> Profile
                  </TabsTrigger>
                  <TabsTrigger value="brand" className="flex items-center gap-2 text-violet-400 data-[state=active]:text-violet-300">
                    <Palette className="w-4 h-4" /> Brand
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="flex items-center gap-2">
                    <Database className="w-4 h-4" /> Accounts
                  </TabsTrigger>
                  <TabsTrigger value="credentials" className="flex items-center gap-2">
                    <Lock className="w-4 h-4" /> Keys
                  </TabsTrigger>
                  <TabsTrigger value="data" className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4" /> Data
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="profile" className="space-y-6">
                   <IdentityProfileBuilder identity={selectedIdentity} mode="edit" onComplete={() => {
                     queryClient.invalidateQueries({ queryKey: ['identities', user?.email] });
                     setSelectedIdentity(null);
                   }} />
                 </TabsContent>

                <TabsContent value="brand">
                  <BrandAssetsEditor identity={selectedIdentity} />
                </TabsContent>

                <TabsContent value="accounts">
                  <LinkedAccountsManager identity={selectedIdentity} />
                </TabsContent>

                <TabsContent value="credentials">
                  <CredentialKeyManager identity={selectedIdentity} credentials={credentials} />
                </TabsContent>

                <TabsContent value="data">
                  <IdentityDataExplorer identity={selectedIdentity} />
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}