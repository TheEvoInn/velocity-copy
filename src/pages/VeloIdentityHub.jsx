import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useIdentitySyncAcrossApp } from '@/hooks/useIdentitySyncAcrossApp';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Shield, Zap, Users, Trash2, Edit, Brain, Key, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import IdentityProfileEditor from '@/components/identity/IdentityProfileEditor';
import PersonaWorkflowGenerator from '@/components/identity/PersonaWorkflowGenerator';

export default function VeloIdentityHub() {
  const { user } = useAuth();
  const qc = useQueryClient();
  useIdentitySyncAcrossApp();
  
  const [selectedIdentity, setSelectedIdentity] = useState(null);
  const [showProfileEditor, setShowProfileEditor] = useState(false);
  const [editingIdentity, setEditingIdentity] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch all identities — RLS is created_by
  const { data: identities = [], isLoading: loadingIdentities } = useQuery({
    queryKey: ['aiIdentities', user?.email],
    queryFn: () => base44.entities.AIIdentity.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  // Fetch user goals
  const { data: goals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: user?.email }).then(r => r[0]),
    enabled: !!user?.email,
  });

  // Fetch KYC — query by user_email to recover pre-redesign records (RLS covers both created_by and user_email)
  const { data: kycData } = useQuery({
    queryKey: ['kycVerification', user?.email],
    queryFn: async () => {
      // Try user_email first (covers old records), fallback to created_by, then unfiltered (RLS-scoped)
      const byUserEmail = await base44.entities.KYCVerification.filter({ user_email: user?.email }, '-created_date', 1);
      if (byUserEmail.length > 0) return byUserEmail[0];
      const byCreatedBy = await base44.entities.KYCVerification.filter({ created_by: user?.email }, '-created_date', 1);
      if (byCreatedBy.length > 0) return byCreatedBy[0];
      // Final fallback — RLS scopes to current user automatically
      const all = await base44.entities.KYCVerification.list('-created_date', 1);
      return all[0] || null;
    },
    enabled: !!user?.email,
  });

  // Fetch credential vault entries for display
  const { data: credentials = [] } = useQuery({
    queryKey: ['credentialVault', user?.email],
    queryFn: () => base44.entities.CredentialVault.filter({ created_by: user?.email }, '-created_date', 50),
    enabled: !!user?.email,
  });

  // Real-time sync is handled by useIdentitySyncAcrossApp (called above).
  // No duplicate subscriptions needed here.

  // Switch active identity
  const switchIdentityMutation = useMutation({
    mutationFn: async (identityId) => {
      await Promise.all(
        identities.map(id =>
          base44.entities.AIIdentity.update(id.id, { is_active: id.id === identityId })
        )
      );
      if (goals?.id) {
        await base44.entities.UserGoals.update(goals.id, { identity_id: identityId });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] });
      qc.invalidateQueries({ queryKey: ['userGoals', user?.email] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (identityId) => base44.entities.AIIdentity.delete(identityId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] }),
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.AIIdentity.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] });
      setShowProfileEditor(false);
      setEditingIdentity(null);
    },
  });

  const createIdentityMutation = useMutation({
    mutationFn: (data) => base44.entities.AIIdentity.create({
      ...data,
      is_active: identities.length === 0, // auto-activate first identity
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] }),
  });

  const activeIdentity = identities.find(id => id.is_active);
  const filteredIdentities = searchTerm 
    ? identities.filter(id => id.name?.toLowerCase().includes(searchTerm.toLowerCase()))
    : identities;

  function openEditor(identity) {
    setEditingIdentity(identity);
    setShowProfileEditor(true);
  }

  // verification_type is the correct field on KYCVerification (kyc_tier lives on AIIdentity.kyc_verified_data)
  const kycTier = kycData?.verification_type || activeIdentity?.kyc_verified_data?.kyc_tier;
  const kycColor = kycTier === 'enhanced' ? 'text-emerald-400' :
    kycTier === 'standard' ? 'text-cyan-400' :
    kycTier === 'basic' ? 'text-amber-400' : 'text-slate-400';

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #818cf8, #06b6d4)' }} />
              <div>
                <h1 className="font-orbitron text-3xl font-bold text-white">IDENTITY HUB</h1>
                <p className="text-[10px] font-mono tracking-widest text-indigo-400/70">VELO AI · AI: NEXUS</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm ml-5">All persona management, KYC, credentials, and account readiness</p>
          </div>
          <Button 
            onClick={() => {
              setEditingIdentity(null);
              setShowProfileEditor(true);
            }}
            className="gap-2 shrink-0"
            style={{ background: 'linear-gradient(135deg, #818cf8, #06b6d4)' }}
          >
            <Plus className="w-4 h-4" />
            New Identity
          </Button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Identities', value: identities.length, color: '#818cf8' },
            { label: 'Active', value: activeIdentity ? 1 : 0, color: '#10b981' },
            { label: 'KYC Tier', value: kycTier || 'None', color: '#f59e0b' },
            { label: 'Total Earned', value: `$${identities.reduce((s, i) => s + (i.total_earned || 0), 0).toFixed(0)}`, color: '#ec4899' },
          ].map(stat => (
            <Card key={stat.label} className="glass-card" style={{ borderColor: stat.color + '30' }}>
              <CardContent className="p-4">
                <div className="text-slate-400 text-xs uppercase tracking-wider mb-1">{stat.label}</div>
                <div className="text-2xl font-bold font-orbitron" style={{ color: stat.color }}>{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Active Identity Banner */}
        {activeIdentity && (
          <div className="rounded-2xl p-4 flex items-center justify-between"
            style={{ background: 'rgba(129,140,248,0.08)', border: '1px solid rgba(129,140,248,0.3)' }}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                style={{ background: activeIdentity.color ? activeIdentity.color + '25' : 'rgba(129,140,248,0.2)', border: '1px solid rgba(129,140,248,0.3)' }}>
                {activeIdentity.icon || '👤'}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-orbitron text-sm font-bold text-white">{activeIdentity.name}</span>
                  <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">ACTIVE</span>
                  {activeIdentity.onboarding_complete && (
                    <CheckCircle className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </div>
                <p className="text-xs text-slate-400">{activeIdentity.role_label || activeIdentity.tagline || 'No role set'}</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => openEditor(activeIdentity)}
              className="gap-1.5 text-indigo-300 border-indigo-400/30 hover:border-indigo-400/60">
              <Edit className="w-3.5 h-3.5" />
              Edit Profile
            </Button>
          </div>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="identities" className="space-y-4">
          <TabsList className="glass-card flex-wrap h-auto gap-1">
            <TabsTrigger value="identities">All Identities ({identities.length})</TabsTrigger>
            <TabsTrigger value="active">Active Profile</TabsTrigger>
            <TabsTrigger value="workflows" className="relative">
              Workflows
              {activeIdentity && <span className="ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 font-bold">AI</span>}
            </TabsTrigger>
            <TabsTrigger value="kyc">KYC & Verification</TabsTrigger>
            <TabsTrigger value="credentials">Credentials</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* Identities Tab */}
          <TabsContent value="identities" className="space-y-4">
            <input
              type="text"
              placeholder="Search identities..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 rounded-lg bg-slate-900/60 border border-slate-700/60 text-white placeholder-slate-500 focus:border-indigo-500/50 focus:outline-none"
            />

            {loadingIdentities ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
              </div>
            ) : filteredIdentities.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-600 mx-auto mb-4 opacity-50" />
                  <p className="text-slate-400 mb-4">No identities yet. Create your first VELO AI persona.</p>
                  <Button onClick={() => { setEditingIdentity(null); setShowProfileEditor(true); }}
                    style={{ background: 'linear-gradient(135deg, #818cf8, #06b6d4)' }}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Identity
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {filteredIdentities.map(identity => (
                  <Card
                    key={identity.id}
                    className={`glass-card cursor-pointer transition-all ${
                      selectedIdentity?.id === identity.id ? 'border-indigo-400/60' : 'hover:border-indigo-400/30'
                    }`}
                    onClick={() => setSelectedIdentity(identity)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-2">
                            <h3 className="font-orbitron text-lg font-bold text-white">{identity.name}</h3>
                            {identity.is_active && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 border border-emerald-500/50 text-emerald-400">ACTIVE</span>
                            )}
                            {identity.onboarding_complete && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-400">ONBOARDED</span>
                            )}
                            {identity.kyc_verified_data?.kyc_tier && identity.kyc_verified_data.kyc_tier !== 'none' && (
                              <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-400">KYC: {identity.kyc_verified_data.kyc_tier}</span>
                            )}
                          </div>
                          <p className="text-sm text-slate-400 mb-1">{identity.role_label || '—'}</p>
                          <p className="text-xs text-slate-500 mb-3 truncate">{identity.bio || identity.tagline || 'No bio set'}</p>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <div className="text-slate-600">Email</div>
                              <div className="text-slate-300 truncate">{identity.email || '—'}</div>
                            </div>
                            <div>
                              <div className="text-slate-600">Tasks Run</div>
                              <div className="text-white font-semibold">{identity.tasks_executed || 0}</div>
                            </div>
                            <div>
                              <div className="text-slate-600">Total Earned</div>
                              <div className="text-emerald-400 font-semibold">${identity.total_earned?.toFixed(0) || 0}</div>
                            </div>
                            <div>
                              <div className="text-slate-600">Tone</div>
                              <div className="text-slate-300 capitalize">{identity.communication_tone || '—'}</div>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 shrink-0">
                          <Button
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); openEditor(identity); }}
                            variant="outline"
                            className="gap-1.5 text-indigo-300 border-indigo-400/30"
                          >
                            <Edit className="w-3.5 h-3.5" />
                            Edit
                          </Button>
                          {!identity.is_active && (
                            <Button
                              size="sm"
                              onClick={(e) => { e.stopPropagation(); switchIdentityMutation.mutate(identity.id); }}
                              variant="outline"
                              className="text-emerald-400 border-emerald-400/30"
                            >
                              Activate
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(identity.id); }}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    {activeIdentity.name}
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400">LIVE</span>
                  </CardTitle>
                  <Button size="sm" onClick={() => openEditor(activeIdentity)}
                    style={{ background: 'linear-gradient(135deg, #818cf8, #06b6d4)' }}>
                    <Edit className="w-4 h-4 mr-1.5" /> Edit Full Profile
                  </Button>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {[
                      { label: 'Email', value: activeIdentity.email },
                      { label: 'Phone', value: activeIdentity.phone },
                      { label: 'Role', value: activeIdentity.role_label },
                      { label: 'Tone', value: activeIdentity.communication_tone },
                      { label: 'Spend Limit', value: activeIdentity.spending_limit_per_task ? `$${activeIdentity.spending_limit_per_task}` : null },
                      { label: 'Tasks Run', value: activeIdentity.tasks_executed },
                    ].map(f => (
                      <div key={f.label}>
                        <div className="text-xs text-slate-500 mb-0.5">{f.label}</div>
                        <div className="text-white font-mono text-xs">{f.value || '—'}</div>
                      </div>
                    ))}
                  </div>

                  {activeIdentity.bio && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <div className="text-xs text-slate-500 mb-1">Bio</div>
                      <p className="text-sm text-slate-300">{activeIdentity.bio}</p>
                    </div>
                  )}

                  {activeIdentity.skills?.length > 0 && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <div className="text-xs text-slate-500 mb-2">Skills</div>
                      <div className="flex flex-wrap gap-2">
                        {activeIdentity.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 text-xs rounded-lg bg-indigo-500/15 border border-indigo-500/30 text-indigo-300">{skill}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeIdentity.kyc_verified_data && (
                    <div className="border-t border-slate-700/50 pt-4">
                      <h4 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-cyan-400" />
                        KYC Verified Data
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <div className="text-slate-500">Legal Name</div>
                          <div className="text-white">{activeIdentity.kyc_verified_data.full_legal_name || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">KYC Tier</div>
                          <div className={kycColor}>{activeIdentity.kyc_verified_data.kyc_tier || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">ID Type</div>
                          <div className="text-white">{activeIdentity.kyc_verified_data.government_id_type || '—'}</div>
                        </div>
                        <div>
                          <div className="text-slate-500">Country</div>
                          <div className="text-white">{activeIdentity.kyc_verified_data.country || '—'}</div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="glass-card">
                <CardContent className="text-center py-12">
                  <p className="text-slate-400 mb-4">No active identity. Create or activate one.</p>
                  <Button onClick={() => { setEditingIdentity(null); setShowProfileEditor(true); }}
                    style={{ background: 'linear-gradient(135deg, #818cf8, #06b6d4)' }}>
                    Create Identity
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Persona Workflow Generator Tab */}
          <TabsContent value="workflows" className="space-y-4">
            <div className="rounded-xl p-4 mb-2"
              style={{ background: 'rgba(0,232,255,0.04)', border: '1px solid rgba(0,232,255,0.15)' }}>
              <h3 className="font-orbitron text-xs tracking-widest text-cyan-400 mb-1">NEXUS — PERSONA WORKFLOW GENERATOR</h3>
              <p className="text-xs text-slate-500">
                Analyzes your active persona's bio and skills to generate specialized Autopilot workflows.
                Generated templates are saved to the Templates Library and can be deployed with one click.
              </p>
            </div>
            <PersonaWorkflowGenerator activeIdentity={activeIdentity} />
          </TabsContent>

          {/* KYC Tab */}
          <TabsContent value="kyc" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-cyan-400" />
                  KYC & Identity Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {kycData ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Verification Type</div>
                        <div className={`text-xl font-bold font-orbitron ${kycColor}`}>{kycTier || kycData.verification_type || 'None'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Status</div>
                        <div className="text-white capitalize">{kycData.status || kycData.admin_status || 'Pending'}</div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 mb-1">Last Updated</div>
                        <div className="text-white text-xs">{kycData.updated_date ? new Date(kycData.updated_date).toLocaleDateString() : '—'}</div>
                      </div>
                    </div>

                    {/* Personal details from KYCVerification */}
                    {(kycData.full_legal_name || kycData.date_of_birth || kycData.city) && (
                      <div className="border-t border-slate-700/50 pt-4 grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                        {kycData.full_legal_name && <div><div className="text-slate-500">Legal Name</div><div className="text-white">{kycData.full_legal_name}</div></div>}
                        {kycData.date_of_birth && <div><div className="text-slate-500">Date of Birth</div><div className="text-white">{kycData.date_of_birth}</div></div>}
                        {kycData.government_id_type && <div><div className="text-slate-500">ID Type</div><div className="text-white capitalize">{kycData.government_id_type}</div></div>}
                        {kycData.city && <div><div className="text-slate-500">City</div><div className="text-white">{kycData.city}</div></div>}
                        {kycData.state && <div><div className="text-slate-500">State</div><div className="text-white">{kycData.state}</div></div>}
                        {kycData.country && <div><div className="text-slate-500">Country</div><div className="text-white">{kycData.country}</div></div>}
                        {kycData.user_email && <div><div className="text-slate-500">Verified Email</div><div className="text-white truncate">{kycData.user_email}</div></div>}
                      </div>
                    )}

                    {/* Autopilot clearances from active identity's kyc_verified_data */}
                    {activeIdentity?.kyc_verified_data?.autopilot_clearance && (
                      <div className="border-t border-slate-700/50 pt-4">
                        <p className="text-xs text-slate-500 mb-3">Autopilot Clearances</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {Object.entries(activeIdentity.kyc_verified_data.autopilot_clearance).map(([key, val]) => (
                            <div key={key} className={`flex items-center gap-2 p-2 rounded-lg text-xs ${val ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-800/40 text-slate-500 border border-slate-700/40'}`}>
                              {val ? <CheckCircle className="w-3 h-3 shrink-0" /> : <div className="w-3 h-3 rounded-full border border-slate-600 shrink-0" />}
                              {key.replace('can_', '').replace(/_/g, ' ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Doc approval status */}
                    {kycData.doc_approvals && Object.keys(kycData.doc_approvals).length > 0 && (
                      <div className="border-t border-slate-700/50 pt-4">
                        <p className="text-xs text-slate-500 mb-3">Document Approvals</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(kycData.doc_approvals).map(([doc, approved]) => (
                            <span key={doc} className={`text-xs px-2 py-1 rounded-lg border flex items-center gap-1 ${
                              approved ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-slate-800/40 border-slate-700/40 text-slate-500'
                            }`}>
                              {approved ? <CheckCircle className="w-3 h-3" /> : <div className="w-3 h-3 rounded-full border border-current" />}
                              {doc.replace(/_/g, ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Shield className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-400 mb-2">No KYC data found.</p>
                    <p className="text-xs text-slate-500">Complete onboarding to verify your identity and unlock full Autopilot capabilities.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Credentials Tab */}
          <TabsContent value="credentials" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-amber-400" />
                  Credential Vault ({credentials.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 text-sm mb-4">Encrypted credentials accessed by Autopilot during execution. Stored in the secure vault.</p>
                {credentials.length === 0 ? (
                  <div className="text-center py-8">
                    <Key className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                    <p className="text-slate-500 text-sm">No credentials stored yet.</p>
                    <p className="text-xs text-slate-600 mt-1">Credentials are added during onboarding or via the Autopilot credential engine.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {credentials.map(cred => (
                      <div key={cred.id} className="flex items-center justify-between p-3 rounded-xl border border-slate-700/40 bg-slate-900/30">
                        <div>
                          <span className="text-sm text-slate-200 capitalize">{cred.platform}</span>
                          <div className="text-xs text-slate-500">{cred.credential_type}</div>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-lg border ${
                          cred.is_active ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' : 'text-slate-500 bg-slate-800/60 border-slate-700/40'
                        }`}>{cred.is_active ? 'Active' : 'Inactive'}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-600 mt-4">Credentials auto-rotate via the Autopilot engine. Manage in full detail via the Admin panel.</p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="w-5 h-5 text-indigo-400" />
                  NEXUS — Identity AI Assistant
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">NEXUS manages your identity data, ensures sync integrity across all systems, and supports Autopilot with verified persona data.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {[
                    { label: 'Identity Sync', status: 'Active', color: '#10b981' },
                    { label: 'KYC Monitoring', status: 'Active', color: '#10b981' },
                    { label: 'Credential Rotation', status: 'Active', color: '#10b981' },
                    { label: 'Cross-System Broadcast', status: 'Active', color: '#10b981' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center justify-between p-3 rounded-xl border border-slate-700/40 bg-slate-900/30">
                      <span className="text-slate-300">{s.label}</span>
                      <span className="font-semibold" style={{ color: s.color }}>{s.status}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Comprehensive Profile Editor Modal */}
        {showProfileEditor && (
          <IdentityProfileEditor
            identity={editingIdentity}
            onClose={() => { setShowProfileEditor(false); setEditingIdentity(null); }}
            onSave={(profileData) => {
              if (editingIdentity?.id) {
                updateProfileMutation.mutate({ id: editingIdentity.id, data: profileData });
              } else {
                createIdentityMutation.mutate(profileData);
                setShowProfileEditor(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}