import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Webhook, ArrowDownLeft, ArrowUpRight, ChevronDown, ChevronUp, Copy, Trash2, Circle } from 'lucide-react';

const STATUS_COLOR = {
  200: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  201: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  204: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  400: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  401: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  403: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  404: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  500: 'text-red-400 bg-red-500/10 border-red-500/30',
  503: 'text-red-400 bg-red-500/10 border-red-500/30',
};

function getStatusColor(code) {
  if (!code) return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
  if (STATUS_COLOR[code]) return STATUS_COLOR[code];
  if (code >= 200 && code < 300) return STATUS_COLOR[200];
  if (code >= 400 && code < 500) return STATUS_COLOR[400];
  return STATUS_COLOR[500];
}

function JsonView({ data }) {
  let formatted;
  try {
    formatted = typeof data === 'string' ? JSON.stringify(JSON.parse(data), null, 2) : JSON.stringify(data, null, 2);
  } catch {
    formatted = String(data);
  }
  return (
    <pre className="text-xs text-slate-300 bg-slate-950/60 rounded-lg p-3 overflow-auto max-h-48 whitespace-pre-wrap break-all">
      {formatted}
    </pre>
  );
}

function WebhookRow({ entry, onCopy }) {
  const [expanded, setExpanded] = useState(false);
  const isIncoming = entry.direction === 'incoming';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      isIncoming ? 'border-cyan-500/20' : 'border-purple-500/20'
    } bg-slate-900/50`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-3 p-3 hover:bg-slate-800/40 transition-colors text-left"
      >
        {/* Direction */}
        <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 ${
          isIncoming ? 'bg-cyan-500/15 text-cyan-400' : 'bg-purple-500/15 text-purple-400'
        }`}>
          {isIncoming ? <ArrowDownLeft className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />}
        </div>

        {/* Status code */}
        <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded border ${getStatusColor(entry.status_code)}`}>
          {entry.status_code || '—'}
        </span>

        {/* Method + path */}
        <span className="text-xs font-mono text-slate-300 truncate flex-1">
          <span className="text-slate-500 mr-1">{entry.method || 'POST'}</span>
          {entry.path || entry.url || '/webhook'}
        </span>

        {/* Source */}
        {entry.source && (
          <span className="text-xs text-slate-500 hidden md:block shrink-0">{entry.source}</span>
        )}

        {/* Timestamp */}
        <span className="text-xs text-slate-600 shrink-0">
          {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}
        </span>

        <span className="text-slate-600 ml-1 shrink-0">
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </span>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-slate-800/60 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-500">Full timestamp: <span className="text-slate-400">{entry.timestamp || '—'}</span></p>
            <button onClick={() => onCopy(entry)} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1">
              <Copy className="w-3 h-3" /> Copy JSON
            </button>
          </div>
          {entry.headers && (
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Headers</p>
              <JsonView data={entry.headers} />
            </div>
          )}
          {entry.payload && (
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Payload</p>
              <JsonView data={entry.payload} />
            </div>
          )}
          {entry.response_body && (
            <div>
              <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Response</p>
              <JsonView data={entry.response_body} />
            </div>
          )}
          {entry.error && (
            <div>
              <p className="text-xs text-red-400 mb-1 font-semibold uppercase tracking-wider">Error</p>
              <pre className="text-xs text-red-300 bg-red-950/30 rounded-lg p-3 whitespace-pre-wrap">{entry.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Live log buffer stored in module scope so it survives re-renders ────────
const LOG_BUFFER_KEY = '__webhook_diag_logs__';
if (!window[LOG_BUFFER_KEY]) window[LOG_BUFFER_KEY] = [];

function getBuffer() { return window[LOG_BUFFER_KEY]; }
function addToBuffer(entry) {
  window[LOG_BUFFER_KEY] = [entry, ...window[LOG_BUFFER_KEY]].slice(0, 200);
}

export function recordWebhook(entry) {
  addToBuffer({ ...entry, id: Date.now() + Math.random(), timestamp: entry.timestamp || new Date().toISOString() });
}

export default function WebhookDiagnostics() {
  const [logs, setLogs] = useState(() => getBuffer());
  const [filter, setFilter] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const timerRef = useRef(null);

  // Also pull from EngineAuditLog entity for persisted webhook events
  const [entityLogs, setEntityLogs] = useState([]);
  const [loadingEntity, setLoadingEntity] = useState(false);

  const loadEntityLogs = async () => {
    setLoadingEntity(true);
    try {
      const rows = await base44.entities.EngineAuditLog.list('-created_date', 50);
      const webhookRows = rows
        .filter(r => r.action_type === 'webhook' || r.category === 'webhook' || (r.details && String(r.details).toLowerCase().includes('webhook')))
        .map(r => ({
          id: r.id,
          direction: r.direction || 'incoming',
          status_code: r.status_code || r.http_status,
          method: r.method || 'POST',
          path: r.path || r.endpoint,
          source: r.source || r.platform,
          payload: r.payload || r.request_body,
          response_body: r.response_body,
          headers: r.headers,
          error: r.error_message,
          timestamp: r.created_date || r.timestamp,
          _fromEntity: true,
        }));
      setEntityLogs(webhookRows);
    } catch (e) {
      // entity may not have matching rows — that's fine
    } finally {
      setLoadingEntity(false);
    }
  };

  useEffect(() => {
    loadEntityLogs();
  }, []);

  useEffect(() => {
    if (!autoRefresh) { clearInterval(timerRef.current); return; }
    timerRef.current = setInterval(() => setLogs([...getBuffer()]), 1500);
    return () => clearInterval(timerRef.current);
  }, [autoRefresh]);

  const allLogs = [
    ...logs,
    ...entityLogs.filter(e => !logs.find(l => l.id === e.id)),
  ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const filtered = allLogs.filter(e => {
    if (filter === 'all') return true;
    if (filter === 'incoming') return e.direction === 'incoming';
    if (filter === 'outgoing') return e.direction === 'outgoing';
    if (filter === 'errors') return e.status_code >= 400 || e.error;
    return true;
  });

  const handleCopy = (entry) => {
    navigator.clipboard.writeText(JSON.stringify(entry, null, 2));
  };

  const handleClear = () => {
    window[LOG_BUFFER_KEY] = [];
    setLogs([]);
  };

  const incoming = allLogs.filter(e => e.direction === 'incoming').length;
  const outgoing = allLogs.filter(e => e.direction === 'outgoing').length;
  const errors = allLogs.filter(e => e.status_code >= 400 || e.error).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Webhook className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-white">Webhook Diagnostics</h2>
          <div className={`flex items-center gap-1 ml-2 ${autoRefresh ? 'text-emerald-400' : 'text-slate-500'}`}>
            <Circle className={`w-2 h-2 fill-current ${autoRefresh ? 'animate-pulse' : ''}`} />
            <span className="text-xs">{autoRefresh ? 'Live' : 'Paused'}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline"
            onClick={() => setAutoRefresh(v => !v)}
            className={`text-xs h-7 border-slate-700 ${autoRefresh ? 'text-emerald-400 border-emerald-500/40' : 'text-slate-400'}`}>
            {autoRefresh ? 'Pause' : 'Resume'}
          </Button>
          <Button size="sm" variant="outline"
            onClick={() => { loadEntityLogs(); setLogs([...getBuffer()]); }}
            disabled={loadingEntity}
            className="text-xs h-7 border-slate-700 text-slate-400">
            <RefreshCw className={`w-3 h-3 mr-1 ${loadingEntity ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button size="sm" variant="outline"
            onClick={handleClear}
            className="text-xs h-7 border-red-500/30 text-red-400 hover:bg-red-500/10">
            <Trash2 className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: allLogs.length, color: 'text-white' },
          { label: 'Incoming', value: incoming, color: 'text-cyan-400' },
          { label: 'Outgoing', value: outgoing, color: 'text-purple-400' },
          { label: 'Errors', value: errors, color: errors > 0 ? 'text-red-400' : 'text-slate-500' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 text-center">
            <div className={`text-xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-slate-500 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-900/60 border border-slate-800 rounded-xl p-1">
        {['all', 'incoming', 'outgoing', 'errors'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors capitalize ${
              filter === f ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>{f}</button>
        ))}
      </div>

      {/* Log list */}
      <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-10 text-center">
            <Webhook className="w-8 h-8 text-slate-700 mx-auto mb-3" />
            <p className="text-sm text-slate-500">No webhook events recorded yet.</p>
            <p className="text-xs text-slate-600 mt-1">Events are captured automatically as webhooks are sent or received.</p>
          </div>
        ) : (
          filtered.map(entry => (
            <WebhookRow key={entry.id} entry={entry} onCopy={handleCopy} />
          ))
        )}
      </div>

      {/* Usage hint */}
      <div className="bg-slate-900/40 border border-slate-800/60 rounded-xl p-3">
        <p className="text-xs text-slate-500">
          <span className="text-slate-400 font-semibold">How to log webhooks:</span>{' '}
          Import <code className="bg-slate-800 px-1 rounded text-slate-300">recordWebhook</code> from{' '}
          <code className="bg-slate-800 px-1 rounded text-slate-300">@/components/diagnostics/WebhookDiagnostics</code> and call it with{' '}
          <code className="bg-slate-800 px-1 rounded text-slate-300">{'{ direction, method, path, status_code, payload, response_body, headers, error }'}</code>.
        </p>
      </div>
    </div>
  );
}