import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Zap, Globe, Play, CheckCircle2, AlertTriangle, Loader2, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const TASK_TYPES = [
  { id: 'logo_generation',   label: 'Logo Generation',      color: 'text-violet-400 bg-violet-500/10 border-violet-500/20' },
  { id: 'content_audit',     label: 'Content Audit',        color: 'text-blue-400 bg-blue-500/10 border-blue-500/20' },
  { id: 'digital_asset',     label: 'Digital Asset Upload', color: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
  { id: 'grant_application', label: 'Grant Application',    color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'freelance_apply',   label: 'Freelance Apply',      color: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
  { id: 'contest_entry',     label: 'Contest Entry',        color: 'text-pink-400 bg-pink-500/10 border-pink-500/20' },
  { id: 'giveaway_entry',    label: 'Giveaway Entry',       color: 'text-orange-400 bg-orange-500/10 border-orange-500/20' },
];

function LogEntry({ entry }) {
  return (
    <div className="flex items-start gap-2 text-xs py-1 border-b border-slate-800/50 last:border-0">
      <span className="text-slate-600 shrink-0 font-mono">{new Date(entry.timestamp).toLocaleTimeString()}</span>
      <span className="text-slate-400">{entry.detail}</span>
    </div>
  );
}

function RunResult({ result }) {
  const [showLog, setShowLog] = useState(false);
  return (
    <div className={`rounded-xl border p-4 mt-4 ${result.submitted ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-amber-500/5 border-amber-500/20'}`}>
      <div className="flex items-start gap-3">
        {result.submitted
          ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white">{result.submitted ? 'Submitted Successfully' : 'Review Required'}</p>
          <p className="text-xs text-slate-400 mt-0.5">{result.message}</p>
          {result.deliverable && (
            <p className="text-xs text-slate-500 mt-1 italic">Deliverable: {result.deliverable}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {result.final_url && (
              <a href={result.final_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                <ExternalLink className="w-3 h-3" /> View page
              </a>
            )}
            {result.debug_url && (
              <a href={result.debug_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300">
                <Globe className="w-3 h-3" /> Browser replay
              </a>
            )}
            <span className="text-xs text-slate-600">{result.fields_found} fields · {result.instructions_executed} actions</span>
          </div>
        </div>
      </div>
      {result.execution_log?.length > 0 && (
        <div className="mt-3">
          <button onClick={() => setShowLog(v => !v)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
            {showLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showLog ? 'Hide' : 'Show'} execution log ({result.execution_log.length} steps)
          </button>
          {showLog && (
            <div className="mt-2 bg-slate-900 rounded-lg p-3 max-h-48 overflow-y-auto">
              {result.execution_log.map((e, i) => <LogEntry key={i} entry={e} />)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function InstantTaskPanel({ opportunities = [], onTaskComplete }) {
  const [selectedOpp, setSelectedOpp] = useState(null);
  const [taskType, setTaskType] = useState('freelance_apply');
  const [customUrl, setCustomUrl] = useState('');
  const [context, setContext] = useState('');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Load active identity
  const { data: identities = [] } = useQuery({
    queryKey: ['identities_active'],
    queryFn: () => base44.entities.AIIdentity.filter({ is_active: true }),
    initialData: [],
  });
  const identity = identities[0] || null;

  const targetUrl = selectedOpp?.url || customUrl;
  const canRun = !!targetUrl && !running;

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    setError(null);
    try {
      const res = await base44.functions.invoke('instantTask', {
        action: 'run_instant_task',
        payload: {
          task_type: taskType,
          url: targetUrl,
          context: context || selectedOpp?.description || '',
          identity: identity ? {
            name: identity.name,
            email: identity.email,
            skills: identity.skills,
            bio: identity.bio,
          } : null,
          opportunity_id: selectedOpp?.id || null,
        },
      });
      setResult(res.data);
      onTaskComplete?.();
    } catch (e) {
      setError(e.message || 'Instant task failed');
    } finally {
      setRunning(false);
    }
  };

  // Only show opportunities that are queued/new and have a URL
  const eligible = opportunities.filter(o => ['new', 'queued', 'reviewing'].includes(o.status) && o.url);

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
          <Zap className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-white">Instant Task</h2>
          <p className="text-xs text-slate-500">Real browser automation · Browserbase</p>
        </div>
        {identity && (
          <Badge className="ml-auto text-xs bg-slate-800 text-slate-300 border-slate-700">
            Identity: {identity.name}
          </Badge>
        )}
      </div>

      {/* Task Type */}
      <div className="mb-3">
        <label className="text-xs text-slate-500 mb-1.5 block">Task Type</label>
        <div className="flex flex-wrap gap-1.5">
          {TASK_TYPES.map(t => (
            <button key={t.id} onClick={() => setTaskType(t.id)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                taskType === t.id ? t.color : 'text-slate-500 bg-slate-800/50 border-slate-700 hover:text-slate-300'
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Opportunity selector OR custom URL */}
      <div className="mb-3">
        <label className="text-xs text-slate-500 mb-1.5 block">Target Opportunity</label>
        {eligible.length > 0 ? (
          <select
            value={selectedOpp?.id || ''}
            onChange={e => {
              const o = eligible.find(x => x.id === e.target.value) || null;
              setSelectedOpp(o);
              if (o) setCustomUrl('');
            }}
            className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-violet-500"
          >
            <option value="">— pick from queue or enter URL below —</option>
            {eligible.map(o => (
              <option key={o.id} value={o.id}>
                [{o.platform || o.category}] {o.title?.slice(0, 60)}
              </option>
            ))}
          </select>
        ) : null}
        <input
          type="url"
          placeholder="https://... (paste direct URL)"
          value={customUrl}
          onChange={e => { setCustomUrl(e.target.value); setSelectedOpp(null); }}
          className="w-full mt-1.5 bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-violet-500"
        />
      </div>

      {/* Context / Brief */}
      <div className="mb-4">
        <label className="text-xs text-slate-500 mb-1.5 block">Task Brief / Context <span className="text-slate-600">(optional)</span></label>
        <textarea
          rows={2}
          placeholder="Describe what to fill in or submit. Leave blank to let AI decide from the page."
          value={context}
          onChange={e => setContext(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 text-white text-xs rounded-lg px-3 py-2 placeholder:text-slate-600 focus:outline-none focus:border-violet-500 resize-none"
        />
      </div>

      {/* Run button */}
      <Button
        onClick={handleRun}
        disabled={!canRun}
        className="w-full bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium gap-2 disabled:opacity-40"
      >
        {running
          ? <><Loader2 className="w-4 h-4 animate-spin" /> Running browser session...</>
          : <><Play className="w-4 h-4" /> Launch Instant Task</>}
      </Button>

      {!identity && (
        <p className="text-xs text-amber-400/80 mt-2 text-center">⚠️ No active identity found — set one in Identity Manager for best results.</p>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 bg-red-500/10 border border-red-500/20 rounded-lg p-3 text-xs text-red-400">{error}</div>
      )}

      {/* Result */}
      {result && <RunResult result={result} />}
    </div>
  );
}