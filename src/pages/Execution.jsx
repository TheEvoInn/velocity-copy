/**
 * EXECUTION DEPARTMENT
 * Real-time task queue, autopilot monitoring, and completion tracking
 * Integrated with Task Reader for URL analysis and follow-up workflows
 */
import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useTasksV2, useOpportunitiesV2, useUserGoalsV2, useActivityLogsV2 } from '@/lib/velocityHooks';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Play, CheckCircle2, AlertTriangle, Clock, Workflow } from 'lucide-react';
import TaskReaderInterface from '@/components/task-reader/TaskReaderInterface';
import AnalysisWorkflowMonitor from '@/components/task-reader/AnalysisWorkflowMonitor';

const style = getDeptStyle('execution');

export default function Execution() {
  const { tasks, isLoading } = useTasksV2();
  const { opportunities } = useOpportunitiesV2({ status: 'executing' });
  const { goals } = useUserGoalsV2();
  const { logs } = useActivityLogsV2(15);
  const [activeTab, setActiveTab] = useState('queue');
  const [recentAnalysisTasks, setRecentAnalysisTasks] = useState([]);
  const [analysisStats, setAnalysisStats] = useState({});

  const stats = {
    queued: tasks.filter(t => t.status === 'queued').length,
    running: tasks.filter(t => ['processing', 'navigating', 'filling', 'submitting'].includes(t.status)).length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
    review: tasks.filter(t => t.status === 'needs_review').length,
  };

  const todayCompleted = tasks.filter(t => t.status === 'completed' && new Date(t.completion_timestamp || 0).toDateString() === new Date().toDateString()).length;

  // Fetch analysis tasks for Task Reader
  useEffect(() => {
    const fetchAnalysisTasks = async () => {
      try {
        const aiTasks = await base44.entities.AITask.filter({}, '-created_at', 10);
        setRecentAnalysisTasks(aiTasks || []);
        setAnalysisStats({
          analyzing: (aiTasks || []).filter(t => t.status === 'analyzing').length,
          queued: (aiTasks || []).filter(t => t.status === 'queued').length,
          completed: (aiTasks || []).filter(t => t.status === 'completed').length,
          failed: (aiTasks || []).filter(t => t.status === 'failed').length
        });
      } catch (error) {
        console.error('Error fetching analysis tasks:', error);
      }
    };
    fetchAnalysisTasks();
  }, []);

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(59,130,246,0.1)`, border: `1px solid ${style.color}` }}>
              <span className="text-2xl">{style.icon}</span>
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">EXECUTION</h1>
              <p className="text-xs text-slate-400">Task Queue · Autopilot · Progress Tracking · URL Analysis</p>
            </div>
          </div>
          <Link to="/AutoPilot">
            <Button className="btn-cosmic gap-2">
              <Zap className="w-4 h-4" />
              Autopilot Control
            </Button>
          </Link>
        </div>

        {/* Tabs Navigation */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-6">
          <TabsList className="glass-card border-slate-700">
            <TabsTrigger value="queue" className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Task Queue
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-2">
              <Workflow className="w-4 h-4" />
              Task Reader ({recentAnalysisTasks.length})
            </TabsTrigger>
          </TabsList>

          {/* Task Queue Tab */}
          <TabsContent value="queue" className="space-y-4">
            {/* Status Grid */}
            <div className="grid grid-cols-5 gap-2">
              <Card className="glass-card p-3">
                <div className="text-xs text-slate-400 mb-1">Queued</div>
                <div className="text-xl font-bold text-cyan-400">{stats.queued}</div>
              </Card>
              <Card className="glass-card p-3">
                <div className="text-xs text-slate-400 mb-1">Running</div>
                <div className="text-xl font-bold text-emerald-400">{stats.running}</div>
              </Card>
              <Card className="glass-card p-3">
                <div className="text-xs text-slate-400 mb-1">Today ✓</div>
                <div className="text-xl font-bold text-amber-400">{todayCompleted}</div>
              </Card>
              <Card className="glass-card p-3">
                <div className="text-xs text-slate-400 mb-1">Failed</div>
                <div className="text-xl font-bold text-red-400">{stats.failed}</div>
              </Card>
              <Card className="glass-card p-3">
                <div className="text-xs text-slate-400 mb-1">Review</div>
                <div className="text-xl font-bold text-amber-400">{stats.review}</div>
              </Card>
            </div>

            {/* Active Tasks */}
            <Card className="glass-card p-4">
              <h3 className="font-orbitron text-sm font-bold text-white mb-4 flex items-center gap-2">
                <Play className="w-4 h-4 text-blue-400" />
                Active Tasks ({stats.running})
              </h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {tasks.filter(t => ['processing', 'navigating', 'filling', 'submitting'].includes(t.status)).length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-4">No active tasks</div>
                ) : (
                  tasks
                    .filter(t => ['processing', 'navigating', 'filling', 'submitting'].includes(t.status))
                    .slice(0, 8)
                    .map(task => (
                      <div key={task.id} className="p-3 bg-slate-800/40 rounded-lg border border-blue-500/30">
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-white truncate">{task.opportunity_type}</div>
                            <div className="text-xs text-slate-400 truncate">{task.url}</div>
                            <div className="text-xs text-blue-400 mt-1 capitalize">{task.status.replace('_', ' ')}</div>
                          </div>
                          <div className="ml-3">
                            <div className="text-xs font-bold text-emerald-400">${task.estimated_value || 0}</div>
                          </div>
                        </div>
                      </div>
                    ))
                )}
              </div>
            </Card>

            {/* Failed Tasks Alert */}
            {stats.failed > 0 && (
              <Card className="glass-card p-4 border-red-500/30">
                <h3 className="font-orbitron text-sm font-bold text-red-400 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Failed Tasks ({stats.failed})
                </h3>
                <div className="space-y-1 text-xs text-slate-400">
                  {tasks.filter(t => t.status === 'failed').slice(0, 5).map(t => (
                    <div key={t.id} className="flex justify-between">
                      <span>{t.opportunity_type}</span>
                      <span className="text-red-400">{t.error_type || 'Unknown'}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Execution Timeline */}
            <Card className="glass-card p-4">
              <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                Activity Log
              </h3>
              <div className="space-y-1 max-h-48 overflow-y-auto text-xs text-slate-400">
                {logs.slice(0, 12).map(log => (
                  <div key={log.id} className="flex justify-between">
                    <span>{log.message}</span>
                    <span className="text-slate-600">{new Date(log.created_date).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          {/* Task Reader Analysis Tab */}
          <TabsContent value="analysis" className="space-y-4">
            <AnalysisWorkflowMonitor 
              recentTasks={recentAnalysisTasks}
              stats={analysisStats}
              onRefresh={() => {
                setRecentAnalysisTasks([]);
                setAnalysisStats({});
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Deep Space Link */}
        <div className="mt-6">
          <Link to="/VelocitySystemDashboard">
            <Button variant="outline" className="w-full gap-2 border-slate-700">
              <span>📡 Deep Space Monitoring</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}