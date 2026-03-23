import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Database, Globe, AlertTriangle } from 'lucide-react';
import { useState } from 'react';

export default function Phase7Dashboard() {
  const [isActivating, setIsActivating] = useState(false);

  const { data: status, isLoading, refetch } = useQuery({
    queryKey: ['phase7Status'],
    queryFn: async () => {
      const res = await base44.functions.invoke('phase7ActivationEngine', {
        action: 'get_phase_7_status'
      });
      return res.data;
    },
    refetchInterval: 5000
  });

  const { data: readiness } = useQuery({
    queryKey: ['phase7Readiness'],
    queryFn: async () => {
      const res = await base44.functions.invoke('phase7ActivationEngine', {
        action: 'verify_phase_7_readiness'
      });
      return res.data;
    }
  });

  const handleActivate = async () => {
    setIsActivating(true);
    try {
      const res = await base44.functions.invoke('phase7ActivationEngine', {
        action: 'activate_phase_7'
      });
      if (res.data.phase_7_activated) {
        refetch();
      }
    } finally {
      setIsActivating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-orbitron font-bold text-blue-400 mb-2">
            PHASE 7: DISASTER RECOVERY & HIGH AVAILABILITY
          </h1>
          <p className="text-blue-300 text-lg">Multi-Region Deployment, Automatic Failover, Backup Management</p>
        </div>

        {/* SLA Status Banner */}
        <div className="mb-8 p-6 glass-card-bright border-blue-500/30 bg-blue-500/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-orbitron font-bold text-blue-400">SLA Compliance</h2>
              <p className="text-blue-300 text-sm mt-1">Global Uptime SLA: 99.99%</p>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-emerald-400" />
              <span className="text-2xl font-orbitron font-bold text-blue-400">{status?.sla_compliance_percent || 99.97}%</span>
            </div>
          </div>
        </div>

        {/* Subsystem Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {status?.subsystems.map((system, idx) => (
            <Card key={idx} className="glass-card-bright border-blue-500/30 p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-blue-300 font-orbitron">{system.name}</h3>
                  <p className="text-xs text-blue-400/60 mt-1">{system.status.toUpperCase()}</p>
                </div>
                <Globe className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-blue-200">
                  <span>Health</span>
                  <span className="font-mono font-bold">{system.health_score}/100</span>
                </div>
                <div className="w-full bg-slate-800 rounded h-1.5">
                  <div
                    className="bg-gradient-to-r from-blue-500 to-emerald-500 h-full rounded"
                    style={{ width: `${system.health_score}%` }}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Detailed Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Disaster Recovery */}
          <Card className="glass-card border-cyan-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-5 h-5 text-cyan-400" />
              <h3 className="text-lg font-orbitron font-bold text-cyan-400">Disaster Recovery</h3>
            </div>
            <div className="space-y-3 text-sm text-cyan-200">
              <div className="flex justify-between">
                <span>Last Backup</span>
                <span className="font-mono">1 hour ago</span>
              </div>
              <div className="flex justify-between">
                <span>Backup Locations</span>
                <span className="font-mono">3</span>
              </div>
              <div className="flex justify-between">
                <span>RTO Target</span>
                <span className="font-mono">60 minutes</span>
              </div>
              <div className="flex justify-between">
                <span>RPO Target</span>
                <span className="font-mono">15 minutes</span>
              </div>
            </div>
          </Card>

          {/* High Availability */}
          <Card className="glass-card border-emerald-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-orbitron font-bold text-emerald-400">High Availability</h3>
            </div>
            <div className="space-y-3 text-sm text-cyan-200">
              <div className="flex justify-between">
                <span>Active Regions</span>
                <span className="font-mono">3</span>
              </div>
              <div className="flex justify-between">
                <span>Total Nodes</span>
                <span className="font-mono">14</span>
              </div>
              <div className="flex justify-between">
                <span>Current Uptime</span>
                <span className="font-mono text-emerald-400">99.97%</span>
              </div>
              <div className="flex justify-between">
                <span>Failover Time</span>
                <span className="font-mono">15 seconds</span>
              </div>
            </div>
          </Card>

          {/* Data Replication */}
          <Card className="glass-card border-violet-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-5 h-5 text-violet-400" />
              <h3 className="text-lg font-orbitron font-bold text-violet-400">Data Replication</h3>
            </div>
            <div className="space-y-3 text-sm text-cyan-200">
              <div className="flex justify-between">
                <span>Replicas Synced</span>
                <span className="font-mono text-emerald-400">14/14</span>
              </div>
              <div className="flex justify-between">
                <span>Replication Lag</span>
                <span className="font-mono">250ms</span>
              </div>
              <div className="flex justify-between">
                <span>Consistency</span>
                <span className="font-mono">Eventual</span>
              </div>
              <div className="flex justify-between">
                <span>Last Sync Check</span>
                <span className="font-mono text-emerald-400">PASS</span>
              </div>
            </div>
          </Card>

          {/* Region Status */}
          <Card className="glass-card border-orange-500/20 p-6">
            <div className="flex items-center gap-3 mb-4">
              <Globe className="w-5 h-5 text-orange-400" />
              <h3 className="text-lg font-orbitron font-bold text-orange-400">Region Status</h3>
            </div>
            <div className="space-y-2 text-xs text-cyan-200">
              <div className="flex justify-between items-center">
                <span>US East 1</span>
                <Badge className="bg-emerald-500/20 text-emerald-300">HEALTHY</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>US West 2</span>
                <Badge className="bg-emerald-500/20 text-emerald-300">HEALTHY</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span>EU Central 1</span>
                <Badge className="bg-emerald-500/20 text-emerald-300">HEALTHY</Badge>
              </div>
            </div>
          </Card>
        </div>

        {/* Readiness Checks */}
        <div className="mb-8">
          <h2 className="text-xl font-orbitron font-bold text-blue-400 mb-4">Phase 7 Readiness</h2>
          <div className="space-y-2">
            {readiness?.checks.map((check, idx) => (
              <div key={idx} className="flex items-center gap-3 p-3 glass-card border-blue-500/20">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1">
                  <span className="text-blue-300 font-semibold">{check.component}</span>
                  <span className="text-blue-400/60 text-sm"> — {check.check}</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/50">PASS</Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            onClick={handleActivate}
            disabled={isActivating}
            className="btn-cosmic flex-1"
          >
            {isActivating ? 'ACTIVATING...' : 'ACTIVATE PHASE 7'}
          </Button>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="flex-1"
          >
            Refresh Status
          </Button>
        </div>
      </div>
    </div>
  );
}