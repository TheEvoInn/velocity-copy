import React from 'react';
import { Card } from '@/components/ui/card';
import TaskExecutionDashboard from '@/components/agent/TaskExecutionDashboard';

export default function AgentWorkerCenter() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Agent Worker</h1>
        <p className="text-sm text-slate-400 mt-1">Autonomous execution of applications and forms across all platforms</p>
      </div>

      {/* Info Banner */}
      <Card className="bg-blue-950/20 border-blue-900/30 p-4">
        <p className="text-sm text-blue-300">
          🤖 The Agent Worker automatically navigates to opportunities, analyzes forms, fills fields with identity data, and submits applications. Tasks can be queued manually or triggered automatically from the Opportunities module.
        </p>
      </Card>

      {/* Task Execution Dashboard */}
      <TaskExecutionDashboard />
    </div>
  );
}