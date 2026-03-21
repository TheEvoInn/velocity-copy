/**
 * CONTROL DEPARTMENT
 * System administration, identity management, security, and compliance
 */
import React from 'react';
import { useAIIdentitiesV2, useWorkflowsV2 } from '@/lib/velocityHooks';
import { getDeptStyle } from '@/lib/galaxyTheme';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Shield, Settings, Zap, Lock } from 'lucide-react';

const style = getDeptStyle('control');

export default function Control() {
  const { identities } = useAIIdentitiesV2();
  const { workflows } = useWorkflowsV2();

  const activeIdentities = identities.filter(i => i.is_active).length;
  const activeWorkflows = workflows.filter(w => w.status === 'active').length;

  return (
    <div className="min-h-screen galaxy-bg p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
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

        {/* Status Grid */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Active Identities</div>
            <div className="text-2xl font-bold text-purple-400">{activeIdentities}</div>
            <div className="text-xs text-slate-600 mt-1">of {identities.length} total</div>
          </Card>
          <Card className="glass-card p-4">
            <div className="text-xs text-slate-400 mb-1">Active Workflows</div>
            <div className="text-2xl font-bold text-cyan-400">{activeWorkflows}</div>
            <div className="text-xs text-slate-600 mt-1">of {workflows.length} total</div>
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

        {/* Workflows */}
        <Card className="glass-card p-4 mb-6">
          <h3 className="font-orbitron text-sm font-bold text-white mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4 text-cyan-400" />
            Automation Workflows
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {workflows.length === 0 ? (
              <div className="text-xs text-slate-500 text-center py-4">No workflows created</div>
            ) : (
              workflows.slice(0, 6).map(wf => (
                <div key={wf.id} className="p-3 bg-slate-800/40 rounded-lg border border-cyan-500/30">
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-white truncate">{wf.name}</div>
                      <div className="text-xs text-slate-400 capitalize">{wf.status}</div>
                    </div>
                    <div className="ml-3 text-right text-xs">
                      <div className="text-slate-400">{wf.execution_stats?.total_runs || 0} runs</div>
                    </div>
                  </div>
                </div>
              ))
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