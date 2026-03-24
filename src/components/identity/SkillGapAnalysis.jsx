/**
 * SKILL GAP ANALYSIS
 * AI-driven tool that cross-references user's AI identities against
 * high-demand task categories from the Discovery engine, then recommends
 * specific training or persona adjustments to increase earning potential.
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, TrendingUp, AlertCircle, CheckCircle2, ChevronDown, ChevronUp, RefreshCw, Target, Zap, Brain } from 'lucide-react';

const PRIORITY_COLOR = {
  high:   { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  text: '#ef4444', label: 'HIGH' },
  medium: { bg: 'rgba(249,214,92,0.1)', border: 'rgba(249,214,92,0.3)', text: '#f9d65c', label: 'MEDIUM' },
  low:    { bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)', text: '#10b981', label: 'LOW' },
};

function GapCard({ gap, idx }) {
  const [expanded, setExpanded] = useState(false);
  const p = PRIORITY_COLOR[gap.priority] || PRIORITY_COLOR.medium;
  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: p.bg, border: `1px solid ${p.border}` }}>
      <button className="w-full flex items-start justify-between p-4 text-left gap-3" onClick={() => setExpanded(e => !e)}>
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <span className="text-[10px] font-orbitron font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0"
            style={{ background: p.border, color: p.text }}>
            {p.label}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white mb-0.5">{gap.category}</div>
            <div className="text-xs text-slate-400 truncate">{gap.identity_name} · {gap.gap_summary}</div>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-sm font-orbitron font-bold text-emerald-400">+${gap.potential_uplift}/mo</div>
            <div className="text-[9px] text-slate-600">est. uplift</div>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: p.border }}>
          {/* Demand signal */}
          <div className="pt-3">
            <div className="text-[10px] font-orbitron tracking-widest text-slate-500 mb-1.5">MARKET DEMAND SIGNAL</div>
            <p className="text-xs text-slate-300 leading-relaxed">{gap.demand_signal}</p>
          </div>
          {/* Current vs required */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[9px] font-orbitron text-slate-500 tracking-widest mb-1.5">CURRENT SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {(gap.current_skills || []).map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-300">{s}</span>
                ))}
                {!gap.current_skills?.length && <span className="text-[10px] text-slate-600">None listed</span>}
              </div>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: `1px solid ${p.border}` }}>
              <div className="text-[9px] font-orbitron tracking-widest mb-1.5" style={{ color: p.text }}>NEEDED SKILLS</div>
              <div className="flex flex-wrap gap-1">
                {(gap.needed_skills || []).map(s => (
                  <span key={s} className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: p.bg, color: p.text, border: `1px solid ${p.border}` }}>{s}</span>
                ))}
              </div>
            </div>
          </div>
          {/* Recommendations */}
          <div>
            <div className="text-[10px] font-orbitron tracking-widest text-slate-500 mb-2">RECOMMENDED ACTIONS</div>
            <div className="space-y-1.5">
              {(gap.recommendations || []).map((r, i) => (
                <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                  <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                  <span className="leading-relaxed">{r}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SkillGapAnalysis({ identities }) {
  const [analysis, setAnalysis] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Pull recent opportunities to get real demand signal
  const { data: opportunities = [] } = useQuery({
    queryKey: ['opportunities_for_gap'],
    queryFn: () => base44.entities.Opportunity.list('-created_date', 100),
    staleTime: 5 * 60 * 1000,
  });

  const runAnalysis = async () => {
    if (!identities?.length) return;
    setIsAnalyzing(true);
    setError('');
    setAnalysis(null);

    try {
      // Build identity summary
      const identitySummary = identities.map(i => ({
        id: i.id,
        name: i.name,
        role: i.role_label,
        skills: i.skills || [],
        preferred_categories: i.preferred_categories || [],
        tasks_executed: i.tasks_executed || 0,
        total_earned: i.total_earned || 0,
        tone: i.communication_tone,
        platforms: i.preferred_platforms || [],
      }));

      // Build demand signal from real opportunities
      const categoryDemand = {};
      opportunities.forEach(opp => {
        const cat = opp.category || 'other';
        if (!categoryDemand[cat]) categoryDemand[cat] = { count: 0, avg_score: 0, total_score: 0, platforms: new Set() };
        categoryDemand[cat].count++;
        categoryDemand[cat].total_score += opp.overall_score || 0;
        if (opp.platform) categoryDemand[cat].platforms.add(opp.platform);
      });
      const demandRanking = Object.entries(categoryDemand)
        .map(([cat, d]) => ({ category: cat, count: d.count, avg_score: d.total_score / d.count, platforms: [...d.platforms] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a career strategy AI for the VELOCITY autonomous profit platform. Analyze the skill gaps between the user's AI identities and current high-demand task categories discovered by the platform's Discovery engine.

USER'S AI IDENTITIES:
${JSON.stringify(identitySummary, null, 2)}

HIGH-DEMAND CATEGORIES (from real Discovery data):
${JSON.stringify(demandRanking, null, 2)}

Total opportunities analyzed: ${opportunities.length}

For each significant gap you find, provide:
1. Which identity is missing which skills
2. The market demand signal explaining WHY this gap costs money
3. Specific, actionable recommendations to close the gap (persona adjustments, skills to add, tone changes, platform focus shifts)
4. Realistic monthly earning uplift estimate if gap is closed

Return a JSON object with:
- summary: brief 1-2 sentence executive summary
- overall_score: number 0-100 (current identity portfolio health)
- top_opportunities: array of top 3 categories the user is WELL-positioned for
- gaps: array of gap objects, each with:
  - identity_name: string
  - category: string (the high-demand category)
  - priority: "high" | "medium" | "low"
  - gap_summary: string (one sentence)
  - demand_signal: string (why this category is hot right now)
  - current_skills: array of strings (what the identity has)
  - needed_skills: array of strings (what's missing)
  - recommendations: array of 2-4 specific action strings
  - potential_uplift: number (estimated extra $/month)`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            overall_score: { type: 'number' },
            top_opportunities: { type: 'array', items: { type: 'string' } },
            gaps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  identity_name: { type: 'string' },
                  category: { type: 'string' },
                  priority: { type: 'string' },
                  gap_summary: { type: 'string' },
                  demand_signal: { type: 'string' },
                  current_skills: { type: 'array', items: { type: 'string' } },
                  needed_skills: { type: 'array', items: { type: 'string' } },
                  recommendations: { type: 'array', items: { type: 'string' } },
                  potential_uplift: { type: 'number' },
                },
              },
            },
          },
        },
      });

      setAnalysis(result);
    } catch (err) {
      setError(err.message || 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const totalUplift = (analysis?.gaps || []).reduce((sum, g) => sum + (g.potential_uplift || 0), 0);
  const highPriority = (analysis?.gaps || []).filter(g => g.priority === 'high').length;

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="rounded-2xl p-5"
        style={{ background: 'rgba(10,15,42,0.7)', border: '1px solid rgba(168,85,247,0.25)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)' }}>
              <Brain className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-orbitron text-sm font-bold text-white tracking-widest">AI SKILL GAP ANALYSIS</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Cross-references your {identities.length} identity(ies) against {opportunities.length} real Discovery opportunities
              </p>
            </div>
          </div>
          <button
            onClick={runAnalysis}
            disabled={isAnalyzing || !identities.length}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-orbitron text-xs tracking-widest transition-all disabled:opacity-40"
            style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)', color: '#a855f7' }}>
            {isAnalyzing
              ? <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Analyzing...</>
              : <><Sparkles className="w-3.5 h-3.5" /> {analysis ? 'Re-Analyze' : 'Run Analysis'}</>
            }
          </button>
        </div>

        {!analysis && !isAnalyzing && (
          <div className="mt-4 p-4 rounded-xl text-center"
            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(168,85,247,0.1)' }}>
            <Sparkles className="w-8 h-8 text-violet-500/40 mx-auto mb-2" />
            <p className="text-sm text-slate-500">Click <span className="text-violet-400">Run Analysis</span> to evaluate your identities against current market demand and receive AI-driven recommendations.</p>
          </div>
        )}

        {isAnalyzing && (
          <div className="mt-4 space-y-2">
            {['Loading identity profiles...', 'Fetching Discovery demand data...', 'Running AI gap analysis...'].map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-xs text-slate-500 animate-pulse" style={{ animationDelay: `${i * 0.3}s` }}>
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                {step}
              </div>
            ))}
          </div>
        )}
      </div>

      {error && (
        <div className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <p className="text-xs text-red-300">{error}</p>
        </div>
      )}

      {analysis && (
        <>
          {/* Score strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'PORTFOLIO HEALTH', value: `${analysis.overall_score}/100`, color: analysis.overall_score >= 70 ? '#10b981' : analysis.overall_score >= 40 ? '#f9d65c' : '#ef4444', icon: Target },
              { label: 'GAPS FOUND', value: analysis.gaps?.length || 0, color: '#a855f7', icon: Brain },
              { label: 'HIGH PRIORITY', value: highPriority, color: '#ef4444', icon: AlertCircle },
              { label: 'EST. UPLIFT', value: `+$${totalUplift.toLocaleString()}/mo`, color: '#10b981', icon: TrendingUp },
            ].map(m => (
              <div key={m.label} className="rounded-2xl p-4"
                style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${m.color}25` }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[9px] font-orbitron tracking-widest" style={{ color: `${m.color}99` }}>{m.label}</span>
                  <m.icon className="w-3 h-3" style={{ color: m.color }} />
                </div>
                <div className="text-xl font-orbitron font-bold" style={{ color: m.color }}>{m.value}</div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="p-4 rounded-2xl"
            style={{ background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.2)' }}>
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
              <p className="text-sm text-slate-300 leading-relaxed">{analysis.summary}</p>
            </div>
          </div>

          {/* Top opportunities */}
          {analysis.top_opportunities?.length > 0 && (
            <div>
              <div className="text-[10px] font-orbitron tracking-widest text-emerald-400/70 mb-2 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5" /> WELL-POSITIONED CATEGORIES
              </div>
              <div className="flex flex-wrap gap-2">
                {analysis.top_opportunities.map(opp => (
                  <span key={opp} className="text-xs px-3 py-1 rounded-full font-medium"
                    style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
                    ✓ {opp}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Gap cards */}
          {analysis.gaps?.length > 0 && (
            <div>
              <div className="text-[10px] font-orbitron tracking-widest text-slate-500 mb-3 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5" /> SKILL GAPS & RECOMMENDATIONS ({analysis.gaps.length})
              </div>
              <div className="space-y-3">
                {analysis.gaps
                  .sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]))
                  .map((gap, i) => <GapCard key={i} gap={gap} idx={i} />)
                }
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}