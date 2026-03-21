import React from 'react';
import BackgroundTaskScheduler from '@/components/execution/BackgroundTaskScheduler';

export default function BackgroundExecutionHub() {
  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <BackgroundTaskScheduler />
    </div>
  );
}