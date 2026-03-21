import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Zap, Settings, TrendingUp, AlertCircle, CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

export default function GlobalTaskOrchestrator() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState(null);

  // Fetch all rules
  const { data: rules = [], isLoading } = useQuery({
    queryKey: ['taskOrchestrationRules'],
    queryFn: () => base44.entities.TaskOrchestrationRule.list('-priority')
  });

  // Create/Update rule
  const ruleMutation = useMutation({
    mutationFn: (data) => {
      if (editingRule) {
        return base44.entities.TaskOrchestrationRule.update(editingRule.id, data);
      }
      return base44.entities.TaskOrchestrationRule.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskOrchestrationRules'] });
      setShowForm(false);
      setEditingRule(null);
      toast.success('Rule saved successfully');
    },
    onError: (err) => toast.error(err.message)
  });

  // Delete rule
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskOrchestrationRule.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['taskOrchestrationRules'] });
      toast.success('Rule deleted');
    },
    onError: (err) => toast.error(err.message)
  });

  const handleSaveRule = (formData) => {
    ruleMutation.mutate(formData);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-orbitron font-bold text-white flex items-center gap-3">
            <Zap className="w-6 h-6 text-cyan-400" />
            Global Task Orchestrator
          </h1>
          <p className="text-sm text-slate-400 mt-1">Create cross-department task dependencies</p>
        </div>
        <Button
          onClick={() => { setEditingRule(null); setShowForm(!showForm); }}
          className="bg-cyan-600 hover:bg-cyan-500 text-white gap-2"
        >
          <Plus className="w-4 h-4" />
          New Rule
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <RuleForm
          rule={editingRule}
          onSave={handleSaveRule}
          onCancel={() => { setShowForm(false); setEditingRule(null); }}
          isSaving={ruleMutation.isPending}
        />
      )}

      {/* Rules List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-slate-400">Loading rules...</p>
        ) : rules.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-slate-400 mb-3">No orchestration rules configured</p>
            <Button
              onClick={() => { setEditingRule(null); setShowForm(true); }}
              variant="outline"
              size="sm"
            >
              Create your first rule
            </Button>
          </div>
        ) : (
          rules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onEdit={() => { setEditingRule(rule); setShowForm(true); }}
              onDelete={() => deleteMutation.mutate(rule.id)}
              isDeleting={deleteMutation.isPending}
            />
          ))
        )}
      </div>

      {/* Stats */}
      {rules.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mt-6">
          <StatsCard
            icon={CheckCircle2}
            label="Active Rules"
            value={rules.filter(r => r.status === 'active').length}
            color="emerald"
          />
          <StatsCard
            icon={Zap}
            label="Total Triggers"
            value={rules.reduce((sum, r) => sum + (r.total_triggers || 0), 0)}
            color="cyan"
          />
          <StatsCard
            icon={TrendingUp}
            label="Success Rate"
            value={`${rules.length > 0 ? Math.round(
              (rules.reduce((sum, r) => sum + (r.total_successful || 0), 0) /
               Math.max(1, rules.reduce((sum, r) => sum + (r.total_triggers || 0), 0))) * 100
            ) : 0}%`}
            color="violet"
          />
        </div>
      )}
    </div>
  );
}

function RuleForm({ rule, onSave, onCancel, isSaving }) {
  const [formData, setFormData] = useState(rule || {
    rule_name: '',
    description: '',
    source_department: 'DigitalResellers',
    source_entity: 'DigitalStorefront',
    condition_field: 'total_revenue',
    condition_operator: '>',
    condition_value: 5000,
    target_department: 'CryptoProfitSystems',
    target_task_type: 'crypto_arbitrage',
    target_task_config: {
      ai_agent: 'NED',
      execution_mode: 'immediate',
      max_allocation: 500
    },
    enabled: true
  });

  return (
    <Card className="mb-6 border-cyan-500/30 bg-slate-900/50">
      <CardHeader>
        <CardTitle className="text-lg">
          {rule ? 'Edit Rule' : 'Create New Orchestration Rule'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-300">Rule Name</label>
            <input
              type="text"
              value={formData.rule_name}
              onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              placeholder="e.g., Trigger Crypto on High Sales"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300">Priority (1-100)</label>
            <input
              type="number"
              value={formData.priority || 50}
              onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
              className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              min="1"
              max="100"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-slate-300">Description</label>
          <input
            type="text"
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
            placeholder="What does this rule do?"
          />
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-white mb-3">Source (Monitor)</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">Department</label>
              <select
                value={formData.source_department}
                onChange={(e) => setFormData({ ...formData, source_department: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option>DigitalResellers</option>
                <option>CryptoProfitSystems</option>
                <option>Finance</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Entity</label>
              <input
                type="text"
                value={formData.source_entity}
                onChange={(e) => setFormData({ ...formData, source_entity: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                placeholder="e.g., DigitalStorefront"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Field</label>
              <input
                type="text"
                value={formData.condition_field}
                onChange={(e) => setFormData({ ...formData, condition_field: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                placeholder="e.g., total_revenue"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-white mb-3">Condition (If)</h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">Operator</label>
              <select
                value={formData.condition_operator}
                onChange={(e) => setFormData({ ...formData, condition_operator: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value=">">&gt;</option>
                <option value=">=">&gt;=</option>
                <option value="<">&lt;</option>
                <option value="<=">&lt;=</option>
                <option value="==">==</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Threshold</label>
              <input
                type="number"
                value={formData.condition_value}
                onChange={(e) => setFormData({ ...formData, condition_value: parseFloat(e.target.value) })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
                placeholder="5000"
              />
            </div>
          </div>
        </div>

        <div className="border-t border-slate-700 pt-4">
          <h3 className="text-sm font-semibold text-white mb-3">Target (Then Execute)</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300">Target Department</label>
              <select
                value={formData.target_department}
                onChange={(e) => setFormData({ ...formData, target_department: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option>CryptoProfitSystems</option>
                <option>Execution</option>
                <option>Finance</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Task Type</label>
              <select
                value={formData.target_task_type}
                onChange={(e) => setFormData({ ...formData, target_task_type: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option value="crypto_arbitrage">Crypto Arbitrage</option>
                <option value="stake_profits">Stake Profits</option>
                <option value="claim_airdrop">Claim Airdrop</option>
                <option value="buy_mining_power">Buy Mining Power</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-3">
            <div>
              <label className="text-xs font-semibold text-slate-300">AI Agent</label>
              <select
                value={formData.target_task_config?.ai_agent || 'NED'}
                onChange={(e) => setFormData({
                  ...formData,
                  target_task_config: { ...formData.target_task_config, ai_agent: e.target.value }
                })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              >
                <option>NED</option>
                <option>Autopilot</option>
                <option>VIPZ</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-300">Max Allocation ($)</label>
              <input
                type="number"
                value={formData.target_task_config?.max_allocation || 500}
                onChange={(e) => setFormData({
                  ...formData,
                  target_task_config: { ...formData.target_task_config, max_allocation: parseFloat(e.target.value) }
                })}
                className="w-full mt-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-sm text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-slate-700">
          <input
            type="checkbox"
            checked={formData.enabled}
            onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
            className="w-4 h-4"
          />
          <label className="text-sm text-slate-300">Enable this rule</label>
        </div>

        <div className="flex gap-3 pt-4 border-t border-slate-700">
          <Button
            onClick={() => onSave(formData)}
            disabled={isSaving}
            className="flex-1 bg-cyan-600 hover:bg-cyan-500"
          >
            {isSaving ? 'Saving...' : 'Save Rule'}
          </Button>
          <Button onClick={onCancel} variant="outline" className="flex-1">
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function RuleCard({ rule, onEdit, onDelete, isDeleting }) {
  return (
    <Card className="border-slate-700 hover:border-cyan-500/50 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-white">{rule.rule_name}</h3>
              <Badge variant={rule.enabled ? 'default' : 'secondary'} className="text-xs">
                {rule.status}
              </Badge>
            </div>
            <p className="text-xs text-slate-400">{rule.description}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={onEdit}
              size="sm"
              variant="outline"
              className="gap-1"
            >
              <Settings className="w-3.5 h-3.5" />
              Edit
            </Button>
            <Button
              onClick={onDelete}
              disabled={isDeleting}
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 text-xs mb-3 py-3 border-t border-b border-slate-700">
          <div>
            <p className="text-slate-500">Monitor</p>
            <p className="text-white font-medium">{rule.source_entity}</p>
          </div>
          <div>
            <p className="text-slate-500">When</p>
            <p className="text-white font-medium">
              {rule.condition_field} {rule.condition_operator} {rule.condition_value}
            </p>
          </div>
          <div>
            <p className="text-slate-500">Then Execute</p>
            <p className="text-white font-medium">{rule.target_task_type}</p>
          </div>
          <div>
            <p className="text-slate-500">Agent</p>
            <p className="text-white font-medium">{rule.target_task_config?.ai_agent || 'NED'}</p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1 text-cyan-400">
            <Zap className="w-3.5 h-3.5" />
            {rule.total_triggers || 0} triggers
          </div>
          <div className="flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {rule.total_successful || 0} successful
          </div>
          {rule.last_triggered_at && (
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="w-3.5 h-3.5" />
              {new Date(rule.last_triggered_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StatsCard({ icon: Icon, label, value, color }) {
  const colorMap = {
    emerald: 'text-emerald-400 bg-emerald-500/10',
    cyan: 'text-cyan-400 bg-cyan-500/10',
    violet: 'text-violet-400 bg-violet-500/10'
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
            <p className="text-xl font-orbitron font-bold text-white">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}