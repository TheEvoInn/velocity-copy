/**
 * DISCOVERY DEPARTMENT
 * Real-time opportunity scanning, analysis, and AI-powered discovery
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useOpportunitiesV2, useUserGoalsV2, useActivityLogsV2 } from '@/lib/velocityHooks';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, TrendingUp, Scan, ChevronRight, Sparkles } from 'lucide-react';
import AIDiscoveryCards from '@/components/discovery/AIDiscoveryCards';

const style = getDeptStyle('discovery');

export default function Discovery() {
  const { opportunities, isLoading, refetch } = useOpportunitiesV2({ status: 'new' });
  const { goals } = useUserGoalsV2();
  const { logs } = useActivityLogsV2(20);
  const [isScanning, setIsScanning] = useState(false);
  const [activeTab, setActiveTab] = useState('ai_discovery');
  const [discoveryOpps, setDiscoveryOpps] = useState([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await base44.functions.invoke('scanOpportunities', { action: 'scan', max_results: 20 });
      refetch();
    } finally {
      setIsScanning(false);
    }
  };

  const handleDiscoveryScan = async () => {
    setDiscoveryLoading(true);
    try {
      const res = await base44.functions.invoke('aiDiscoveryEngine', {
        action: 'get_all_discoveries'
      });
      setDiscoveryOpps(res.data?.opportunities || []);
    } catch (err) {
      console.error('AI Discovery scan error:', err);
    } finally {
      setDiscoveryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'ai_discovery' && discoveryOpps.length === 0) {
      handleDiscoveryScan();
    }
  }, [activeTab]);

  const topOpps = opportunities
    .filter(o => o.overall_score >= 60)
    .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
    .slice(0, 10);

  const categories = {};
  opportunities.forEach(o => {
    const cat = o.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(245,158,11,0.1)`, border: `1px solid ${style.color}` }}>
              <span className="text-2xl">{style.icon}</span>
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">DISCOVERY</h1>
              <p className="text-xs text-slate-400">Autonomous AI scanning for digital niches and crypto yields</p>
            </div>
          </div>
          <Button
            onClick={() => activeTab === 'ai_discovery' ? handleDiscoveryScan() : handleScan()}
            disabled={activeTab === 'ai_discovery' ? discoveryLoading : isScanning}
            className="btn-cosmic gap-2"
          >
            <Scan className="w-4 h-4" />
            {activeTab === 'ai_discovery' 
              ? (discoveryLoading ? 'Discovering...' : 'AI Discover') 
              : (isScanning ? 'Scanning...' : 'Scan Now')}
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-700 pb-3 mb-6 overflow-x-auto">
          {[
            { id: 'ai_discovery', label: 'AI Discovery Engine', icon: Sparkles },
            { id: 'opportunities', label: 'Traditional Scanner', icon: TrendingUp },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI Discovery Tab */}
        {activeTab === 'ai_discovery' && (
          <div className="mb-6 space-y-4">
            <div className="p-4 rounded-lg border border-violet-500/30 bg-violet-500/10 mb-4">
              <p className="text-sm text-violet-300">
                🤖 <strong>AI Discovery Engine</strong> autonomously scans digital resale niches and crypto yield opportunities, 
                then ranks them by profit potential, velocity, and legitimacy. One-click actions to launch storefronts or staking positions.
              </p>
            </div>
            <AIDiscoveryCards 
              opportunities={discoveryOpps}
              loading={discoveryLoading}
              onRefresh={handleDiscoveryScan}
            />
          </div>
        )}

        {/* Traditional Scanner Tab */}
        {activeTab === 'opportunities' && (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <Card className="glass-card p-4">
                <div className="text-xs text-slate-400 mb-1">Total Found</div>
                <div className="text-2xl font-bold text-amber-400">{opportunities.length}</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-xs text-slate-400 mb-1">High Quality (60+)</div>
                <div className="text-2xl font-bold text-emerald-400">{topOpps.length}</div>
              </Card>
              <Card className="glass-card p-4">
                <div className="text-xs text-slate-400 mb-1">Est. Weekly Value</div>
                <div className="text-2xl font-bold text-cyan-400">
                  ${topOpps.reduce((s, o) => s + (o.profit_estimate_high || 0), 0) / 7 | 0}
                </div>
              </Card>
            </div>

            {/* Category Breakdown */}
            {Object.keys(categories).length > 0 && (
              <Card className="glass-card p-4 mb-6">
                <h3 className="font-orbitron text-sm font-bold text-white mb-3">Category Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {Object.entries(categories).map(([cat, count]) => (
                    <div key={cat} className="text-center p-2 bg-slate-800/30 rounded-lg border border-slate-700/50">
                      <div className="text-xs text-slate-400 capitalize">{cat}</div>
                      <div className="text-lg font-bold text-amber-400">{count}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Top Opportunities */}
            <Card className="glass-card p-4 mb-6">
              <h3 className="font-orbitron text-sm font-bold text-white mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-400" />
                Top Ranked Opportunities
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {topOpps.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-8">No high-quality opportunities yet. Run a scan.</div>
                ) : (
                  topOpps.map(opp => (
                    <Link key={opp.id} to={`/Opportunities?id=${opp.id}`}>
                      <div className="p-3 bg-slate-800/40 rounded-lg border border-slate-700/40 hover:border-amber-500/40 transition cursor-pointer">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-white truncate">{opp.title}</div>
                            <div className="text-xs text-slate-400">{opp.platform || 'Unknown'}</div>
                          </div>
                          <div className="ml-3 text-right">
                            <div className="text-sm font-bold text-emerald-400">${opp.profit_estimate_high || 0}</div>
                            <div className="text-xs text-slate-500">Score: {opp.overall_score || 0}</div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </Card>

            {/* Recent Activity */}
            <Card className="glass-card p-4">
              <h3 className="font-orbitron text-sm font-bold text-white mb-3">Recent Activity</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto text-xs text-slate-400">
                {logs.slice(0, 10).map(log => (
                  <div key={log.id} className="flex justify-between">
                    <span>{log.message}</span>
                    <span className="text-slate-600">{new Date(log.created_date).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* Deep Space Link */}
            <div className="mt-6">
              <Link to="/VelocitySystemDashboard">
                <Button variant="outline" className="w-full gap-2 border-slate-700">
                  <span>📡 Deep Space Analytics</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}