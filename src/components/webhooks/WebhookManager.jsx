/**
 * Webhook Manager Component
 * Configure and manage Task Reader webhooks
 */
import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Copy, RotateCcw, Zap, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function WebhookManager({ webhooks = [] }) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTokens, setShowTokens] = useState({});
  const [formData, setFormData] = useState({
    webhook_name: '',
    trigger_type: 'url_analysis',
    description: ''
  });

  const handleCreate = async () => {
    if (!formData.webhook_name.trim()) {
      alert('Please enter a webhook name');
      return;
    }

    try {
      const res = await base44.functions.invoke('webhookManager', {
        action: 'create_webhook',
        payload: formData
      });

      if (res.data.status === 'success') {
        alert('Webhook created successfully!');
        setFormData({ webhook_name: '', trigger_type: 'url_analysis', description: '' });
        setShowCreateForm(false);
        window.location.reload();
      }
    } catch (err) {
      alert('Error creating webhook: ' + err.message);
    }
  };

  const handleRotateToken = async (webhookId) => {
    if (!confirm('Are you sure? The old token will no longer work.')) return;

    try {
      const res = await base44.functions.invoke('webhookManager', {
        action: 'rotate_token',
        payload: { webhook_id: webhookId }
      });

      if (res.data.status === 'success') {
        alert('Token rotated successfully!');
        window.location.reload();
      }
    } catch (err) {
      alert('Error rotating token: ' + err.message);
    }
  };

  const handleToggleWebhook = async (webhookId, currentStatus) => {
    try {
      const res = await base44.functions.invoke('webhookManager', {
        action: 'toggle_webhook',
        payload: { webhook_id: webhookId, enabled: currentStatus === 'paused' }
      });

      if (res.data.status === 'success') {
        window.location.reload();
      }
    } catch (err) {
      alert('Error toggling webhook: ' + err.message);
    }
  };

  return (
    <div className="space-y-4">
      {/* Create Button */}
      <Button
        onClick={() => setShowCreateForm(!showCreateForm)}
        className="gap-2"
      >
        <Plus className="w-4 h-4" />
        Create Webhook
      </Button>

      {/* Create Form */}
      {showCreateForm && (
        <Card className="p-6 bg-violet-500/10 border-violet-500/30">
          <h3 className="font-semibold text-white mb-4">Create New Webhook</h3>
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Webhook Name (e.g., 'Job Application Trigger')"
              value={formData.webhook_name}
              onChange={e => setFormData({...formData, webhook_name: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-400"
            />

            <select
              value={formData.trigger_type}
              onChange={e => setFormData({...formData, trigger_type: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white"
            >
              <option value="url_analysis">URL Analysis</option>
              <option value="form_filling">Form Filling</option>
              <option value="grant_application">Grant Application</option>
              <option value="job_application">Job Application</option>
              <option value="generic_task">Generic Task</option>
            </select>

            <textarea
              placeholder="Description (optional)"
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-400 h-20"
            />

            <div className="flex gap-2">
              <Button onClick={handleCreate} className="flex-1">Create</Button>
              <Button
                onClick={() => setShowCreateForm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Webhooks List */}
      <div className="space-y-3">
        {webhooks?.length > 0 ? (
          webhooks.map(webhook => (
            <Card key={webhook.id} className="p-4 bg-slate-900/50 border-slate-800">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-white">{webhook.webhook_name}</h4>
                    <Badge className={
                      webhook.status === 'active'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }>
                      {webhook.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-400 mt-1">{webhook.description}</p>
                </div>
                <span className="text-xs text-slate-500">
                  {webhook.trigger_type?.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Webhook URL & Token */}
              <div className="bg-slate-800/50 rounded-lg p-3 mb-3 space-y-2">
                <div>
                  <p className="text-xs text-slate-400 mb-1">Webhook URL</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded flex-1 overflow-x-auto">
                      {webhook.webhook_url}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(webhook.webhook_url)}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-slate-400 mb-1">Webhook Token</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs text-slate-300 bg-slate-900 px-2 py-1 rounded flex-1 overflow-x-auto">
                      {showTokens[webhook.id] ? webhook.webhook_token : '••••••••••••••••'}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowTokens({...showTokens, [webhook.id]: !showTokens[webhook.id]})}
                      className="h-7 w-7 p-0"
                    >
                      {showTokens[webhook.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(webhook.webhook_token)}
                      className="h-7 w-7 p-0"
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Stats */}
              {webhook.statistics && (
                <div className="grid grid-cols-4 gap-2 text-xs mb-3">
                  <div>
                    <p className="text-slate-400">Total Requests</p>
                    <p className="text-white font-semibold">{webhook.statistics.total_requests || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Tasks Created</p>
                    <p className="text-white font-semibold">{webhook.statistics.successful_tasks || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Failed</p>
                    <p className="text-white font-semibold">{webhook.statistics.failed_requests || 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Success Rate</p>
                    <p className="text-white font-semibold">{Math.round((webhook.statistics.success_rate || 0) * 100)}%</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleToggleWebhook(webhook.id, webhook.status)}
                  className="flex-1 text-xs"
                >
                  {webhook.status === 'active' ? 'Pause' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleRotateToken(webhook.id)}
                  className="flex-1 gap-1 text-xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  Rotate Token
                </Button>
              </div>
            </Card>
          ))
        ) : (
          <Card className="p-4 text-center text-slate-400">
            <Zap className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No webhooks created yet</p>
            <p className="text-xs mt-1">Create one to trigger tasks from external services</p>
          </Card>
        )}
      </div>
    </div>
  );
}