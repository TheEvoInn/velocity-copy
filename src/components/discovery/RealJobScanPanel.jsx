/**
 * RealJobScanPanel — trigger multi-source real job/opportunity scanning
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Telescope, Zap, Loader2, CheckCircle2, AlertTriangle, Globe, Cpu, GitBranch } from 'lucide-react';

const SOURCES = [
  { id: 'ai_web', label: 'AI Web Search', icon: Globe, desc: 'Contests, grants, giveaways via live internet search' },
  { id: 'rapidapi', label: 'Job Boards', icon: Cpu, desc: 'Real jobs from Indeed, LinkedIn, Freelancer.com' },
  { id: 'n8n', label: 'n8n MCP', icon: GitBranch, desc: 'Custom workflows via your n8n instance' },
];

export default function RealJobScanPanel({ onComplete }) {
  const [selected, setSelected] = useState(['ai_web', 'rapidapi', 'n8n']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const toggleSource = (id) => {
    setSelected(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const runScan = async () => {
    if (!Array.isArray(selected) || !selected.length) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await base44.functions.invoke('scanOpportunities', { sources: selected });
      setResult(res?.data || null);
      if (typeof onComplete === 'function') onComplete();
    } catch (e) {
      console.error('Scan failed:', e.message);
      setResult({ error: e.message, grand_total_saved: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Telescope className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-white">Real Opportunity Scan</h3>
      </div>

      <div className="space-y-2">
        {SOURCES.map(({ id, label, icon: Icon, desc }) => (
          <button
            key={id}
            onClick={() => toggleSource(id)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
              selected.includes(id)
                ? 'bg-amber-950/30 border-amber-500/30 text-white'
                : 'bg-slate-800/30 border-slate-700/50 text-slate-500 hover:border-slate-600'
            }`}
          >
            <Icon className={`w-4 h-4 shrink-0 ${selected.includes(id) ? 'text-amber-400' : 'text-slate-600'}`} />
            <div className="min-w-0">
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xs opacity-60 truncate">{desc}</p>
            </div>
            {selected.includes(id) && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 ml-auto shrink-0" />}
          </button>
        ))}
      </div>

      <Button
        onClick={runScan}
        disabled={loading || !selected.length}
        className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs h-9 gap-2"
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
        {loading ? 'Scanning Real Sources...' : `Scan ${selected.length} Source${selected.length !== 1 ? 's' : ''}`}
      </Button>

      {result && (
        <div className="space-y-2">
          <div className={`p-3 rounded-lg text-xs ${typeof result?.grand_total_saved === 'number' && result.grand_total_saved > 0 ? 'bg-emerald-950/40 border border-emerald-500/20' : 'bg-slate-800/50 border border-slate-700'}`}>
            <p className={`font-semibold ${typeof result?.grand_total_saved === 'number' && result.grand_total_saved > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
              {typeof result?.grand_total_saved === 'number' && result.grand_total_saved > 0
                ? `✅ ${result.grand_total_saved} new real opportunities found`
                : result?.error ? `⚠️ ${result.error}` : 'Scan complete — no new opportunities found'}
            </p>
          </div>
          {Array.isArray(result?.sources) && result.sources.map((s, i) => (
            <div key={i} className="flex items-center justify-between px-2 py-1 bg-slate-800/30 rounded text-xs">
              <span className="text-slate-400">{s?.source || 'Unknown'}</span>
              {s?.error
                ? <span className="flex items-center gap-1 text-red-400"><AlertTriangle className="w-3 h-3" />{String(s.error).slice(0, 40)}</span>
                : <Badge variant="outline" className="text-xs">{typeof s?.found === 'number' ? s.found : (typeof s?.saved === 'number' ? s.saved : 0)} found</Badge>
              }
            </div>
          ))}
        </div>
      )}
    </div>
  );
}