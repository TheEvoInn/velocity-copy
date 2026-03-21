import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, GitBranch, TrendingUp, Shield, Zap, AlertCircle } from 'lucide-react';

export default function IdentityRoutingDashboard({ routingStats = {} }) {
  const stats = {
    total_routing_logs: routingStats.total_routing_logs || 0,
    successful_routes: routingStats.successful_routes || 0,
    avg_fit_score: routingStats.avg_fit_score || 0,
    policies_active: routingStats.policies_active || 0,
    identities_available: routingStats.identities_available || 0,
    kyc_required_today: routingStats.kyc_required_today || 0,
  };

  const successRate = stats.total_routing_logs > 0 
    ? Math.round((stats.successful_routes / stats.total_routing_logs) * 100) 
    : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-1">
          <GitBranch className="w-4 h-4 text-violet-400" />
          Identity Routing Dashboard
        </h2>
        <p className="text-xs text-slate-500">Monitor intelligent identity selection performance</p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {/* Average Fit Score */}
        <Card className="bg-gradient-to-br from-violet-950/40 to-slate-900/50 border-violet-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Avg Fit Score</span>
              <Zap className="w-3.5 h-3.5 text-violet-400" />
            </div>
            <div className="text-2xl font-bold text-violet-400">{stats.avg_fit_score.toFixed(0)}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {stats.avg_fit_score >= 80 ? '✓ Excellent' : stats.avg_fit_score >= 70 ? 'Good' : 'Needs work'}
            </div>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card className="bg-gradient-to-br from-emerald-950/40 to-slate-900/50 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Success Rate</span>
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400">{successRate}%</div>
            <div className="text-[10px] text-slate-500 mt-1">
              {stats.successful_routes}/{stats.total_routing_logs} successful
            </div>
          </CardContent>
        </Card>

        {/* Active Policies */}
        <Card className="bg-gradient-to-br from-blue-950/40 to-slate-900/50 border-blue-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Active Policies</span>
              <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-blue-400">{stats.policies_active}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Routing rules configured
            </div>
          </CardContent>
        </Card>

        {/* Available Identities */}
        <Card className="bg-gradient-to-br from-cyan-950/40 to-slate-900/50 border-cyan-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Identities</span>
              <GitBranch className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold text-cyan-400">{stats.identities_available}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Available for routing
            </div>
          </CardContent>
        </Card>

        {/* Routing Logs */}
        <Card className="bg-gradient-to-br from-amber-950/40 to-slate-900/50 border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Routing Logs</span>
              <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400">{stats.total_routing_logs}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Total routing decisions
            </div>
          </CardContent>
        </Card>

        {/* KYC Requirements Today */}
        <Card className="bg-gradient-to-br from-red-950/40 to-slate-900/50 border-red-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">KYC Today</span>
              <Shield className="w-3.5 h-3.5 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-red-400">{stats.kyc_required_today}</div>
            <div className="text-[10px] text-slate-500 mt-1">
              Tasks requiring legal identity
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status & Capabilities */}
      <Card className="bg-slate-900/40 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            System Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
            <span className="text-slate-400">Intelligent Routing</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
            <span className="text-slate-400">Performance Tracking</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Enabled</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
            <span className="text-slate-400">Custom Policies</span>
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
              {stats.policies_active} configured
            </Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
            <span className="text-slate-400">KYC Detection</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-slate-800/40">
            <span className="text-slate-400">Audit Logging</span>
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Complete</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Information */}
      <Card className="bg-blue-950/20 border-blue-500/30">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
            <div className="text-xs text-blue-300 space-y-1">
              <p className="font-semibold">Intelligent routing is analyzing opportunities and auto-selecting the best identity for each task.</p>
              <p>Configure custom routing policies in Identity Manager to fine-tune behavior by category or platform.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}