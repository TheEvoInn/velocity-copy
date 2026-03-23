/**
 * CONTROL DEPARTMENT
 * System administration, identity management, security, and compliance
 */
import React from 'react';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { useAIIdentities, useWorkflows } from '@/hooks/useQueryHooks';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shield, Settings, Zap, Lock, Sparkles } from 'lucide-react';
import SubPageNav from '@/components/layout/SubPageNav';

const style = getDeptStyle('control');

const STATUS_COLOR = {
  active: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
  paused: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  draft: 'text-slate-400 bg-slate-700/30 border-slate-600/30',
  completed: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/30',
  abandoned: 'text-red-400 bg-red-500/10 border-red-500/30',
};

export default function Control() {
  const { data: identities = [], isLoading: idLoading, error: idError } = useAIIdentities();
  const { data: workflows = [], isLoading: wfLoading, error: wfError } = useWorkflows();

  // Also pull Strategy records (created when templates/workflows are applied)
  const { data: strategies = [], isLoading: stratLoading } = useQuery({
    queryKey: ['customStrategies'],
    queryFn: () => base44.entities.Strategy.list('-updated_date', 30),
  });

  // UserDataStore to show which template is currently active
  const { data: store } = useQuery({
    queryKey: ['userDataStore_templates'],
    queryFn: async () => {
      const me = await base44.auth.me();
      const res = await base44.entities.UserDataStore.filter({ user_email: me.email });
      return res[0] || null;
    },
  });

  const activeIdentities = identities.filter(i => i.is_active).length;
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;
  const activeStrategies = strategies.filter(s => s.status === 'active').length;
  const appliedTemplateName = store?.autopilot_preferences?.active_template_name;
  const isLoading = idLoading || wfLoading || stratLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen galaxy-bg flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (idError || wfError) {
    return (
      <div className="min-h-screen galaxy-bg flex items-center justify-center">
        <div className="p-6 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          Error loading Control panel data. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen galaxy-bg">
      <SubPageNav />
      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `rgba(168,85,247,0.1)`, border: `1px solid ${style.color}` }}>
              <span className="text-2xl">{style.icon}</span>
            </div>
            <div>
              <h1 className="font-orbitron text-2xl font-bold text-white">CONTROL</h1>
              <p className="text-xs text-slate-400">Identities · Workflows · Security · Admin</p>
            </div>
          </div>
          <Link to="/AdminControlPanel">
            <Button className="btn-cosmic gap-2">
              <Settings className="w-4 h-4" />
              Admin Panel
            </Button>
          </Link>
        </div>

        {/* Active Template Banner */}
        {appliedTemplateName && (
          <div className="flex items-center gap-3 p-3 mb-4 rounded-xl border border-violet-500/30 bg-violet-500/8">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
            <div className="flex-1 min-w-0">
              <span className="text-xs text-slate-400">Active Template: </span>
              <span className="text-xs font-semibold text-violet-300">{appliedTemplateName}</span>
            </div>
            <Link to="/TemplatesLibrary" className="text-[10px] text-violet-400 hover:text-violet-300 shrink-0">Change →</Link>
          </div>
        )}

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Active Identities</div>
            <div className="text-2xl font-bold text-purple-400">{activeIdentities}</div>
            <div className="text-xs text-slate-600 mt-1">of {identities.length} total</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Active Workflows</div>
            <div className="text-2xl font-bold text-cyan-400">{activeWorkflows + activeStrategies}</div>
            <div className="text-xs text-slate-600 mt-1">{workflows.length} flows · {strategies.length} strategies</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">System Status</div>
            <div className="text-2xl font-bold text-emerald-400">✓</div>
            <div className="text-xs text-slate-600 mt-1">Operational</div>
          </Card>
        </div>

        {/* AI Identities */}
        <Card className="glass-card p-4 mb-6">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            Active AI Identities
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {identities.filter(i => i.is_active).length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No active identities</div>
            ) : (
              identities
                .filter(i => i.is_active)
                .slice(0, 6)
                .map(id => (
                  <div key={id.id} className="p-3 bg-slate-800/40 rounded-lg border border-purple-500/30">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-semibold text-white">{id.name}</div>
                        <div className="text-xs text-slate-400">{id.role_label || 'AI Agent'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-purple-400 font-bold">{id.tasks_executed || 0} tasks</div>
                        <div className="text-xs text-emerald-400">${(id.total_earned || 0).toFixed(0)}</div>
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </Card>

        {/* Workflows & Applied Strategies */}
        <Card className="glass-card p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-orbitron text-sm font-bold text-white flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-400" />
              Workflows & Strategies
            </h3>
            <Link to="/TemplatesLibrary" className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors">
              + Add Template
            </Link>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {workflows.length === 0 && strategies.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-6">
                No workflows yet.{' '}
                <Link to="/TemplatesLibrary" className="text-cyan-400 hover:underline">Browse templates →</Link>
              </div>
            ) : (
              <>
                {/* Strategies from templates/builder */}
                {strategies.slice(0, 6).map(s => (
                  <div key={s.id} className="p-3 bg-slate-800/40 rounded-lg border border-violet-500/20 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{s.title}</div>
                      <div className="text-xs text-slate-500 capitalize truncate">{s.variant} · {(s.categories || []).slice(0, 2).join(', ') || 'all'}</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-orbitron border shrink-0 ${STATUS_COLOR[s.status] || STATUS_COLOR.draft}`}>
                      {s.status || 'draft'}
                    </span>
                  </div>
                ))}
                {/* Native workflows */}
                {workflows.slice(0, 4).map(wf => (
                  <div key={wf.id} className="p-3 bg-slate-800/40 rounded-lg border border-cyan-500/20 flex items-center justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{wf.name}</div>
                      <div className="text-xs text-slate-500 capitalize">{wf.status} · {wf.execution_stats?.total_runs || 0} runs</div>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-orbitron border shrink-0 ${STATUS_COLOR[wf.status] || STATUS_COLOR.draft}`}>
                      {wf.status || 'draft'}
                    </span>
                  </div>
                ))}
              </>
            )}
          </div>
        </Card>

        {/* Admin Quick Links */}
        <div className="grid grid-cols-2 gap-3">
          <Link to="/IdentityManager">
            <Button variant="outline" className="w-full gap-2">
              <Zap className="w-4 h-4" />
              Identity Manager
            </Button>
          </Link>
          <Link to="/WorkflowBuilder">
            <Button variant="outline" className="w-full gap-2">
              <Zap className="w-4 h-4" />
              Workflow Builder
            </Button>
          </Link>
          <Link to="/SecurityDashboard">
            <Button variant="outline" className="w-full gap-2">
              <Lock className="w-4 h-4" />
              Security
            </Button>
          </Link>
          <Link to="/KYCManagement">
            <Button variant="outline" className="w-full gap-2">
              <Shield className="w-4 h-4" />
              KYC Admin
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}