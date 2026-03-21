/**
 * CROSS-SYSTEM AUTOMATION ADMIN DASHBOARD
 * Unified event-driven trigger management across all departments
 * Admin-only platform-wide orchestration
 */
import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap, Plus, Settings, Trash2, CheckCircle2, AlertCircle,
  TrendingUp, Coins, ShoppingCart, Activity, Clock, Lock
} from 'lucide-react';
import { toast } from 'sonner';

export default function CrossSystemAutomation() {
  const queryClient = useQueryClient();
  const { user: authUser } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingTrigger, setEditingTrigger] = useState(null);

  // Verify admin access
  if (authUser?.role !== 'admin') {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <Card className="border-red-500/30 bg-red-950/20">
          <CardContent className="p-8 text-center">
            <Lock className="w-12 h-12 text-red-400 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-white mb-2">Admin Access Required</h2>
            <p className="text-slate-300">Cross-system automation is admin-only functionality</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Fetch all triggers (platform-wide admin view)
  const { data: triggers = [], isLoading } = useQuery({
    queryKey: ['crossSystemTriggers'],
    queryFn: async () => {
      return await base44.asServiceRole.entities.CrossSystemTrigger.filter(
        {},
        '-priority'
      );
    },
    refetchInterval: 10000,
  });

  // Create/Update trigger
  const triggerMutation = useMutation({
    mutationFn: async (data) => {
      if (editingTrigger) {
        return await base44.asServiceRole.entities.CrossSystemTrigger.update(editingTrigger.id, data);
      }
      return await base44.asServiceRole.entities.CrossSystemTrigger.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crossSystemTriggers'] });
      setShowForm(false);
      setEditingTrigger(null);
      toast.success('Trigger saved');
    },
    onError: (err) => toast.error(err.message),
  });

  // Delete trigger
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.asServiceRole.entities.CrossSystemTrigger.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crossSystemTriggers'] });
      toast.success('Trigger deleted');
    },
    onError: (err) => toast.error(err.message),
  });

  const stats = {
    total: triggers.length,
    active: triggers.filter(t => t.enabled && t.status === 'active').length,
    total_executions: triggers.reduce((sum, t) => sum + (t.total_triggers || 0), 0),
    success_rate: triggers.length > 0
      ? Math.round(
          (triggers.reduce((sum, t) => sum + (t.successful_triggers || 0), 0) /
            Math.max(1, triggers.reduce((sum, t) => sum + (t.total_triggers || 0), 0))) * 100
        )
      : 0,
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white font-orbitron flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400" />
            Cross-System Automation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Event-driven triggers for unified department orchestration
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={() => base44.functions.invoke('platformTriggerMonitor', {})}
            variant="outline"
            className="gap-2"
          >
            <Activity className="w-4 h-4" />
            Run Monitor Now
          </Button>
          <Button
            onClick={() => { setEditingTrigger(null); setShowForm(!showForm); }}
            className="bg-cyan-600 hover:bg-cyan-500 gap-2"
          >
            <Plus className="w-4 h-4" />
            New Trigger
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          label="Total Triggers"
          value={stats.total}
          icon={Zap}
          color="cyan"
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          label="Total Executions"
          value={stats.total_executions}
          icon={TrendingUp}
          color="violet"
        />
        <StatCard
          label="Success Rate"
          value={`${stats.success_rate}%`}
          icon={Activity}
          color="amber"
        />
      </div>

      {/* Form */}
      {showForm && (
        <TriggerForm
          trigger={editingTrigger}
          onSave={(data) => triggerMutation.mutate(data)}
          onCancel={() => { setShowForm(false); setEditingTrigger(null); }}
          isSaving={triggerMutation.isPending}
        />
      )}

      {/* Triggers List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-slate-400">Loading triggers...</p>
        ) : triggers.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="p-8 text-center">
              <p className="text-slate-400 mb-3">No cross-system triggers configured</p>
              <Button
                onClick={() => setShowForm(true)}
                variant="outline"
              >
                Create First Trigger
              </Button>
            </CardContent>
          </Card>
        ) : (
          triggers.map(trigger => (
            <TriggerCard
              key={trigger.id}
              trigger={trigger}
              onEdit={() => { setEditingTrigger(trigger); setShowForm(true); }}
              onDelete={() => deleteMutation.mutate(trigger.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))
        )}
      </div>
    </div>
  );
}

function TriggerForm({ trigger, onSave, onCancel, isSaving }) {
  const [formData, setFormData] = useState(trigger || {
    trigger_name: '',
    description: '',
    trigger_type: 'revenue_milestone',
    source_system: 'DigitalCommerce',
    source_metric: 'total_revenue',
    source_entity: 'DigitalStorefront',
    trigger_condition: { operator: '>', threshold: 5000 },
    target_systems: [
      {
        system: 'CryptoAutomation',
        action: 'scale_staking',
        parameters: { allocation: 500 },
        enabled: true
      }
    ],
    scaling_config: {
      scale_proportional: true,
      base_value: 500,
      max_scale: 5000,
      scale_formula: 'linear'
    },
    cooldown_seconds: 300,
    enabled: true,
    is_platform_wide: true,
  });

  return (
    <Card className="mb-6 border-cyan-500/30 bg-slate-900/50">
      <CardHeader>
        <CardTitle>{trigger ? 'Edit Trigger' : 'Create Cross-System Trigger'}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Info */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-white">Trigger Configuration</h3>
          <div className="grid grid-cols-2 gap-4">
            <input
              type="text"
              value={formData.trigger_name}
              onChange={(e) => setFormData({ ...formData, trigger_name: e.target.value })}
              placeholder="Trigger name"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
            <select
              value={formData.trigger_type}
              onChange={(e) => setFormData({ ...formData, trigger_type: e.target.value })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            >
              <option value="revenue_milestone">Revenue Milestone</option>
              <option value="yield_performance">Yield Performance</option>
              <option value="balance_threshold">Balance Threshold</option>
              <option value="opportunity_found">Opportunity Found</option>
            </select>
          </div>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Description"
            className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm h-20"
          />
        </div>

        {/* Source */}
        <div className="space-y-4 border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-white">Monitor Source</h3>
          <div className="grid grid-cols-3 gap-4">
            <select
              value={formData.source_system}
              onChange={(e) => setFormData({ ...formData, source_system: e.target.value })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            >
              <option>DigitalCommerce</option>
              <option>CryptoAutomation</option>
              <option>Finance</option>
              <option>Discovery</option>
            </select>
            <input
              type="text"
              value={formData.source_entity}
              onChange={(e) => setFormData({ ...formData, source_entity: e.target.value })}
              placeholder="Entity"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
            <input
              type="text"
              value={formData.source_metric}
              onChange={(e) => setFormData({ ...formData, source_metric: e.target.value })}
              placeholder="Metric field"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
          </div>
        </div>

        {/* Condition */}
        <div className="space-y-4 border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-white">Trigger Condition</h3>
          <div className="grid grid-cols-3 gap-4">
            <select
              value={formData.trigger_condition?.operator}
              onChange={(e) => setFormData({
                ...formData,
                trigger_condition: { ...formData.trigger_condition, operator: e.target.value }
              })}
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            >
              <option>&gt;</option>
              <option>&gt;=</option>
              <option>&lt;</option>
              <option>&lt;=</option>
              <option>==</option>
            </select>
            <input
              type="number"
              value={formData.trigger_condition?.threshold}
              onChange={(e) => setFormData({
                ...formData,
                trigger_condition: { ...formData.trigger_condition, threshold: parseFloat(e.target.value) }
              })}
              placeholder="Threshold"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
            <input
              type="number"
              value={formData.cooldown_seconds}
              onChange={(e) => setFormData({ ...formData, cooldown_seconds: parseInt(e.target.value) })}
              placeholder="Cooldown (sec)"
              className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
            />
          </div>
        </div>

        {/* Scaling */}
        <div className="space-y-4 border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-white">Scaling Configuration</h3>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={formData.scaling_config?.scale_proportional}
              onChange={(e) => setFormData({
                ...formData,
                scaling_config: { ...formData.scaling_config, scale_proportional: e.target.checked }
              })}
            />
            Scale actions proportionally to metric value
          </label>
          {formData.scaling_config?.scale_proportional && (
            <div className="grid grid-cols-3 gap-4">
              <input
                type="number"
                value={formData.scaling_config?.base_value}
                onChange={(e) => setFormData({
                  ...formData,
                  scaling_config: { ...formData.scaling_config, base_value: parseFloat(e.target.value) }
                })}
                placeholder="Base allocation"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              />
              <input
                type="number"
                value={formData.scaling_config?.max_scale}
                onChange={(e) => setFormData({
                  ...formData,
                  scaling_config: { ...formData.scaling_config, max_scale: parseFloat(e.target.value) }
                })}
                placeholder="Max allocation"
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              />
              <select
                value={formData.scaling_config?.scale_formula}
                onChange={(e) => setFormData({
                  ...formData,
                  scaling_config: { ...formData.scaling_config, scale_formula: e.target.value }
                })}
                className="px-3 py-2 bg-slate-800 border border-slate-700 rounded text-white text-sm"
              >
                <option value="linear">Linear</option>
                <option value="exponential">Exponential</option>
              </select>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-slate-700 pt-4">
          <Button
            onClick={() => onSave(formData)}
            disabled={isSaving}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500"
          >
            {isSaving ? 'Saving...' : 'Save Trigger'}
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function TriggerCard({ trigger, onEdit, onDelete, isDeleting }) {
  const systemColors = {
    DigitalCommerce: 'purple',
    CryptoAutomation: 'cyan',
    Finance: 'emerald',
    Discovery: 'amber',
  };

  return (
    <Card className="border-slate-700 hover:border-cyan-500/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{trigger.trigger_name}</h3>
              <Badge className={trigger.enabled ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-500/20 text-slate-400'}>
                {trigger.status}
              </Badge>
              {trigger.is_platform_wide && (
                <Badge className="bg-cyan-500/20 text-cyan-400">Platform-wide</Badge>
              )}
            </div>
            <p className="text-xs text-slate-400">{trigger.description}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={onEdit} size="sm" variant="outline" className="gap-1">
              <Settings className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              onClick={onDelete}
              disabled={isDeleting}
              size="sm"
              variant="ghost"
              className="text-red-400"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-xs mb-3 py-3 border-t border-b border-slate-700">
          <div>
            <p className="text-slate-500">Monitor</p>
            <p className="text-white font-medium flex items-center gap-1 mt-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--dept-${systemColors[trigger.source_system]})` }} />
              {trigger.source_system} → {trigger.source_metric}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Condition</p>
            <p className="text-white font-medium mt-1">
              {trigger.trigger_condition?.operator} {trigger.trigger_condition?.threshold}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Target Systems</p>
            <p className="text-white font-medium mt-1">{trigger.target_systems?.length || 0} actions</p>
          </div>
          <div>
            <p className="text-slate-500">Executions</p>
            <p className="text-emerald-400 font-medium mt-1">{trigger.total_triggers || 0} triggers</p>
          </div>
        </div>

        {/* Target Systems Preview */}
        <div className="flex flex-wrap gap-2">
          {trigger.target_systems?.map((target, idx) => (
            <Badge key={idx} variant="outline" className="text-xs gap-1">
              <span>{target.system}</span>
              <span className="text-slate-500">→</span>
              <span>{target.action}</span>
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function StatCard({ label, value, icon: Icon, color }) {
  const colorMap = {
    cyan: 'text-cyan-400 bg-cyan-500/10',
    emerald: 'text-emerald-400 bg-emerald-500/10',
    violet: 'text-violet-400 bg-violet-500/10',
    amber: 'text-amber-400 bg-amber-500/10',
  };

  return (
    <Card className="border-slate-700">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colorMap[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400">{label}</p>
            <p className="text-2xl font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}