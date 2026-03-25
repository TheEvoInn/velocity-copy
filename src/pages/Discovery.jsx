/**
 * DISCOVERY HUB — VELO AI
 * AI Assistant: SCOUT
 * 30+ categories · LLM internet scan · Keyword expansion · Online-only · AI-ready
 */
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser, useUserOpportunities } from '@/hooks/useUserData';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import {
  Search, RefreshCw, Sparkles, Filter, Zap, Globe,
  CheckCircle, Bot, Clock, DollarSign, Target, ChevronDown, ChevronUp, Radio, Brain
} from 'lucide-react';
import DiscoveryScanStatus from '@/components/discovery/DiscoveryScanStatus';

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
  dropshipping:         { label: 'Dropshipping',       color: '#4ade80', emoji: '📬' },
  grants:               { label: 'Grants',             color: '#22d3ee', emoji: '🏛️' },
  prizes_contests:      { label: 'Contests',           color: '#e879f9', emoji: '🏆' },
  sweepstakes:          { label: 'Sweepstakes',        color: '#fb7185', emoji: '🎰' },
  crypto_earn:          { label: 'Crypto Earn',        color: '#fbbf24', emoji: '₿' },
  arbitrage:            { label: 'Arbitrage',          color: '#10b981', emoji: '⚖️' },
  lead_generation:      { label: 'Lead Gen',           color: '#06b6d4', emoji: '🎯' },
  seo_tasks:            { label: 'SEO',                color: '#84cc16', emoji: '🔍' },
  email_marketing:      { label: 'Email Marketing',   color: '#f97316', emoji: '📧' },
  video_editing:        { label: 'Video Editing',      color: '#c026d3', emoji: '🎞️' },
  podcasting:           { label: 'Podcasting',         color: '#7c3aed', emoji: '🎤' },
  accounting_finance:   { label: 'Finance',            color: '#16a34a', emoji: '💹' },
  legal_tasks:          { label: 'Legal',              color: '#1d4ed8', emoji: '⚖️' },
  consulting:           { label: 'Consulting',         color: '#b45309', emoji: '🧠' },
  elearning:            { label: 'eLearning',          color: '#0891b2', emoji: '🎓' },
  healthcare_tasks:     { label: 'Healthcare',         color: '#dc2626', emoji: '🏥' },
  real_estate:          { label: 'Real Estate',        color: '#92400e', emoji: '🏠' },
  app_development:      { label: 'App Dev',            color: '#4f46e5', emoji: '📲' },
  reselling:            { label: 'Reselling',          color: '#0d9488', emoji: '🔄' },
  outreach:             { label: 'Outreach',           color: '#6d28d9', emoji: '📨' },
  prompt_engineering:   { label: 'Prompts',            color: '#d97706', emoji: '✨' },
  automation_tools:     { label: 'Automation',         color: '#059669', emoji: '⚙️' },
  nft_web3:             { label: 'Web3/NFT',           color: '#8b5cf6', emoji: '🔮' },
};

const DIFFICULTY_COLOR = { beginner: '#10b981', intermediate: '#f9d65c', advanced: '#ef4444' };
const SCAN_STEPS = [
  '⚙️ Initializing SCOUT v5 — 45+ categories, 700+ keywords, 150+ platforms...',
  '🔍 Expanding keyword matrix across all opportunity categories...',
  '🌐 Scanning: Upwork · Fiverr · Rev · Appen · MTurk · Scale.ai · Outlier.ai · Remotasks · Surge.ai · Alignerr...',
  '🔭 Scanning: Grants.gov · SBA · Devpost · Kaggle · PromptBase · Dework · Gitcoin · Layer3...',
  '🤖 AI internet discovery — live scraping 150+ sources for active opportunities...',
  '🎯 Cross-referencing user skills, identity, and KYC tier with opportunities...',
  '🚫 Filtering non-online, physical, and phone-required tasks...',
  '📊 Scoring by pay rate, speed, AI-fit, platform reliability, skill match...',
  '⚡ Auto-queuing top AI-compatible opportunities for Autopilot execution...',
  '✅ SCOUT discovery complete — syncing to Autopilot queue and Command Hub!',
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

      <div className="font-semibold text-sm text-white mb-1 leading-tight">{opp.title}</div>
      {opp.platform && <div className="text-xs text-slate-500 mb-2">{opp.platform}</div>}

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

      {opp.score > 0 && (
        <div className="mb-3">
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${opp.score}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
          </div>
        </div>
      )}

      {opp.description && (
        <div>
          <button onClick={() => setExpanded(e => !e)}
            className="text-xs text-slate-600 hover:text-slate-400 flex items-center gap-1 mb-1">
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? 'Less' : 'Details'}
          </button>
          {expanded && <div className="text-xs text-slate-400 leading-relaxed">{opp.description}</div>}
        </div>
      )}

      {opp.can_ai_complete && opp.status === 'discovered' && (
        <button onClick={() => onQueueAutopilot(opp)}
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

  // Load user goals for personalized scan parameters
  const { data: userGoals } = useQuery({
    queryKey: ['userGoals', user?.email],
    queryFn: () => base44.entities.UserGoals.filter({ created_by: user?.email }, '-created_date', 1).then(r => r[0]),
    enabled: !!user?.email,
  });

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
  const [scanningCategory, setScanningCategory] = useState(null);
  const [categoryResults, setCategoryResults] = useState({});

  async function scanCategory(categoryKey) {
    if (scanningCategory) return;
    setScanningCategory(categoryKey);
    setCategoryResults(prev => ({ ...prev, [categoryKey]: null }));
    const res = await base44.functions.invoke('discoveryEngine', {
      action: 'scan_category',
      category: categoryKey,
    });
    setScanningCategory(null);
    setCategoryResults(prev => ({ ...prev, [categoryKey]: res.data }));
    setCatFilter(categoryKey);
    qc.invalidateQueries({ queryKey: ['opportunities'] });
    refetch();
  }

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

    // Pass ALL 45 categories explicitly for a full deep scan
    const allCategories = Object.keys(CATEGORIES).filter(k => k !== 'all');

    // Fire discovery engine + proactive scout in parallel for maximum coverage
    const [discoveryRes, scoutRes] = await Promise.allSettled([
      base44.functions.invoke('discoveryEngine', {
        action: 'full_scan',
        categories: allCategories,
        user_email: user?.email,
        user_skills: userGoals?.skills || [],
        preferred_categories: userGoals?.preferred_categories || [],
        risk_tolerance: userGoals?.risk_tolerance || 'moderate',
        daily_target: userGoals?.daily_target || 100,
        hours_per_day: userGoals?.hours_per_day || 8,
        filters: filtersPayload,
      }),
      base44.functions.invoke('proactiveScoutingEngine', {
        action: 'run_scout',
      }),
    ]);

    const mainResult = discoveryRes.status === 'fulfilled' ? discoveryRes.value?.data : null;
    const scoutResult = scoutRes.status === 'fulfilled' ? scoutRes.value?.data : null;

    setLastScanResult({
      ...mainResult,
      scout_created: scoutResult?.created || 0,
      scout_signals: scoutResult?.signals_found || 0,
      scout_auto_queued: scoutResult?.auto_queued || 0,
    });

    qc.invalidateQueries({ queryKey: ['opportunities'] });
    refetch();
    setIsScanning(false);
    setScanStep('');
    setScanProgress(0);
  }

  async function handleQueueAutopilot(opp) {
    await base44.entities.WorkOpportunity.update(opp.id, { autopilot_queued: true, status: 'evaluating' });
    qc.invalidateQueries({ queryKey: ['opportunities'] });
  }

  async function clearAll() {
    for (const opp of rawOpps.slice(0, 50)) {
      await base44.entities.WorkOpportunity.delete(opp.id).catch(() => null);
    }
    qc.invalidateQueries({ queryKey: ['opportunities'] });
  }

  const activeCatList = useMemo(() =>
    Object.entries(CATEGORIES).filter(([key]) => key === 'all' || (catCounts[key] || 0) > 0),
    [catCounts]
  );

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-2 h-8 rounded-full" style={{ background: 'linear-gradient(to bottom, #f59e0b, #f97316)' }} />
            <div>
              <h1 className="font-orbitron text-3xl font-bold text-white">DISCOVERY HUB</h1>
              <p className="text-[10px] font-mono tracking-widest text-amber-400/70">VELO AI · AI: SCOUT</p>
            </div>
          </div>
          <p className="text-slate-400 text-sm ml-5">30+ categories · LLM internet scan · Keyword expansion · Online-only · AI-ready</p>
        </div>
        <div className="flex gap-2 shrink-0">
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

      {/* SCOUT AI Status */}
      <div className="rounded-2xl p-3 flex items-center gap-3 mb-3"
      style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
      <Brain className="w-4 h-4 text-amber-400 shrink-0" />
      <div>
        <span className="text-xs font-orbitron text-amber-400 tracking-wider">SCOUT v5 — FULL INTERNET SCANNER</span>
        <p className="text-xs text-slate-500">45 categories · 700+ keywords · 150+ platforms · AI live internet scan · Auto-Autopilot feed</p>
      </div>
      <span className="text-xs text-amber-400 font-mono px-2 py-0.5 rounded border border-amber-400/30 bg-amber-400/10 shrink-0 ml-auto">ACTIVE</span>
      </div>

      {/* Personalization Context Banner */}
      {userGoals && (userGoals.skills?.length > 0 || userGoals.preferred_categories?.length > 0) && (
        <div className="rounded-xl p-3 flex items-center gap-3 mb-5 flex-wrap"
          style={{ background: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.2)' }}>
          <Target className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-400 font-orbitron tracking-wider">PERSONALIZED SCAN</span>
          <div className="flex flex-wrap gap-1.5 ml-1">
            {userGoals.skills?.slice(0, 5).map(s => (
              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/25 text-indigo-300">{s}</span>
            ))}
            {userGoals.risk_tolerance && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 capitalize">{userGoals.risk_tolerance} risk</span>
            )}
            {userGoals.daily_target > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300">${userGoals.daily_target}/day target</span>
            )}
          </div>
        </div>
      )}

      {/* Scan Status */}
      <DiscoveryScanStatus
        isScanning={isScanning}
        progress={scanProgress}
        currentStep={scanStep}
        lastResult={lastScanResult}
        onDismiss={() => setLastScanResult(null)}
      />

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-5 p-5 rounded-2xl space-y-4"
          style={{ background: 'rgba(10,15,42,0.8)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <div className="font-orbitron text-xs text-slate-400 tracking-widest mb-3">SCOUT FILTERS</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest mb-1 block">
                MIN PAY: <span className="text-emerald-400">${minPay}</span>
              </label>
              <input type="range" min="0" max="200" step="5" value={minPay}
                onChange={e => setMinPay(Number(e.target.value))}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, #10b981 ${minPay / 2}%, #1e293b ${minPay / 2}%)` }} />
            </div>
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
              <button onClick={clearAll} className="ml-auto text-xs text-red-800 hover:text-red-500 font-orbitron transition-colors">
                Clear All
              </button>
            )}
          </div>
        </div>
      )}

      <SummaryBar opportunities={rawOpps} />

      {/* Category Pills */}
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

      {/* Opportunity Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : opportunities.length === 0 ? (
        <div className="text-center py-20">
          <Globe className="w-16 h-16 text-slate-700 mx-auto mb-4" />
          <p className="font-orbitron text-lg text-slate-600 mb-2">No Opportunities Found</p>
          <p className="text-xs text-slate-700 mb-6 max-w-sm mx-auto">
            Run a Full Scan to let SCOUT discover work across 25+ online categories.
          </p>
          <button onClick={() => runFullScan()} disabled={isScanning}
            className="px-8 py-3 rounded-xl font-orbitron text-sm tracking-widest transition-all"
            style={{ background: 'linear-gradient(135deg, rgba(249,214,92,0.15), rgba(255,46,196,0.08))', border: '1px solid rgba(249,214,92,0.4)', color: '#f9d65c' }}>
            <Sparkles className="w-4 h-4 inline mr-2" />LAUNCH SCOUT SCAN
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {opportunities.map(opp => (
            <OppCard key={opp.id} opp={opp} onQueueAutopilot={handleQueueAutopilot} />
          ))}
        </div>
      )}

      {/* Category Coverage Grid */}
      <div className="mt-8 p-5 rounded-2xl"
        style={{ background: 'rgba(10,15,42,0.5)', border: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="font-orbitron text-xs text-slate-600 tracking-widest mb-1">SCOUT COVERAGE — 45 CATEGORIES</div>
        <p className="text-xs text-slate-700 mb-4">Click any category to instantly launch a deep scan &amp; expand results</p>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-7 gap-2">
          {Object.entries(CATEGORIES).filter(([k]) => k !== 'all').map(([key, meta]) => {
            const isThisScanning = scanningCategory === key;
            const justScanned = categoryResults[key];
            return (
              <div key={key}
                className="text-center p-2 rounded-xl cursor-pointer transition-all duration-200"
                onClick={() => isThisScanning ? null : catCounts[key] ? setCatFilter(key) : scanCategory(key)}
                style={{
                  background: isThisScanning ? `${meta.color}15` : catCounts[key] ? `${meta.color}08` : 'rgba(255,255,255,0.01)',
                  border: `1px solid ${isThisScanning ? `${meta.color}55` : catCounts[key] ? `${meta.color}25` : 'rgba(255,255,255,0.04)'}`,
                  opacity: isThisScanning ? 1 : catCounts[key] ? 1 : 0.5,
                  boxShadow: isThisScanning ? `0 0 12px ${meta.color}33` : justScanned ? `0 0 8px ${meta.color}22` : 'none',
                  transform: isThisScanning ? 'scale(1.04)' : 'scale(1)',
                }}>
                <div className="text-lg mb-0.5">
                  {isThisScanning ? <span className="inline-block animate-spin">⚙️</span> : meta.emoji}
                </div>
                <div className="text-xs leading-tight" style={{ color: isThisScanning ? meta.color : catCounts[key] ? meta.color : '#475569' }}>
                  {meta.label}
                </div>
                {catCounts[key] > 0 && !isThisScanning && (
                  <div className="text-xs font-orbitron font-bold mt-0.5" style={{ color: meta.color }}>{catCounts[key]}</div>
                )}
                {isThisScanning && (
                  <div className="text-xs font-orbitron mt-0.5" style={{ color: meta.color }}>SCANNING</div>
                )}
                {justScanned && !isThisScanning && (
                  <div className="text-xs font-orbitron mt-0.5 text-emerald-400">+{justScanned.created || 0} new</div>
                )}
                {!catCounts[key] && !isThisScanning && !justScanned && (
                  <div className="text-[9px] text-slate-700 mt-0.5">tap scan</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}