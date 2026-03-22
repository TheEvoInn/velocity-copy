/**
 * Email Campaign Builder — Create & Execute Marketing Campaigns
 * - Define target audiences
 * - Create email sequences
 * - Schedule autonomous sending
 * - Track metrics
 */
import React, { useState } from 'react';
import { Send, Plus, Trash2, Play, Settings } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function EmailCampaignBuilder() {
  const [campaigns, setCampaigns] = useState([]);
  const [showNew, setShowNew] = useState(false);
  const [newCampaign, setNewCampaign] = useState({
    name: '',
    subject: '',
    body: '',
    targetEmails: '',
    scheduleTime: '',
  });
  const queryClient = useQueryClient();

  // Create campaign
  const handleCreateCampaign = async () => {
    if (!newCampaign.name || !newCampaign.subject || !newCampaign.body) {
      alert('Please fill in all required fields');
      return;
    }

    const emails = newCampaign.targetEmails
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

    if (emails.length === 0) {
      alert('Please add at least one recipient');
      return;
    }

    try {
      // Queue all emails
      for (const email of emails) {
        await base44.functions.invoke('emailOrchestrationEngine', {
          action: 'queue_email',
          mode: 'autonomous',
          data: {
            to: email,
            subject: newCampaign.subject,
            body: newCampaign.body,
            send_at: newCampaign.scheduleTime,
            campaign_id: `campaign_${Date.now()}`,
          },
        });
      }

      setNewCampaign({ name: '', subject: '', body: '', targetEmails: '', scheduleTime: '' });
      setShowNew(false);
      alert(`✓ Campaign created: ${emails.length} emails queued`);
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-bold text-cyan-400">Email Campaigns</h3>
        <button
          onClick={() => setShowNew(!showNew)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold transition-colors"
        >
          <Plus className="w-4 h-4" /> New Campaign
        </button>
      </div>

      {showNew && (
        <div className="p-4 rounded-lg bg-slate-900/50 border border-slate-800 space-y-3">
          <input
            type="text"
            value={newCampaign.name}
            onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
            placeholder="Campaign name..."
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
          />

          <input
            type="text"
            value={newCampaign.subject}
            onChange={(e) => setNewCampaign({ ...newCampaign, subject: e.target.value })}
            placeholder="Email subject..."
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
          />

          <textarea
            value={newCampaign.body}
            onChange={(e) => setNewCampaign({ ...newCampaign, body: e.target.value })}
            placeholder="Email body..."
            rows={4}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm font-mono"
          />

          <textarea
            value={newCampaign.targetEmails}
            onChange={(e) => setNewCampaign({ ...newCampaign, targetEmails: e.target.value })}
            placeholder="Recipients (comma-separated)..."
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm font-mono"
          />

          <input
            type="datetime-local"
            value={newCampaign.scheduleTime}
            onChange={(e) => setNewCampaign({ ...newCampaign, scheduleTime: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
          />

          <button
            onClick={handleCreateCampaign}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
          >
            <Send className="w-4 h-4" /> Create Campaign
          </button>
        </div>
      )}

      <div className="text-xs text-slate-500">
        <p>📧 Create automated email campaigns. All emails are queued for autonomous delivery.</p>
      </div>
    </div>
  );
}