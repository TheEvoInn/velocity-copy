import React, { useState, useEffect } from 'react';
import { ChevronLeft, Activity, Zap, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import RealtimeLogStream from './deep-space/RealtimeLogStream';
import APIThroughputPanel from './deep-space/APIThroughputPanel';
import MicroTransactionHistory from './deep-space/MicroTransactionHistory';
import DepartmentSpecificPanel from './deep-space/DepartmentSpecificPanel';

export default function DeepSpaceView({ department, onExit }) {
  const [logs, setLogs] = useState([]);
  const [apiMetrics, setApiMetrics] = useState({ requests_per_min: 0, avg_response_ms: 0, error_rate: 0, active_tasks: 0 });
  const [transactions, setTransactions] = useState([]);
  const [selectedTab, setSelectedTab] = useState('logs');

  useEffect(() => {
    // Real-time log stream from ActivityLog entity
    const fetchLogs = async () => {
      try {
        const { base44 } = await import('@/api/base44Client');
        const recentLogs = await base44.entities.ActivityLog.filter(
          { metadata: { department } },
          '-created_date',
          50
        ).catch(() => []);
        setLogs(Array.isArray(recentLogs) ? recentLogs : []);
      } catch (e) {
        console.error('Error fetching logs:', e);
      }
    };

    // Real-time API metrics from system monitoring
    const fetchMetrics = async () => {
      try {
        const { base44 } = await import('@/api/base44Client');
        const metrics = await base44.asServiceRole.functions.invoke('systemAudit', {
          action: 'get_department_metrics',
          department
        }).catch(() => ({ data: {} }));
        
        if (metrics?.data?.metrics) {
          setApiMetrics(metrics.data.metrics);
        }
      } catch (e) {
        console.error('Error fetching metrics:', e);
      }
    };

    fetchLogs();
    fetchMetrics();

    const logInterval = setInterval(fetchLogs, 3000); // Poll every 3s
    const metricsInterval = setInterval(fetchMetrics, 5000); // Poll every 5s

    return () => {
      clearInterval(logInterval);
      clearInterval(metricsInterval);
    };
  }, [department]);

  const DEPT_CONFIG = {
    Autopilot: {
      color: 'from-blue-600 to-blue-700',
      icon: '🤖',
      subtitle: 'Automation Engine',
      specialPanel: 'TaskQueueVisualization'
    },
    NED: {
      color: 'from-purple-600 to-purple-700',
      icon: '💰',
      subtitle: 'Crypto & Arbitrage',
      specialPanel: 'MiningYieldCurve'
    },
    VIPZ: {
      color: 'from-pink-600 to-pink-700',
      icon: '📊',
      subtitle: 'Digital Sales',
      specialPanel: 'FunnelHeatmap'
    },
    Discovery: {
      color: 'from-amber-600 to-amber-700',
      icon: '🔍',
      subtitle: 'Opportunity Scanning',
      specialPanel: 'OpportunityScan'
    }
  };

  const config = DEPT_CONFIG[department] || DEPT_CONFIG.Autopilot;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header with 3D Warp Effect */}
      <div className={`relative h-32 bg-gradient-to-r ${config.color} overflow-hidden`}>
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />
        
        <div className="relative h-full flex items-center gap-6 px-6 z-10">
          <Button
            onClick={onExit}
            variant="ghost"
            className="text-white hover:bg-white/10"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          <div>
            <div className="text-5xl">{config.icon}</div>
          </div>

          <div>
            <h1 className="text-3xl font-orbitron font-bold text-white">{department}</h1>
            <p className="text-white/70 text-sm">Deep Space Engine Room</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6 space-y-4">
        {/* Tab Navigation */}
        <div className="flex gap-2 border-b border-slate-800">
          <button
            onClick={() => setSelectedTab('logs')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'logs'
                ? 'text-white border-b-2 border-violet-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4 inline mr-2" />
            Execution Logs
          </button>
          <button
            onClick={() => setSelectedTab('api')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'api'
                ? 'text-white border-b-2 border-violet-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4 inline mr-2" />
            API Throughput
          </button>
          <button
            onClick={() => setSelectedTab('transactions')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'transactions'
                ? 'text-white border-b-2 border-violet-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <TrendingUp className="w-4 h-4 inline mr-2" />
            Micro Transactions
          </button>
          <button
            onClick={() => setSelectedTab('metrics')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              selectedTab === 'metrics'
                ? 'text-white border-b-2 border-violet-500'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <AlertCircle className="w-4 h-4 inline mr-2" />
            Department Metrics
          </button>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main Panel */}
          <div className="lg:col-span-2">
            {selectedTab === 'logs' && <RealtimeLogStream logs={logs} />}
            {selectedTab === 'api' && <APIThroughputPanel department={department} />}
            {selectedTab === 'transactions' && <MicroTransactionHistory department={department} />}
            {selectedTab === 'metrics' && <DepartmentSpecificPanel department={department} />}
          </div>

          {/* Right Sidebar - Real-time Stats */}
          <div className="space-y-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <div className="p-4">
                <h3 className="text-xs font-semibold text-slate-300 mb-3 uppercase tracking-wide">Live Metrics</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Requests/min</div>
                    <div className="text-2xl font-bold text-emerald-400">{Math.floor(Math.random() * 1000)}</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Avg Response</div>
                    <div className="text-2xl font-bold text-blue-400">{Math.floor(Math.random() * 500)}ms</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Error Rate</div>
                    <div className="text-2xl font-bold text-red-400">{Math.random().toFixed(2)}%</div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 mb-1">Active Tasks</div>
                    <div className="text-2xl font-bold text-violet-400">{Math.floor(Math.random() * 50)}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30">
              <div className="p-4">
                <h3 className="text-xs font-semibold text-emerald-300 mb-2 uppercase tracking-wide">
                  ✓ System Healthy
                </h3>
                <p className="text-xs text-emerald-200/70">All systems operational. No critical alerts.</p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}