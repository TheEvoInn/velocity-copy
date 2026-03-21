import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, Settings, Save } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  'arbitrage', 'service', 'lead_gen', 'digital_flip', 'auction',
  'market_inefficiency', 'trend_surge', 'freelance', 'resale', 'grant',
  'contest', 'giveaway', 'financial', 'tax', 'government', 'prize'
];

const KYC_REASONS = [
  'financial_onboarding', 'payment_payout', 'prize_claiming', 'grant_application',
  'tax_compliance', 'government_compliance', 'identity_verification',
  'age_verification', 'residency_verification', 'high_value_transaction'
];

export default function IdentityRoutingPolicyBuilder() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState(null);
  const [formData, setFormData] = useState({
    rule_name: '',
    category: 'general',
    platform: '',
    requires_kyc: false,
    kyc_reason: '',
    identity_type: 'auto_detect',
    priority: 50,
  });

  // Fetch policies
  const { data: policies = [] } = useQuery({
    queryKey: ['identityRoutingPolicies'],
    queryFn: async () => {
      const res = await base44.functions.invoke('intelligentIdentityRouter', {
        action: 'get_routing_policies'
      });
      return res.data?.policies || [];
    },
    refetchInterval: 60000
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingPolicy) {
        await base44.entities.IdentityRoutingPolicy.update(editingPolicy.id, data);
      } else {
        await base44.functions.invoke('intelligentIdentityRouter', {
          action: 'create_routing_policy',
          policyData: data
        });
      }
    },
    onSuccess: () => {
      toast.success(`✓ Policy ${editingPolicy ? 'updated' : 'created'}`);
      qc.invalidateQueries({ queryKey: ['identityRoutingPolicies'] });
      setShowForm(false);
      setEditingPolicy(null);
      resetForm();
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    }
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (policyId) => base44.entities.IdentityRoutingPolicy.delete(policyId),
    onSuccess: () => {
      toast.success('✓ Policy deleted');
      qc.invalidateQueries({ queryKey: ['identityRoutingPolicies'] });
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    }
  });

  const resetForm = () => {
    setFormData({
      rule_name: '',
      category: 'general',
      platform: '',
      requires_kyc: false,
      kyc_reason: '',
      identity_type: 'auto_detect',
      priority: 50,
    });
  };

  const handleEdit = (policy) => {
    setEditingPolicy(policy);
    setFormData(policy);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!formData.rule_name.trim()) {
      toast.error('Rule name is required');
      return;
    }
    saveMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <Settings className="w-4 h-4 text-cyan-400" />
          Routing Policies ({policies.length})
        </h3>
        {!showForm && (
          <Button
            onClick={() => { resetForm(); setShowForm(true); }}
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-7 gap-1"
          >
            <Plus className="w-3 h-3" /> New Rule
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && (
        <Card className="bg-slate-900/60 border-slate-700">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{editingPolicy ? 'Edit Rule' : 'Create Routing Rule'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Rule Name */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Rule Name *</label>
              <Input
                value={formData.rule_name}
                onChange={(e) => setFormData({ ...formData, rule_name: e.target.value })}
                placeholder="e.g., 'High-value grants require KYC'"
                className="bg-slate-800 border-slate-700 text-white text-sm h-8"
              />
            </div>

            {/* Category & Platform */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs"
                >
                  {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Platform (optional)</label>
                <Input
                  value={formData.platform}
                  onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                  placeholder="e.g., upwork, stripe"
                  className="bg-slate-800 border-slate-700 text-white text-sm h-8"
                />
              </div>
            </div>

            {/* KYC Toggle */}
            <div className="p-3 rounded-lg bg-slate-800/40 border border-slate-700">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requires_kyc}
                  onChange={(e) => setFormData({ ...formData, requires_kyc: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-xs text-slate-300">Requires KYC Verification</span>
              </label>
            </div>

            {/* KYC Reason */}
            {formData.requires_kyc && (
              <div>
                <label className="text-xs text-slate-400 block mb-1">KYC Reason</label>
                <select
                  value={formData.kyc_reason}
                  onChange={(e) => setFormData({ ...formData, kyc_reason: e.target.value })}
                  className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs"
                >
                  <option value="">Select reason...</option>
                  {KYC_REASONS.map(reason => <option key={reason} value={reason}>{reason}</option>)}
                </select>
              </div>
            )}

            {/* Identity Type */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Identity Type</label>
              <select
                value={formData.identity_type}
                onChange={(e) => setFormData({ ...formData, identity_type: e.target.value })}
                className="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1.5 text-white text-xs"
              >
                <option value="auto_detect">Auto-detect (AI decides)</option>
                <option value="persona">Always Use Persona</option>
                <option value="legal">Always Use Legal Identity</option>
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="text-xs text-slate-400 block mb-1">Priority (0-100)</label>
              <Input
                type="range"
                min="0"
                max="100"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full h-2 cursor-pointer"
              />
              <div className="text-xs text-slate-500 text-right mt-1">{formData.priority}</div>
            </div>

            {/* Buttons */}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-white text-xs h-8 gap-1"
              >
                <Save className="w-3 h-3" />
                {saveMutation.isPending ? 'Saving...' : 'Save Rule'}
              </Button>
              <Button
                onClick={() => { setShowForm(false); setEditingPolicy(null); resetForm(); }}
                variant="outline"
                className="flex-1 border-slate-700 text-xs h-8"
              >
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Policies List */}
      <div className="space-y-2">
        {policies.length === 0 ? (
          <div className="text-center py-6 text-slate-500 text-xs">
            No routing policies yet. Create one to automate identity selection.
          </div>
        ) : (
          policies.map((policy) => (
            <Card key={policy.id} className="bg-slate-900/40 border-slate-800 hover:border-slate-700 transition-colors p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-white text-sm">{policy.rule_name}</div>
                  <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                    <div>Category: <span className="text-slate-400">{policy.category}</span></div>
                    {policy.platform && <div>Platform: <span className="text-slate-400">{policy.platform}</span></div>}
                    <div>Identity Type: <span className={policy.identity_type === 'legal' ? 'text-amber-400' : policy.identity_type === 'persona' ? 'text-blue-400' : 'text-slate-400'}>{policy.identity_type}</span></div>
                    {policy.requires_kyc && <div className="text-amber-400">⚠ KYC Required ({policy.kyc_reason})</div>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    onClick={() => handleEdit(policy)}
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-slate-500 hover:text-slate-300"
                  >
                    ✎
                  </Button>
                  <Button
                    onClick={() => deleteMutation.mutate(policy.id)}
                    size="sm"
                    variant="ghost"
                    disabled={deleteMutation.isPending}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}