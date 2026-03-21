import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, CheckCircle2, AlertCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';

const OPPORTUNITY_TYPES = ['job', 'grant', 'contest', 'giveaway', 'survey', 'arbitrage', 'freelance', 'resale'];
const OPERATORS = ['>', '>=', '<', '<=', '==', '!='];
const CONDITIONS = [
  { label: 'Profit Estimate High', field: 'profit_estimate_high' },
  { label: 'Profit Estimate Low', field: 'profit_estimate_low' },
  { label: 'Risk Score', field: 'risk_score' },
  { label: 'Velocity Score', field: 'velocity_score' },
];

export default function AutoExecuteRuleBuilder() {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState([]);
  const [editingRule, setEditingRule] = useState(null);
  const [formData, setFormData] = useState({
    rule_name: '',
    opportunity_type: '',
    condition_field: '',
    operator: '>',
    condition_value: '',
    auto_execute: true,
  });

  // Fetch existing rules
  const { data: existingRules = [] } = useQuery({
    queryKey: ['autoExecuteRules'],
    queryFn: async () => {
      try {
        const res = await base44.entities.TaskOrchestrationRule.filter({
          source_entity: 'Opportunity',
          enabled: true
        }, '-created_date', 100);
        return Array.isArray(res) ? res : [];
      } catch {
        return [];
      }
    }
  });

  // Save rule mutation
  const saveRuleMutation = useMutation({
    mutationFn: async (ruleData) => {
      if (editingRule?.id) {
        return base44.entities.TaskOrchestrationRule.update(editingRule.id, ruleData);
      }
      return base44.entities.TaskOrchestrationRule.create(ruleData);
    },
    onSuccess: () => {
      toast.success(editingRule?.id ? 'Rule updated' : 'Rule created');
      queryClient.invalidateQueries({ queryKey: ['autoExecuteRules'] });
      resetForm();
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to save rule');
    }
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: (ruleId) => base44.entities.TaskOrchestrationRule.delete(ruleId),
    onSuccess: () => {
      toast.success('Rule deleted');
      queryClient.invalidateQueries({ queryKey: ['autoExecuteRules'] });
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to delete rule');
    }
  });

  const resetForm = () => {
    setFormData({
      rule_name: '',
      opportunity_type: '',
      condition_field: '',
      operator: '>',
      condition_value: '',
      auto_execute: true,
    });
    setEditingRule(null);
  };

  const handleAddRule = () => {
    if (!formData.rule_name || !formData.opportunity_type || !formData.condition_field || !formData.condition_value) {
      toast.error('Please fill all fields');
      return;
    }

    const rulePayload = {
      rule_name: formData.rule_name,
      source_entity: 'Opportunity',
      source_event_type: 'create',
      condition_field: formData.condition_field,
      condition_operator: formData.operator,
      condition_value: parseFloat(formData.condition_value),
      target_task_type: 'auto_apply',
      target_task_config: {
        execution_mode: 'immediate',
        parameters: {
          opportunity_type: formData.opportunity_type,
          auto_execute: formData.auto_execute
        }
      },
      enabled: true,
      priority: 50
    };

    saveRuleMutation.mutate(rulePayload);
  };

  const handleEditRule = (rule) => {
    setEditingRule(rule);
    setFormData({
      rule_name: rule.rule_name,
      opportunity_type: rule.target_task_config?.parameters?.opportunity_type || '',
      condition_field: rule.condition_field,
      operator: rule.condition_operator || '>',
      condition_value: rule.condition_value?.toString() || '',
      auto_execute: rule.target_task_config?.parameters?.auto_execute !== false,
    });
  };

  return (
    <div className="space-y-4">
      {/* Rule Builder Form */}
      <Card className="bg-slate-900/50 border-slate-700 rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2 font-orbitron tracking-wide">
            <Zap className="w-4 h-4 text-amber-400" />
            {editingRule ? 'Edit Auto-Execute Rule' : 'Create Auto-Execute Rule'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Rule Name */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Rule Name</label>
            <Input
              placeholder="e.g., High-Profit Auto-Apply"
              value={formData.rule_name}
              onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
              className="bg-slate-800 border-slate-600 text-white text-xs h-8"
            />
          </div>

          {/* Opportunity Type */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1 block">Opportunity Type</label>
            <Select value={formData.opportunity_type} onValueChange={(val) => setFormData({ ...formData, opportunity_type: val })}>
              <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-xs h-8">
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                {OPPORTUNITY_TYPES.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Condition */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Condition</label>
              <Select value={formData.condition_field} onValueChange={(val) => setFormData({ ...formData, condition_field: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-xs h-8">
                  <SelectValue placeholder="Select..." />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map(c => (
                    <SelectItem key={c.field} value={c.field}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Operator</label>
              <Select value={formData.operator} onValueChange={(val) => setFormData({ ...formData, operator: val })}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white text-xs h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map(op => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs text-slate-400 font-medium mb-1 block">Value</label>
              <Input
                type="number"
                placeholder="e.g., 500"
                value={formData.condition_value}
                onChange={(e) => setFormData({ ...formData, condition_value: e.target.value })}
                className="bg-slate-800 border-slate-600 text-white text-xs h-8"
              />
            </div>
          </div>

          {/* Auto-Execute Toggle */}
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-800/50 border border-slate-700/50">
            <input
              type="checkbox"
              checked={formData.auto_execute}
              onChange={(e) => setFormData({ ...formData, auto_execute: e.target.checked })}
              className="w-4 h-4"
            />
            <label className="text-xs text-slate-300">Auto-trigger task creation when condition is met</label>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleAddRule}
              disabled={saveRuleMutation.isPending}
              className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8 gap-1 flex-1"
            >
              <Plus className="w-3 h-3" />
              {editingRule ? 'Update Rule' : 'Add Rule'}
            </Button>
            {editingRule && (
              <Button
                size="sm"
                variant="outline"
                onClick={resetForm}
                className="text-xs h-8"
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rules List */}
      {existingRules.length > 0 && (
        <Card className="bg-slate-900/50 border-slate-700 rounded-2xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-orbitron tracking-wide">
              Active Rules ({existingRules.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {existingRules.map(rule => (
              <div key={rule.id} className="flex items-start justify-between p-3 rounded-lg bg-slate-800/30 border border-slate-700/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xs font-medium text-white">{rule.rule_name}</p>
                    <Badge variant="outline" className="text-[10px]">
                      {rule.target_task_config?.parameters?.opportunity_type || 'any'}
                    </Badge>
                    {rule.enabled && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400">
                    If {rule.condition_field} {rule.condition_operator} {rule.condition_value} → auto-execute
                  </p>
                </div>
                <div className="flex gap-2 ml-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleEditRule(rule)}
                    className="text-xs h-6"
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRuleMutation.mutate(rule.id)}
                    disabled={deleteRuleMutation.isPending}
                    className="text-xs h-6 text-red-400 hover:text-red-300"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {existingRules.length === 0 && (
        <Card className="bg-slate-900/50 border-slate-700 rounded-2xl">
          <CardContent className="py-6">
            <div className="text-center">
              <AlertCircle className="w-6 h-6 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No rules configured yet. Create your first rule above.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}