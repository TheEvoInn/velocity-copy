/**
 * DISCOVERY DEPARTMENT
 * Real-time opportunity scanning, analysis, and categorization
 */
import React, { useState } from 'react';
import { useOpportunitiesV2, useUserGoalsV2, useActivityLogsV2 } from '@/lib/velocityHooks';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Zap, TrendingUp, Scan, ChevronRight } from 'lucide-react';

const style = getDeptStyle('discovery');

export default function Discovery() {
  const { opportunities, isLoading, refetch } = useOpportunitiesV2({ status: 'new' });
  const { goals } = useUserGoalsV2();
  const { logs } = useActivityLogsV2(20);
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = async () => {
    setIsScanning(true);
    try {
      await base44.functions.invoke('scanOpportunities', { action: 'scan', max_results: 20 });
      refetch();
    } finally {
      setIsScanning(false);
    }
  };

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
              <p className="text-xs text-slate-400">Scan · Analyze · Classify Opportunities</p>
            </div>
          </div>
          <Button
            onClick={handleScan}
            disabled={isScanning}
            className="btn-cosmic gap-2"
          >
            <Scan className="w-4 h-4" />
            {isScanning ? 'Scanning...' : 'Scan Now'}
          </Button>
        </div>

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
      </div>
    </div>
  );
}