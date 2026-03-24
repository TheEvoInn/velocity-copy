/**
 * STEP WORKFLOWS — Onboarding Step 5
 * Shows AI-suggested ready-to-implement workflow & strategy templates
 * based on user's identity + preferences. Auto-applies best matches if user
 * skips selection.
 */
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, Workflow, Sparkles, Loader2, CheckCircle2, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';

// Curated template library
const TEMPLATE_LIBRARY = [
  {
    id: 'freelance_writer',
    title: 'Freelance Writing Autopilot',
    category: 'freelance',
    description: 'Continuously scans Upwork, Freelancer & ProBlogger for writing gigs, auto-applies with AI-generated proposals.',
    tags: ['Writing', 'Content', 'Upwork'],
    risk: 'low', earning_est: '$500–2,000/mo', skills_match: ['Writing', 'Research', 'SEO'],
    categories_match: ['freelance', 'service'],
    color: '#8b5cf6', icon: '✍️',
    strategy: { variant: 'fastest', target_daily_profit: 80, starting_capital: 0 },
  },
  {
    id: 'digital_arbitrage',
    title: 'Digital Product Arbitrage',
    category: 'arbitrage',
    description: 'Finds underpriced digital assets on marketplaces, flips them at 2–5x margin using AI valuation.',
    tags: ['Arbitrage', 'Digital Flip', 'Passive'],
    risk: 'moderate', earning_est: '$300–1,500/mo', skills_match: ['Research', 'Marketing'],
    categories_match: ['arbitrage', 'digital_flip'],
    color: '#f59e0b', icon: '🔄',
    strategy: { variant: 'highest_yield', target_daily_profit: 100, starting_capital: 200 },
  },
  {
    id: 'lead_gen_machine',
    title: 'B2B Lead Generation Machine',
    category: 'lead_gen',
    description: 'Automates LinkedIn/web scraping, qualifies leads with AI, and delivers packaged lead lists to buyers.',
    tags: ['Lead Gen', 'B2B', 'Sales'],
    risk: 'low', earning_est: '$800–3,000/mo', skills_match: ['Sales', 'Research', 'Marketing'],
    categories_match: ['lead_gen', 'service'],
    color: '#06b6d4', icon: '🎯',
    strategy: { variant: 'safest', target_daily_profit: 120, starting_capital: 0 },
  },
  {
    id: 'grant_hunter',
    title: 'AI Grant Hunter',
    category: 'grant',
    description: 'Monitors 500+ grant databases, matches eligibility, auto-fills applications using your verified identity.',
    tags: ['Grants', 'Government', 'Free Money'],
    risk: 'low', earning_est: '$1,000–10,000/grant', skills_match: ['Writing', 'Research'],
    categories_match: ['grant'],
    color: '#10b981', icon: '🏛️',
    strategy: { variant: 'safest', target_daily_profit: 0, starting_capital: 0 },
  },
  {
    id: 'contest_sweeper',
    title: 'Contest & Giveaway Sweeper',
    category: 'contest',
    description: 'Automatically enters legitimate contests and giveaways at scale using your verified identity profile.',
    tags: ['Contest', 'Giveaway', 'Passive'],
    risk: 'low', earning_est: '$100–500/mo', skills_match: [],
    categories_match: ['contest', 'giveaway'],
    color: '#ec4899', icon: '🎰',
    strategy: { variant: 'fastest', target_daily_profit: 20, starting_capital: 0 },
  },
  {
    id: 'resale_engine',
    title: 'Resale & Flip Engine',
    category: 'resale',
    description: 'Monitors eBay, Craigslist & FB Marketplace for underpriced items, coordinates buy-low-sell-high cycles.',
    tags: ['Resale', 'Physical', 'Arbitrage'],
    risk: 'moderate', earning_est: '$500–2,500/mo', skills_match: ['Research'],
    categories_match: ['resale', 'arbitrage', 'auction'],
    color: '#f97316', icon: '📦',
    strategy: { variant: 'highest_yield', target_daily_profit: 150, starting_capital: 500 },
  },
  {
    id: 'dev_gigs',
    title: 'Dev & Tech Gig Autopilot',
    category: 'freelance',
    description: 'Targets high-value development, automation, and tech consulting gigs on premium platforms.',
    tags: ['Coding', 'Dev', 'Tech'],
    risk: 'low', earning_est: '$2,000–8,000/mo', skills_match: ['Coding', 'Data Analysis'],
    categories_match: ['freelance', 'service'],
    color: '#3b82f6', icon: '💻',
    strategy: { variant: 'highest_yield', target_daily_profit: 300, starting_capital: 0 },
  },
  {
    id: 'design_gigs',
    title: 'Design & Creative Autopilot',
    category: 'freelance',
    description: 'Scans for design, video editing, and creative work. Auto-pitches with AI-generated portfolio excerpts.',
    tags: ['Design', 'Video', 'Creative'],
    risk: 'low', earning_est: '$800–4,000/mo', skills_match: ['Design', 'Video Editing', 'Photography'],
    categories_match: ['freelance', 'service'],
    color: '#ec4899', icon: '🎨',
    strategy: { variant: 'safest', target_daily_profit: 150, starting_capital: 0 },
  },
];

function scoreTemplate(template, identityData, prefData) {
  let score = 0;
  const userSkills = identityData.skills || [];
  const userCats = prefData.preferred_categories || [];
  const capital = prefData.available_capital || 0;
  const risk = prefData.risk_tolerance || 'moderate';

  // Category match
  template.categories_match.forEach(c => { if (userCats.includes(c)) score += 20; });
  // Skill match
  template.skills_match.forEach(s => { if (userSkills.includes(s)) score += 15; });
  // Capital requirement
  if (template.strategy.starting_capital === 0) score += 10;
  else if (template.strategy.starting_capital <= capital) score += 5;
  // Risk match
  if (risk === 'conservative' && template.risk === 'low') score += 10;
  if (risk === 'aggressive' && template.risk !== 'low') score += 10;
  if (risk === 'moderate') score += 5;

  return score;
}

export default function StepWorkflows({ data, onChange, identityData, prefData, onNext, onBack }) {
  const [loading, setLoading] = useState(false);
  const [aiSuggested, setAiSuggested] = useState([]);
  const selected = data.selected_templates || [];

  // Score and rank templates on mount
  useEffect(() => {
    const scored = TEMPLATE_LIBRARY
      .map(t => ({ ...t, score: scoreTemplate(t, identityData, prefData) }))
      .sort((a, b) => b.score - a.score);
    setAiSuggested(scored);
  }, []);

  const toggle = (id) => {
    onChange({
      ...data,
      selected_templates: selected.includes(id)
        ? selected.filter(s => s !== id)
        : [...selected, id],
    });
  };

  const selectAll = () => {
    const top = aiSuggested.slice(0, 4).map(t => t.id);
    onChange({ ...data, selected_templates: top });
  };

  const handleNext = () => {
    // If nothing selected, auto-select top 3 matches
    if (!selected.length) {
      const autoSelected = aiSuggested.slice(0, 3).map(t => t.id);
      onChange({ ...data, selected_templates: autoSelected, auto_matched: true });
    }
    onNext();
  };

  const topTemplates = aiSuggested.slice(0, 4);
  const otherTemplates = aiSuggested.slice(4);

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Workflow className="w-5 h-5 text-violet-400" />
        <h2 className="text-base font-bold text-white">Workflows & Strategies</h2>
        <span className="ml-auto text-[10px] text-slate-500">Auto-applied if none selected</span>
      </div>

      <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-3 mb-4 flex items-start gap-2">
        <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <p className="text-xs text-violet-200/80 leading-relaxed">
          AI has ranked these templates based on your skills, target earnings, and risk tolerance.
          Select the ones you want — or skip and we'll automatically apply the top matches.
        </p>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">

        {/* AI-Recommended top picks */}
        <div className="text-[10px] font-orbitron tracking-widest text-violet-400/70 mb-1.5 flex items-center gap-2">
          <Sparkles className="w-3 h-3" /> AI-RECOMMENDED FOR YOU
          <button onClick={selectAll} className="ml-auto text-[9px] text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded px-2 py-0.5 transition-colors">
            Select All Top 4
          </button>
        </div>

        {topTemplates.map(t => {
          const isSelected = selected.includes(t.id);
          return (
            <button key={t.id} type="button" onClick={() => toggle(t.id)}
              className="w-full text-left rounded-xl border p-3 transition-all"
              style={{
                background: isSelected ? `${t.color}12` : 'rgba(30,41,59,0.5)',
                borderColor: isSelected ? `${t.color}50` : 'rgba(71,85,105,0.5)',
                boxShadow: isSelected ? `0 0 16px ${t.color}15` : 'none',
              }}>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0 mt-0.5">{t.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold text-white">{t.title}</span>
                    {t.score >= 40 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold"
                        style={{ background: `${t.color}20`, color: t.color, border: `1px solid ${t.color}40` }}>
                        BEST MATCH
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 leading-relaxed mb-1.5">{t.description}</p>
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-emerald-400 font-semibold">{t.earning_est}</span>
                    <span className="text-[10px] text-slate-600">Risk: {t.risk}</span>
                    <div className="flex gap-1 ml-auto">
                      {t.tags.map(tag => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700/60 text-slate-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 mt-1">
                  {isSelected
                    ? <CheckCircle2 className="w-4 h-4" style={{ color: t.color }} />
                    : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />
                  }
                </div>
              </div>
            </button>
          );
        })}

        {/* More templates (collapsed section) */}
        {otherTemplates.length > 0 && (
          <>
            <div className="text-[10px] font-orbitron tracking-widest text-slate-600 mt-3 mb-1.5">MORE TEMPLATES</div>
            {otherTemplates.map(t => {
              const isSelected = selected.includes(t.id);
              return (
                <button key={t.id} type="button" onClick={() => toggle(t.id)}
                  className="w-full text-left rounded-xl border p-3 transition-all"
                  style={{
                    background: isSelected ? `${t.color}12` : 'rgba(15,23,42,0.4)',
                    borderColor: isSelected ? `${t.color}50` : 'rgba(51,65,85,0.4)',
                  }}>
                  <div className="flex items-center gap-3">
                    <span className="text-lg shrink-0">{t.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white">{t.title}</div>
                      <div className="text-[10px] text-slate-500">{t.earning_est} · Risk: {t.risk}</div>
                    </div>
                    {isSelected
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" style={{ color: t.color }} />
                      : <div className="w-4 h-4 rounded-full border-2 border-slate-700 shrink-0" />
                    }
                  </div>
                </button>
              );
            })}
          </>
        )}
      </div>

      {selected.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-violet-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {selected.length} workflow{selected.length !== 1 ? 's' : ''} selected — will be activated at launch
        </div>
      )}
      {!selected.length && (
        <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
          <Zap className="w-3.5 h-3.5 text-violet-400" />
          No selection = top 3 AI-matched workflows auto-applied at launch
        </div>
      )}

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
        <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 text-slate-400 h-9 px-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
        <Button onClick={handleNext} size="sm" className="flex-1 bg-violet-600 hover:bg-violet-500 text-white h-9">
          {selected.length ? `Apply ${selected.length} Workflow${selected.length !== 1 ? 's' : ''} & Continue` : 'Auto-Match & Continue'} <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

export { TEMPLATE_LIBRARY };