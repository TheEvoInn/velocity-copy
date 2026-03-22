/**
 * IdentityPersonaCard — Full persona card with credentials, platform matrix, and success metrics
 * 2-way synced: all edits persist immediately via useUserIdentities hook
 */
import React, { useState } from 'react';
import {
  Radio, Power, Trash2, ChevronDown, ChevronUp, Check, X, Pencil,
  Shield, Globe, TrendingUp, Zap, Clock, Star, AlertTriangle, Link2
} from 'lucide-react';

const PLATFORM_COLORS = {
  upwork: '#14a800', fiverr: '#1dbf73', freelancer: '#0e4c96',
  toptal: '#204ecf', guru: '#f47920', peopleperhour: '#f77f00',
  '99designs': '#f2533c', other: '#64748b',
};

const HEALTH_CONFIG = {
  healthy: { color: '#10b981', label: 'Healthy', icon: '✓' },
  warning: { color: '#f9d65c', label: 'Warning', icon: '⚠' },
  cooldown: { color: '#f97316', label: 'Cooldown', icon: '⏸' },
  suspended: { color: '#ef4444', label: 'Suspended', icon: '✗' },
  limited: { color: '#a855f7', label: 'Limited', icon: '⚡' },
};

function InlineEdit({ value, onSave, placeholder = '—', multiline = false, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const commit = async () => {
    if (draft !== (value || '')) await onSave(draft);
    setEditing(false);
  };
  const cancel = () => { setDraft(value || ''); setEditing(false); };

  if (!editing) return (
    <span onClick={() => { setDraft(value || ''); setEditing(true); }}
      className={`group cursor-pointer hover:bg-white/5 rounded px-0.5 transition-colors ${className}`} title="Click to edit">
      {value || <span className="text-slate-600 italic text-xs">{placeholder}</span>}
      <Pencil className="inline-block w-2 h-2 ml-0.5 text-slate-600 opacity-0 group-hover:opacity-100" />
    </span>
  );

  return (
    <span className="flex items-center gap-1">
      {multiline
        ? <textarea autoFocus value={draft} onChange={e => setDraft(e.target.value)} rows={2}
            onKeyDown={e => e.key === 'Escape' && cancel()}
            className={`bg-slate-800 border border-violet-500/50 rounded px-1.5 py-0.5 text-white text-xs w-full focus:outline-none resize-none ${className}`} />
        : <input autoFocus value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
            className={`bg-slate-800 border border-violet-500/50 rounded px-1.5 py-0.5 text-white text-xs focus:outline-none w-full ${className}`} />
      }
      <button onClick={commit} className="text-emerald-400 shrink-0"><Check className="w-3 h-3" /></button>
      <button onClick={cancel} className="text-slate-500 shrink-0"><X className="w-3 h-3" /></button>
    </span>
  );
}

function MetricBar({ value, max = 100, color }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width 0.6s ease' }} />
    </div>
  );
}

export default function IdentityPersonaCard({ identity, linkedAccounts = [], onSwitch, onDelete, onUpdate, isSwitching }) {
  const [expanded, setExpanded] = useState(false);
  const isActive = identity.is_active;
  const color = identity.color || '#a855f7';

  const save = (field) => async (value) => onUpdate({ id: identity.id, data: { [field]: value } });

  // Compute success rate from tasks
  const successRate = identity.tasks_executed > 0
    ? Math.min(100, Math.round(((identity.tasks_executed - (identity.failed_tasks || 0)) / identity.tasks_executed) * 100))
    : 0;

  const avgEarningPerTask = identity.tasks_executed > 0
    ? (identity.total_earned || 0) / identity.tasks_executed
    : 0;

  // Authorized platforms derived from linked accounts
  const authorizedPlatforms = linkedAccounts.filter(a => identity.linked_account_ids?.includes(a.id));

  return (
    <div className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        background: 'rgba(10,15,42,0.8)',
        border: `1.5px solid ${isActive ? color : `${color}30`}`,
        boxShadow: isActive ? `0 0 20px ${color}15, 0 0 40px ${color}08` : 'none',
      }}>

      {/* Top accent */}
      <div className="h-0.5 w-full" style={{ background: isActive ? `linear-gradient(90deg, transparent, ${color}, transparent)` : 'transparent' }} />

      <div className="p-5">
        {/* ── HEADER ── */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl font-bold shrink-0"
              style={{ background: `${color}15`, border: `1px solid ${color}30`, color }}>
              {identity.icon || identity.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-orbitron text-sm font-bold text-white">
                  <InlineEdit value={identity.name} onSave={save('name')} placeholder="Name" />
                </span>
                {isActive && (
                  <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${color}15`, color, border: `1px solid ${color}30` }}>
                    <Radio className="w-2 h-2 animate-pulse" /> ACTIVE
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                <InlineEdit value={identity.role_label} onSave={save('role_label')} placeholder="Role" />
              </div>
            </div>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="text-slate-600 hover:text-white transition-colors mt-1">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* ── METRICS ROW ── */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: 'TASKS', value: identity.tasks_executed || 0, color: '#00e8ff' },
            { label: 'EARNED', value: `$${(identity.total_earned || 0).toFixed(0)}`, color: '#10b981' },
            { label: 'SUCCESS', value: `${successRate}%`, color: successRate >= 70 ? '#10b981' : successRate >= 40 ? '#f9d65c' : '#ef4444' },
          ].map(m => (
            <div key={m.label} className="rounded-xl p-2.5 text-center"
              style={{ background: `${m.color}08`, border: `1px solid ${m.color}15` }}>
              <div className="text-xs font-orbitron tracking-widest mb-0.5" style={{ color: `${m.color}70` }}>{m.label}</div>
              <div className="text-sm font-orbitron font-bold" style={{ color: m.color }}>{m.value}</div>
            </div>
          ))}
        </div>

        {/* ── PLATFORM AUTHORIZATION MATRIX ── */}
        <div className="mb-4">
          <div className="text-xs font-orbitron text-slate-600 tracking-widest mb-2 flex items-center gap-1.5">
            <Globe className="w-3 h-3" /> AUTHORIZED PLATFORMS
          </div>
          {authorizedPlatforms.length === 0 ? (
            <div className="text-xs text-slate-700 italic">No platforms linked yet</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {authorizedPlatforms.map(acc => {
                const health = HEALTH_CONFIG[acc.health_status] || HEALTH_CONFIG.healthy;
                const pColor = PLATFORM_COLORS[acc.platform] || PLATFORM_COLORS.other;
                return (
                  <div key={acc.id} className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs"
                    style={{ background: `${pColor}12`, border: `1px solid ${pColor}30`, color: pColor }}>
                    <span className="font-medium capitalize">{acc.platform}</span>
                    <span title={health.label} style={{ color: health.color }}>{health.icon}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── SKILLS PREVIEW ── */}
        {(identity.skills || []).length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {(identity.skills || []).slice(0, 5).map(skill => (
              <span key={skill} className="text-[10px] px-1.5 py-0.5 rounded-full"
                style={{ background: `${color}10`, color: `${color}bb`, border: `1px solid ${color}20` }}>
                {skill}
              </span>
            ))}
            {(identity.skills || []).length > 5 && (
              <span className="text-[10px] text-slate-600">+{identity.skills.length - 5}</span>
            )}
          </div>
        )}

        {/* ── SUCCESS METRIC BAR ── */}
        {identity.tasks_executed > 0 && (
          <div className="mb-4 space-y-1.5">
            <div className="flex justify-between text-[10px]">
              <span className="text-slate-600 font-orbitron tracking-wider">PERFORMANCE</span>
              <span style={{ color }}>{successRate}%</span>
            </div>
            <MetricBar value={successRate} color={color} />
          </div>
        )}

        {/* ── ACTIONS ── */}
        <div className="flex gap-2">
          <button onClick={() => onSwitch(identity.id)} disabled={isSwitching || isActive}
            className="flex-1 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all"
            style={{
              background: isActive ? `${color}10` : `${color}15`,
              border: `1px solid ${isActive ? `${color}40` : `${color}35`}`,
              color: isActive ? color : color,
              opacity: isActive ? 0.7 : 1,
              cursor: isActive ? 'default' : 'pointer',
            }}>
            <Power className="w-3 h-3 inline mr-1" />
            {isSwitching ? 'Switching…' : isActive ? 'Active' : 'Activate'}
          </button>
          <button onClick={() => onDelete(identity.id)} disabled={isActive}
            className="p-2 rounded-xl transition-all"
            style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', color: '#ef4444', opacity: isActive ? 0.3 : 1 }}>
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ── EXPANDED DETAIL PANEL ── */}
        {expanded && (
          <div className="mt-4 pt-4 border-t space-y-4 text-xs" style={{ borderColor: `${color}15` }}>

            {/* Bio */}
            <div>
              <div className="text-slate-600 font-orbitron tracking-widest mb-1.5">BIO</div>
              <div className="text-slate-400 leading-relaxed">
                <InlineEdit value={identity.bio} onSave={save('bio')} placeholder="Add a bio…" multiline />
              </div>
            </div>

            {/* Tone selector */}
            <div>
              <div className="text-slate-600 font-orbitron tracking-widest mb-1.5">COMMUNICATION TONE</div>
              <select value={identity.communication_tone || 'professional'}
                onChange={e => onUpdate({ id: identity.id, data: { communication_tone: e.target.value } })}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-violet-500 w-full cursor-pointer">
                {['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive', 'empathetic'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Skills */}
            <div>
              <div className="text-slate-600 font-orbitron tracking-widest mb-1.5">SKILLS</div>
              <InlineEdit
                value={(identity.skills || []).join(', ')}
                onSave={v => onUpdate({ id: identity.id, data: { skills: v.split(',').map(s => s.trim()).filter(Boolean) } })}
                placeholder="writing, research, data-entry…"
              />
            </div>

            {/* Preferred platforms */}
            <div>
              <div className="text-slate-600 font-orbitron tracking-widest mb-1.5">PREFERRED PLATFORMS</div>
              <InlineEdit
                value={(identity.preferred_platforms || []).join(', ')}
                onSave={v => onUpdate({ id: identity.id, data: { preferred_platforms: v.split(',').map(s => s.trim()).filter(Boolean) } })}
                placeholder="upwork, fiverr, freelancer…"
              />
            </div>

            {/* Email signature */}
            <div>
              <div className="text-slate-600 font-orbitron tracking-widest mb-1.5">EMAIL SIGNATURE</div>
              <InlineEdit value={identity.email_signature} onSave={save('email_signature')} placeholder="Best regards…" multiline />
            </div>

            {/* Spending limit */}
            <div>
              <div className="text-slate-600 font-orbitron tracking-widest mb-1.5">
                SPENDING LIMIT PER TASK: <span style={{ color }}>${identity.spending_limit_per_task || 100}</span>
              </div>
              <input type="range" min="0" max="500" step="10"
                value={identity.spending_limit_per_task || 100}
                onChange={e => onUpdate({ id: identity.id, data: { spending_limit_per_task: Number(e.target.value) } })}
                className="w-full h-1 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(90deg, ${color} ${(identity.spending_limit_per_task || 100) / 5}%, #1e293b ${(identity.spending_limit_per_task || 100) / 5}%)` }} />
            </div>

            {/* Account detail table */}
            {authorizedPlatforms.length > 0 && (
              <div>
                <div className="text-slate-600 font-orbitron tracking-widest mb-2">ACCOUNT CREDENTIALS STATUS</div>
                <div className="space-y-1.5 rounded-xl overflow-hidden">
                  {authorizedPlatforms.map(acc => {
                    const health = HEALTH_CONFIG[acc.health_status] || HEALTH_CONFIG.healthy;
                    return (
                      <div key={acc.id} className="flex items-center justify-between px-3 py-2 rounded-lg"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: health.color }} />
                          <span className="text-slate-300 capitalize font-medium">{acc.platform}</span>
                          {acc.username && <span className="text-slate-600">@{acc.username}</span>}
                        </div>
                        <div className="flex items-center gap-3 text-slate-500">
                          {acc.jobs_completed > 0 && <span className="text-emerald-400">{acc.jobs_completed} jobs</span>}
                          {acc.rating > 0 && <span className="text-amber-400">★{acc.rating.toFixed(1)}</span>}
                          <span style={{ color: health.color }}>{health.label}</span>
                          {acc.encrypted_credential_id && (
                            <span title="Credentials stored in vault">
                              <Shield className="w-3 h-3 text-violet-400" />
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}