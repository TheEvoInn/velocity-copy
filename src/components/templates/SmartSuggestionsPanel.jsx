import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, RefreshCw, TrendingUp, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CONFIDENCE_COLOR = (score) => {
  if (score >= 85) return '#10b981';
  if (score >= 70) return '#f9d65c';
  return '#f97316';
};

export default function SmartSuggestionsPanel({ onApply, applyingId }) {
  const [refreshKey, setRefreshKey] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ['templateSuggestions', refreshKey],
    queryFn: () => base44.functions.invoke('templateSuggestionEngine', {}).then(r => r.data),
    staleTime: 10 * 60 * 1000, // 10 min cache
  });

  const suggestions = data?.suggestions || [];
  const analysis = data?.analysis || {};

  return (
    <div className="mb-8">
      {/* Panel header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'rgba(181,55,242,0.15)', border: '1px solid rgba(181,55,242,0.4)' }}>
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div>
            <h2 className="font-orbitron text-xs tracking-widest text-violet-300">AI SUGGESTIONS FOR YOU</h2>
            {analysis.readiness_level && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                Profile: <span className="text-violet-400 capitalize">{analysis.readiness_level}</span>
                {analysis.top_opportunity && <> · Top opportunity: <span className="text-slate-300">{analysis.top_opportunity}</span></>}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={() => setRefreshKey(k => k + 1)}
          disabled={isLoading}
          className="p-1.5 rounded-lg text-slate-500 hover:text-violet-400 hover:bg-violet-500/10 transition-all disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Profile gaps */}
      {(analysis.gaps_identified || []).length > 0 && (
        <div className="flex items-start gap-2 p-3 mb-4 rounded-xl border border-amber-500/20 bg-amber-500/5">
          <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300/80">
            <span className="font-semibold">Profile gaps: </span>
            {analysis.gaps_identified.join(' · ')}
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center gap-3 py-10 rounded-2xl border border-violet-500/15"
          style={{ background: 'rgba(181,55,242,0.03)' }}>
          <div className="w-5 h-5 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-slate-400 font-orbitron tracking-wider">ANALYZING YOUR PROFILE…</span>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="text-center py-6 text-xs text-slate-500">
          Could not load suggestions.{' '}
          <button onClick={() => setRefreshKey(k => k + 1)} className="text-violet-400 hover:underline">Retry</button>
        </div>
      )}

      {/* Suggestions grid */}
      {!isLoading && suggestions.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
          {suggestions.map(s => {
            const isApplying = applyingId === s.id;
            const confColor = CONFIDENCE_COLOR(s.confidence_score || 75);
            return (
              <div key={s.id}
                className="relative rounded-2xl p-4 flex flex-col gap-3 transition-all duration-200 cursor-default"
                style={{
                  background: 'rgba(10,15,42,0.75)',
                  border: `1px solid ${s.color || '#a855f7'}25`,
                  backdropFilter: 'blur(20px)',
                }}>

                {/* Confidence badge */}
                <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full"
                  style={{ background: `${confColor}15`, border: `1px solid ${confColor}40` }}>
                  <TrendingUp className="w-2.5 h-2.5" style={{ color: confColor }} />
                  <span className="text-[10px] font-orbitron" style={{ color: confColor }}>
                    {s.confidence_score || 75}%
                  </span>
                </div>

                {/* Icon + Name */}
                <div className="flex items-start gap-2 pr-10">
                  <span className="text-xl shrink-0">{s.icon || '⚡'}</span>
                  <div>
                    <p className="text-xs font-semibold text-white leading-tight">{s.name}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{s.category} · {s.difficulty}</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-[11px] text-slate-400 leading-relaxed">{s.description}</p>

                {/* Why recommended */}
                <div className="flex items-start gap-1.5 p-2 rounded-lg"
                  style={{ background: `${s.color || '#a855f7'}0a`, border: `1px solid ${s.color || '#a855f7'}20` }}>
                  <Sparkles className="w-2.5 h-2.5 shrink-0 mt-0.5" style={{ color: s.color || '#a855f7' }} />
                  <p className="text-[10px]" style={{ color: `${s.color || '#a855f7'}cc` }}>{s.why_recommended}</p>
                </div>

                {/* Profit estimate */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600">Est. daily</span>
                  <span className="text-xs font-orbitron" style={{ color: s.color || '#a855f7' }}>
                    ${s.estimated_daily_profit_low}–${s.estimated_daily_profit_high}
                  </span>
                </div>

                {/* Apply button */}
                <Button
                  size="sm"
                  disabled={isApplying}
                  onClick={() => onApply(s)}
                  className="w-full h-7 text-[11px] font-orbitron tracking-wide mt-auto"
                  style={{
                    background: `linear-gradient(135deg, ${s.color || '#a855f7'}cc, ${s.color || '#a855f7'}80)`,
                    border: `1px solid ${s.color || '#a855f7'}60`,
                    color: '#fff',
                  }}>
                  {isApplying ? (
                    <><div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin mr-1" /> Applying…</>
                  ) : (
                    <><Zap className="w-3 h-3 mr-1" /> Apply & Sync</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}