import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Radar, Loader2, Zap, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';

const CATEGORY_OPTIONS = [
  { value: 'grant', label: 'Grants', emoji: '🏛️' },
  { value: 'sweepstakes', label: 'Sweepstakes', emoji: '🎰' },
  { value: 'contest', label: 'Contests', emoji: '🏆' },
  { value: 'giveaway', label: 'Giveaways', emoji: '🎁' },
  { value: 'beta_reward', label: 'Beta Rewards', emoji: '🔬' },
  { value: 'promo_credit', label: 'Promo Credits', emoji: '💳' },
  { value: 'free_item', label: 'Free Items', emoji: '📦' },
  { value: 'loyalty_bonus', label: 'Loyalty Bonuses', emoji: '⭐' },
  { value: 'raffle', label: 'Raffles', emoji: '🎟️' },
  { value: 'first_come', label: 'First Come', emoji: '⚡' },
];

export default function PrizeScanPanel({ onScanComplete }) {
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState(['grant', 'sweepstakes', 'contest', 'giveaway', 'beta_reward', 'promo_credit']);
  const qc = useQueryClient();

  const toggle = (v) => setSelected(s => s.includes(v) ? s.filter(x => x !== v) : [...s, v]);

  const scan = async () => {
    setScanning(true);
    setResult(null);
    const res = await base44.functions.invoke('prizeEngine', { action: 'scan', categories: selected });
    setResult(res?.data);
    qc.invalidateQueries({ queryKey: ['prizeOpportunities'] });
    onScanComplete?.(res?.data);
    setScanning(false);
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 overflow-hidden">
      <button onClick={() => setExpanded(v => !v)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-slate-800/20 transition-colors">
        <div className="flex items-center gap-2">
          <Radar className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-white">Opportunity Scanner</span>
          <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">AI + Internet</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-800 p-5 space-y-4">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-2">Scan Categories</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map(c => (
                <button key={c.value} onClick={() => toggle(c.value)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    selected.includes(c.value)
                      ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
                      : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                  }`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={scan} disabled={scanning || selected.length === 0}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white h-9 gap-2">
            {scanning
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning internet for opportunities...</>
              : <><Radar className="w-4 h-4" /> Run Live Scan ({selected.length} categories)</>
            }
          </Button>

          {result && (
            <div className={`rounded-xl border px-4 py-3 ${
              result.new_opportunities > 0 ? 'bg-emerald-950/20 border-emerald-500/20' : 'bg-slate-800 border-slate-700'
            }`}>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-white">
                    {result.new_opportunities} new opportunit{result.new_opportunities !== 1 ? 'ies' : 'y'} discovered
                    {result.total_potential_value > 0 && ` · Est. $${result.total_potential_value.toLocaleString()} total value`}
                  </p>
                  {result.scan_summary && <p className="text-[10px] text-slate-500 mt-0.5">{result.scan_summary}</p>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}