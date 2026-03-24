/**
 * CONTROL — Workflows & Strategies Hub
 * Unified command surface for all user workflows, strategies, and automation templates.
 */
import React, { useState } from 'react';
import { useWorkflows, useAIIdentities } from '@/hooks/useQueryHooks';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Zap, Settings, Workflow, BookOpen, Plus, Play, Pause,
  ChevronRight, TrendingUp, Target, Layers, GitBranch, Sparkles, RefreshCw
} from 'lucide-react';

const STATUS_COLOR = {
  active:    'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  paused:    'text-amber-400  bg-amber-500/10  border-amber-500/30',
  draft:     'text-slate-400  bg-slate-700/30  border-slate-600/30',
  completed: 'text-cyan-400   bg-cyan-500/10   border-cyan-500/30',
  abandoned: 'text-red-400    bg-red-500/10    border-red-500/30',
};

const VARIANT_COLOR = {
  fastest:      { color: '#f9d65c', label: 'Fastest' },
  safest:       { color: '#10b981', label: 'Safest' },
  highest_yield:{ color: '#a855f7', label: 'High Yield' },
};

const TABS = [
  { key: 'strategies', label: 'Strategies',  icon: Target },
  { key: 'workflows',  label: 'Workflows',   icon: GitBranch },
  { key: 'templates',  label: 'Templates',   icon: Layers },
];

export default function Control() {
  const qc = useQueryClient();
  const [tab, setTab] = useState('strategies');

  const { data: workflows = [], isLoading: wfLoading } = useWorkflows();
  const { data: identities = [] } = useAIIdentities();

  const { data: strategies = [], isLoading: stratLoading } = useQuery({
    queryKey: ['strategies'],
    queryFn: () => base44.entities.Strategy.list('-updated_date', 50),
  });

  const { data: store } = useQuery({
    queryKey: ['userDataStore_control'],
    queryFn: async () => {
      const me = await base44.auth.me();
      const res = await base44.entities.UserDataStore.filter({ user_email: me.email });
      return res[0] || null;
    },
  });

  const updateStrategy = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Strategy.update(id, data),
    onSuccess: () => qc.invalidateQueries(['strategies']),
  });

  const updateWorkflow = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Workflow.update(id, data),
    onSuccess: () => qc.invalidateQueries(['workflows']),
  });

  const activeStrategies = strategies.filter(s => s.status === 'active').length;
  const activeWorkflows  = workflows.filter(w => w.status === 'active').length;
  const appliedTemplate  = store?.autopilot_preferences?.active_template_name;
  const isLoading = wfLoading || stratLoading;

  return (
    <div className="min-h-screen galaxy-bg">
      <div className="max-w-7xl mx-auto p-4 md:p-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.4)' }}>
              <Workflow className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white tracking-wider">WORKFLOWS & STRATEGIES</h1>
              <p className="text-xs text-slate-400">Unified command hub · Automation · Execution rules</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/WorkflowBuilder">
              <Button className="btn-cosmic gap-2 text-xs h-8">
                <Plus className="w-3.5 h-3.5" />
                New Workflow
              </Button>
            </Link>
            <Link to="/AdminPanel">
              <Button variant="outline" className="gap-2 text-xs h-8 border-slate-700 text-slate-300">
                <Settings className="w-3.5 h-3.5" />
                Admin
              </Button>
            </Link>
          </div>
        </div>

        {/* ── Active Template Banner ── */}
        {appliedTemplate && (
          <div className="flex items-center gap-3 p-3 mb-5 rounded-xl border border-violet-500/30 bg-violet-500/8">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-400">Active Template: </span>
              <span className="text-xs font-semibold text-violet-300">{appliedTemplate}</span>
            </div>
            <Link to="/TemplatesLibrary" className="text-[10px] text-violet-400 hover:text-violet-300 shrink-0">
              Change →
            </Link>
          </div>
        )}

        {/* ── Metric Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'ACTIVE STRATEGIES', value: activeStrategies, color: '#a855f7', icon: Target },
            { label: 'ACTIVE WORKFLOWS',  value: activeWorkflows,  color: '#06b6d4', icon: GitBranch },
            { label: 'TOTAL STRATEGIES',  value: strategies.length, color: '#f9d65c', icon: TrendingUp },
            { label: 'AI IDENTITIES',     value: identities.filter(i => i.is_active).length, color: '#10b981', icon: Zap },
          ].map(m => (
            <div key={m.label} className="relative rounded-2xl p-4 overflow-hidden"
              style={{ background: 'rgba(10,15,42,0.7)', border: `1px solid ${m.color}25`, backdropFilter: 'blur(20px)' }}>
              <div className="absolute inset-0 pointer-events-none opacity-5"
                style={{ background: `radial-gradient(ellipse at top left, ${m.color}, transparent 70%)` }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-orbitron tracking-widest" style={{ color: `${m.color}99` }}>{m.label}</span>
                  <m.icon className="w-3.5 h-3.5" style={{ color: m.color }} />
                </div>
                <div className="text-2xl font-orbitron font-bold" style={{ color: m.color, textShadow: `0 0 12px ${m.color}60` }}>
                  {m.value}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tab Bar ── */}
        <div className="flex items-center gap-1 mb-5 p-1 rounded-xl"
          style={{ background: 'rgba(10,15,42,0.6)', border: '1px solid rgba(168,85,247,0.2)' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-orbitron tracking-wider transition-all duration-200 ${
                  active
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* ── Strategies Tab ── */}
        {tab === 'strategies' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">{strategies.length} strategies total</p>
              <Link to="/TemplatesLibrary" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> New from Template
              </Link>
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : strategies.length === 0 ? (
              <Card className="glass-card p-12 text-center">
                <Target className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-2">No strategies yet</p>
                <p className="text-slate-600 text-xs mb-4">Build a strategy from scratch or apply a template</p>
                <Link to="/TemplatesLibrary">
                  <Button className="btn-cosmic gap-2 text-xs h-8">
                    <BookOpen className="w-3.5 h-3.5" /> Browse Templates
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-3">
                {strategies.map(s => {
                  const variant = VARIANT_COLOR[s.variant] || { color: '#94a3b8', label: s.variant };
                  const stepsTotal = (s.steps || []).length;
                  const stepsDone  = (s.steps || []).filter(st => st.completed).length;
                  const pct = stepsTotal > 0 ? Math.round((stepsDone / stepsTotal) * 100) : 0;
                  return (
                    <Card key={s.id} className="glass-card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-white truncate">{s.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded font-orbitron"
                              style={{ background: `${variant.color}20`, color: variant.color, border: `1px solid ${variant.color}40` }}>
                              {variant.label}
                            </span>
                          </div>
                          {s.description && (
                            <p className="text-xs text-slate-500 mb-2 line-clamp-2">{s.description}</p>
                          )}
                          <div className="flex items-center gap-3 text-xs text-slate-600">
                            {s.target_daily_profit && (
                              <span className="text-emerald-400/80">
                                ${s.target_daily_profit}/day target
                              </span>
                            )}
                            {stepsTotal > 0 && (
                              <span>{stepsDone}/{stepsTotal} steps ({pct}%)</span>
                            )}
                            {(s.categories || []).length > 0 && (
                              <span>{s.categories.slice(0, 2).join(', ')}</span>
                            )}
                          </div>
                          {stepsTotal > 0 && (
                            <div className="mt-2 h-1 rounded-full bg-slate-800 overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: `${pct}%`, background: variant.color }} />
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-orbitron border ${STATUS_COLOR[s.status] || STATUS_COLOR.draft}`}>
                            {s.status || 'draft'}
                          </span>
                          <button
                            onClick={() => updateStrategy.mutate({ id: s.id, data: { status: s.status === 'active' ? 'paused' : 'active' } })}
                            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                            {s.status === 'active'
                              ? <Pause className="w-3.5 h-3.5 text-amber-400" />
                              : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Workflows Tab ── */}
        {tab === 'workflows' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">{workflows.length} workflows total</p>
              <Link to="/WorkflowBuilder" className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Build Workflow
              </Link>
            </div>
            {wfLoading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : workflows.length === 0 ? (
              <Card className="glass-card p-12 text-center">
                <GitBranch className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400 text-sm mb-2">No workflows yet</p>
                <p className="text-slate-600 text-xs mb-4">Use the Workflow Builder to create automation chains</p>
                <Link to="/WorkflowBuilder">
                  <Button className="btn-cosmic gap-2 text-xs h-8">
                    <Plus className="w-3.5 h-3.5" /> Build Workflow
                  </Button>
                </Link>
              </Card>
            ) : (
              <div className="space-y-3">
                {workflows.map(wf => (
                  <Card key={wf.id} className="glass-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold text-white truncate">{wf.name}</span>
                        </div>
                        {wf.description && (
                          <p className="text-xs text-slate-500 mb-2 line-clamp-1">{wf.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span>{wf.execution_stats?.total_runs || 0} runs</span>
                          {wf.execution_stats?.success_rate != null && (
                            <span className="text-emerald-400/80">{wf.execution_stats.success_rate}% success</span>
                          )}
                          {wf.trigger_type && <span className="capitalize">Trigger: {wf.trigger_type}</span>}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-orbitron border ${STATUS_COLOR[wf.status] || STATUS_COLOR.draft}`}>
                          {wf.status || 'draft'}
                        </span>
                        <button
                          onClick={() => updateWorkflow.mutate({ id: wf.id, data: { status: wf.status === 'active' ? 'paused' : 'active' } })}
                          className="p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                          {wf.status === 'active'
                            ? <Pause className="w-3.5 h-3.5 text-amber-400" />
                            : <Play className="w-3.5 h-3.5 text-emerald-400" />}
                        </button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Templates Tab ── */}
        {tab === 'templates' && (
          <div className="space-y-3">
            {/* Quick nav cards to template-related tools */}
            {[
              {
                to: '/TemplatesLibrary',
                icon: BookOpen,
                color: '#a855f7',
                title: 'Templates Library',
                desc: 'Browse and apply pre-built profit strategies and automation templates',
              },
              {
                to: '/WorkflowBuilder',
                icon: GitBranch,
                color: '#06b6d4',
                title: 'Workflow Builder',
                desc: 'Build custom multi-step automation workflows with triggers and conditions',
              },
              {
                to: '/AutomationManager',
                icon: RefreshCw,
                color: '#10b981',
                title: 'Automation Manager',
                desc: 'Manage all active automations, schedules, and trigger configurations',
              },
              {
                to: '/IdentityManager',
                icon: Zap,
                color: '#f9d65c',
                title: 'Identity Manager',
                desc: 'Assign AI identities to strategies and workflows for autonomous execution',
              },
            ].map(item => (
              <Link key={item.to} to={item.to}>
                <Card className="glass-card p-4 hover:border-opacity-80 transition-all duration-200 cursor-pointer group"
                  style={{ borderColor: `${item.color}20` }}
                  onMouseEnter={e => e.currentTarget.style.borderColor = `${item.color}60`}
                  onMouseLeave={e => e.currentTarget.style.borderColor = `${item.color}20`}>
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: `${item.color}15`, border: `1px solid ${item.color}30` }}>
                      <item.icon className="w-5 h-5" style={{ color: item.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white mb-0.5">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.desc}</div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}