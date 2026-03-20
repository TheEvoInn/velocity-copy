import React from 'react';
import TaskQueueViewer from '@/components/execution/TaskQueueViewer';

export default function TaskQueueApproval() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        <TaskQueueViewer />
      </div>
    </div>
  );
}