import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Library, Filter, RefreshCw, Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import TemplateCard from '@/components/templates/TemplateCard';

// ── Built-in curated templates ────────────────────────────────────────────────
const CURATED_TEMPLATES = [
  {
    id: 'tpl_upwork_freelance',
    name: 'Upwork High-Value Proposals',
    description: 'Continuously scans Upwork for $500+ jobs in tech and writing, auto-generates tailored proposals using AI persona.',
    platform: 'upwork', category: 'freelance', difficulty: 'intermediate', icon: '💼', color: '#14b8a6',
    estimated_daily_profit_low: 200, estimated_daily_profit_high: 800, is_official: true, use_count: 4821,
    tags: ['proposals', 'writing', 'tech'],
    autopilot_config: { enabled: true, mode: 'continuous', execution_mode: 'review_required', max_concurrent_tasks: 3, preferred_categories: ['freelance'] },
    execution_rules: { minimum_profit_threshold: 50, minimum_success_probability: 65, skip_opportunities_with_captcha: true },
    goals_config: { risk_tolerance: 'moderate' },
    setup_steps: ['Connect your Upwork account in Account Manager', 'Create or select a Freelancer AI identity', 'Enable autopilot and run first cycle'],
  },
  {
    id: 'tpl_fiverr_gigs',
    name: 'Fiverr Gig Optimizer',
    description: 'Monitors trending Fiverr categories and automatically queues high-demand gig opportunities for your active personas.',
    platform: 'fiverr', category: 'service', difficulty: 'beginner', icon: '🎨', color: '#22c55e',
    estimated_daily_profit_low: 50, estimated_daily_profit_high: 300, is_official: true, use_count: 3102,
    tags: ['gigs', 'creative', 'design'],
    autopilot_config: { enabled: true, mode: 'continuous', execution_mode: 'full_auto', max_concurrent_tasks: 5, preferred_categories: ['service'] },
    execution_rules: { minimum_profit_threshold: 10, skip_opportunities_with_captcha: true },
    goals_config: { risk_tolerance: 'conservative' },
    setup_steps: ['Link Fiverr account credentials', 'Set your service category preferences', 'Launch with Full Auto mode'],
  },
  {
    id: 'tpl_ebay_arbitrage',
    name: 'eBay Retail Arbitrage',
    description: 'Scans eBay listings for underpriced items and cross-checks retail prices to identify profitable resell margins.',
    platform: 'ebay', category: 'arbitrage', difficulty: 'advanced', icon: '📦', color: '#f59e0b',
    estimated_daily_profit_low: 100, estimated_daily_profit_high: 500, is_official: true, use_count: 2240,
    tags: ['arbitrage', 'resell', 'products'],
    autopilot_config: { enabled: true, mode: 'scheduled', execution_mode: 'review_required', max_concurrent_tasks: 2, preferred_categories: ['arbitrage', 'resale'] },
    execution_rules: { minimum_profit_threshold: 30, minimum_success_probability: 70, skip_opportunities_over_capital_threshold: false },
    goals_config: { risk_tolerance: 'aggressive', available_capital: 1000 },
    setup_steps: ['Set available capital in Goals', 'Link eBay credentials', 'Configure resale price thresholds', 'Start with Review Required mode'],
  },
  {
    id: 'tpl_grant_hunter',
    name: 'Grant & Contest Hunter',
    description: 'Continuously monitors government grants, competitions, and prize pools. Auto-applies to eligible opportunities using KYC identity.',
    platform: 'multi', category: 'grant', difficulty: 'intermediate', icon: '🏆', color: '#8b5cf6',
    estimated_daily_profit_low: 0, estimated_daily_profit_high: 5000, is_official: true, use_count: 1587,
    tags: ['grants', 'prizes', 'competitions'],
    autopilot_config: { enabled: true, mode: 'continuous', execution_mode: 'review_required', max_concurrent_tasks: 3, preferred_categories: ['grant', 'contest'] },
    execution_rules: { skip_opportunities_requiring_kyc: false, minimum_profit_threshold: 100 },
    goals_config: { risk_tolerance: 'moderate' },
    setup_steps: ['Complete KYC verification', 'Create a Legal Identity with your real details', 'Enable grant/contest in preferred categories'],
  },
  {
    id: 'tpl_lead_gen_linkedin',
    name: 'LinkedIn Lead Generation',
    description: 'Identifies high-value B2B leads from LinkedIn and automates outreach sequences to generate consulting or service income.',
    platform: 'linkedin', category: 'lead_gen', difficulty: 'advanced', icon: '🔗', color: '#0ea5e9',
    estimated_daily_profit_low: 150, estimated_daily_profit_high: 1000, is_official: false, use_count: 890,
    tags: ['b2b', 'outreach', 'consulting'],
    autopilot_config: { enabled: true, mode: 'scheduled', execution_mode: 'notification_only', max_concurrent_tasks: 2, preferred_categories: ['lead_gen', 'service'] },
    execution_rules: { minimum_profit_threshold: 100, minimum_success_probability: 60 },
    goals_config: { risk_tolerance: 'moderate' },
    setup_steps: ['Connect LinkedIn account', 'Define target industry and title keywords', 'Review each lead before outreach in notification mode'],
  },
  {
    id: 'tpl_conservative_passive',
    name: 'Conservative Passive Income',
    description: 'Low-risk, high-reliability setup focused on survey completion, small gigs, and verified bounties. Great for beginners.',
    platform: 'multi', category: 'general', difficulty: 'beginner', icon: '🌱', color: '#10b981',
    estimated_daily_profit_low: 20, estimated_daily_profit_high: 100, is_official: true, use_count: 6741,
    tags: ['low-risk', 'passive', 'surveys', 'bounties'],
    autopilot_config: { enabled: true, mode: 'continuous', execution_mode: 'full_auto', max_concurrent_tasks: 5, preferred_categories: ['service', 'general'] },
    execution_rules: { minimum_profit_threshold: 5, minimum_success_probability: 80, skip_opportunities_with_captcha: true, skip_opportunities_requiring_kyc: true },
    goals_config: { risk_tolerance: 'conservative' },
    setup_steps: ['No accounts needed to start', 'Enable Full Auto for hands-free operation', 'Set daily target to $20–$50 to start'],
  },
  {
    id: 'tpl_freelancer_blitz',
    name: 'Freelancer.com Blitz',
    description: 'Aggressive multi-category proposal blitz on Freelancer.com — maximizes application volume with AI-crafted bids.',
    platform: 'freelancer', category: 'freelance', difficulty: 'intermediate', icon: '⚡', color: '#f97316',
    estimated_daily_profit_low: 100, estimated_daily_profit_high: 600, is_official: false, use_count: 1203,
    tags: ['bids', 'volume', 'aggressive'],
    autopilot_config: { enabled: true, mode: 'continuous', execution_mode: 'review_required', max_concurrent_tasks: 6, preferred_categories: ['freelance'] },
    execution_rules: { minimum_profit_threshold: 20, minimum_success_probability: 55 },
    goals_config: { risk_tolerance: 'aggressive' },
    setup_steps: ['Connect Freelancer.com account', 'Set preferred skill categories', 'Monitor and approve top bids daily'],
  },
  {
    id: 'tpl_digital_products',
    name: 'Digital Product Flipper',
    description: 'Finds undervalued digital assets, templates, and tools across marketplaces and resells them at markup on other platforms.',
    platform: 'multi', category: 'arbitrage', difficulty: 'advanced', icon: '💾', color: '#a855f7',
    estimated_daily_profit_low: 50, estimated_daily_profit_high: 400, is_official: false, use_count: 621,
    tags: ['digital', 'templates', 'assets'],
    autopilot_config: { enabled: true, mode: 'scheduled', execution_mode: 'review_required', max_concurrent_tasks: 2, preferred_categories: ['arbitrage', 'digital_flip'] },
    execution_rules: { minimum_profit_threshold: 25, skip_opportunities_over_capital_threshold: false },
    goals_config: { risk_tolerance: 'moderate' },
    setup_steps: ['Set capital budget for purchases', 'List resale platforms in Account Manager', 'Review each flip manually before purchase'],
  },
];

const ALL_PLATFORMS = ['all', 'upwork', 'fiverr', 'ebay', 'freelancer', 'linkedin', 'multi'];
const ALL_CATEGORIES = ['all', 'freelance', 'arbitrage', 'lead_gen', 'contest', 'grant', 'resale', 'service', 'general'];
const ALL_DIFFICULTIES = ['all', 'beginner', 'intermediate', 'advanced'];

export default function TemplatesLibrary() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [filterPlatform, setFilterPlatform] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterDifficulty, setFilterDifficulty] = useState('all');
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [applyingId, setApplyingId] = useState(null);

  // Load user's saved templates + UserDataStore
  const { data: store, refetch: refetchStore } = useQuery({
    queryKey: ['userDataStore_templates'],
    queryFn: async () => {
      const me = await base44.auth.me();
      const res = await base44.entities.UserDataStore.filter({ user_email: me.email });
      return res[0] || null;
    }
  });

  const { data: userGoals = {} } = useQuery({
    queryKey: ['userGoals'],
    queryFn: () => base44.entities.UserGoals.list().then(r => r[0] || {}),
  });

  // Load any custom templates from the database
  const { data: customTemplates = [] } = useQuery({
    queryKey: ['workflowTemplates'],
    queryFn: () => base44.entities.WorkflowTemplate.list('-use_count', 50),
  });

  const savedIds = store?.saved_workflows?.map(w => w.workflow_id) || [];
  const appliedId = store?.autopilot_preferences?.active_template_id;

  // Merge curated + custom
  const allTemplates = [
    ...CURATED_TEMPLATES,
    ...customTemplates.map(t => ({ ...t, id: t.id || `custom_${t.id}` })),
  ];

  // Filter
  const filtered = allTemplates.filter(t => {
    if (showSavedOnly && !savedIds.includes(t.id)) return false;
    if (filterPlatform !== 'all' && t.platform !== filterPlatform) return false;
    if (filterCategory !== 'all' && t.category !== filterCategory) return false;
    if (filterDifficulty !== 'all' && t.difficulty !== filterDifficulty) return false;
    if (search) {
      const q = search.toLowerCase();
      return t.name.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.tags?.some(tag => tag.includes(q));
    }
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async (template) => {
      const me = await base44.auth.me();
      const currentSaved = store?.saved_workflows || [];
      const alreadySaved = currentSaved.find(w => w.workflow_id === template.id);
      const newSaved = alreadySaved
        ? currentSaved.filter(w => w.workflow_id !== template.id)
        : [...currentSaved, { workflow_id: template.id, workflow_name: template.name, execution_rules: template.execution_rules || {} }];

      if (store) {
        return base44.entities.UserDataStore.update(store.id, { saved_workflows: newSaved });
      } else {
        return base44.entities.UserDataStore.create({ user_email: me.email, saved_workflows: newSaved });
      }
    },
    onSuccess: (_, template) => {
      const isSaved = savedIds.includes(template.id);
      toast.success(isSaved ? 'Removed from saved templates' : 'Template saved!');
      refetchStore();
      qc.invalidateQueries({ queryKey: ['userDataStore_templates'] });
    },
    onError: e => toast.error(e.message),
  });

  const applyMutation = useMutation({
    mutationFn: async (template) => {
      const me = await base44.auth.me();

      // Apply to autopilot preferences in UserDataStore
      const newAutopilotPrefs = {
        ...(store?.autopilot_preferences || {}),
        ...(template.autopilot_config || {}),
        active_template_id: template.id,
        active_template_name: template.name,
      };

      const newExecutionRules = {
        ...(store?.execution_rules || {}),
        ...(template.execution_rules || {}),
      };

      const updates = {
        autopilot_preferences: newAutopilotPrefs,
        execution_rules: newExecutionRules,
      };

      if (store) {
        await base44.entities.UserDataStore.update(store.id, updates);
      } else {
        const storeData = await base44.entities.UserDataStore.create({ user_email: me.email, ...updates });
      }

      // Apply goals config if provided
      if (template.goals_config && userGoals.id) {
        await base44.entities.UserGoals.update(userGoals.id, template.goals_config);
      }

      return template;
    },
    onSuccess: (template) => {
      toast.success(`✓ "${template.name}" applied! Autopilot configured.`);
      qc.invalidateQueries({ queryKey: ['userDataStore_templates'] });
      qc.invalidateQueries({ queryKey: ['userGoals'] });
      qc.invalidateQueries({ queryKey: ['platformState'] });
      setApplyingId(null);
    },
    onError: (error) => {
      console.error('Apply template error:', error);
      toast.error(`Failed to apply template: ${error.message || 'Unknown error'}`);
      setApplyingId(null);
    },
  });

  const handleApply = async (template) => {
    setApplyingId(template.id);
    applyMutation.mutate(template);
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.4)' }}>
            📚
          </div>
          <div>
            <h1 className="font-orbitron text-xl font-bold tracking-widest text-white text-glow-violet">
              TEMPLATES LIBRARY
            </h1>
            <p className="text-xs text-slate-500 tracking-wide mt-0.5">
              {allTemplates.length} pre-configured workflow templates · One-click deploy
            </p>
          </div>
        </div>
        {appliedId && (
          <div className="text-[11px] px-3 py-1.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-300">
            <Sparkles className="w-3 h-3 inline mr-1" />
            Active: {store?.autopilot_preferences?.active_template_name || appliedId}
          </div>
        )}
      </div>

      {/* Search + Filters */}
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search templates..."
            className="pl-9 bg-slate-800/60 border-slate-700 text-sm"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          {/* Platform filter */}
          <select
            value={filterPlatform}
            onChange={e => setFilterPlatform(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs"
          >
            {ALL_PLATFORMS.map(p => <option key={p} value={p}>{p === 'all' ? 'All Platforms' : p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
          </select>

          {/* Category filter */}
          <select
            value={filterCategory}
            onChange={e => setFilterCategory(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs"
          >
            {ALL_CATEGORIES.map(c => <option key={c} value={c}>{c === 'all' ? 'All Categories' : c.replace(/_/g, ' ')}</option>)}
          </select>

          {/* Difficulty filter */}
          <select
            value={filterDifficulty}
            onChange={e => setFilterDifficulty(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-300 rounded-lg px-3 py-2 text-xs"
          >
            {ALL_DIFFICULTIES.map(d => <option key={d} value={d}>{d === 'all' ? 'All Levels' : d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
          </select>

          {/* Saved toggle */}
          <button
            onClick={() => setShowSavedOnly(!showSavedOnly)}
            className="px-3 py-2 rounded-lg text-xs transition-all"
            style={{
              background: showSavedOnly ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${showSavedOnly ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.1)'}`,
              color: showSavedOnly ? '#a78bfa' : '#94a3b8',
            }}
          >
            🔖 Saved ({savedIds.length})
          </button>
        </div>
      </div>

      {/* Results count */}
      <div className="flex items-center gap-2 mb-4 text-xs text-slate-500">
        <Filter className="w-3.5 h-3.5" />
        {filtered.length} template{filtered.length !== 1 ? 's' : ''} found
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Library className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No templates match your filters.</p>
          <Button size="sm" variant="ghost" className="mt-3 text-xs"
            onClick={() => { setSearch(''); setFilterPlatform('all'); setFilterCategory('all'); setFilterDifficulty('all'); setShowSavedOnly(false); }}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              isSaved={savedIds.includes(template.id)}
              isApplied={appliedId === template.id}
              applying={applyingId === template.id}
              onSave={() => saveMutation.mutate(template)}
              onApply={() => handleApply(template)}
            />
          ))}
        </div>
      )}

      {/* Setup panel — show when a template is applied */}
      {appliedId && (() => {
        const active = allTemplates.find(t => t.id === appliedId);
        if (!active?.setup_steps?.length) return null;
        return (
          <div className="mt-8 p-5 rounded-2xl border border-violet-500/25 bg-violet-500/5">
            <h3 className="font-orbitron text-xs tracking-widest text-violet-400 mb-4">
              SETUP GUIDE · {active.name}
            </h3>
            <div className="space-y-2">
              {active.setup_steps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <span className="font-orbitron text-xs text-violet-500 shrink-0 mt-0.5">{String(i + 1).padStart(2, '0')}</span>
                  <p className="text-xs text-slate-300">{step}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}