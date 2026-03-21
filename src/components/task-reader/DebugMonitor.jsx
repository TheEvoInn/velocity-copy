/**
 * Debug Monitor
 * Real-time monitoring of Task Reader analysis and Autopilot decision-making
 * Shows overlay events, field highlights, and action flow
 */
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Activity,
  Eye,
  CheckCircle2,
  AlertCircle,
  Zap,
  Copy,
  Download,
  X
} from 'lucide-react';
import { toast } from 'sonner';

export default function DebugMonitor({ analysis, onClose }) {
  const [events, setEvents] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventFilter, setEventFilter] = useState('all');

  useEffect(() => {
    if (!analysis) return;

    // Simulate monitoring if overlay is active
    const interval = setInterval(() => {
      if (isMonitoring) {
        // In production, would poll actual overlay events from Browserbase
        setEvents(prev => {
          if (prev.length < 50) {
            return [...prev, {
              id: `event_${Date.now()}`,
              timestamp: new Date().toISOString(),
              type: Math.random() > 0.5 ? 'highlight' : 'validation',
              field: analysis.understanding.form_fields?.[0]?.name || 'field',
              status: Math.random() > 0.3 ? 'success' : 'pending'
            }];
          }
          return prev.slice(-50);
        });
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isMonitoring, analysis]);

  if (!analysis) return null;

  const filteredEvents = eventFilter === 'all' 
    ? events 
    : events.filter(e => e.type === eventFilter);

  const stats = {
    total: events.length,
    highlights: events.filter(e => e.type === 'highlight').length,
    validations: events.filter(e => e.type === 'validation').length,
    successful: events.filter(e => e.status === 'success').length
  };

  const exportData = () => {
    const data = {
      analysis_id: analysis.workflow?.id,
      timestamp: new Date().toISOString(),
      understanding: analysis.understanding,
      events: events,
      statistics: stats
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `task-reader-debug-${Date.now()}.json`;
    a.click();

    toast.success('Debug data exported');
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm p-4 md:p-6 flex items-center justify-center">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-900/95 border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <Activity className="w-5 h-5 text-cyan-400" />
            <h2 className="text-lg font-semibold text-white">Debug Monitor</h2>
            {isMonitoring && (
              <div className="flex items-center gap-1 ml-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-xs text-red-400">LIVE</span>
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-4 p-4">
          {/* Left: Overview & Controls */}
          <div className="w-full lg:w-64 space-y-3">
            {/* Stats */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300">Event Statistics</h3>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between items-center p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Total Events</span>
                  <Badge>{stats.total}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Highlights</span>
                  <Badge className="text-cyan-300 bg-cyan-500/20 border-cyan-500/30">{stats.highlights}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Validations</span>
                  <Badge className="text-amber-300 bg-amber-500/20 border-amber-500/30">{stats.validations}</Badge>
                </div>
                <div className="flex justify-between items-center p-2 rounded bg-slate-800/50">
                  <span className="text-slate-400">Successful</span>
                  <Badge className="text-emerald-300 bg-emerald-500/20 border-emerald-500/30">{stats.successful}</Badge>
                </div>
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300">Controls</h3>
              <Button
                size="sm"
                onClick={() => setIsMonitoring(!isMonitoring)}
                className={`w-full gap-2 ${isMonitoring ? 'bg-red-600 hover:bg-red-500' : 'bg-emerald-600 hover:bg-emerald-500'}`}
              >
                {isMonitoring ? (
                  <>
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    Stop Monitoring
                  </>
                ) : (
                  <>
                    <Activity className="w-3 h-3" />
                    Start Monitoring
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEvents([])}
                className="w-full gap-2"
              >
                Clear Events
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={exportData}
                className="w-full gap-2"
              >
                <Download className="w-3 h-3" />
                Export
              </Button>
            </div>

            {/* Filters */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-slate-300">Filter</h3>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full px-2 py-1 rounded bg-slate-800 border border-slate-700 text-xs text-white"
              >
                <option value="all">All Events</option>
                <option value="highlight">Highlights</option>
                <option value="validation">Validations</option>
              </select>
            </div>

            {/* Analysis Info */}
            {analysis.understanding && (
              <div className="p-2 rounded bg-slate-800/50 space-y-1 text-xs">
                <h3 className="font-semibold text-slate-300 mb-2">Analysis</h3>
                <div>
                  <span className="text-slate-400">Type:</span>
                  <span className="ml-1 text-cyan-300 font-mono">{analysis.understanding.page_type}</span>
                </div>
                <div>
                  <span className="text-slate-400">Confidence:</span>
                  <span className="ml-1 text-cyan-300">{Math.round(analysis.understanding.confidence * 100)}%</span>
                </div>
                <div>
                  <span className="text-slate-400">Fields:</span>
                  <span className="ml-1 text-cyan-300">{analysis.understanding.form_fields?.length || 0}</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Event Log */}
          <div className="flex-1 flex flex-col min-h-0">
            <h3 className="text-xs font-semibold text-slate-300 mb-2">Event Log ({filteredEvents.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 border border-slate-700 rounded p-2 bg-slate-950/50">
              {filteredEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 text-slate-500">
                  <Eye className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-xs">No events yet</p>
                  <p className="text-[10px] mt-1">Start monitoring to see events</p>
                </div>
              ) : (
                [...filteredEvents].reverse().map((event) => (
                  <div
                    key={event.id}
                    onClick={() => setSelectedEvent(event)}
                    className={`p-2 rounded cursor-pointer transition-all text-xs border-l-2 ${
                      selectedEvent?.id === event.id
                        ? 'bg-slate-700 border-l-cyan-400'
                        : 'bg-slate-800/50 border-l-slate-700 hover:bg-slate-700/50 hover:border-l-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {event.type === 'highlight' ? (
                          <Eye className="w-3 h-3 text-cyan-400" />
                        ) : (
                          <CheckCircle2 className="w-3 h-3 text-amber-400" />
                        )}
                        <span className="font-mono text-slate-300">{event.type}</span>
                      </div>
                      <Badge
                        className="text-[9px]"
                        variant={event.status === 'success' ? 'default' : 'secondary'}
                      >
                        {event.status}
                      </Badge>
                    </div>
                    <div className="text-[10px] text-slate-400">
                      Field: <span className="text-slate-300">{event.field}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Selected Event Details */}
            {selectedEvent && (
              <div className="mt-3 p-3 rounded bg-slate-800/50 border border-slate-700 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-white">Event Details</h4>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedEvent, null, 2));
                      toast.success('Copied to clipboard');
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <pre className="bg-slate-950 p-2 rounded overflow-x-auto text-[10px] text-slate-300 max-h-32 overflow-y-auto">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}