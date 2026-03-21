import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Zap, Clock, TrendingUp, Pause, Play, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function TaskQueueMonitor() {
  const queryClient = useQueryClient();
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  const { data: queueStatus = {}, isLoading, refetch } = useQuery({
    queryKey: ['taskQueueStatus'],
    queryFn: async () => {
      const res = await base44.functions.invoke('taskQueueManager', {
        action: 'get_queue_status'
      });
      return res.data;
    },
    refetchInterval: 10000
  });

  const checkConflictsMutation = useMutation({
    mutationFn: async (platform) => {
      const res = await base44.functions.invoke('taskQueueManager', {
        action: 'check_platform_conflicts',
        payload: { platform }
      });
      return res.data;
    }
  });

  const optimizeQueueMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('taskQueueManager', {
        action: 'optimize_queue',
        payload: {}
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
    }
  });

  const recalculateMutation = useMutation({
    mutationFn: async () => {
      const res = await base44.functions.invoke('taskQueueManager', {
        action: 'recalculate_priorities',
        payload: {}
      });
      return res.data;
    },
    onSuccess: () => {
      refetch();
    }
  });

  const handleCheckConflicts = async (platform) => {
    const result = await checkConflictsMutation.mutateAsync(platform);
    setSelectedPlatform({ platform, result });
  };

  const safePlatformConflicts = Array.isArray(queueStatus?.platform_conflicts) ? queueStatus.platform_conflicts : [];
  const safeQueue = Array.isArray(queueStatus?.queue) ? queueStatus.queue : [];
  const conflictsCount = safePlatformConflicts.length;
  const highPriorityCount = safeQueue.filter(t => t && typeof t?.priority === 'number' && t.priority > 75).length;

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Queued</div>
            <div className="text-lg font-bold text-blue-400">{queueStatus.total_queued || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Processing</div>
            <div className="text-lg font-bold text-emerald-400">{queueStatus.total_processing || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Completed</div>
            <div className="text-lg font-bold text-slate-400">{queueStatus.total_completed || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800">
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">High Priority</div>
            <div className="text-lg font-bold text-amber-400">{highPriorityCount}</div>
          </CardContent>
        </Card>

        <Card className={`border-slate-800 ${conflictsCount > 0 ? 'bg-red-900/20' : 'bg-slate-900/80'}`}>
          <CardContent className="p-3">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Conflicts</div>
            <div className={`text-lg font-bold ${conflictsCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
              {conflictsCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conflict Alerts */}
      {conflictsCount > 0 && (
        <Card className="bg-red-900/20 border-red-800/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Platform Conflicts Detected
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-red-300 space-y-2">
            {safePlatformConflicts.map((conflict, i) => (
              conflict && <div key={i} className="flex items-center justify-between p-2 bg-slate-900/50 rounded">
                <div>
                  <strong>{conflict?.platform || 'unknown'}</strong>: {typeof conflict?.count === 'number' ? conflict.count : 0} overlapping tasks
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCheckConflicts(conflict.platform)}
                  className="h-7 text-xs border-red-700 text-red-400 hover:text-red-300"
                >
                  Details
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Platform Breakdown */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              By Platform
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="h-7 text-xs border-slate-700 text-slate-400"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {Array.isArray(queueStatus?.by_platform) && queueStatus.by_platform.length ? (
            queueStatus.by_platform.map((p, i) => (
              p && <div key={i} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                <div>
                  <strong className="text-white">{p?.platform || 'unknown'}</strong>
                  <div className="text-slate-500 mt-1">
                    Queued: {typeof p?.queued === 'number' ? p.queued : 0} | Processing: {typeof p?.processing === 'number' ? p.processing : 0}
                  </div>
                </div>
                <div className="text-right">
                  {typeof p?.processing === 'number' && p.processing > 0 ? (
                    <Badge className="bg-red-900/30 text-red-300 text-[10px]">BUSY</Badge>
                  ) : (
                    <Badge className="bg-emerald-900/30 text-emerald-300 text-[10px]">READY</Badge>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-slate-500 py-3">No active platforms</div>
          )}
        </CardContent>
      </Card>

      {/* Queue Optimization Controls */}
      <Card className="bg-slate-900/80 border-slate-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="w-4 h-4 text-slate-400" />
            Priority Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Button
            onClick={() => recalculateMutation.mutate()}
            disabled={recalculateMutation.isPending}
            className="w-full bg-slate-700 hover:bg-slate-600 text-white text-xs h-8"
          >
            {recalculateMutation.isPending ? 'Recalculating...' : 'Recalculate Priorities'}
          </Button>
          <Button
            onClick={() => optimizeQueueMutation.mutate()}
            disabled={optimizeQueueMutation.isPending}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8"
          >
            {optimizeQueueMutation.isPending ? 'Optimizing...' : 'Optimize Queue (Pause Low-Priority)'}
          </Button>
          <p className="text-[10px] text-slate-500 mt-2">
            💡 Optimization pauses tasks with priority &lt; 35 if urgent tasks exist
          </p>
        </CardContent>
      </Card>

      {/* Top Tasks in Queue */}
      {safeQueue.length > 0 && (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-slate-400" />
              Top Queued Tasks
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {safeQueue.slice(0, 5).map((task, i) => (
              task && task.id && <div key={task.id} className="flex items-center justify-between p-2 bg-slate-800/50 rounded">
                <div>
                  <div className="font-mono text-slate-300">{task?.platform || 'unknown'}</div>
                  <div className="text-slate-500 text-[9px] mt-0.5">
                    {task?.opportunity_type || 'task'} • Est: ${typeof task?.estimated_value === 'number' ? task.estimated_value.toFixed(0) : 0}
                  </div>
                </div>
                <div className="text-right">
                  <Badge 
                    className={`text-[10px] ${
                      typeof task?.priority === 'number' && task.priority > 75 ? 'bg-red-900/30 text-red-300' :
                      typeof task?.priority === 'number' && task.priority > 50 ? 'bg-amber-900/30 text-amber-300' :
                      'bg-blue-900/30 text-blue-300'
                    }`}
                  >
                    {typeof task?.priority === 'number' ? task.priority : 50}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Platform Details Modal */}
      {selectedPlatform && (
        <Card className="bg-slate-900/80 border-slate-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              {selectedPlatform.platform} Details
              <button onClick={() => setSelectedPlatform(null)} className="text-slate-400 hover:text-white text-lg">
                ✕
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {selectedPlatform?.result?.is_conflict ? (
              <div className="p-3 bg-red-900/20 border border-red-800/50 rounded text-red-300">
                <strong>⚠️ {typeof selectedPlatform.result?.executing_count === 'number' ? selectedPlatform.result.executing_count : 0} task(s) executing simultaneously!</strong>
                {Array.isArray(selectedPlatform.result?.executing_tasks) && selectedPlatform.result.executing_tasks.map((t, i) => (
                  t && <div key={i} className="text-[10px] mt-1 font-mono text-slate-300">
                    Task {t?.id ? t.id.slice(0, 8) : 'unknown'}... ({t?.status || 'unknown'}) started at {t?.started_at ? new Date(t.started_at).toLocaleTimeString() : 'N/A'}
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-emerald-900/20 border border-emerald-800/50 rounded text-emerald-300">
                ✓ No conflicts detected
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}