import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Activity, Search, Target, Zap, Bell, User, Settings, Wallet } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const actionIcons = {
  scan: Search, opportunity_found: Target, strategy_generated: Zap,
  alert: Bell, user_action: User, system: Settings, wallet_update: Wallet
};

const severityColors = {
  info: { text: "text-slate-400", bg: "bg-slate-500/10", border: "border-slate-500/20" },
  success: { text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
  warning: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" },
  critical: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20" }
};

export default function ActivityPage() {
  const { data: logs = [] } = useQuery({
    queryKey: ['allLogs'],
    queryFn: () => base44.entities.ActivityLog.list('-created_date', 200),
    initialData: [],
  });

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Activity className="w-5 h-5 text-violet-400" />
          Activity Log
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">{logs.length} events recorded</p>
      </div>

      <div className="space-y-2">
        {logs.map(log => {
          const Icon = actionIcons[log.action_type] || Settings;
          const colors = severityColors[log.severity] || severityColors.info;
          
          return (
            <div key={log.id} className="flex items-start gap-3 p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-colors">
              <div className={`p-2 rounded-lg ${colors.bg} ${colors.border} border mt-0.5 shrink-0`}>
                <Icon className={`w-4 h-4 ${colors.text}`} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline" className="text-[10px] border-slate-700 text-slate-500">
                    {log.action_type?.replace(/_/g, ' ')}
                  </Badge>
                  <Badge variant="outline" className={`text-[10px] ${colors.border} ${colors.text} border`}>
                    {log.severity}
                  </Badge>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed">{log.message}</p>
                <p className="text-[10px] text-slate-600 mt-1">
                  {log.created_date && format(new Date(log.created_date), 'MMM d, yyyy h:mm:ss a')}
                </p>
              </div>
            </div>
          );
        })}

        {logs.length === 0 && (
          <div className="text-center py-16">
            <Activity className="w-10 h-10 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No activity logged yet.</p>
            <p className="text-xs text-slate-600 mt-1">Activity will appear here as you use the system.</p>
          </div>
        )}
      </div>
    </div>
  );
}