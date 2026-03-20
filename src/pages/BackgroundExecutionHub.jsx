import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Clock } from 'lucide-react';
import TaskExecutionConfig from '../components/execution/TaskExecutionConfig';
import BackgroundTaskScheduler from '../components/execution/BackgroundTaskScheduler';

export default function BackgroundExecutionHub() {
  return (
    <div className="min-h-screen bg-slate-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white font-orbitron">Background Execution Hub</h1>
              <p className="text-sm text-slate-400">Automated task execution with risk-based filtering</p>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Configuration */}
          <div className="lg:col-span-1">
            <TaskExecutionConfig />
          </div>

          {/* Right: Scheduler */}
          <div className="lg:col-span-2">
            <BackgroundTaskScheduler />
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="bg-blue-950/30 border-blue-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Execution Flow
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-blue-200 space-y-2">
              <div>1. <span className="font-medium">Risk Assessment:</span> Only opportunities with score ≥ threshold execute</div>
              <div>2. <span className="font-medium">Credential Lookup:</span> Finds active credentials for the platform</div>
              <div>3. <span className="font-medium">Delayed Execution:</span> Waits for configured delay before acting</div>
              <div>4. <span className="font-medium">Action Execution:</span> Applies job or submits proposal automatically</div>
              <div>5. <span className="font-medium">Audit Logging:</span> All actions recorded with confirmation numbers</div>
            </CardContent>
          </Card>

          <Card className="bg-emerald-950/30 border-emerald-500/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                Security & Compliance
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-emerald-200 space-y-2">
              <div>✓ Credentials encrypted at rest (AES-256-GCM)</div>
              <div>✓ Permission-based action authorization</div>
              <div>✓ User consent required for full automation</div>
              <div>✓ Immutable access logs for audit trails</div>
              <div>✓ Random delays prevent detection patterns</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}