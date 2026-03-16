import React from 'react';
import { Card } from '@/components/ui/card';

export default function ExecutionStats({ stats }) {
  const topPlatforms = Object.entries(stats.by_platform || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  const topIdentities = Object.entries(stats.by_identity || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-white">Execution Analytics</h3>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <p className="text-xs text-slate-500 font-medium">Avg Execution Time</p>
          <p className="text-2xl font-bold text-white mt-2">{stats.avg_execution_time || 0}s</p>
        </Card>
        <Card className="bg-emerald-950/20 border-emerald-900/30 p-4">
          <p className="text-xs text-slate-500 font-medium">Total Value Completed</p>
          <p className="text-2xl font-bold text-emerald-400 mt-2">${(stats.total_value_completed || 0).toLocaleString()}</p>
        </Card>
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <p className="text-xs text-slate-500 font-medium">Total Value Attempted</p>
          <p className="text-2xl font-bold text-white mt-2">${(stats.total_value_attempted || 0).toLocaleString()}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Platforms */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Top Platforms</h4>
          <div className="space-y-2">
            {topPlatforms.length > 0 ? (
              topPlatforms.map(([platform, count]) => (
                <div key={platform} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{platform}</span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No data yet</p>
            )}
          </div>
        </Card>

        {/* Top Identities */}
        <Card className="bg-slate-900/50 border-slate-800 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Top Identities</h4>
          <div className="space-y-2">
            {topIdentities.length > 0 ? (
              topIdentities.map(([identity, count]) => (
                <div key={identity} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{identity}</span>
                  <span className="font-semibold text-white">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No data yet</p>
            )}
          </div>
        </Card>
      </div>

      {/* Task Status Breakdown */}
      <Card className="bg-slate-900/50 border-slate-800 p-4">
        <h4 className="text-sm font-semibold text-white mb-3">Task Status Breakdown</h4>
        <div className="space-y-2">
          {Object.entries(stats.by_status || {})
            .sort((a, b) => b[1] - a[1])
            .map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="text-slate-400 capitalize">{status}</span>
                <div className="flex items-center gap-2">
                  <div className="w-32 bg-slate-800 rounded-full h-2">
                    <div
                      className="bg-emerald-500 h-2 rounded-full"
                      style={{
                        width: `${Math.max((count / (stats.total || 1)) * 100, 5)}%`
                      }}
                    />
                  </div>
                  <span className="font-semibold text-white w-8 text-right">{count}</span>
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}