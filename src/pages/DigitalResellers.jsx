import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  ShoppingCart, Zap, TrendingUp, Globe, Sparkles, AlertCircle,
  Play, Pause, RotateCw, Plus, Eye, Settings, Trash2, Lock
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/AuthContext';
import { CheckCircle2 } from 'lucide-react';

export default function DigitalResellers() {
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedOpportunity, setSelectedOpportunity] = useState(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  
  // Get active identity from local storage or context
  const activeIdentityData = typeof window !== 'undefined' 
    ? localStorage.getItem('activeIdentity') 
    : null;
  const activeIdentity = activeIdentityData ? JSON.parse(activeIdentityData) : null;

  // Fetch user data
  const { data: user } = useQuery({
    queryKey: ['currentUser'],
    queryFn: async () => await base44.auth.me(),
  });

  // Fetch digital resale opportunities (created by current user)
  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery({
    queryKey: ['digitalResellOpportunities', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const res = await base44.entities.Opportunity.filter(
        { category: 'digital_flip', created_by: user.email },
        '-created_date',
        100
      );
      return res;
    },
    enabled: !!user?.email,
    refetchInterval: 30000,
  });

  // Fetch user's generated storefronts
  const { data: storefronts = [] } = useQuery({
    queryKey: ['userStorefronts'],
    queryFn: async () => {
      const res = await base44.entities.DigitalStorefront.filter(
        { created_by: user?.email },
        '-created_date',
        50
      );
      return res;
    },
    enabled: !!user?.email,
  });

  // Generate landing page mutation
  const generatePageMutation = useMutation({
    mutationFn: async (opportunityData) => {
      const response = await base44.functions.invoke('resellPageGenerator', {
        action: 'generate_complete_page',
        opportunity: opportunityData,
        user_identity: user?.id,
      });
      return response.data;
    },
    onSuccess: (data) => {
      toast.success(`Landing page created: ${data.page_title}`);
      queryClient.invalidateQueries({ queryKey: ['userStorefronts'] });
      setShowGenerateModal(false);
    },
    onError: (err) => {
      toast.error(`Failed to generate page: ${err.message}`);
    },
  });

  // Fetch reseller autopilot config
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

  // Launch autopilot reseller mutation
  const launchAutopilotMutation = useMutation({
    mutationFn: async () => {
      // Verify user has approved identity
      if (!activeIdentity) {
        throw new Error('Please select an approved identity first');
      }
      
      const response = await base44.functions.invoke('autopilotResellOrchestrator', {
        action: 'launch_autonomous_reseller',
        user_id: user?.id,
        user_email: user?.email,
        identity_id: activeIdentity?.id,
      });
      return response.data;
    },
    onSuccess: () => {
      toast.success('Autopilot Digital Reseller launched!');
      queryClient.invalidateQueries({ queryKey: ['resellAutopilotConfig'] });
      queryClient.invalidateQueries({ queryKey: ['userStorefronts'] });
    },
    onError: (err) => {
      toast.error(`Launch failed: ${err.message}`);
    },
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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 p-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
            <ShoppingCart className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white font-orbitron">
              Autopilot Digital Resellers
            </h1>
            <p className="text-sm text-slate-400">
              Autonomous landing page generation & digital product publishing
            </p>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Active Storefronts</span>
              <Globe className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-3xl font-bold text-cyan-400">{stats.active_storefronts}</div>
            <div className="text-xs text-slate-500 mt-2">Live & earning</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Total Revenue</span>
              <TrendingUp className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-3xl font-bold text-emerald-400">${stats.total_revenue.toFixed(0)}</div>
            <div className="text-xs text-slate-500 mt-2">From all storefronts</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Pending Opportunities</span>
              <AlertCircle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-3xl font-bold text-amber-400">{stats.pending_opportunities}</div>
            <div className="text-xs text-slate-500 mt-2">Ready to monetize</div>
          </CardContent>
        </Card>

        <Card className="glass-card-bright">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Avg Conversion</span>
              <Sparkles className="w-4 h-4 text-violet-400" />
            </div>
            <div className="text-3xl font-bold text-violet-400">{stats.avg_conversion}%</div>
            <div className="text-xs text-slate-500 mt-2">Across all pages</div>
          </CardContent>
        </Card>
      </div>

      {/* Primary CTA */}
      <Card className="bg-gradient-to-r from-purple-600/30 to-pink-600/30 border-purple-500/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">Launch Autopilot Reseller</h2>
              <p className="text-sm text-slate-300">
                Start autonomous landing page generation, product publishing, and revenue collection
              </p>
            </div>
            <Button
              onClick={() => launchAutopilotMutation.mutate()}
              disabled={launchAutopilotMutation.isPending || !activeIdentity || autopilotConfig?.autopilot_enabled}
              className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 gap-2"
            >
              {!activeIdentity ? (
                <>
                  <Lock className="w-4 h-4" />
                  Activate Identity First
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
      <div className="flex gap-2 border-b border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: Eye },
          { id: 'storefronts', label: 'Storefronts', icon: Globe },
          { id: 'opportunities', label: 'Opportunities', icon: TrendingUp },
          { id: 'settings', label: 'Configuration', icon: Settings },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors ${
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

      {/* Content */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-violet-400" />
                How It Works
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">1</div>
                <div><strong>Discover Opportunities</strong> - AI scans for profitable digital resale niches</div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">2</div>
                <div><strong>Generate Page</strong> - One-click landing page creation with your brand</div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">3</div>
                <div><strong>Configure Products</strong> - Auto-populate with descriptions, pricing, images</div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">4</div>
                <div><strong>Setup Payments</strong> - Payment processing automatically configured</div>
              </div>
              <div className="flex gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">5</div>
                <div><strong>Publish & Earn</strong> - Page goes live and starts collecting revenue</div>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={() => setShowGenerateModal(true)}
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 gap-2 py-6 text-base"
          >
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
                <Button
                  onClick={() => setShowGenerateModal(true)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Generate First Page
                </Button>
              </CardContent>
            </Card>
          ) : (
            storefronts.map(storefront => (
              <Card key={storefront.id} className="glass-card hover:border-purple-500/50 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{storefront.page_title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{storefront.description}</p>
                    </div>
                    <Badge className={`${
                      storefront.status === 'published'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}>
                      {storefront.status}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Revenue</div>
                      <div className="text-emerald-400 font-bold">${storefront.total_revenue || 0}</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Conversion</div>
                      <div className="text-cyan-400 font-bold">{storefront.conversion_rate || 0}%</div>
                    </div>
                    <div className="p-2 rounded bg-slate-800">
                      <div className="text-slate-400">Products</div>
                      <div className="text-violet-400 font-bold">{storefront.product_count || 0}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="text-xs">
                      <Eye className="w-3 h-3 mr-1" /> View
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      <Settings className="w-3 h-3 mr-1" /> Edit
                    </Button>
                    <Button size="sm" variant="outline" className="text-xs">
                      <Trash2 className="w-3 h-3 mr-1" /> Delete
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'opportunities' && (
        <div className="space-y-4">
          {opportunitiesLoading ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <div className="inline-block animate-spin">
                  <Zap className="w-6 h-6 text-purple-400" />
                </div>
                <p className="text-slate-400 mt-2">Scanning for opportunities...</p>
              </CardContent>
            </Card>
          ) : opportunities.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-8 text-center">
                <AlertCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No resale opportunities found. Running automated scan...</p>
              </CardContent>
            </Card>
          ) : (
            opportunities.map(opp => (
              <Card key={opp.id} className="glass-card hover:border-purple-500/50">
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-semibold text-white">{opp.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">{opp.description}</p>
                    </div>
                    <Badge className="bg-purple-500/20 text-purple-400">{opp.category}</Badge>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      onClick={() => generatePageMutation.mutate(opp)}
                      disabled={generatePageMutation.isPending}
                      className="bg-cyan-600 hover:bg-cyan-700 gap-2"
                    >
                      <Sparkles className="w-3 h-3" />
                      Generate Page
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {activeTab === 'settings' && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Digital Reseller Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">Identity & Branding</div>
              <p className="text-slate-400">All pages automatically use your selected identity, brand colors, and tone of voice.</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">Payment Processing</div>
              <p className="text-slate-400">Stripe integration configured. All payments automatically deposited to your wallet.</p>
            </div>
            <div className="p-4 rounded bg-slate-800/50">
              <div className="font-semibold text-white mb-2">Content Generation</div>
              <p className="text-slate-400">AI generates all copy, product descriptions, and marketing content aligned with your brand.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}