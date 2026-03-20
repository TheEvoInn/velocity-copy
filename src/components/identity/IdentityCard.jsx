import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Power, Trash2, Link2, ChevronDown, Pencil, Check, X, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';

// Inline editable field — saves on blur or Enter key
function InlineField({ value, onSave, placeholder = '—', multiline = false, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    if (draft === (value || '')) { setEditing(false); return; }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (!editing) {
    return (
      <span
        onClick={() => { setDraft(value || ''); setEditing(true); }}
        className={`group relative cursor-pointer hover:bg-white/5 rounded px-1 -mx-1 transition-colors ${className}`}
        title="Click to edit"
      >
        {value || <span className="text-slate-600 italic">{placeholder}</span>}
        <Pencil className="inline-block w-2.5 h-2.5 ml-1 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1">
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') cancel(); }}
          rows={2}
          className={`bg-slate-800 border border-violet-500/50 rounded px-1.5 py-0.5 text-white text-xs w-full focus:outline-none focus:border-violet-400 resize-none ${className}`}
        />
      ) : (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className={`bg-slate-800 border border-violet-500/50 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none focus:border-violet-400 min-w-0 w-full ${className}`}
        />
      )}
      <button onClick={commit} disabled={saving} className="text-emerald-400 hover:text-emerald-300 shrink-0">
        <Check className="w-3 h-3" />
      </button>
      <button onClick={cancel} className="text-slate-500 hover:text-slate-300 shrink-0">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

export default function IdentityCard({
  identity,
  onEdit,
  onSwitch,
  onDelete,
  onManageAccounts,
  isSwitching
}) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();

  const isActive = identity.is_active;

  const saveField = async (field, value) => {
    await base44.entities.AIIdentity.update(identity.id, { [field]: value });
    qc.invalidateQueries({ queryKey: ['aiIdentities', user?.email] });
    qc.invalidateQueries({ queryKey: ['active_identity', user?.email] });
  };

  return (
    <Card className={`border transition-all ${isActive ? 'border-emerald-500/50 bg-emerald-950/10' : 'border-slate-700/60 bg-slate-900/50'} p-4`}>
      <div className="space-y-3">

        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-white text-sm">
                <InlineField
                  value={identity.name}
                  onSave={v => saveField('name', v)}
                  placeholder="Identity name"
                />
              </span>
              {isActive && (
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                  <Radio className="w-2.5 h-2.5 animate-pulse" /> ACTIVE
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              <InlineField
                value={identity.role_label}
                onSave={v => saveField('role_label', v)}
                placeholder="Role label"
              />
            </p>
          </div>
          <button onClick={() => setExpanded(!expanded)} className="text-slate-500 hover:text-white shrink-0 mt-0.5">
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Quick info - inline editable */}
        <div className="text-xs text-slate-400 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0">📧</span>
            <InlineField
              value={identity.email}
              onSave={v => saveField('email', v)}
              placeholder="Add email"
              className="flex-1"
            />
          </div>
          <div className="flex items-start gap-1.5">
            <span className="shrink-0 mt-0.5">💬</span>
            <InlineField
              value={identity.tagline}
              onSave={v => saveField('tagline', v)}
              placeholder="Add tagline"
              className="flex-1"
            />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 text-[10px]">
          <div><span className="text-slate-500">Tasks </span><span className="text-white font-semibold">{identity.tasks_executed || 0}</span></div>
          <div><span className="text-slate-500">Earned </span><span className="text-emerald-400 font-semibold">${(identity.total_earned || 0).toFixed(2)}</span></div>
          <div><span className="text-slate-500">Accounts </span><span className="text-blue-400 font-semibold">{(identity.linked_account_ids || []).length}</span></div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={isActive ? 'outline' : 'default'}
            onClick={() => onSwitch(identity.id)}
            disabled={isSwitching || isActive}
            className={`flex-1 text-xs ${!isActive ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'border-slate-600 text-slate-400'}`}
          >
            <Power className="w-3 h-3 mr-1" />
            {isSwitching ? 'Switching…' : isActive ? 'Active' : 'Activate'}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onManageAccounts}
            className="text-xs border-slate-700 text-slate-400 hover:text-white"
          >
            <Link2 className="w-3 h-3 mr-1" />
            Accounts
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onEdit(identity)}
            className="text-xs border-slate-700 text-slate-400 hover:text-white"
          >
            <Pencil className="w-3 h-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(identity.id)}
            disabled={isSwitching || isActive}
            className="text-red-400 hover:text-red-300 hover:bg-red-950/20"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>

        {/* Expanded details - all inline editable */}
        {expanded && (
          <div className="pt-3 border-t border-slate-800 space-y-3 text-xs">
            <div>
              <p className="text-slate-500 font-medium mb-1">Bio</p>
              <InlineField
                value={identity.bio}
                onSave={v => saveField('bio', v)}
                placeholder="Add a bio…"
                multiline
              />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Tone</p>
              <select
                value={identity.communication_tone || 'professional'}
                onChange={e => saveField('communication_tone', e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-violet-500 cursor-pointer"
              >
                {['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive', 'empathetic'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Email Signature</p>
              <InlineField
                value={identity.email_signature}
                onSave={v => saveField('email_signature', v)}
                placeholder="Add email signature…"
                multiline
              />
            </div>
            <div>
              <p className="text-slate-500 font-medium mb-1">Skills <span className="text-slate-600 font-normal">(comma-separated)</span></p>
              <InlineField
                value={(identity.skills || []).join(', ')}
                onSave={v => saveField('skills', v.split(',').map(s => s.trim()).filter(Boolean))}
                placeholder="Add skills…"
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}