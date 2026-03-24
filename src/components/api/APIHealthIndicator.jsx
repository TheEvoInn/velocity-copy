import React from 'react';
import { CheckCircle2, AlertCircle, XCircle, Clock } from 'lucide-react';

export default function APIHealthIndicator({ api, recentMetrics }) {
  const getHealthStatus = () => {
    const score = api.execution_readiness_score || 0;
    if (score >= 75) return { status: 'healthy', icon: CheckCircle2, color: 'text-emerald-400' };
    if (score >= 50) return { status: 'degraded', icon: AlertCircle, color: 'text-amber-400' };
    return { status: 'unhealthy', icon: XCircle, color: 'text-red-400' };
  };

  const health = getHealthStatus();
  const HealthIcon = health.icon;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-3">
        <HealthIcon className={`w-5 h-5 ${health.color}`} />
        <span className="text-sm capitalize text-slate-300">
          {health.status.replace('_', ' ')}
        </span>
        <span className="text-xs text-slate-500 ml-auto">
          {api.last_verified ? `Last checked: ${new Date(api.last_verified).toLocaleDateString()}` : 'Never checked'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-slate-800/50 rounded p-2">
          <div className="text-slate-400">Success Rate</div>
          <div className="font-bold text-emerald-300 mt-1">{api.success_rate_observed?.toFixed(1) || 'N/A'}%</div>
        </div>
        <div className="bg-slate-800/50 rounded p-2">
          <div className="text-slate-400">Avg Response</div>
          <div className="font-bold text-cyan-300 mt-1">{api.average_response_time_ms?.toFixed(0) || 'N/A'}ms</div>
        </div>
      </div>

      {api.flagged_by_admin && (
        <div className="bg-red-500/10 border border-red-500/20 rounded p-2">
          <div className="text-xs text-red-300">⚠️ Admin Flag</div>
          <p className="text-[10px] text-red-200 mt-1">{api.admin_notes}</p>
        </div>
      )}

      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${
            api.execution_readiness_score >= 75 ? 'bg-emerald-500' : 
            api.execution_readiness_score >= 50 ? 'bg-amber-500' : 
            'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, api.execution_readiness_score || 0)}%` }}
        />
      </div>
    </div>
  );
}