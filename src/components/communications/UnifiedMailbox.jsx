/**
 * Unified Mailbox — User + Autopilot Email Management
 * - Send emails manually or queue for autopilot
 * - View email history
 * - Use templates
 * - Integrated with notifications and campaigns
 */
import React, { useState } from 'react';
import { Send, Clock, Mail, Plus, Eye, Trash2, Copy, CheckCircle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function UnifiedMailbox() {
  const [tab, setTab] = useState('send'); // send, history, templates
  const [draftTo, setDraftTo] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [sendMode, setSendMode] = useState('manual'); // manual, queue
  const [scheduleTime, setScheduleTime] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templates, setTemplates] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const queryClient = useQueryClient();

  // Fetch email history
  const { data: emailHistory = [] } = useQuery({
    queryKey: ['email-history'],
    queryFn: async () => {
      const res = await base44.functions.invoke('emailOrchestrationEngine', {
        action: 'get_history',
        data: { limit: 30 },
      });
      return res.data?.emails || [];
    },
  });

  // Fetch templates
  const { data: templatesList = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await base44.functions.invoke('emailOrchestrationEngine', {
        action: 'list_templates',
        data: {},
      });
      return res.data?.templates || [];
    },
  });

  // Send/Queue email
  const handleSendEmail = async () => {
    if (!draftTo || !draftSubject || !draftBody) {
      alert('Please fill in all fields');
      return;
    }

    setIsSending(true);
    try {
      if (sendMode === 'manual') {
        // Send immediately
        const res = await base44.functions.invoke('emailOrchestrationEngine', {
          action: 'send_email',
          mode: 'manual',
          data: {
            to: draftTo,
            subject: draftSubject,
            body: draftBody,
            auto_generated: false,
          },
        });

        if (res.data?.success) {
          setDraftTo('');
          setDraftSubject('');
          setDraftBody('');
          queryClient.invalidateQueries({ queryKey: ['email-history'] });
          alert(`✓ Email sent to ${draftTo}`);
        }
      } else if (sendMode === 'queue') {
        // Queue for autopilot
        if (!scheduleTime) {
          alert('Please select a send time');
          return;
        }

        const res = await base44.functions.invoke('emailOrchestrationEngine', {
          action: 'queue_email',
          mode: 'autonomous',
          data: {
            to: draftTo,
            subject: draftSubject,
            body: draftBody,
            send_at: scheduleTime,
            auto_generated: false,
          },
        });

        if (res.data?.success) {
          setDraftTo('');
          setDraftSubject('');
          setDraftBody('');
          setScheduleTime('');
          setSendMode('manual');
          alert(`✓ Email queued for ${scheduleTime}`);
        }
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsSending(false);
    }
  };

  // Apply template
  const applyTemplate = async (template) => {
    try {
      const res = await base44.functions.invoke('emailOrchestrationEngine', {
        action: 'generate_from_template',
        data: {
          template_id: template.id,
          recipient_name: draftTo.split('@')[0],
          recipient_email: draftTo,
        },
      });

      if (res.data?.success) {
        setDraftSubject(res.data.subject);
        setDraftBody(res.data.body);
      }
    } catch (error) {
      alert(`Error applying template: ${error.message}`);
    }
  };

  // Save as template
  const saveAsTemplate = async () => {
    if (!newTemplateName || !draftSubject || !draftBody) {
      alert('Please fill in template name, subject, and body');
      return;
    }

    try {
      await base44.functions.invoke('emailOrchestrationEngine', {
        action: 'create_template',
        data: {
          name: newTemplateName,
          subject: draftSubject,
          body: draftBody,
          category: 'user-created',
        },
      });

      setNewTemplateName('');
      setShowTemplateForm(false);
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      alert('✓ Template saved');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <div className="w-full space-y-4">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-slate-800 pb-3">
        {['send', 'history', 'templates'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-xs font-orbitron uppercase transition-all ${
              tab === t
                ? 'text-cyan-400 border-b-2 border-cyan-400'
                : 'text-slate-500 hover:text-slate-400'
            }`}
          >
            {t === 'send' && '✉ Compose'}
            {t === 'history' && '📋 History'}
            {t === 'templates' && '📝 Templates'}
          </button>
        ))}
      </div>

      {/* SEND TAB */}
      {tab === 'send' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 font-mono">TO</label>
            <input
              type="email"
              value={draftTo}
              onChange={(e) => setDraftTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono">SUBJECT</label>
            <input
              type="text"
              value={draftSubject}
              onChange={(e) => setDraftSubject(e.target.value)}
              placeholder="Email subject..."
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          <div>
            <label className="text-xs text-slate-400 font-mono">BODY</label>
            <textarea
              value={draftBody}
              onChange={(e) => setDraftBody(e.target.value)}
              placeholder="Message content..."
              rows={6}
              className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm font-mono focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
            />
          </div>

          {/* Template Quick Apply */}
          {templatesList.length > 0 && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800">
              <p className="text-xs text-slate-400 font-orbitron mb-2">QUICK TEMPLATES</p>
              <div className="flex gap-2 flex-wrap">
                {templatesList.slice(0, 5).map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl)}
                    className="text-xs px-2 py-1 rounded border border-cyan-600/40 text-cyan-400 hover:bg-cyan-600/10 transition-colors"
                  >
                    {tpl.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Send Mode */}
          <div className="grid grid-cols-2 gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sendMode"
                value="manual"
                checked={sendMode === 'manual'}
                onChange={(e) => setSendMode(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-xs text-slate-400">Send Now</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="sendMode"
                value="queue"
                checked={sendMode === 'queue'}
                onChange={(e) => setSendMode(e.target.value)}
                className="w-4 h-4"
              />
              <span className="text-xs text-slate-400">Queue for Autopilot</span>
            </label>
          </div>

          {sendMode === 'queue' && (
            <div>
              <label className="text-xs text-slate-400 font-mono">SCHEDULE TIME</label>
              <input
                type="datetime-local"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="w-full mt-1 px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-white text-sm"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleSendEmail}
              disabled={isSending}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {sendMode === 'manual' ? 'SEND NOW' : 'QUEUE EMAIL'}
            </button>
            <button
              onClick={() => setShowTemplateForm(!showTemplateForm)}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Save as Template */}
          {showTemplateForm && (
            <div className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 space-y-2">
              <input
                type="text"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="Template name..."
                className="w-full px-2 py-1 rounded text-xs bg-slate-950 border border-slate-800 text-white"
              />
              <button
                onClick={saveAsTemplate}
                className="w-full px-3 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-colors"
              >
                Save as Template
              </button>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {emailHistory.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No emails sent yet</p>
          ) : (
            emailHistory.map(email => (
              <div
                key={email.id}
                className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-slate-400">{email.to}</p>
                    <p className="text-sm text-white truncate">{email.subject}</p>
                    <p className="text-xs text-slate-500 mt-1">{email.preview}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1 text-xs text-slate-500">
                    <span>{new Date(email.sent_at).toLocaleDateString()}</span>
                    <span className="text-emerald-400">✓ {email.status}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* TEMPLATES TAB */}
      {tab === 'templates' && (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {templatesList.length === 0 ? (
            <p className="text-xs text-slate-500 py-8 text-center">No templates yet. Create one in Compose.</p>
          ) : (
            templatesList.map(tpl => (
              <div
                key={tpl.id}
                className="p-3 rounded-lg bg-slate-900/50 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
                onClick={() => {
                  applyTemplate(tpl);
                  setTab('send');
                }}
              >
                <p className="text-sm font-bold text-cyan-400">{tpl.name}</p>
                <p className="text-xs text-slate-400">{tpl.subject}</p>
                <p className="text-xs text-slate-500 mt-1">{tpl.category}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}