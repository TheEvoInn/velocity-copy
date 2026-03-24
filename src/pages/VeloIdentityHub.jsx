import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useIdentitySyncAcrossApp } from '@/hooks/useIdentitySyncAcrossApp';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, ChevronRight, Shield, Zap, Users, Eye, EyeOff, Trash2, Edit, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function VeloIdentityHub() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useIdentitySyncAcrossApp(); // Real-time sync hook
  
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [showCreator, setShowCreator] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showProfileEditor, setShowProfileEditor] = useState(false);

  // Fetch all identities
  const { data: identities = [], isLoading: loadingIdentities } = useQuery({
    queryKey: ['aiIdentities', user?.email],
    queryFn: () => base44.entities.AIIdentity.filter({ user_email: user?.email }),
    enabled: !!user?.email,
  });

  // Fetch active identity
  const { data: goals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  // Fetch KYC status
  const { data: kycData } = useQuery({
    queryKey: ['kycVerification', user?.email],
    queryFn: () => base44.entities.KYCVerification.filter({ created_by: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  // REAL-TIME KYC SUBSCRIPTION: Listen for admin approvals and all KYC updates
  useEffect(() => {
    if (!user?.email) return;
    const unsubscribe = base44.entities.KYCVerification.subscribe((event) => {
      console.log('[VeloIdentityHub] KYC update event:', event.type, event.data?.kyc_tier, event.data?.verification_status);
      // Invalidate ALL related queries to broadcast change across dashboard
      qc.invalidateQueries({ queryKey: ['kycVerification', user?.email] });
      qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] });
      qc.invalidateQueries({ queryKey: ['userGoals'] });
    });
    return unsubscribe;
  }, [user?.email, qc]);

  // Switch active identity
  const switchIdentityMutation = useMutation({
    mutationFn: (identityId) => 
      base44.auth.updateMe({ active_identity_id: identityId })
        .then(() => base44.entities.UserGoals.update(goals?.id, { identity_id: identityId })),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['userGoals', 'aiIdentities'] });
    },
  });

  const activeIdentity = identities.find(id => id.is_active);
  const filteredIdentities = searchTerm 
    ? identities.filter(id => id.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : identities;

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="font-orbitron text-4xl font-bold text-white">VELO AI Identity Hub</h1>
          <p className="text-slate-400">Manage AI identities, profiles, and autonomous personas</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card border-cyan-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Identities</div>
              <div className="text-2xl font-bold text-cyan-400">{identities.length}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-emerald-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Active</div>
              <div className="text-2xl font-bold text-emerald-400">{activeIdentity ? 1 : 0}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-amber-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">KYC Status</div>
              <div className="text-2xl font-bold text-amber-400">{kycData?.kyc_tier || 'Pending'}</div>
            </CardContent>
          </Card>
          <Card className="glass-card border-violet-500/20">
            <CardContent className="p-4">
              <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">Total Earned</div>
              <div className="text-2xl font-bold text-violet-400">${identities.reduce((s, i) => s + (i.total_earned || 0), 0).toFixed(0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="identities" className="space-y-4">
          <TabsList className="glass-card">
            <TabsTrigger value="identities">Identities ({identities.length})</TabsTrigger>
            <TabsTrigger value="active">Active Profile</TabsTrigger>
            <TabsTrigger value="kyc">KYC & Verification</TabsTrigger>
            <TabsTrigger value="settings">Hub Settings</TabsTrigger>
          </TabsList>

          {/* Identities Tab */}
          <TabsContent value="identities" className="space-y-4">
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search identities..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white placeholder-slate-500"
              />
              <Button 
                onClick={() => setShowCreator(true)}
                className="gap-2"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
              >
                <Plus className="w-4 h-4" />
                New Identity
              </Button>
            </div>

            {loadingIdentities ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-violet-500/20 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : filteredIdentities.length === 0 ? (
              <Card className="glass-card text-center py-12">
                <Users className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                <p className="text-slate-400">No identities found. Create your first AI persona.</p>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredIdentities.map(identity => (
                  <Card
                    key={identity.id}
                    className={`glass-card cursor-pointer transition-all ${
                      selectedIdentity?.id === identity.id ? 'border-cyan-400/60' : 'hover:border-cyan-400/30'
                    }`}
                    onClick={() => setSelectedIdentity(identity)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-orbitron text-lg font-bold text-white">{identity.name}</h3>
                            {identity.is_active && (
                              <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">
                                ACTIVE
                              </span>
                            )}
                            {identity.onboarding_complete && (
                              <span className="px-2 py-1 text-xs font-bold rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400">
                                ONBOARDED
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mb-3">{identity.bio || identity.tagline || 'No bio'}</p>
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div>
                              <div className="text-slate-500">Role</div>
                              <div className="text-white font-semibold">{identity.role_label || '—'}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Tasks</div>
                              <div className="text-white font-semibold">{identity.tasks_executed || 0}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Earned</div>
                              <div className="text-white font-semibold">${identity.total_earned?.toFixed(0) || 0}</div>
                            </div>
                            <div>
                              <div className="text-slate-500">Status</div>
                              <div className={`font-semibold ${identity.is_active ? 'text-emerald-400' : 'text-slate-400'}`}>
                                {identity.is_active ? 'Live' : 'Idle'}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {!identity.is_active && (
                            <Button
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                switchIdentityMutation.mutate(identity.id);
                              }}
                              variant="outline"
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMutation.mutate(identity.id);
                            }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Profile Tab */}
          <TabsContent value="active" className="space-y-4">
            {activeIdentity ? (
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    {activeIdentity.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Email</div>
                      <div className="text-white font-mono">{activeIdentity.email || '—'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Status</div>
                      <div className="text-white">
                        {activeIdentity.is_active ? (
                          <span className="text-emerald-400">Active & Live</span>
                        ) : (
                          <span className="text-slate-400">Inactive</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-700/50 pt-4">
                    <h4 className="text-sm font-bold text-white mb-3">KYC Verified Data</h4>
                    {activeIdentity.kyc_verified_data ? (
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-500">Legal Name</div>
                          <div className="text-white">{activeIdentity.kyc_verified_data.full_legal_name || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">ID Type</div>
                          <div className="text-white">{activeIdentity.kyc_verified_data.government_id_type || '—'}</div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-400 text-xs">KYC not completed</p>
                    )}
                  </div>

                  <Button 
                    onClick={() => setShowProfileEditor(true)}
                    className="w-full" 
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit Profile
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card text-center py-12">
                <p className="text-slate-400 mb-4">No active identity. Select or create one.</p>
                <Button onClick={() => setShowCreator(true)}>Create Identity</Button>
              </Card>
            )}
          </TabsContent>

          {/* KYC Tab */}
          <TabsContent value="kyc" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  KYC Verification Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {kycData ? (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Tier</div>
                        <div className={`text-lg font-bold ${
                          kycData.kyc_tier === 'enhanced' ? 'text-emerald-400' :
                          kycData.kyc_tier === 'standard' ? 'text-cyan-400' :
                          kycData.kyc_tier === 'basic' ? 'text-amber-400' :
                          'text-slate-400'
                        }`}>
                          {kycData.kyc_tier || 'None'}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Status</div>
                        <div className="text-white">{kycData.verification_status || 'Pending'}</div>
                      </div>
                    </div>
                    <div className="border-t border-slate-700/50 pt-4">
                      <p className="text-sm text-slate-400">Last updated: {kycData.updated_date ? new Date(kycData.updated_date).toLocaleDateString() : '—'}</p>
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400">No KYC data found. Complete onboarding to verify your identity.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5 text-violet-400" />
                  Hub Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white block">Auto-Sync Real-Time Updates</label>
                  <p className="text-xs text-slate-400 mb-2">Identity changes sync instantly to all systems</p>
                  <Button variant="outline" className="w-full">Enabled (All Systems)</Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Profile Editor Modal */}
        {showProfileEditor && activeIdentity && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <Card className="glass-card w-full max-w-2xl mx-4">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Edit Identity Profile</CardTitle>
                <button 
                  onClick={() => setShowProfileEditor(false)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  ✕
                </button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Name</label>
                  <input 
                    type="text" 
                    defaultValue={activeIdentity.name}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Email</label>
                  <input 
                    type="email" 
                    defaultValue={activeIdentity.email}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Bio</label>
                  <textarea 
                    defaultValue={activeIdentity.bio}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm h-24 resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-semibold text-white block mb-2">Role Label</label>
                  <input 
                    type="text" 
                    defaultValue={activeIdentity.role_label}
                    className="w-full px-3 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white text-sm"
                  />
                </div>
                <div className="flex gap-2 pt-4">
                  <Button 
                    onClick={() => setShowProfileEditor(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button 
                    onClick={() => {
                      // TODO: Add mutation to save profile changes
                      setShowProfileEditor(false);
                    }}
                    className="flex-1"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #06b6d4)' }}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}