/**
 * IdentityCreateForm — Slide-in panel to create or edit an AI persona
 * On save, triggers 2-way sync via useUserIdentities hook
 */
import React, { useState, useEffect } from 'react';
import { X, Sparkles, Save } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const COLORS = ['#a855f7', '#00e8ff', '#10b981', '#f9d65c', '#ff2ec4', '#3b82f6', '#f97316', '#ef4444'];
const ICONS = ['🤖', '💼', '✍️', '🎮', '🎨', '🔬', '📊', '💻', '🌍', '⚡'];

const DEFAULT_FORM = {
  name: '', role_label: '', email: '', tagline: '', bio: '',
  communication_tone: 'professional', skills: '',
  preferred_platforms: '', color: '#a855f7', icon: '🤖',
  spending_limit_per_task: 100,
};

export default function IdentityCreateForm({ identity, onSave, onCancel }) {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (identity) {
      setForm({
        ...DEFAULT_FORM, ...identity,
        skills: (identity.skills || []).join(', '),
        preferred_platforms: (identity.preferred_platforms || []).join(', '),
      });
    } else {
      setForm(DEFAULT_FORM);
    }
  }, [identity]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  async function generateBio() {
    if (!form.name || !form.role_label) return;
    setGenerating(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a short, compelling 2-sentence professional bio for an AI persona named "${form.name}" who works as "${form.role_label}". Tone: ${form.communication_tone}. Skills: ${form.skills}. Make it specific and authentic-sounding.`,
      });
      if (typeof res === 'string') set('bio', res.trim());
    } catch {}
    setGenerating(false);
  }

  async function handleSave() {
    if (!form.name) return;
    setLoading(true);
    const data = {
      ...form,
      skills: form.skills.split(',').map(s => s.trim()).filter(Boolean),
      preferred_platforms: form.preferred_platforms.split(',').map(s => s.trim()).filter(Boolean),
    };
    await onSave(data);
    setLoading(false);
  }

  const color = form.color || '#a855f7';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(5,7,20,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ background: 'rgba(10,15,42,0.95)', border: `1.5px solid ${color}40`, boxShadow: `0 0 40px ${color}15` }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: `${color}20` }}>
          <div>
            <h2 className="font-orbitron text-sm font-bold text-white tracking-widest">
              {identity ? 'EDIT IDENTITY' : 'CREATE IDENTITY'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Configure AI persona — all settings sync in real-time</p>
          </div>
          <button onClick={onCancel} className="text-slate-500 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Icon + Color row */}
          <div className="flex gap-4 items-start">
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-2">ICON</label>
              <div className="flex flex-wrap gap-1.5">
                {ICONS.map(ic => (
                  <button key={ic} onClick={() => set('icon', ic)}
                    className="w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all"
                    style={{ background: form.icon === ic ? `${color}20` : 'rgba(255,255,255,0.04)', border: `1px solid ${form.icon === ic ? color : 'rgba(255,255,255,0.1)'}` }}>
                    {ic}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-2">COLOR</label>
              <div className="flex flex-wrap gap-1.5">
                {COLORS.map(c => (
                  <button key={c} onClick={() => set('color', c)}
                    className="w-7 h-7 rounded-lg transition-all"
                    style={{ background: c, border: form.color === c ? '2px solid white' : '2px solid transparent', transform: form.color === c ? 'scale(1.15)' : 'scale(1)' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Name + Role */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">NAME *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Alex Morgan" className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">ROLE</label>
              <input value={form.role_label} onChange={e => set('role_label', e.target.value)}
                placeholder="Freelance Writer" className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
            </div>
          </div>

          {/* Email + Tagline */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">EMAIL</label>
              <input value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="alex@example.com" className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
            </div>
            <div>
              <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">TAGLINE</label>
              <input value={form.tagline} onChange={e => set('tagline', e.target.value)}
                placeholder="Delivering results 24/7" className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
            </div>
          </div>

          {/* Tone */}
          <div>
            <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">COMMUNICATION TONE</label>
            <select value={form.communication_tone} onChange={e => set('communication_tone', e.target.value)}
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500 cursor-pointer">
              {['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive', 'empathetic'].map(t => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>

          {/* Bio */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-orbitron text-slate-500 tracking-widest">BIO</label>
              <button onClick={generateBio} disabled={generating || !form.name}
                className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300 disabled:opacity-40 transition-colors">
                <Sparkles className="w-3 h-3" />
                {generating ? 'Generating…' : 'AI Generate'}
              </button>
            </div>
            <textarea value={form.bio} onChange={e => set('bio', e.target.value)}
              placeholder="Professional bio…" rows={3}
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500 resize-none" />
          </div>

          {/* Skills */}
          <div>
            <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">SKILLS (comma-separated)</label>
            <input value={form.skills} onChange={e => set('skills', e.target.value)}
              placeholder="writing, research, data-entry, transcription…"
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
          </div>

          {/* Preferred Platforms */}
          <div>
            <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">PREFERRED PLATFORMS</label>
            <input value={form.preferred_platforms} onChange={e => set('preferred_platforms', e.target.value)}
              placeholder="upwork, fiverr, freelancer…"
              className="w-full px-3 py-2 rounded-xl text-sm text-white bg-slate-800 border border-slate-700 focus:outline-none focus:border-violet-500" />
          </div>

          {/* Spending limit */}
          <div>
            <label className="text-xs font-orbitron text-slate-500 tracking-widest block mb-1.5">
              SPENDING LIMIT PER TASK: <span style={{ color }}>${form.spending_limit_per_task}</span>
            </label>
            <input type="range" min="0" max="500" step="10" value={form.spending_limit_per_task}
              onChange={e => set('spending_limit_per_task', Number(e.target.value))}
              className="w-full h-1 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(90deg, ${color} ${form.spending_limit_per_task / 5}%, #1e293b ${form.spending_limit_per_task / 5}%)` }} />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 flex justify-end gap-3 border-t" style={{ borderColor: `${color}15` }}>
          <button onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-orbitron text-slate-400 hover:text-white transition-colors"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={loading || !form.name}
            className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-orbitron tracking-wide transition-all disabled:opacity-50"
            style={{ background: `${color}15`, border: `1px solid ${color}40`, color }}>
            <Save className="w-3.5 h-3.5" />
            {loading ? 'Saving…' : identity ? 'Update Identity' : 'Create Identity'}
          </button>
        </div>
      </div>
    </div>
  );
}