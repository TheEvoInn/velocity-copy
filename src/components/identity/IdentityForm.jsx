import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, X, Upload, User, Palette } from 'lucide-react';
import MissionWriteButton from './MissionWriteButton';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';

const TONES = ['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive', 'empathetic'];
const PLATFORMS = ['upwork', 'fiverr', 'freelancer', 'toptal', 'guru', 'peopleperhour', '99designs', 'amazon', 'ebay', 'etsy', 'other'];
const CATEGORIES = ['freelance', 'service', 'arbitrage', 'lead_gen', 'digital_flip', 'auction', 'resale'];
const ROLE_LABELS = ['Freelancer', 'Sales & Outreach', 'Marketplace Seller', 'Negotiator', 'Support Agent', 'Content Creator', 'Consultant', 'Custom'];
const ACCENT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
const DEFAULT_SIGNATURES = {
  professional: 'Best regards,\n{name}\n\nSent via AI Autopilot',
  friendly: 'Cheers,\n{name} 😊',
  authoritative: 'Regards,\n{name}\nProfessional Services',
  casual: 'Thanks!\n{name}',
  technical: 'Best,\n{name}\nTech Solutions',
  persuasive: 'Looking forward to working with you,\n{name}',
  empathetic: 'With appreciation,\n{name}'
};

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-0.5">{hint}</p>}
    </div>
  );
}

function Toggle({ label, options, value, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
            value === o ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600'
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

function MultiSelect({ options, value = [], onChange }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`px-2 py-0.5 rounded text-[10px] border transition-colors capitalize ${
            value.includes(o) ? 'bg-violet-600/20 border-violet-500/40 text-violet-400' : 'bg-slate-800 border-slate-700 text-slate-600 hover:text-slate-400'
          }`}>
          {o}
        </button>
      ))}
    </div>
  );
}

export default function IdentityForm({ identity, onSave, onCancel }) {
  const [uploading, setUploading] = useState(false);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [form, setForm] = useState({
    name: identity?.name || '',
    role_label: identity?.role_label || 'Freelancer',
    email: identity?.email || '',
    phone: identity?.phone || '',
    avatar_url: identity?.avatar_url || '',
    tagline: identity?.tagline || '',
    bio: identity?.bio || '',
    communication_tone: identity?.communication_tone || 'professional',
    email_signature: identity?.email_signature || DEFAULT_SIGNATURES.professional,
    proposal_style: identity?.proposal_style || '',
    skills: identity?.skills?.join(', ') || '',
    preferred_platforms: identity?.preferred_platforms || [],
    preferred_categories: identity?.preferred_categories || [],
    spending_limit_per_task: identity?.spending_limit_per_task ?? 100,
    color: identity?.color || ACCENT_COLORS[0],
    notes: identity?.notes || '',
    auto_select_for_task_types: identity?.auto_select_for_task_types || [],
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // Mutation to save identity to database
  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const identityData = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        spending_limit_per_task: parseFloat(formData.spending_limit_per_task) || 100,
        created_by: user?.email,
        is_user_specific: true
      };

      if (identity?.id) {
        // Update existing
        return await base44.entities.AIIdentity.update(identity.id, identityData);
      } else {
        // Create new
        return await base44.entities.AIIdentity.create(identityData);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['aiIdentities'] });
      toast.success(identity ? 'Identity updated' : 'Identity created');
      onSave(form);
    },
    onError: (error) => {
      toast.error(`Failed to save identity: ${error.message}`);
    }
  });

  const handleToneChange = (tone) => {
    set('communication_tone', tone);
    if (!form.email_signature || DEFAULT_SIGNATURES[form.communication_tone] === form.email_signature) {
      set('email_signature', (DEFAULT_SIGNATURES[tone] || '').replace('{name}', form.name || 'AI Agent'));
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const res = await base44.integrations.Core.UploadFile({ file });
    if (res?.file_url) set('avatar_url', res.file_url);
    setUploading(false);
  };

  const handleSubmit = () => {
    if (!form.name?.trim()) {
      toast.error('Identity name is required');
      return;
    }
    saveMutation.mutate(form);
  };

  const TASK_TYPES = ['freelance', 'content', 'service', 'arbitrage', 'lead_gen', 'market_scan', 'digital_flip'];

  return (
    <div className="rounded-2xl bg-slate-900 border border-slate-700 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{identity ? 'Edit Identity' : 'New Identity Profile'}</h3>
        <button onClick={onCancel} className="text-slate-500 hover:text-white p-1"><X className="w-4 h-4" /></button>
      </div>

      {/* Avatar + Name row */}
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-700 flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${form.color}33, ${form.color}11)` }}>
            {form.avatar_url
              ? <img src={form.avatar_url} className="w-full h-full object-cover" alt="Avatar" />
              : <User className="w-7 h-7" style={{ color: form.color }} />
            }
          </div>
          <label className="mt-1.5 block cursor-pointer text-center">
            <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
            <span className="text-[9px] text-slate-500 hover:text-white transition-colors">
              {uploading ? 'Uploading...' : 'Upload'}
            </span>
          </label>
        </div>
        <div className="flex-1 space-y-2">
          <Field label="Identity Name *">
            <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Alex Mercer"
              className="bg-slate-800 border-slate-700 text-white text-sm h-9" />
          </Field>
          <Field label="Role Label">
            <Toggle options={ROLE_LABELS.slice(0, 4)} value={form.role_label} onChange={v => set('role_label', v)} />
          </Field>
        </div>
      </div>

      {/* Accent color */}
      <Field label="Accent Color">
        <div className="flex gap-2 flex-wrap">
          {ACCENT_COLORS.map(c => (
            <button key={c} type="button" onClick={() => set('color', c)}
              className={`w-7 h-7 rounded-lg transition-transform ${form.color === c ? 'scale-110 ring-2 ring-white/40' : 'hover:scale-105'}`}
              style={{ background: c }} />
          ))}
        </div>
      </Field>

      {/* Contact */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email Address">
          <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="ai@example.com"
            className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </Field>
        <Field label="Phone (optional)">
          <Input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+1 555 0100"
            className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </Field>
      </div>

      {/* Tagline + Bio */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Tagline / Headline</label>
          <MissionWriteButton field="tagline" identity={form} onResult={v => set('tagline', v)} />
        </div>
        <Input value={form.tagline} onChange={e => set('tagline', e.target.value)}
          placeholder="Expert freelancer delivering quality results"
          className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        <p className="text-[10px] text-slate-600 mt-0.5">Used on platform profiles</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Full Bio</label>
          <MissionWriteButton field="bio" identity={form} onResult={v => set('bio', v)} />
        </div>
        <textarea value={form.bio} onChange={e => set('bio', e.target.value)} rows={3}
          placeholder="Detailed professional bio used in proposals and profiles..."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none" />
      </div>

      {/* Communication Tone */}
      <Field label="Communication Tone">
        <Toggle options={TONES} value={form.communication_tone} onChange={handleToneChange} />
      </Field>

      {/* Email Signature */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Email Signature</label>
          <MissionWriteButton field="email_signature" identity={form} onResult={v => set('email_signature', v)} />
        </div>
        <textarea value={form.email_signature} onChange={e => set('email_signature', e.target.value)} rows={3}
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-emerald-500/50 resize-none" />
      </div>

      {/* Proposal style */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[10px] text-slate-500 uppercase tracking-wider">Proposal Writing Instructions</label>
          <MissionWriteButton field="proposal_style" identity={form} onResult={v => set('proposal_style', v)} />
        </div>
        <textarea value={form.proposal_style} onChange={e => set('proposal_style', e.target.value)} rows={2}
          placeholder="Always start with the client's specific pain point. Use bullet points for deliverables. Close with a clear CTA."
          className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none" />
        <p className="text-[10px] text-slate-600 mt-0.5">How the AI should write proposals for this identity</p>
      </div>

      {/* Skills */}
      <Field label="Skills (comma separated)">
        <Input value={form.skills} onChange={e => set('skills', e.target.value)}
          placeholder="copywriting, SEO, research, data analysis"
          className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
      </Field>

      {/* Platforms + Categories */}
      <Field label="Preferred Platforms">
        <MultiSelect options={PLATFORMS} value={form.preferred_platforms} onChange={v => set('preferred_platforms', v)} />
      </Field>
      <Field label="Preferred Categories">
        <MultiSelect options={CATEGORIES} value={form.preferred_categories} onChange={v => set('preferred_categories', v)} />
      </Field>

      {/* Auto-select task types */}
      <Field label="Auto-Select for Task Types" hint="AI will automatically use this identity for these tasks">
        <MultiSelect options={TASK_TYPES} value={form.auto_select_for_task_types} onChange={v => set('auto_select_for_task_types', v)} />
      </Field>

      {/* Spending limit */}
      <Field label="Max Spending Limit per Task ($)">
        <Input type="number" value={form.spending_limit_per_task} onChange={e => set('spending_limit_per_task', e.target.value)}
          className="bg-slate-800 border-slate-700 text-white text-xs h-8 w-32" />
      </Field>

      {/* Notes */}
      <Field label="Notes">
        <Input value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Internal notes..."
          className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
      </Field>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button 
          onClick={handleSubmit} 
          disabled={saveMutation.isPending}
          size="sm" 
          className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs h-9 gap-1.5"
        >
          <Save className="w-3.5 h-3.5" /> {saveMutation.isPending ? 'Saving...' : identity ? 'Update Identity' : 'Create Identity'}
        </Button>
        <Button onClick={onCancel} variant="outline" size="sm" className="border-slate-700 text-slate-400 text-xs h-9">Cancel</Button>
      </div>
    </div>
  );
}