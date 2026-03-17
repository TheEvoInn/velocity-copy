import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Zap, Play, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

export default function N8nMcpPanel() {
  const [method, setMethod] = useState('tools/list');
  const [params, setParams] = useState('{}');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showRaw, setShowRaw] = useState(false);

  const QUICK_ACTIONS = [
    { label: 'List Tools', method: 'tools/list', params: '{}' },
    { label: 'List Workflows', method: 'tools/call', params: '{"name":"list_workflows","arguments":{}}' },
    { label: 'Get Executions', method: 'tools/call', params: '{"name":"list_executions","arguments":{"limit":10}}' },
  ];

  async function callMcp() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      let parsedParams = {};
      try { parsedParams = JSON.parse(params); } catch { throw new Error('Invalid JSON in params'); }

      const payload = {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params: parsedParams,
      };

      const res = await base44.functions.invoke('n8nMcp', payload);
      setResult(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-orange-400" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">n8n MCP</h3>
          <p className="text-xs text-slate-500">velocitypulse.app.n8n.cloud</p>
        </div>
        <span className="ml-auto text-[10px] px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full">Connected</span>
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(a => (
          <button
            key={a.label}
            onClick={() => { setMethod(a.method); setParams(a.params); }}
            className="text-xs px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* Method */}
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Method</label>
        <Input
          value={method}
          onChange={e => setMethod(e.target.value)}
          placeholder="e.g. tools/list or tools/call"
          className="bg-slate-800 border-slate-700 text-white text-xs h-8"
        />
      </div>

      {/* Params */}
      <div className="space-y-1">
        <label className="text-xs text-slate-400">Params (JSON)</label>
        <Textarea
          value={params}
          onChange={e => setParams(e.target.value)}
          rows={3}
          className="bg-slate-800 border-slate-700 text-white text-xs font-mono resize-none"
        />
      </div>

      <Button
        onClick={callMcp}
        disabled={loading}
        className="w-full bg-orange-600 hover:bg-orange-500 text-white text-xs h-8 gap-2"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
        {loading ? 'Calling...' : 'Execute'}
      </Button>

      {/* Error */}
      {error && (
        <div className="text-xs text-red-400 bg-red-950/30 border border-red-500/20 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-2">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-300"
          >
            {showRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showRaw ? 'Hide' : 'Show'} Raw Response
          </button>

          {/* Friendly tool list */}
          {result.result?.tools && (
            <div className="space-y-1">
              <p className="text-xs text-slate-400">{result.result.tools.length} tools available:</p>
              {result.result.tools.map(t => (
                <div key={t.name} className="px-3 py-2 bg-slate-800/60 rounded-lg">
                  <p className="text-xs text-white font-medium">{t.name}</p>
                  {t.description && <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>}
                </div>
              ))}
            </div>
          )}

          {/* Raw JSON */}
          {showRaw && (
            <pre className="text-[10px] text-slate-400 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}