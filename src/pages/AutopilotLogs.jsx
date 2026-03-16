import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { FileText, Clock, CheckCircle, AlertCircle, Filter, Download } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';

export default function AutopilotLogs() {
  const [filter, setFilter] = useState('all');

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['autopilotExecutionLogs', filter],
    queryFn: async () => {
      if (filter === 'all') {
        return await base44.entities.AIWorkLog.list('-created_date', 100);
      } else {
        return await base44.entities.AIWorkLog.filter({
          status: filter
        }, '-created_date', 100);
      }
    },
    initialData: [],
  });

  const { data: taskQueue = [] } = useQuery({
    queryKey: ['executionQueue'],
    queryFn: () => base44.entities.TaskExecutionQueue.list('-created_date', 50),
    initialData: [],
  });

  const statusIcon = {
    sent: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    completed: <CheckCircle className="w-4 h-4 text-emerald-400" />,
    failed: <AlertCircle className="w-4 h-4 text-red-400" />,
    pending: <Clock className="w-4 h-4 text-amber-400" />,
  };

  const logTypes = {
    proposal_submitted: '📝 Proposal',
    task_decision: '🎯 Task Decision',
    email_sent: '✉️ Email Sent',
    payment_collected: '💰 Payment',
    job_completed: '✅ Job Completed',
  };

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-400" />
            Autopilot Execution Logs
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Complete history of all automated tasks and executions</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="border-slate-700 text-slate-400 text-xs h-8"
        >
          <Download className="w-3.5 h-3.5 mr-1.5" />
          Export
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Total Executions</div>
            <div className="text-lg font-bold text-blue-400">{logs.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Successful</div>
            <div className="text-lg font-bold text-emerald-400">{logs.filter(l => l.status === 'completed').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Failed</div>
            <div className="text-lg font-bold text-red-400">{logs.filter(l => l.status === 'failed').length}</div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">In Queue</div>
            <div className="text-lg font-bold text-amber-400">{taskQueue.filter(t => t.status === 'queued').length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {['all', 'completed', 'failed', 'pending'].map(f => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
            className="text-xs h-8 whitespace-nowrap capitalize"
          >
            {f === 'all' ? 'All Logs' : f}
          </Button>
        ))}
      </div>

      {/* Logs Table */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Execution History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-slate-500">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="py-8 text-center text-slate-500">No logs found</div>
          ) : (
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div key={log.id || i} className="p-3 bg-slate-800/50 rounded-lg hover:bg-slate-800/70 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="pt-0.5">
                        {statusIcon[log.status] || statusIcon.pending}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-mono text-sm text-slate-300 truncate">
                          {logTypes[log.log_type] || log.log_type}
                        </div>
                        <div className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {log.subject || log.content_preview || log.ai_decision_context}
                        </div>
                        {log.recipient && (
                          <div className="text-[10px] text-slate-600 mt-1">
                            To: {log.recipient}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-slate-500">
                        {format(new Date(log.created_date), 'HH:mm')}
                      </div>
                      <div className="text-[10px] text-slate-600">
                        {format(new Date(log.created_date), 'MMM d')}
                      </div>
                      {log.revenue_associated > 0 && (
                        <div className="text-xs font-bold text-emerald-400 mt-1">
                          ${log.revenue_associated.toFixed(2)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Execution Queue Status */}
      {taskQueue.length > 0 && (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Current Execution Queue</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {taskQueue.slice(0, 10).map((task, i) => (
              <div key={task.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                <div>
                  <div className="text-slate-300 font-mono">{task.opportunity_type}</div>
                  <div className="text-slate-600">{task.platform} • Status: {task.status}</div>
                </div>
                <div className="text-right">
                  <div className="text-slate-400">${task.estimated_value?.toFixed(0) || 0}</div>
                  <div className={`text-[10px] font-bold ${
                    task.priority > 75 ? 'text-red-400' :
                    task.priority > 50 ? 'text-amber-400' :
                    'text-blue-400'
                  }`}>
                    P{task.priority}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}