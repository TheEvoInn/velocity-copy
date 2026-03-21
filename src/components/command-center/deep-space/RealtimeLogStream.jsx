import React from 'react';
import { Card } from '@/components/ui/card';

const LOG_COLORS = {
  execution: 'text-blue-400 bg-blue-500/10',
  api: 'text-cyan-400 bg-cyan-500/10',
  success: 'text-emerald-400 bg-emerald-500/10',
  error: 'text-red-400 bg-red-500/10',
  warning: 'text-amber-400 bg-amber-500/10'
};

export default function RealtimeLogStream({ logs }) {
  return (
    <Card className="bg-slate-900/50 border-slate-800 overflow-hidden">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-white mb-3">Live Execution Stream</h3>
        <div className="space-y-1 max-h-96 overflow-y-auto font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-slate-500 py-4 text-center">Waiting for events...</p>
          ) : (
            logs.map((log, idx) => (
              <div key={idx} className={`flex gap-2 p-2 rounded ${LOG_COLORS[log.type] || 'text-slate-400'}`}>
                <span className="text-slate-600 min-w-[100px] shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
                <span className="flex-1 break-words">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}