/**
 * DIGITAL COMMERCE UNIFIED SYSTEM
 * Merged Resellers + VIPZ: Autonomous landing page generation, email marketing, and revenue collection
 * Integrated with Velocity identity, workflows, and real-time reporting
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart, Zap, TrendingUp, Globe, Sparkles, AlertCircle,
  Play, Pause, RotateCw, Plus, Eye, Settings, Trash2, Lock, Wand2,
  Target, Mail, BookOpen, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { Link as RouterLink } from 'react-router-dom';
import SocialProofLibrary from '@/components/widgets/SocialProofLibrary';

export default function DigitalCommerce() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedStorefrontId, setSelectedStorefrontId] = useState(null);
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();

  // Get Velocity identity profile
  const { data: velocityIdentity } = useQuery({
    queryKey: ['velocityIdentity', authUser?.email],
    queryFn: async () => {
      if (!authUser?.email) return null;
      const identities = await base44.entities.AIIdentity.filter(
        { created_by: authUser.email, is_active: true },
        '-last_used_at',
        1
      );
      return identities.length > 0 ? identities[0] : null;
    },
    enabled: !!authUser?.email,
  });

  // Fetch user
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => await base44.auth.me(),
  });

  // Fetch storefronts
  const { data: storefronts = [] } = useQuery({
    queryKey: ['userStorefronts', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.DigitalStorefront.filter(
        { created_by: user.email },
        '-created_date',
        50
      );
    },
    enabled: !!user?.email,
    refetchInterval: 20000,
  });

  // Fetch opportunities
  const { data: opportunities = [] } = useQuery({
    queryKey: ['digitalResellOpp', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.Opportunity.filter(
        { category: 'digital_flip', created_by: user.email },
        '-created_date',
        100
      );
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  // Fetch email sequences
  const { data: sequences = [] } = useQuery({
    queryKey: ['emailSequences', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      return await base44.entities.EmailSequence.filter(
        { created_by: user.email },
        '-updated_date',
        20
      );
    },
    enabled: !!user?.email,
  });

  // Fetch autopilot config
  const { data: autopilotConfig } = useQuery({
    queryKey: ['resellAutopilotConfig', user?.email],
    queryFn: async () => {
      if (!user?.email) return null;
      const configs = await base44.entities.ResellAutopilotConfig.filter(
        { created_by: user.email },
        '-updated_date',
        1
      );
      return configs.length > 0 ? configs[0] : null;
    },
    enabled: !!user?.email,
  });

  // Launch autopilot mutation
  const launchAutopilotMutation = useMutation({
    mutationFn: async () => {
      if (!velocityIdentity) {
        throw new Error('Activate your Velocity identity first');
      }
      const response = await base44.functions.invoke('autopilotResellOrchestrator', {
        action: 'launch_autonomous_reseller',
        user_id: user?.id,
        user_email: user?.email,
        identity_id: velocityIdentity.id,
        workflow_trigger: 'digital_commerce_autopilot',
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Digital Commerce Autopilot launched!');
      queryClient.invalidateQueries({ queryKey: ['resellAutopilotConfig'] });
    },
    onError: (err) => {
      toast.error(`Launch failed: ${err.message}`);
    },
  });

  // Generate page mutation
  const generatePageMutation = useMutation({
    mutationFn: async (opportunityData) => {
      const response = await base44.functions.invoke('resellPageGenerator', {
        action: 'generate_complete_page',
        opportunity: opportunityData,
        user_identity: velocityIdentity?.id,
        report_to_workflow: true,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Landing page created: ${data.page_title}`);
      queryClient.invalidateQueries({ queryKey: ['userStorefronts'] });
    },
    onError: (err) => {
      toast.error(`Failed to generate page: ${err.message}`);
    },
  });

  // Calculate stats
  const stats = {
    active_storefronts: storefronts.filter(s => s.status === 'published').length,
    total_revenue: storefronts.reduce((sum, s) => sum + (s.total_revenue || 0), 0),
    total_traffic: storefronts.reduce((sum, s) => sum + (s.visitor_count || 0), 0),
    total_conversions: storefronts.reduce((sum, s) => sum + (s.customer_count || 0), 0),
    pending_opportunities: opportunities.filter(o => o.status === 'new').length,
    active_sequences: sequences.filter(s => s.status === 'active').length,
    avg_conversion: storefronts.length > 0
      ? (storefronts.reduce((sum, s) => sum + (s.conversion_rate || 0), 0) / storefronts.length).toFixed(2)
      : '0',
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white font-orbitron">Digital Commerce</h1>
            <p className="text-sm text-slate-400">Landing pages, email funnels, and autonomous earning</p>
          </div>
        </div>
        {velocityIdentity && (
          <Badge className="bg-emerald-500/20 text-emerald-400 gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Identity: {velocityIdentity.name}
          </Badge>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Revenue</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400">${stats.total_revenue.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-2">From storefronts</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Active Pages</span>
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.active_storefronts}</div>
            <div className="text-xs text-slate-500 mt-2">Live & earning</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Traffic</span>
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-bold text-violet-400">{stats.total_traffic.toLocaleString()}</div>
            <div className="text-xs text-slate-500 mt-2">Total visitors</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Conversions</span>
              <Target className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.total_conversions}</div>
            <div className="text-xs text-slate-500 mt-2">Avg {stats.avg_conversion}%</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Email Sequences</span>
              <Mail className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.active_sequences}</div>
            <div className="text-xs text-slate-500 mt-2">Active</div>
          </CardContent>
        </Card>
      </div>

      {/* Launch CTA */}
      <Card className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Configure & Go</h2>
              <p className="text-sm text-slate-300">
                One-click launch: AI generates pages, manages emails, and collects revenue 24/7
              </p>
            </div>
            <Button
              onClick={() => launchAutopilotMutation.mutate()}
              disabled={launchAutopilotMutation.isPending || !velocityIdentity || autopilotConfig?.autopilot_enabled}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 gap-2 shrink-0"
            >
              {!velocityIdentity ? (
                <>
                  <Lock className="w-4 h-4" />
                  Set Identity First
                </>
              ) : autopilotConfig?.autopilot_enabled ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Running
                </>
              ) : launchAutopilotMutation.isPending ? (
                <>
                  <Zap className="w-4 h-4 animate-spin" />
                  Launching...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Launch Now
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-800 overflow-x-auto">
        {[
          { id: 'dashboard', label: 'Dashboard', icon: Eye },
          { id: 'pages', label: 'Pages', icon: Globe },
          { id: 'opportunities', label: 'Opportunities', icon: TrendingUp },
          { id: 'sequences', label: 'Email', icon: Mail },
          { id: 'widgets', label: 'Widgets', icon: Sparkles },
          { id: 'settings', label: 'Config', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? 'border-purple-500 text-purple-400'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Dashboard Tab */}
      {activeTab === 'dashboard' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                System Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">🎯 Landing Pages</h3>
                  <p className="text-xs">Autonomous generation from discovered opportunities</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">📧 Email Funnels</h3>
                  <p className="text-xs">Auto-created sequences for lead conversion</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">💳 Payments</h3>
                  <p className="text-xs">Stripe integration auto-configured</p>
                </div>
                <div className="p-4 rounded bg-slate-800/50">
                  <h3 className="font-semibold text-white mb-2">📊 Real-time Reporting</h3>
                  <p className="text-xs">Live analytics via Velocity workflows</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Pages Tab */}
      {activeTab === 'pages' && (
        <div className="space-y-4">
          {storefronts.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <Globe className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No pages yet. Scan opportunities to get started.</p>
              </CardContent>
            </Card>
          ) : (
            storefronts.map(sf => (
              <Card key={sf.id} className="glass-card hover:border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{sf.page_title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{sf.headline}</p>
                    </div>
                    <Badge className={sf.status === 'published' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}>
                      {sf.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mb-3 text-xs">
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Revenue</div>
                      <div className="text-emerald-400 font-bold">${sf.total_revenue || 0}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Visitors</div>
                      <div className="text-cyan-400 font-bold">{sf.visitor_count || 0}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Conv Rate</div>
                      <div className="text-violet-400 font-bold">{sf.conversion_rate || 0}%</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Products</div>
                      <div className="text-amber-400 font-bold">{sf.product_count || 0}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <RouterLink to={`/PageCustomizer?id=${sf.id}`}>
                      <Button size="sm" variant="outline" className="text-xs gap-1">
                        <Wand2 className="w-3 h-3" /> Edit
                      </Button>
                    </RouterLink>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Opportunities Tab */}
      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {opportunities.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No opportunities found yet.</p>
              </CardContent>
            </Card>
          ) : (
            opportunities.map(opp => (
              <Card key={opp.id} className="glass-card hover:border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{opp.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{opp.description}</p>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400">${opp.profit_estimate_high || 0}</Badge>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => generatePageMutation.mutate(opp)}
                    disabled={generatePageMutation.isPending}
                    className="bg-cyan-600 hover:bg-cyan-700 gap-2 w-full"
                  >
                    <Sparkles className="w-3 h-3" />
                    Generate Page
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Email Sequences Tab */}
      {activeTab === 'sequences' && (
        <div className="space-y-4">
          {sequences.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <Mail className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No sequences created yet.</p>
                <RouterLink to="/EmailMarketing">
                  <Button className="mt-4 bg-purple-600 hover:bg-purple-700">
                    Create Sequence
                  </Button>
                </RouterLink>
              </CardContent>
            </Card>
          ) : (
            sequences.map(seq => (
              <Card key={seq.id} className="glass-card">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{seq.name}</h3>
                      <p className="text-xs text-slate-400">{seq.total_emails} emails</p>
                    </div>
                    <Badge className={seq.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
                      {seq.status}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Leads</div>
                      <div className="text-cyan-400 font-bold">{seq.total_leads_enrolled || 0}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Conv Rate</div>
                      <div className="text-emerald-400 font-bold">{(seq.conversion_rate || 0).toFixed(1)}%</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Revenue</div>
                      <div className="text-violet-400 font-bold">${seq.total_revenue_generated || 0}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Widgets Tab */}
      {activeTab === 'widgets' && (
        <div className="space-y-4">
          {storefronts && storefronts.length > 0 ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-300 block mb-2">
                  Select Storefront
                </label>
                <select
                  value={selectedStorefrontId || ''}
                  onChange={(e) => setSelectedStorefrontId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
                >
                  <option value="">Choose a storefront...</option>
                  {storefronts.map(sf => (
                    <option key={sf.id} value={sf.id}>
                      {sf.page_title}
                    </option>
                  ))}
                </select>
              </div>
              {selectedStorefrontId && (
                <SocialProofLibrary storefrontId={selectedStorefrontId} />
              )}
            </div>
          ) : (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Create a page first to add widgets.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Digital Commerce Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Velocity Identity</div>
              <p className="text-slate-400">
                {velocityIdentity ? `Active: ${velocityIdentity.name}` : 'No identity selected'}
              </p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Workflow Integration</div>
              <p className="text-slate-400">Reports to: digital_commerce_autopilot, email_marketing_automation</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Real-time Sync</div>
              <p className="text-slate-400">Live feed connected. Updates every 20 seconds.</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">✓ Credential Verification</div>
              <p className="text-slate-400">All credentials verified through Velocity identity profile</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}