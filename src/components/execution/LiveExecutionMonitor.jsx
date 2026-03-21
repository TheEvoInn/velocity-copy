import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Monitor, Play, Pause, Square, Hand, AlertCircle, Loader2, Eye, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export default function LiveExecutionMonitor() {
  const [selectedSession, setSelectedSession] = useState(null);
  const [expandedLogs, setExpandedLogs] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState(2000);

  // Get active execution sessions
  const { data: sessions = [], refetch: refetchSessions } = useQuery({
    queryKey: ['live_sessions'],
    queryFn: async () => {
      try {
        // Fetch tasks that are currently executing
        const executing = await base44.entities.TaskExecutionQueue.filter(
          { status: 'executing' },
          '-start_timestamp',
          10
        );
        return executing || [];
      } catch (err) {
        console.error('Failed to fetch sessions:', err);
        return [];
      }
    },
    refetchInterval: refreshInterval,
  });

  // Get live session data
  const { data: liveData, refetch: refetchLiveData } = useQuery({
    queryKey: ['live_session_data', selectedSession?.id],
    queryFn: async () => {
      if (!selectedSession?.id) return null;
      try {
        const res = await base44.functions.invoke('agentWorker', {
          action: 'get_live_session',
          task_id: selectedSession.id,
        });
        return res.data || null;
      } catch (err) {
        console.error('Failed to fetch live data:', err);
        return null;
      }
    },
    enabled: !!selectedSession?.id,
    refetchInterval: refreshInterval,
  });

  // Control mutations
  const pauseMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'pause_execution',
        task_id: taskId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Task paused');
      refetchSessions();
      refetchLiveData();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const resumeMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'resume_execution',
        task_id: taskId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Task resumed');
      refetchLiveData();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const stopMutation = useMutation({
    mutationFn: async (taskId) => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'stop_execution',
        task_id: taskId,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Task stopped');
      setSelectedSession(null);
      refetchSessions();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  const interventMutation = useMutation({
    mutationFn: async ({ taskId, instruction }) => {
      const res = await base44.functions.invoke('agentWorker', {
        action: 'intervene',
        task_id: taskId,
        instruction,
      });
      return res.data;
    },
    onSuccess: () => {
      toast.success('Intervention sent');
      refetchLiveData();
    },
    onError: (err) => toast.error(`Failed: ${err.message}`),
  });

  // Auto-select first session if none selected
  useEffect(() => {
    if (!selectedSession && sessions.length > 0) {
      setSelectedSession(sessions[0]);
    }
  }, [sessions, selectedSession]);

  if (sessions.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-8 text-center">
          <Monitor className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No active execution sessions</p>
        </CardContent>
      </Card>
    );
  }

  const isPaused = liveData?.status === 'paused';
  const isExecuting = liveData?.status === 'executing';

  return (
    <div className="space-y-4">
      {/* Session Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sessions.map((session) => (
          <Card
            key={session.id}
            onClick={() => setSelectedSession(session)}
            className={`p-3 cursor-pointer transition-all ${
              selectedSession?.id === session.id
                ? 'bg-blue-900/50 border-blue-600 ring-2 ring-blue-500/30'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-white truncate">{session.opportunity_type || 'Task'}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{session.platform || 'Unknown'}</p>
              </div>
              <Badge className="shrink-0 bg-blue-600 text-white text-[10px]">
                {session.status}
              </Badge>
            </div>
          </Card>
        ))}
      </div>

      {selectedSession && liveData && (
        <div className="space-y-4">
          {/* Live Screenshot Viewer */}
          <Card className="bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <CardTitle className="text-sm">Live Browser Session</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  {isExecuting && <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                  <span className="text-xs text-slate-400">
                    {isPaused ? 'Paused' : isExecuting ? 'Executing' : 'Idle'}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {liveData.screenshot_url ? (
                <div className="bg-black/40 aspect-video relative overflow-hidden">
                  <img
                    src={liveData.screenshot_url}
                    alt="Live browser session"
                    className="w-full h-full object-contain"
                  />
                  {/* Interaction Overlay */}
                  {liveData.current_interaction && (
                    <div className="absolute bottom-3 right-3 bg-black/70 border border-amber-500/50 rounded px-3 py-2 flex items-center gap-2">
                      <Hand className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-amber-300 font-mono">
                        {liveData.current_interaction.type}: {liveData.current_interaction.target}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-800 aspect-video flex items-center justify-center">
                  <div className="text-center">
                    <Eye className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-xs text-slate-500">No screenshot available</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Current Step & Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card className="bg-slate-900 border-slate-800 p-4">
              <p className="text-[10px] text-slate-500 mb-1">CURRENT STEP</p>
              <p className="text-xs font-semibold text-white truncate">
                {liveData.current_step || 'Initializing...'}
              </p>
            </Card>
            <Card className="bg-slate-900 border-slate-800 p-4">
              <p className="text-[10px] text-slate-500 mb-1">EXECUTION TIME</p>
              <p className="text-xs font-semibold text-white">
                {liveData.execution_time_seconds || 0}s
              </p>
            </Card>
            <Card className="bg-slate-900 border-slate-800 p-4">
              <p className="text-[10px] text-slate-500 mb-1">FIELDS FILLED</p>
              <p className="text-xs font-semibold text-white">
                {liveData.fields_filled || 0} / {liveData.total_fields || 0}
              </p>
            </Card>
          </div>

          {/* Real-time Execution Log */}
          <Card className="bg-slate-900 border-slate-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedLogs(!expandedLogs)}>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                  Execution Log
                </CardTitle>
                <ChevronDown className={`w-4 h-4 text-slate-500 transition-transform ${expandedLogs ? 'rotate-180' : ''}`} />
              </div>
            </CardHeader>
            {expandedLogs && (
              <CardContent className="p-0">
                <div className="bg-slate-800/30 p-3 max-h-48 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 border-t border-slate-800">
                  {liveData.execution_log && liveData.execution_log.length > 0 ? (
                    liveData.execution_log.slice(-20).map((log, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-slate-600">[{log.timestamp}]</span>
                        <span className={
                          log.status === 'completed' ? 'text-emerald-400' :
                          log.status === 'error' ? 'text-red-400' :
                          'text-blue-400'
                        }>
                          {log.step}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-500">No logs yet...</p>
                  )}
                </div>
              </CardContent>
            )}
          </Card>

          {/* Control Panel */}
          <Card className="bg-slate-900 border-slate-800 p-4">
            <div className="flex flex-wrap gap-2">
              {isExecuting ? (
                <Button
                  onClick={() => pauseMutation.mutate(selectedSession.id)}
                  disabled={pauseMutation.isPending}
                  className="bg-amber-600 hover:bg-amber-500 text-white text-xs"
                  size="sm"
                >
                  <Pause className="w-3 h-3 mr-1.5" />
                  {pauseMutation.isPending ? 'Pausing...' : 'Pause'}
                </Button>
              ) : isPaused ? (
                <Button
                  onClick={() => resumeMutation.mutate(selectedSession.id)}
                  disabled={resumeMutation.isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs"
                  size="sm"
                >
                  <Play className="w-3 h-3 mr-1.5" />
                  {resumeMutation.isPending ? 'Resuming...' : 'Resume'}
                </Button>
              ) : null}

              <Button
                onClick={() => stopMutation.mutate(selectedSession.id)}
                disabled={stopMutation.isPending}
                className="bg-red-600 hover:bg-red-500 text-white text-xs"
                size="sm"
              >
                <Square className="w-3 h-3 mr-1.5" />
                {stopMutation.isPending ? 'Stopping...' : 'Stop'}
              </Button>

              {isPaused && (
                <Button
                  onClick={() => interventMutation.mutate({
                    taskId: selectedSession.id,
                    instruction: 'Intervention triggered by admin - please continue with next step'
                  })}
                  disabled={interventMutation.isPending}
                  className="bg-violet-600 hover:bg-violet-500 text-white text-xs ml-auto"
                  size="sm"
                >
                  <Hand className="w-3 h-3 mr-1.5" />
                  {interventMutation.isPending ? 'Intervening...' : 'Intervene'}
                </Button>
              )}
            </div>
          </Card>

          {/* Alerts */}
          {liveData.alerts && liveData.alerts.length > 0 && (
            <Card className="bg-red-950/30 border-red-500/30 p-3">
              <div className="flex gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  {liveData.alerts.map((alert, idx) => (
                    <p key={idx} className="text-xs text-red-300">{alert}</p>
                  ))}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}