import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertCircle,
  CheckCircle,
  Zap,
  TrendingUp,
  Search,
  Filter,
  Download,
  RefreshCw,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';

const severityColors = {
  success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  error: 'bg-red-500/10 text-red-400 border-red-500/20',
  info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
};

const actionIcons = {
  scan: <Search className="w-4 h-4" />,
  execution: <Zap className="w-4 h-4" />,
  workflow: <TrendingUp className="w-4 h-4" />,
  webhook: <AlertCircle className="w-4 h-4" />,
  system: <Zap className="w-4 h-4" />
};

export default function CentralEventLog() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [filterAction, setFilterAction] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fetch all activity logs - real-time with 2s refresh
  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['centralEventLog'],
    queryFn: async () => {
      const currentUser = await base44.auth.me();
      if (!currentUser?.email) return [];
      
      try {
        return await base44.entities.ActivityLog.filter(
          { created_by: currentUser.email },
          '-created_date',
          200
        ).catch(() => []);
      } catch {
        return [];
      }
    },
    refetchInterval: autoRefresh ? 2000 : false,
    staleTime: 0
  });

  const logsArray = Array.isArray(logs) ? logs : [];

  // Filter logs
  const filteredLogs = logsArray.filter(log => {
    const matchSearch = 
      (log.message || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.action_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchSeverity = filterSeverity === 'all' || log.severity === filterSeverity;
    const matchAction = filterAction === 'all' || log.action_type === filterAction;

    return matchSearch && matchSeverity && matchAction;
  });

  // Statistics
  const stats = {
    total: logsArray.length,
    success: logsArray.filter(l => l.severity === 'success').length,
    errors: logsArray.filter(l => l.severity === 'error').length,
    warnings: logsArray.filter(l => l.severity === 'warning').length
  };

  const successRate = logsArray.length > 0 
    ? ((stats.success / logsArray.length) * 100).toFixed(1)
    : 0;

  // Export logs
  const handleExport = () => {
    const csv = [
      ['Timestamp', 'Action', 'Severity', 'Message'],
      ...filteredLogs.map(l => [
        new Date(l.created_date).toISOString(),
        l.action_type,
        l.severity,
        l.message
      ])
    ]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-log-${new Date().toISOString()}.csv`;
    a.click();
    toast.success('Event log exported');
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Central Event Log</h1>
        <p className="text-slate-400">Real-time system activity across all departments and workflows</p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-900 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-slate-400">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-white">{stats.total}</div>
            <p className="text-xs text-slate-500 mt-2">Last 24 hours</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-emerald-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-emerald-400">Successful</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-emerald-400">{stats.success}</div>
            <p className="text-xs text-slate-500 mt-2">{successRate}% success rate</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-amber-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-amber-400">Warnings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-amber-400">{stats.warnings}</div>
            <p className="text-xs text-slate-500 mt-2">Requires attention</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 border-red-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-red-400">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-400">{stats.errors}</div>
            <p className="text-xs text-slate-500 mt-2">Critical issues</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex-1 min-w-64">
          <Input
            placeholder="Search events..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-800 border-slate-700"
          />
        </div>

        <select
          value={filterSeverity}
          onChange={(e) => setFilterSeverity(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded text-sm"
        >
          <option value="all">All Severity</option>
          <option value="success">Success</option>
          <option value="warning">Warning</option>
          <option value="error">Error</option>
          <option value="info">Info</option>
        </select>

        <select
          value={filterAction}
          onChange={(e) => setFilterAction(e.target.value)}
          className="px-3 py-2 bg-slate-800 border border-slate-700 text-white rounded text-sm"
        >
          <option value="all">All Actions</option>
          <option value="scan">Scan</option>
          <option value="execution">Execution</option>
          <option value="workflow">Workflow</option>
          <option value="webhook">Webhook</option>
          <option value="system">System</option>
        </select>

        <Button
          variant={autoRefresh ? 'default' : 'outline'}
          size="sm"
          onClick={() => setAutoRefresh(!autoRefresh)}
          className="gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          {autoRefresh ? 'Live' : 'Paused'}
        </Button>

        <Button
          onClick={refetch}
          variant="outline"
          size="sm"
          disabled={isLoading}
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>

        <Button
          onClick={handleExport}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <Download className="w-4 h-4" />
          Export
        </Button>
      </div>

      {/* Event List */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Events</CardTitle>
          <CardDescription>
            Showing {filteredLogs.length} of {logsArray.length} events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin">
                <RefreshCw className="w-6 h-6 text-slate-400" />
              </div>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              No events found matching your filters
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {filteredLogs.map((log, idx) => (
                <div
                  key={`${log.id}-${idx}`}
                  className={`p-3 rounded border ${severityColors[log.severity] || severityColors.info}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {actionIcons[log.action_type] || actionIcons.system}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate capitalize">
                            {log.action_type}
                          </p>
                          <span className="text-xs opacity-75">
                            {new Date(log.created_date).toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs mt-1 opacity-90 line-clamp-2">
                          {log.message}
                        </p>
                        {log.metadata && Object.keys(log.metadata).length > 0 && (
                          <p className="text-xs mt-1 opacity-75">
                            {Object.entries(log.metadata)
                              .slice(0, 2)
                              .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
                              .join(' • ')}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs font-semibold capitalize px-2 py-1 rounded bg-black/30 whitespace-nowrap ml-2">
                      {log.severity}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}