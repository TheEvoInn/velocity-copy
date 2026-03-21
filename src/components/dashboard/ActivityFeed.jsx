import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Zap, Search, Target, Bell, User, Settings, Wallet } from 'lucide-react';

const actionIcons = {
  scan: Search,
  opportunity_found: Target,
  strategy_generated: Zap,
  alert: Bell,
  user_action: User,
  system: Settings,
  wallet_update: Wallet,
};

const severityColors = {
  info: 'text-slate-400',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
};

const severityBg = {
  info: 'bg-slate-500/10 border-slate-500/20',
  success: 'bg-emerald-500/10 border-emerald-500/20',
  warning: 'bg-amber-500/10 border-amber-500/20',
  critical: 'bg-red-500/10 border-red-500/20',
};

export default function ActivityFeed({ logs: propLogs }) {
  // Self-fetch live activity if no logs passed as props
  const { data: fetchedLogs = [] } = useQuery({
    queryKey: ['activityFeed_live'],
    queryFn: async () => {
      try {
        return await base44.entities.ActivityLog.list('-created_date', 30);
      } catch (err) {
        console.error('Failed to fetch activity logs:', err);
        return [];
      }
    },
    refetchInterval: 12000,
    enabled: !propLogs, // only fetch if not provided by parent
  });

  const logs = propLogs ?? fetchedLogs;
  const safeLogs = Array.isArray(logs) ? logs : [];

   if (safeLogs.length === 0) {
    return (
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Activity Feed
        </h3>
        <div className="text-center py-8">
          <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center mx-auto mb-3">
            <Search className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-xs text-slate-500">No activity yet. Start a scan to begin.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-6">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        Activity Feed
        <span className="ml-auto text-[10px] text-slate-600">{safeLogs.length} entries</span>
      </h3>
      <div className="space-y-3 max-h-80 overflow-y-auto">
         {safeLogs.slice(0, 30).map((log) => {
           const Icon = actionIcons[log.action_type] || Settings;
           const sColor = severityColors[log.severity] || severityColors.info;
           const sBg = severityBg[log.severity] || severityBg.info;
           return (
             <div key={log.id} className="flex items-start gap-3">
               <div className={`p-1.5 rounded-lg ${sBg} border mt-0.5 shrink-0`}>
                 <Icon className={`w-3 h-3 ${sColor}`} />
               </div>
               <div className="min-w-0 flex-1">
                 <p className="text-xs text-slate-300 leading-relaxed">{log.message}</p>
                 <p className="text-[10px] text-slate-600 mt-0.5">
                   {log.created_date ? format(new Date(log.created_date), 'MMM d, h:mm a') : ''}
                 </p>
               </div>
             </div>
           );
         })}
      </div>
    </div>
  );
}