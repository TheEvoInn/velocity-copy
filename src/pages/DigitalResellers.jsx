/**
 * COMMERCE HUB — VELO AI
 * AI Assistant: MERCH
 * Autonomous digital storefronts, landing pages, and product commerce
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, Zap, TrendingUp, Globe, Sparkles, AlertCircle,
  Play, Eye, Settings, Trash2, Lock, Wand2, Brain, Plus, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { Link as RouterLink } from 'react-router-dom';
import SocialProofLibrary from '@/components/widgets/SocialProofLibrary';

export default function DigitalResellers() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedStorefrontId, setSelectedStorefrontId] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();

  // Fetch active identity from SDK — NOT localStorage
  const { data: activeIdentity } = useQuery({
    queryKey: ['activeIdentity', authUser?.email],
    queryFn: async () => {
      if (!authUser?.email) return null;
      const identities = await base44.entities.AIIdentity.filter(
        { user_email: authUser.email, is_active: true },
        '-last_used_at',
        1
      );
      return identities.length > 0 ? identities[0] : null;
    },
    enabled: !!authUser?.email,
  });

  // Real-time identity sync
  useEffect(() => {
    if (!authUser?.email) return;
    const unsub = base44.entities.AIIdentity.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['activeIdentity', authUser.email] });
    });
    return unsub;
  }, [authUser?.email, queryClient]);

  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: () => base44.auth.me(),
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['digitalResellOpportunities', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.Opportunity.filter({ category: 'digital_flip', created_by: user.email }, '-created_date', 100);
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  const { data: storefronts = [] } = useQuery({
    queryKey: ['userStorefronts', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return base44.entities.DigitalStorefront.filter({ created_by: user.email }, '-created_date', 50);
    },
    enabled: !!user?.email,
  });

  const generatePageMutation = useMutation({
    mutationFn: async (opportunityData) => {
      const response = await base44.functions.invoke('resellPageGenerator', {
        action: 'generate_complete_page',
        opportunity: opportunityData,
        user_identity: activeIdentity?.id || user?.id,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Landing page created: ${data?.page_title}`);
      queryClient.invalidateQueries({ queryKey: ['userStorefronts', user?.email] });
      setShowGenerateModal(false);
    },
    onError: (err) => toast.error(`Failed to generate page: ${err.message}`),
  });

  const { data: autopilotConfig } = useQuery({
    queryKey: ['resellAutopilotConfig', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const configs = await base44.entities.ResellAutopilotConfig.filter({ created_by: user.email }, '-updated_date', 1);
      return configs.length > 0 ? configs[0] : null;
    },
    enabled: !!user?.email,
  });

  const launchAutopilotMutation = useMutation({
    mutationFn: async () => {
      if (!activeIdentity) throw new Error('Please activate an identity in the Identity Hub first');
      const response = await base44.functions.invoke('autopilotResellOrchestrator', {
        action: 'launch_autonomous_reseller',
        user_id: user?.id,
        user_email: user?.email,
        identity_id: activeIdentity.id,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('MERCH Autopilot launched!');
      queryClient.invalidateQueries({ queryKey: ['resellAutopilotConfig', user?.email] });
      queryClient.invalidateQueries({ queryKey: ['userStorefronts', user?.email] });
    },
    onError: (err) => toast.error(`Launch failed: ${err.message}`),
  });

  const stats = {
    active_storefronts: storefronts.filter(s => s.status === 'published').length,
    total_revenue: storefronts.reduce((sum, s) => sum + (s.total_revenue || 0), 0),
    pending_opportunities: opportunities.filter(o => o.status === 'new').length,
    avg_conversion: storefronts.length > 0
      ? (storefronts.reduce((sum, s) => sum + (s.conversion_rate || 0), 0) / storefronts.length).toFixed(2)
      : '0',
  };

  return (
    <div className="min-h-screen pt-20 pb-8 px-4 md:px-8">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #ec4899, #f43f5e)' }} />
              <div>
                <h1 className="font-orbitron text-3xl font-bold text-white">COMMERCE HUB</h1>
                <p className="text-[10px] font-mono tracking-widest text-pink-400/70">VELO AI · AI: MERCH</p>
              </div>
            </div>
            <p className="text-slate-400 text-sm ml-5">Autonomous landing pages, digital storefronts, and commerce execution</p>
          </div>
          {activeIdentity && (
            <Badge className="bg-emerald-500/20 text-emerald-400 gap-1 border border-emerald-500/30">
              <CheckCircle2 className="w-3 h-3" />
              Identity: {activeIdentity.name}
            </Badge>
          )}
        </div>

        {/* MERCH AI Status */}
        <div className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: 'rgba(236,72,153,0.05)', border: '1px solid rgba(236,72,153,0.2)' }}>
          <Brain className="w-5 h-5 text-pink-400 shrink-0" />
          <div className="flex-1">
            <span className="text-xs font-orbitron text-pink-400 tracking-wider">MERCH COMMERCE ENGINE</span>
            <p className="text-xs text-slate-500 mt-0.5">Scanning digital niches · Generating storefronts · Managing product pages · Syncing with Finance Command</p>
          </div>
          <span className="text-xs text-pink-400 font-mono px-2 py-1 rounded-lg border border-pink-400/30 bg-pink-400/10 shrink-0">ACTIVE</span>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Active Storefronts', value: stats.active_storefronts, color: '#00ffd9', icon: Globe, sub: 'Live & earning' },
            { label: 'Total Revenue', value: `$${stats.total_revenue.toFixed(0)}`, color: '#10b981', icon: TrendingUp, sub: 'From all storefronts' },
            { label: 'Pending Opps', value: stats.pending_opportunities, color: '#f59e0b', icon: AlertCircle, sub: 'Ready to monetize' },
            { label: 'Avg Conversion', value: `${stats.avg_conversion}%`, color: '#818cf8', icon: Sparkles, sub: 'Across all pages' },
          ].map(s => (
            <Card key={s.label} className="glass-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-slate-400">{s.label}</span>
                  <s.icon className="w-4 h-4" style={{ color: s.color }} />
                </div>
                <div className="text-2xl font-bold font-orbitron" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-slate-500 mt-1">{s.sub}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Launch CTA */}
        <Card className="glass-card border-pink-500/30">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold font-orbitron text-white mb-0.5">Launch MERCH Autopilot</h2>
                <p className="text-sm text-slate-400">Start autonomous landing page generation, product publishing, and revenue collection</p>
              </div>
              <Button
                onClick={() => launchAutopilotMutation.mutate()}
                disabled={launchAutopilotMutation.isPending || !activeIdentity || autopilotConfig?.autopilot_enabled}
                style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)', color: '#fff' }}
                className="gap-2 font-bold shrink-0"
              >
                {!activeIdentity ? <><Lock className="w-4 h-4" /> Go to Identity Hub</>
                  : autopilotConfig?.autopilot_enabled ? <><CheckCircle2 className="w-4 h-4" /> Running</>
                  : launchAutopilotMutation.isPending ? <><Zap className="w-4 h-4 animate-spin" /> Launching...</>
                  : <><Zap className="w-4 h-4" /> Launch Now</>}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
          {[
            { id: 'overview', label: 'Overview', icon: Eye },
            { id: 'storefronts', label: 'Storefronts', icon: Globe },
            { id: 'opportunities', label: 'Opportunities', icon: TrendingUp },
            { id: 'widgets', label: 'Social Proof', icon: Sparkles },
            { id: 'settings', label: 'Configuration', icon: Settings },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
                activeTab === tab.id ? 'border-pink-500 text-pink-400' : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}>
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'overview' && (
          <div className="space-y-4">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-400" />
                  How MERCH Works
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-slate-300">
                {[
                  ['1', 'Discover Niches', 'MERCH scans for profitable digital resale opportunities'],
                  ['2', 'Generate Page', 'One-click landing page creation using your VELO AI identity brand'],
                  ['3', 'Configure Products', 'Auto-populate with descriptions, pricing, images'],
                  ['4', 'Setup Payments', 'Payment processing automatically configured'],
                  ['5', 'Publish & Earn', 'Page goes live and starts collecting revenue autonomously'],
                ].map(([n, title, desc]) => (
                  <div key={n} className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>{n}</div>
                    <div><strong className="text-white">{title}</strong> — {desc}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Button onClick={() => setShowGenerateModal(true)}
              className="w-full gap-2 py-6 text-base font-bold"
              style={{ background: 'linear-gradient(135deg, #ec4899, #818cf8)' }}>
              <Plus className="w-5 h-5" />
              Generate New Landing Page
            </Button>
          </div>
        )}

        {activeTab === 'storefronts' && (
          <div className="space-y-4">
            {storefronts.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="p-8 text-center">
                  <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400 mb-4">No storefronts yet. Create your first one!</p>
                  <Button onClick={() => setShowGenerateModal(true)} style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}>Generate First Page</Button>
                </CardContent>
              </Card>
            ) : storefronts.map(storefront => (
              <Card key={storefront.id} className="glass-card hover:border-pink-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{storefront.page_title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{storefront.description}</p>
                    </div>
                    <Badge className={storefront.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
                      {storefront.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                    {[
                      { label: 'Revenue', value: `$${storefront.total_revenue || 0}`, color: 'text-emerald-400' },
                      { label: 'Conversion', value: `${storefront.conversion_rate || 0}%`, color: 'text-teal-400' },
                      { label: 'Products', value: storefront.product_count || 0, color: 'text-violet-400' },
                    ].map(f => (
                      <div key={f.label} className="p-2 rounded-lg bg-slate-800/50">
                        <div className="text-slate-400">{f.label}</div>
                        <div className={`${f.color} font-bold`}>{f.value}</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs gap-1"><Eye className="w-3 h-3" /> View</Button>
                    <RouterLink to={`/PageCustomizer?id=${storefront.id}`}>
                      <Button size="sm" variant="outline" className="text-xs gap-1"><Wand2 className="w-3 h-3" /> Customize</Button>
                    </RouterLink>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'opportunities' && (
          <div className="space-y-4">
            {opportunitiesLoading ? (
              <Card className="glass-card"><CardContent className="p-8 text-center"><div className="inline-block animate-spin"><Zap className="w-6 h-6 text-pink-400" /></div><p className="text-slate-400 mt-2">Scanning for opportunities...</p></CardContent></Card>
            ) : opportunities.length === 0 ? (
              <Card className="glass-card"><CardContent className="p-8 text-center"><AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">No resale opportunities found. MERCH will scan automatically.</p></CardContent></Card>
            ) : opportunities.map(opp => (
              <Card key={opp.id} className="glass-card hover:border-pink-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{opp.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{opp.description}</p>
                    </div>
                    <Badge className="bg-pink-500/20 text-pink-400">{opp.category}</Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button size="sm" onClick={() => generatePageMutation.mutate(opp)} disabled={generatePageMutation.isPending}
                      style={{ background: 'linear-gradient(135deg, #ec4899, #818cf8)' }} className="gap-1 text-xs">
                      <Sparkles className="w-3 h-3" /> Generate Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {activeTab === 'widgets' && (
          <div className="space-y-4">
            {storefronts.length > 0 ? (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">Select Storefront</label>
                  <select value={selectedStorefrontId || ''} onChange={(e) => setSelectedStorefrontId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm focus:outline-none focus:border-pink-500/50">
                    <option value="">Choose a storefront...</option>
                    {storefronts.map(sf => <option key={sf.id} value={sf.id}>{sf.page_title}</option>)}
                  </select>
                </div>
                {selectedStorefrontId && (
                  <SocialProofLibrary storefrontId={selectedStorefrontId} onAddWidget={() => toast.success('Widget added!')} />
                )}
              </div>
            ) : (
              <Card className="glass-card"><CardContent className="p-8 text-center"><AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" /><p className="text-slate-400">Create a storefront first to add social proof widgets.</p></CardContent></Card>
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-5 h-5 text-pink-400" />
                MERCH Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {[
                { label: '✓ VELO AI Identity', value: activeIdentity ? `Active: ${activeIdentity.name} — branding & voice auto-applied` : 'No identity active — configure in Identity Hub' },
                { label: '✓ Payment Processing', value: 'Stripe integration configured. Payments deposited to VELO AI wallet.' },
                { label: '✓ Content Generation', value: 'MERCH generates all copy using your VELO AI brand identity & tone.' },
                { label: '✓ Finance Sync', value: 'All revenue synced in real-time to Finance Command.' },
              ].map(item => (
                <div key={item.label} className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/40">
                  <div className="font-semibold text-white mb-1">{item.label}</div>
                  <p className="text-slate-400 text-xs">{item.value}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}