import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';

const SEVERITY_STYLES = {
  info: 'bg-blue-500/20 text-blue-400',
  success: 'bg-emerald-500/20 text-emerald-400',
  warning: 'bg-amber-500/20 text-amber-400',
  critical: 'bg-red-500/20 text-red-400',
};

const DOT_COLORS = {
  info: 'bg-blue-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  critical: 'bg-red-500',
};

export default function AdminActivityLog() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin-activity'],
    queryFn: async () => {
      const res = await base44.functions.invoke('adminService', { action: 'list_activity' });
      return res.data;
    },
    refetchInterval: 60000,
  });

  const logs = data?.logs || [];

  const filtered = logs.filter(log => {
    const matchSearch = !search || log.message?.toLowerCase().includes(search.toLowerCase());
    const matchSeverity = severityFilter === 'all' || log.severity === severityFilter;
    return matchSearch && matchSeverity;
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-4 border-slate-700 border-t-violet-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Summary Counts */}
      <div className="grid grid-cols-4 gap-3">
        {['info','success','warning','critical'].map(sev => (
          <Card key={sev} className="bg-slate-900 border-slate-800 cursor-pointer hover:border-slate-600 transition-colors" onClick={() => setSeverityFilter(severityFilter === sev ? 'all' : sev)}>
            <CardContent className="p-3 text-center">
              <p className={`text-xl font-bold ${sev === 'info' ? 'text-blue-400' : sev === 'success' ? 'text-emerald-400' : sev === 'warning' ? 'text-amber-400' : 'text-red-400'}`}>
                {logs.filter(l => l.severity === sev).length}
              </p>
              <p className="text-xs text-slate-500 capitalize">{sev}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..." className="pl-9 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500" />
        </div>
        {['all','info','success','warning','critical'].map(s => (
          <button key={s} onClick={() => setSeverityFilter(s)}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${severityFilter === s ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-activity'] })} disabled={isFetching}
          className="text-slate-400 hover:text-white gap-1">
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Log Entries */}
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-500 text-sm py-8">No activity logs found.</p>
          ) : filtered.map((log, i) => (
            <div key={log.id || i} className="flex items-start gap-3 py-2 border-b border-slate-800/50 last:border-0">
              <div className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${DOT_COLORS[log.severity] || 'bg-slate-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm text-slate-200">{log.message}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${SEVERITY_STYLES[log.severity] || 'bg-slate-700 text-slate-400'}`}>{log.severity}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 capitalize">{log.action_type?.replace(/_/g,' ')}</span>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{format(new Date(log.created_date), 'MMM d, yyyy HH:mm:ss')}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}