import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExecutionSimulator({ workflow }) {
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState([]);
  const [nodeStatuses, setNodeStatuses] = useState({});

  const simulateExecution = async () => {
    setIsRunning(true);
    setExecutionLog([]);
    setNodeStatuses({});

    const log = [];

    // Simulate node execution
    for (const node of workflow.nodes) {
      log.push({
        timestamp: new Date().toLocaleTimeString(),
        node: node.label,
        status: 'running'
      });

      setExecutionLog([...log]);
      setNodeStatuses(prev => ({ ...prev, [node.id]: 'running' }));

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Random success/failure
      const isSuccess = Math.random() > 0.2;

      log[log.length - 1] = {
        ...log[log.length - 1],
        status: isSuccess ? 'success' : 'error',
        duration: '1.2s'
      };

      setExecutionLog([...log]);
      setNodeStatuses(prev => ({ ...prev, [node.id]: isSuccess ? 'success' : 'error' }));
    }

    setIsRunning(false);
  };

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">Execution Simulator</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={simulateExecution}
            disabled={isRunning}
            className="gap-1"
          >
            <Play className="w-3 h-3" />
            Run
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setExecutionLog([]);
              setNodeStatuses({});
            }}
          >
            <RotateCcw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Execution Log */}
      <div className="space-y-1 max-h-40 overflow-y-auto">
        {executionLog.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Run simulation to see execution log</p>
        ) : (
          executionLog.map((entry, idx) => (
            <div key={idx} className="flex items-center gap-2 text-xs p-2 bg-slate-800/30 rounded">
              <span className="text-slate-500 min-w-[80px]">{entry.timestamp}</span>
              <span className="text-slate-300 flex-1">{entry.node}</span>
              <span className={`font-semibold ${
                entry.status === 'success' ? 'text-emerald-400' :
                entry.status === 'error' ? 'text-red-400' :
                'text-amber-400'
              }`}>
                {entry.status.toUpperCase()}
              </span>
              {entry.duration && <span className="text-slate-500">{entry.duration}</span>}
            </div>
          ))
        )}
      </div>

      {/* Summary */}
      {executionLog.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-700/50">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-slate-500 mb-1">Total</div>
              <div className="text-sm font-semibold text-white">{executionLog.length}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Success</div>
              <div className="text-sm font-semibold text-emerald-400">
                {executionLog.filter(e => e.status === 'success').length}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Failed</div>
              <div className="text-sm font-semibold text-red-400">
                {executionLog.filter(e => e.status === 'error').length}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}