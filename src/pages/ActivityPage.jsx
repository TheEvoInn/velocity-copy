/**
 * ACTIVITY PAGE
 * Comprehensive audit log and real-time event tracking
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useActivityLogsV2 } from '@/lib/velocityHooks';
import { Card } from '@/components/ui/card';
import { Clock, Filter } from 'lucide-react';

export default function ActivityPage() {
  const { logs } = useActivityLogsV2(200);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = logs.filter(log => {
    const matchesSeverity = severityFilter === 'all' || log.severity === severityFilter;
    const matchesSearch = log.message?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSeverity && matchesSearch;
  });

  const severities = ['info', 'warning', 'critical'];

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-slate-700/40 border border-slate-600/40">
            <Clock className="w-6 h-6 text-slate-300" />
          </div>
          <div>
            <h1 className="font-orbitron text-2xl font-bold text-white">Activity Log</h1>
            <p className="text-xs text-slate-400">Real-time event tracking and audit trail</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-2 mb-6">
          <Card className="glass-card p-3">
            <div className="text-xs text-slate-400">Total</div>
            <div className="text-xl font-bold text-cyan-400">{logs.length}</div>
          </Card>
          <Card className="glass-card p-3">
            <div className="text-xs text-slate-400">Info</div>
            <div className="text-xl font-bold text-blue-400">{logs.filter(l => l.severity === 'info').length}</div>
          </Card>
          <Card className="glass-card p-3">
            <div className="text-xs text-slate-400">Warning</div>
            <div className="text-xl font-bold text-amber-400">{logs.filter(l => l.severity === 'warning').length}</div>
          </Card>
          <Card className="glass-card p-3">
            <div className="text-xs text-slate-400">Critical</div>
            <div className="text-xl font-bold text-red-400">{logs.filter(l => l.severity === 'critical').length}</div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="glass-card p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-3">
            <input
              type="text"
              placeholder="Search logs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm"
            />
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value)}
              className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-2 text-white text-sm"
            >
              <option value="all">All Severity</option>
              {severities.map(sev => (
                <option key={sev} value={sev}>{sev}</option>
              ))}
            </select>
          </div>
        </Card>

        {/* Log List */}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <Card className="glass-card p-8 text-center text-slate-400">
              No matching logs
            </Card>
          ) : (
            filtered.map(log => (
              <Card key={log.id} className={`glass-card p-3 border-l-2 ${
                log.severity === 'critical' ? 'border-l-red-500' : 
                log.severity === 'warning' ? 'border-l-amber-500' : 
                'border-l-blue-500'
              }`}>
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white">{log.message}</div>
                    <div className="text-xs text-slate-500 mt-1">
                      {new Date(log.created_date).toLocaleString()}
                    </div>
                    {log.metadata && (
                      <div className="text-xs text-slate-600 mt-1">
                        Entity: {log.metadata.entity_name}
                      </div>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ml-4 shrink-0 ${
                    log.severity === 'critical' ? 'bg-red-500/20 text-red-300' :
                    log.severity === 'warning' ? 'bg-amber-500/20 text-amber-300' :
                    'bg-blue-500/20 text-blue-300'
                  }`}>
                    {log.severity}
                  </span>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}