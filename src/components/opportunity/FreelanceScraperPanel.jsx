import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, Loader2, Wifi, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

const PLATFORMS = ['Upwork', 'Fiverr', 'Freelancer', 'Toptal', 'PeoplePerHour', 'LinkedIn', 'Remote.co'];

export default function FreelanceScraperPanel() {
  const queryClient = useQueryClient();
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState(null);

  const { data: goals = [] } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list(),
    initialData: [],
  });
  const profile = goals[0] || {};
  const skills = profile.skills || [];

  const runScan = async () => {
    setScanning(true);
    setLastResult(null);
    try {
      const res = await base44.functions.invoke('scrapeFreelanceJobs', {});
      setLastResult(res.data);
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });
    } catch (e) {
      setLastResult({ error: e.message });
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-4 mb-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Wifi className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Live Job Scraper</p>
            <p className="text-[11px] text-slate-500">
              {skills.length > 0
                ? `Scanning for: ${skills.slice(0, 3).join(', ')}${skills.length > 3 ? ` +${skills.length - 3} more` : ''}`
                : 'Configure skills in your profile to target jobs'
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Platform badges */}
          <div className="hidden sm:flex items-center gap-1">
            {PLATFORMS.slice(0, 4).map(p => (
              <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-500">{p}</span>
            ))}
            <span className="text-[9px] text-slate-600">+{PLATFORMS.length - 4}</span>
          </div>

          <Button
            size="sm"
            onClick={runScan}
            disabled={scanning}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-8 shrink-0"
          >
            {scanning ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Scanning...</>
            ) : (
              <><Search className="w-3.5 h-3.5 mr-1" /> Scan Now</>
            )}
          </Button>
        </div>
      </div>

      {/* Scanning animation */}
      {scanning && (
        <div className="mt-4 rounded-xl bg-slate-800/60 border border-slate-700 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
            <span className="text-xs text-emerald-400">Live scanning job boards...</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p, i) => (
              <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 animate-pulse" style={{ animationDelay: `${i * 0.15}s` }}>
                {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Result */}
      {lastResult && !scanning && (
        <div className={`mt-3 flex items-center gap-2 px-3 py-2 rounded-lg ${lastResult.error ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'}`}>
          {lastResult.error
            ? <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          }
          <span className={`text-xs ${lastResult.error ? 'text-rose-400' : 'text-emerald-400'}`}>
            {lastResult.error
              ? `Scan failed: ${lastResult.error}`
              : `Found ${lastResult.found || 0} jobs · Added ${lastResult.created || 0} new opportunities to the board`
            }
          </span>
          {!lastResult.error && (
            <button onClick={runScan} className="ml-auto text-[10px] text-slate-500 hover:text-white flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Rescan
            </button>
          )}
        </div>
      )}
    </div>
  );
}