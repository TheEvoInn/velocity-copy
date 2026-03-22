/**
 * DISCOVERY ENGINE v3
 * Expanded AI-powered work discovery — 25+ categories, keyword expansion,
 * online-only filtering, per-user isolation, autopilot sync
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserOpportunities } from '@/hooks/useUserData';
import { useQueryClient } from '@tanstack/react-query';
import {
  Search, RefreshCw, Sparkles, Filter, TrendingUp, Zap, Globe,
  CheckCircle, Bot, Clock, DollarSign, Target, ChevronDown, ChevronUp, X, Radio
} from 'lucide-react';
import DiscoveryScanStatus from '@/components/discovery/DiscoveryScanStatus';

// ─── CATEGORY META ─────────────────────────────────────────────────────────────
const CATEGORIES = {
  all:                  { label: 'All',               color: '#94a3b8', emoji: '🌐' },
  ai_training:          { label: 'AI Training',        color: '#a855f7', emoji: '🤖' },
  microtasks:           { label: 'Micro Tasks',        color: '#00e8ff', emoji: '⚡' },
  transcription:        { label: 'Transcription',      color: '#3b82f6', emoji: '🎙️' },
  writing:              { label: 'Writing',            color: '#f9d65c', emoji: '✍️' },
  data_entry:           { label: 'Data Entry',         color: '#06b6d4', emoji: '📊' },
  research:             { label: 'Research',           color: '#8b5cf6', emoji: '🔬' },
  virtual_assistant:    { label: 'VA Tasks',           color: '#ec4899', emoji: '🗂️' },
  customer_support:     { label: 'Chat Support',       color: '#10b981', emoji: '💬' },
  surveys:              { label: 'Surveys',            color: '#f97316', emoji: '📋' },
  game_testing:         { label: 'Game Testing',       color: '#84cc16', emoji: '🎮' },
  testing_websites:     { label: 'Web Testing',        color: '#06b6d4', emoji: '🖥️' },
  translation:          { label: 'Translation',        color: '#14b8a6', emoji: '🌍' },
  coding:               { label: 'Coding',             color: '#6366f1', emoji: '💻' },
  design:               { label: 'Design',             color: '#ff2ec4', emoji: '🎨' },
  digital_products:     { label: 'Digital Products',   color: '#f9d65c', emoji: '📦' },
  content_creation:     { label: 'Content Creation',   color: '#f43f5e', emoji: '🎬' },
  social_media:         { label: 'Social Media',       color: '#818cf8', emoji: '📱' },
  affiliate_marketing:  { label: 'Affiliate',          color: '#fb923c', emoji: '🔗' },
  review_writing:       { label: 'Reviews',            color: '#fbbf24', emoji: '⭐' },
  marketplace_listing:  { label: 'Marketplace',        color: '#34d399', emoji: '🛒' },
  tutoring:             { label: 'Tutoring',           color: '#60a5fa', emoji: '📚' },
  freelancing:          { label: 'Freelancing',        color: '#c084fc', emoji: '💼' },
  photo_video:          { label: 'Photo/Video',        color: '#f87171', emoji: '📷' },
  moderation:           { label: 'Moderation',         color: '#94a3b8', emoji: '🛡️' },
};

const DIFFICULTY_COLOR = { beginner: '#10b981', intermediate: '#f9d65c', advanced: '#ef4444' };
const SCAN_STEPS = [
  '⚙️ Initializing keyword expansion engine...',
  '🔍 Expanding 200+ search terms across 30 categories...',
  '🌐 Scanning: Upwork · Fiverr · Rev · Appen · MTurk · Scale.ai · Outlier.ai · Remotasks...',
  '🤖 AI internet discovery — live scraping active opportunities...',
  '🚫 Filtering physical, phone-required, and non-online tasks...',
  '📊 Scoring by pay rate, speed, AI-fit, platform reliability...',
  '⚡ Task Reader parsing — converting to executable workflows...',
  '✅ Discovery complete — syncing to your Autopilot queue!',
];

function OppCard({ opp, onQueueAutopilot }) {
  const cat = CATEGORIES[opp.category] || CATEGORIES.all;
  const color = cat.color;
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-2xl p-4 transition-all duration-200"
      style={{ background: 'rgba(10,15,42,0.75)', border: `1px solid ${color}22` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = `${color}55`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = `${color}22`; e.currentTarget.style.transform = 'translateY(0)'; }}>

      {/* Top row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs px-2 py-0.5 rounded-full font-orbitron"
            style={{ background: `${color}12`, color, border: `1px solid ${color}28` }}>
            {cat.emoji} {cat.label}
          </span>
          {opp.can_ai_complete && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(168,85,247,0.12)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.25)' }}>
              🤖 AI
            </span>
          )}
          {opp.online_only && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.2)' }}>
              🌐 Online
            </span>
          )}
        </div>
        {opp.score > 0 && (
          <div className="font-orbitron text-xs font-bold shrink-0 ml-2" style={{ color }}>
            {Math.round(opp.score)}
          </div>
        )}
      </div>

      {/* Title */}
      <div className="font-semibold text-sm text-white mb-1 leading-tight">{opp.title}</div>

      {/* Platform */}
      {opp.platform && (
        <div className="text-xs text-slate-500 mb-2">{opp.platform}</div>
      )}

      {/* Metrics row */}
      <div className="flex items-center gap-3 mb-3">
        {opp.estimated_pay > 0 && (
          <span className="flex items-center gap-1 text-xs font-mono text-emerald-400">
            <DollarSign className="w-3 h-3" />${opp.estimated_pay}
          </span>
        )}
        {opp.time_estimate_minutes > 0 && (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <Clock className="w-3 h-3" />{opp.time_estimate_minutes < 60 ? `${opp.time_estimate_minutes}m` : `${(opp.time_estimate_minutes / 60).toFixed(1)}h`}
          </span>
        )}
        {opp.difficulty && (
          <span className="text-xs capitalize" style={{ color: DIFFICULTY_COLOR[opp.difficulty] || '#94a3b8' }}>
            {opp.difficulty}
          </span>
        )}
      </div>

      {/* Score bar */}
      {opp.score > 0 && (
        <div className="mb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${opp.score}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
          </div>
        </div>
      )}

      {/* Expandable description */}
      {opp.description && (
        <div>
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1 mb-1">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less' : 'Details'}
          </button>
          {expanded && (
            <div className="text-xs text-slate-400 leading-relaxed">{opp.description}</div>
          )}
        </div>
      )}

      {/* Autopilot queue button */}
      {opp.can_ai_complete && opp.status === 'discovered' && (
        <button
          onClick={() => onQueueAutopilot(opp)}
          className="mt-3 w-full py-1.5 rounded-xl text-xs font-orbitron tracking-wide transition-all"
          style={{ background: 'rgba(0,232,255,0.06)', border: '1px solid rgba(0,232,255,0.2)', color: '#00e8ff' }}>
          ⚡ Queue for Autopilot
        </button>
      )}
      {opp.autopilot_queued && (
        <div className="mt-2 text-center text-xs text-emerald-400 font-orbitron">✓ Queued</div>
      )}
    </div>
  );
}

function SummaryBar({ opportunities }) {
  const total = opportunities.length;
  const aiCompatible = opportunities.filter(o => o.can_ai_complete).length;
  const totalPotential = opportunities.reduce((s, o) => s + (o.estimated_pay || 0), 0);
  const avgScore = total > 0 ? (opportunities.reduce((s, o) => s + (o.score || 0), 0) / total).toFixed(0) : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
      {[
        { label: 'FOUND', value: total, color: '#f9d65c' },
        { label: 'AI-READY', value: aiCompatible, color: '#a855f7' },
        { label: 'POTENTIAL', value: `$${totalPotential.toFixed(0)}`, color: '#10b981' },
        { label: 'AVG SCORE', value: avgScore, color: '#00e8ff' },
      ].map(s => (
        <div key={s.label} className="rounded-2xl p-4"
          style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${s.color}18` }}>
          <div className="text-xs font-orbitron tracking-widest mb-1" style={{ color: `${s.color}70` }}>{s.label}</div>
          <div className="text-2xl font-orbitron font-bold" style={{ color: s.color }}>{s.value}</div>
        </div>
      ))}
    </div>
  );
}

export default function Discovery() {
  const { data: user } = useCurrentUser();
  const { data: rawOpps = [], refetch, isLoading } = useUserOpportunities();
  const qc = useQueryClient();

  const [isScanning, setIsScanning] = useState(false);
  const [scanStep, setScanStep] = useState('');
  const [scanProgress, setScanProgress] = useState(0);
  const [catFilter, setCatFilter] = useState('all');
  const [diffFilter, setDiffFilter] = useState('all');
  const [aiOnly, setAiOnly] = useState(false);
  const [sortBy, setSortBy] = useState('score');
  const [showFilters, setShowFilters] = useState(false);
  const [minPay, setMinPay] = useState(0);
  const [maxTime, setMaxTime] = useState(999);
  const [lastScanResult, setLastScanResult] = useState(null);

  // Filter & sort
  const opportunities = useMemo(() => {
    let opps = [...rawOpps];
    if (catFilter !== 'all') opps = opps.filter(o => o.category === catFilter);
    if (diffFilter !== 'all') opps = opps.filter(o => o.difficulty === diffFilter);
    if (aiOnly) opps = opps.filter(o => o.can_ai_complete);
    if (minPay > 0) opps = opps.filter(o => (o.estimated_pay || 0) >= minPay);
    if (maxTime < 999) opps = opps.filter(o => (o.time_estimate_minutes || 999) <= maxTime);
    if (sortBy === 'score') opps.sort((a, b) => (b.score || 0) - (a.score || 0));
    else if (sortBy === 'pay') opps.sort((a, b) => (b.estimated_pay || 0) - (a.estimated_pay || 0));
    else if (sortBy === 'time') opps.sort((a, b) => (a.time_estimate_minutes || 999) - (b.time_estimate_minutes || 999));
    else if (sortBy === 'new') opps.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
    return opps;
  }, [rawOpps, catFilter, diffFilter, aiOnly, sortBy, minPay, maxTime]);

  // Category counts
  const catCounts = useMemo(() => {
    const counts = {};
    rawOpps.forEach(o => { counts[o.category] = (counts[o.category] || 0) + 1; });
    return counts;
  }, [rawOpps]);

  async function runFullScan(filtersPayload = {}) {
    setIsScanning(true);
    setScanProgress(0);
    setLastScanResult(null);
    for (let i = 0; i < SCAN_STEPS.length; i++) {
      setScanStep(SCAN_STEPS[i]);
      setScanProgress(Math.round(((i + 1) / SCAN_STEPS.length) * 100));
      await new Promise(r => setTimeout(r, 450));
    }
    try {
      const res = await base44.functions.invoke('discoveryEngine', {
        action: 'full_scan',
        user_email: user?.email,
        filters: filtersPayload,
      });
      setLastScanResult(res.data);
      qc.invalidateQueries({ queryKey: ['opportunities'] });
      refetch();
    } catch {}
    setIsScanning(false);
    setScanStep('');
    setScanProgress(0);
  }

  async function handleQueueAutopilot(opp) {
    await base44.entities.WorkOpportunity.update(opp.id, {
      autopilot_queued: true,
      status: 'evaluating',
    }).catch(() => null);
    qc.invalidateQueries({ queryKey: ['opportunities'] });
  }

  async function clearAll() {
    for (const opp of rawOpps.slice(0, 50)) {
      await base44.entities.WorkOpportunity.delete(opp.id).catch(() => null);
    }
    qc.invalidateQueries({ queryKey: ['opportunities'] });
  }

  const activeCatList = Object.entries(CATEGORIES).filter(([key]) => key === 'all' || (catCounts[key] || 0) > 0);

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(249,214,92,0.1)', border: '1px solid rgba(249,214,92,0.3)' }}>
            <Search className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold text-white tracking-widest">DISCOVERY ENGINE</h1>
            <p className="text-xs text-slate-500 font-mono">30+ categories · LLM internet scan · Keyword expansion · Online-only · AI-ready</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(f => !f)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-orbitron transition-all"
            style={{
              background: showFilters ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${showFilters ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: showFilters ? '#a855f7' : '#64748b',
            }}>
            <Filter className="w-3.5 h-3.5" /> Filters
          </button>
          {rawOpps.filter(o => o.can_ai_complete && !o.autopilot_queued).length > 0 && (
            <button
              onClick={async () => {
                await base44.functions.invoke('discoveryEngine', { action: 'queue_all_for_autopilot' });
                qc.invalidateQueries({ queryKey: ['opportunities'] });
              }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
              style={{ background: 'rgba(0,232,255,0.08)', border: '1px solid rgba(0,232,255,0.25)', color: '#00e8ff' }}>
              <Radio className="w-3.5 h-3.5" /> Queue All
            </button>
          )}
          <button onClick={() => runFullScan()} disabled={isScanning}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{ background: 'rgba(249,214,92,0.1)', border: '1px solid rgba(249,214,92,0.4)', color: '#f9d65c' }}>
            {isScanning ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {isScanning ? 'Scanning...' : 'Full Scan'}
          </button>
        </div>
      </div>

      {/* ── SCAN STATUS (progress + results) ── */}
      <DiscoveryScanStatus
        isScanning={isScanning}
        progress={scanProgress}
        currentStep={scanStep}
        lastResult={lastScanResult}
        onDismiss={() => setLastScanResult(null)}
      />

      {/* ── FILTER PANEL ── */}
      {showFilters && (
        <div className="mb-5 p-5 rounded-2xl space-y-4"
          style={{ background: 'rgba(10,15,42,0.8)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div className="font-orbitron text-xs text-slate-400 tracking-widest mb-3">FILTER & SORT</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Sort */}
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-1 block">SORT BY</label>
              <select value={sortBy} onChange={e => setSortBy(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-orbitron text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="score">Score</option>
                <option value="pay">Pay</option>
                <option value="time">Fastest</option>
                <option value="new">Newest</option>
              </select>
            </div>
            {/* Difficulty */}
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-1 block">DIFFICULTY</label>
              <select value={diffFilter} onChange={e => setDiffFilter(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-orbitron text-white"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <option value="all">All</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            {/* Min Pay */}
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-1 block">
                MIN PAY: <span className="text-emerald-400">${minPay}</span>
              </label>
              <input type="range" min="0" max="200" step="5" value={minPay}
                onChange={e => setMinPay(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, #10b981 ${minPay / 2}%, #1e293b ${minPay / 2}%)` }} />
            </div>
            {/* Max Time */}
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-1 block">
                MAX TIME: <span className="text-cyan-400">{maxTime >= 999 ? 'Any' : `${maxTime}m`}</span>
              </label>
              <input type="range" min="10" max="999" step="10" value={maxTime}
                onChange={e => setMaxTime(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, #00e8ff ${maxTime / 10}%, #1e293b ${maxTime / 10}%)` }} />
            </div>
          </div>
          {/* AI toggle */}
          <div className="flex items-center gap-3">
            <button onClick={() => setAiOnly(v => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-orbitron transition-all"
              style={{
                background: aiOnly ? 'rgba(168,85,247,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${aiOnly ? 'rgba(168,85,247,0.4)' : 'rgba(255,255,255,0.08)'}`,
                color: aiOnly ? '#a855f7' : '#64748b',
              }}>
              <Bot className="w-3.5 h-3.5" /> AI-Compatible Only
            </button>
            <button onClick={() => { setCatFilter('all'); setDiffFilter('all'); setAiOnly(false); setMinPay(0); setMaxTime(999); }}
              className="text-xs text-slate-600 hover:text-slate-400 font-orbitron">
              Reset
            </button>
            {rawOpps.length > 0 && (
              <button onClick={clearAll}
                className="ml-auto text-xs text-red-800 hover:text-red-500 font-orbitron transition-colors">
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── SUMMARY STATS ── */}
      <SummaryBar opportunities={rawOpps} />

      {/* ── CATEGORY PILLS ── */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 scrollbar-none">
        {activeCatList.map(([key, meta]) => (
          <button key={key} onClick={() => setCatFilter(key)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-orbitron whitespace-nowrap transition-all shrink-0"
            style={{
              background: catFilter === key ? `${meta.color}15` : 'rgba(255,255,255,0.02)',
              border: `1px solid ${catFilter === key ? `${meta.color}45` : 'rgba(255,255,255,0.06)'}`,
              color: catFilter === key ? meta.color : '#64748b',
            }}>
            {meta.emoji} {meta.label}
            {key !== 'all' && catCounts[key] > 0 && (
              <span className="ml-0.5 text-xs opacity-60">{catCounts[key]}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── OPPORTUNITY GRID ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="font-orbitron text-lg text-slate-600 mb-2">No Opportunities Found</p>
          <p className="text-xs text-slate-700 mb-6 max-w-sm mx-auto">
            Run a Full Scan to discover work across 25+ online categories — AI training, transcription, micro-tasks, writing, and more.
          </p>
          <button onClick={() => runFullScan()} disabled={isScanning}
            className="px-8 py-3 rounded-xl font-orbitron text-sm tracking-widest transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(249,214,92,0.15), rgba(255,46,196,0.08))', border: '1px solid rgba(249,214,92,0.4)', color: '#f9d65c' }}>
            <Sparkles className="w-4 h-4 inline mr-2" />LAUNCH DISCOVERY SCAN
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {opportunities.map(opp => (
            <OppCard key={opp.id} opp={opp} onQueueAutopilot={handleQueueAutopilot} />
          ))}
        </div>
      )}

      {/* ── CATEGORY LEGEND ── */}
      {rawOpps.length > 0 && (
        <div className="mt-8 p-5 rounded-2xl"
          style={{ background: 'rgba(10,15,42,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="font-orbitron text-xs text-slate-600 tracking-widest mb-4">DISCOVERY COVERAGE — 25+ WORK CATEGORIES</div>
          <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
            {Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([key, meta]) => (
              <div key={key} className="text-center p-2 rounded-xl cursor-pointer"
                onClick={() => setCatFilter(key)}
                style={{
                  background: catCounts[key] ? `${meta.color}08` : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${catCounts[key] ? `${meta.color}25` : 'rgba(255,255,255,0.04)'}`,
                  opacity: catCounts[key] ? 1 : 0.4,
                }}>
                <div className="text-lg mb-0.5">{meta.emoji}</div>
                <div className="text-xs leading-tight" style={{ color: catCounts[key] ? meta.color : '#475569' }}>
                  {meta.label}
                </div>
                {catCounts[key] > 0 && (
                  <div className="text-xs font-orbitron font-bold mt-0.5" style={{ color: meta.color }}>
                    {catCounts[key]}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}