/**
 * DEPARTMENT 1: Discovery & Intelligence
 * Finds opportunities, analyzes markets, scans for profit signals.
 * Communicates with: Execution (sends tasks), Finance (estimates value),
 * Control (reads identity requirements), Command Center (shows summary).
 */
import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDepartmentSync } from '@/hooks/useDepartmentSync';
import { platformComm, PLATFORM_EVENTS } from '@/services/platformCrossComm';
import { Telescope, Zap, Target, Clock, TrendingUp, Search, Filter, RefreshCw, Send, BarChart2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import OpportunityCard from '@/components/dashboard/OpportunityCard';
import OpportunityDetail from '@/components/opportunity/OpportunityDetail';
import RealTimeAlertSystem from '@/components/scanning/RealTimeAlertSystem';
import OpportunityAnalysisPanel from '@/components/scanning/OpportunityAnalysisPanel';
import RealJobScanPanel from '@/components/discovery/RealJobScanPanel';
import GlobalOpportunityDiscovery from '@/components/discovery/GlobalOpportunityDiscovery';
import WorkflowAutomationControl from '@/components/automation/WorkflowAutomationControl';

const STATUS_COLORS = {
  new: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  reviewing: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  queued: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  executing: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  completed: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  expired: 'bg-slate-600/20 text-slate-400 border-slate-600/30',
  dismissed: 'bg-slate-700/20 text-slate-500 border-slate-700/30',
};

const CATEGORY_FILTERS = ['all', 'freelance', 'arbitrage', 'grant', 'contest', 'giveaway', 'resale', 'service'];

export default function Discovery() {
  const { opportunities, activeOpps, identities, DeptBus, DEPT_EVENTS } = useDepartmentSync();
  const queryClient = useQueryClient();
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [filter, setFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [scanning, setScanning] = useState(false);
  const [platformStats, setPlatformStats] = useState(null);

  // Listen to cross-platform events
  useEffect(() => {
    const unsub1 = platformComm.subscribe(PLATFORM_EVENTS.OPPORTUNITY_FOUND, () => {
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    });
    const unsub2 = platformComm.subscribe(PLATFORM_EVENTS.SCAN_COMPLETED, (data) => {
      setPlatformStats(data);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    });
    
    return () => {
      unsub1();
      unsub2();
    };
  }, [queryClient]);

  const filtered = (Array.isArray(opportunities) ? opportunities : []).filter(o => {
    if (!o || !o.id) return false;
    const catOk = filter === 'all' || o?.category === filter;
    const statOk = statusFilter === 'all' || (statusFilter === 'active' ? ['new', 'queued', 'reviewing', 'executing'].includes(o?.status) : o?.status === statusFilter);
    return catOk && statOk;
  });

  const safeOpps = Array.isArray(opportunities) ? opportunities : [];
  const stats = {
    total: safeOpps.length,
    active: Array.isArray(activeOpps) ? activeOpps.length : 0,
    completed: safeOpps.filter(o => o?.status === 'completed').length,
    queued: safeOpps.filter(o => o?.status === 'queued').length,
  };

  const handleSendToExecution = async (opp) => {
    if (!opp?.id) return;
    const identity = Array.isArray(identities) ? (identities.find(i => i?.is_active) || identities[0]) : null;
    try {
      const task = await base44.entities.TaskExecutionQueue.create({
        opportunity_id: opp.id,
        url: opp?.url || '',
        opportunity_type: opp?.opportunity_type || 'other',
        platform: opp?.platform || 'unknown',
        identity_id: identity?.id || '',
        identity_name: identity?.name || '',
        status: 'queued',
        priority: typeof opp?.overall_score === 'number' ? opp.overall_score : 50,
        estimated_value: typeof opp?.profit_estimate_high === 'number' ? opp.profit_estimate_high : 0,
        queue_timestamp: new Date().toISOString(),
      });
      await base44.entities.Opportunity.update(opp.id, { status: 'queued' }).catch(() => {});
      // Emit cross-platform event
      await platformComm.notifyQueueing(opp, identity);
      DeptBus.emit(DEPT_EVENTS.TASK_QUEUED, { opportunity: opp, identity, task_id: task?.id });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
      queryClient.invalidateQueries({ queryKey: ['taskQueue'] });
    } catch (err) {
      console.error('Failed to send to execution:', err.message);
    }
  };

  const handleDismiss = async (opp) => {
    await base44.entities.Opportunity.update(opp.id, { status: 'dismissed' });
    queryClient.invalidateQueries({ queryKey: ['opportunities'] });
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {selectedOpp && <OpportunityDetail opportunity={selectedOpp} onClose={() => setSelectedOpp(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
            <Telescope className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Discovery & Intelligence</h1>
            <p className="text-xs text-slate-500">Market scanning · Opportunity analysis · Task routing</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button size="sm"
             onClick={async () => {
               setScanning(true);
               try {
                 await platformComm.emit(PLATFORM_EVENTS.SCAN_STARTED, { source: 'discovery_ui' });
                 const result = await base44.functions.invoke('unifiedOrchestrator', { action: 'scan_opportunities' });
                 await platformComm.emit(PLATFORM_EVENTS.SCAN_COMPLETED, { 
                   total_found: result?.data?.grand_total_saved || 0,
                   sources: result?.data?.sources || []
                 });
                 queryClient.invalidateQueries({ queryKey: ['opportunities'] });
               } catch (err) {
                 console.error('Scan failed:', err.message);
               } finally {
                 setScanning(false);
               }
             }}
             disabled={scanning}
             className="bg-amber-600/80 hover:bg-amber-500 text-white text-xs h-8 gap-1.5">
             <Radio className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
             {scanning ? 'Scanning Markets...' : 'Scan All Markets'}
           </Button>
         </div>
      </div>

      {/* Stats Row with Cross-Platform Data */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Found', value: stats.total, icon: Target, color: 'text-amber-400' },
          { label: 'Active Pipeline', value: stats.active, icon: TrendingUp, color: 'text-blue-400' },
          { label: 'In Queue', value: stats.queued, icon: Clock, color: 'text-purple-400' },
          { label: 'Completed', value: stats.completed, icon: BarChart2, color: 'text-emerald-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-3.5 h-3.5 ${color}`} />
              <span className="text-xs text-slate-500">{label}</span>
            </div>
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            {platformStats && label === 'Total Found' && (
              <p className="text-[10px] text-slate-600 mt-1">Last scan: +{platformStats.total_found}</p>
            )}
          </div>
        ))}
      </div>

      {/* Real-Time Alerts */}
      <div className="mb-5">
        <RealTimeAlertSystem />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1">
          {['active', 'all', 'completed', 'failed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                statusFilter === s ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>{s}</button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-lg p-1 flex-wrap">
          {CATEGORY_FILTERS.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors capitalize ${
                filter === c ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}>{c}</button>
          ))}
        </div>
      </div>

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
        {filtered.slice(0, 30).map(opp => (
          <div key={opp.id} className="relative group">
            <OpportunityCard opportunity={opp} onClick={() => setSelectedOpp(opp)} />
            {['new', 'reviewing'].includes(opp.status) && (
              <div className="absolute bottom-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={(e) => { e.stopPropagation(); handleSendToExecution(opp); }}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs rounded-lg transition-colors">
                  <Send className="w-3 h-3" /> Execute
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDismiss(opp); }}
                  className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded-lg transition-colors">
                  Dismiss
                </button>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="col-span-3 bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center">
            <Telescope className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500 mb-1">No opportunities match your filters.</p>
            <Link to="/Chat">
              <Button size="sm" className="mt-3 bg-amber-600 hover:bg-amber-500 text-white text-xs gap-1.5">
                <Zap className="w-3.5 h-3.5" /> Ask AI to scan
              </Button>
            </Link>
          </div>
        )}
      </div>

      {/* Real Job Scan Panel */}
      <div className="mb-5">
        <RealJobScanPanel onComplete={() => {
          queryClient.invalidateQueries({ queryKey: ['opportunities'] });
        }} />
      </div>

      {/* Global Opportunity Discovery */}
      <div className="mb-5">
        <GlobalOpportunityDiscovery />
      </div>

      {/* Workflow Automation Control */}
      <div className="mb-5">
        <WorkflowAutomationControl />
      </div>

      {/* Deep Analysis Panel */}
      <OpportunityAnalysisPanel />
    </div>
  );
}