import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Clock } from 'lucide-react';
import TaskExecutionConfig from '../components/execution/TaskExecutionConfig';
import BackgroundTaskScheduler from '../components/execution/BackgroundTaskScheduler';

export default function BackgroundExecutionHub() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
          <Zap className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h1 className="font-orbitron text-lg font-bold text-white tracking-wide">Background Execution Hub</h1>
          <p className="text-xs text-slate-500">Automated task execution with risk-based filtering</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <TaskExecutionConfig />
          </div>
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