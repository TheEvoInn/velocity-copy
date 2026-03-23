/**
 * VIPZ DEPARTMENT
 * AI-driven marketing, funnel optimization, landing page automation
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, TrendingUp, BookOpen, Target, RefreshCw } from 'lucide-react';

const style = getDeptStyle('vipz');

const DUMMY_COLOR = '#ec4899';

export default function VIPZ() {
  const [selectedStorefront, setSelectedStorefront] = useState(null);

  const { data: dashboardData = {}, refetch: refetchDashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['vipz_dashboard'],
    queryFn: async () => {
      const res = await base44.functions.invoke('vipzRealtimeEngine', {
        action: 'get_dashboard_summary'
      });
      return res.data?.dashboard || {};
    },
    refetchInterval: 30000,
    staleTime: 5000,
  });

  const { data: storefronts = [] } = useQuery({
    queryKey: ['vipz_storefronts'],
    queryFn: async () => {
      const res = await base44.functions.invoke('vipzRealtimeEngine', {
        action: 'get_active_storefronts'
      });
      return res.data?.storefronts || [];
    },
    refetchInterval: 60000,
    staleTime: 5000,
  });

  const { data: sequences = [] } = useQuery({
    queryKey: ['emailSequences'],
    queryFn: () => base44.entities.EmailSequence.filter({ created_by: true }, '-updated_date', 20).catch(() => []),
    staleTime: 5000,
  });

  const stats = {
    pages: dashboardData.published_storefronts || 0,
    traffic: Math.round(dashboardData.total_emails_sent || 0),
    conversions: dashboardData.total_conversions || 0,
    revenue: parseFloat(dashboardData.total_revenue || 0),
    sequences: dashboardData.active_campaigns || 0,
    openRate: dashboardData.open_rate || 0,
    health: dashboardData.health_status || 'SETUP_REQUIRED'
  };

  const conversionRate = stats.traffic > 0 ? ((stats.conversions / stats.traffic) * 100).toFixed(2) : '0';

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(236,72,153,0.1)`, border: `1px solid ${style.color}` }}>
              <span className="text-2xl">🎯</span>
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">VIPZ</h1>
              <p className="text-xs text-slate-400">Marketing Automation · Funnel Optimization · Landing Pages</p>
            </div>
          </div>
          <div className="flex gap-2">
           <Button 
             variant="outline" 
             size="icon"
             onClick={() => refetchDashboard()}
             disabled={dashboardLoading}
           >
             <RefreshCw className={`w-4 h-4 ${dashboardLoading ? 'animate-spin' : ''}`} />
           </Button>
           <Link to="/PageCustomizer">
             <Button className="btn-cosmic gap-2">
               <BookOpen className="w-4 h-4" />
               Create Page
             </Button>
           </Link>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Pages</div>
            <div className="text-2xl font-bold text-pink-400">{stats.pages}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Visitors</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.traffic.toLocaleString()}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Conversions</div>
            <div className="text-2xl font-bold text-emerald-400">{stats.conversions}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Open Rate</div>
            <div className="text-2xl font-bold text-amber-400">{stats.openRate}%</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Revenue</div>
            <div className="text-2xl font-bold text-violet-400">${stats.revenue.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">System Health</div>
            <div className="text-2xl font-bold text-cyan-400">{stats.health}</div>
          </Card>
        </div>

        {/* Active Pages */}
        <Card className="glass-card p-4 mb-6">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-pink-400" />
            Published Pages
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {storefronts.filter(s => s.status === 'published').length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No published pages</div>
            ) : (
              storefronts
                .filter(s => s.status === 'published')
                .slice(0, 8)
                .map(page => (
                  <div key={page.id} className="p-3 bg-slate-800/40 rounded-lg border border-pink-500/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{page.page_title}</div>
                        <div className="text-xs text-slate-400 mt-1">
                          {page.visitor_count || 0} visits · {page.customer_count || 0} conversions
                        </div>
                      </div>
                      <div className="ml-3 text-right text-xs">
                        <div className="font-bold text-emerald-400">${(page.total_revenue || 0).toFixed(0)}</div>
                        <div className="text-slate-500">
                          {page.visitor_count > 0 ? ((page.customer_count / page.visitor_count) * 100).toFixed(1) : '0'}%
                        </div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Email Sequences */}
        <Card className="glass-card p-4 mb-6">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-cyan-400" />
            Email Sequences ({stats.sequences} Active)
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {sequences.filter(s => s.status === 'active').length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No active sequences</div>
            ) : (
              sequences
                .filter(s => s.status === 'active')
                .slice(0, 5)
                .map(seq => (
                  <div key={seq.id} className="p-3 bg-slate-800/40 rounded-lg border border-cyan-500/30">
                    <div className="flex justify-between items-start">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-white truncate">{seq.name}</div>
                        <div className="text-xs text-slate-400">{seq.total_emails} emails</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-emerald-400 font-bold">{(seq.conversion_rate || 0).toFixed(1)}%</div>
                        <div className="text-slate-500">{seq.total_leads_enrolled || 0} leads</div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/EmailMarketing">
            <Button variant="outline" className="w-full gap-2">
              <Zap className="w-4 h-4" />
              Email Marketing
            </Button>
          </Link>
          <Link to="/PageCustomizer">
            <Button variant="outline" className="w-full gap-2">
              <BookOpen className="w-4 h-4" />
              Create Page
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}