import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, User, Sparkles, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const TONES = ['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive'];
const TASK_TYPES = ['freelance', 'content', 'service', 'arbitrage', 'lead_gen', 'digital_flip'];
const SKILLS_LIST = ['Writing', 'Design', 'Coding', 'Marketing', 'Sales', 'SEO', 'Research', 'Data Analysis', 'Video Editing', 'Customer Service', 'Translation', 'Social Media', 'Teaching', 'Accounting', 'Photography'];
const ACCENT_COLORS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];
const ROLE_LABELS = ['Freelancer', 'Content Creator', 'Consultant', 'Sales Agent', 'Developer', 'Designer', 'Researcher', 'Analyst'];

function Tag({ label, active, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${active ? 'bg-violet-600/20 border-violet-500/40 text-violet-300' : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'}`}>
      {label}
    </button>
  );
}

export default function StepIdentity({ data, onChange, onNext, onBack }) {
  const [generating, setGenerating] = useState(null);

  const set = (k, v) => onChange({ ...data, [k]: v });
  const toggleArr = (key, val) => {
    const arr = data[key] || [];
    set(key, arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
  };

  const aiGenerate = async (field) => {
    setGenerating(field);
    const prompts = {
      tagline: `Write a single compelling tagline (max 12 words) for a ${data.role_label || 'Freelancer'} named "${data.name || 'Professional'}" with skills: ${(data.skills || []).join(', ') || 'general'}. Return ONLY the tagline.`,
      bio: `Write a 3-4 sentence professional bio in first person for "${data.name || 'a professional'}", a ${data.role_label || 'Freelancer'} with skills: ${(data.skills || []).join(', ') || 'general skills'}, tone: ${data.communication_tone || 'professional'}. Make it compelling and credibility-building. Return ONLY the bio.`,
      proposal_style: `Write 5 specific proposal writing instructions for a ${data.role_label || 'Freelancer'} with ${data.communication_tone || 'professional'} tone. Format as bullet points starting with "- ".`,
    };
    try {
      const result = await base44.integrations.Core.InvokeLLM({ prompt: prompts[field] });
      if (result) set(field, result.trim());
    } finally {
      setGenerating(null);
    }
  };

  const suggestSkills = async () => {
    setGenerating('skills');
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `List the top 8 most in-demand and high-earning skills for a ${data.role_label || 'Freelancer'} on freelance platforms. Return ONLY a JSON array of skill name strings, no explanation. Example: ["Writing","SEO","Research"]`,
        response_json_schema: { type: 'object', properties: { skills: { type: 'array', items: { type: 'string' } } } },
      });
      const suggested = result?.skills || [];
      const merged = [...new Set([...(data.skills || []), ...suggested])];
      set('skills', merged);
    } finally {
      setGenerating(null);
    }
  };

  const AIWriteBtn = ({ field }) => (
    <button type="button" onClick={() => aiGenerate(field)} disabled={!!generating}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all disabled:opacity-40"
      style={{ background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.35)', color: '#a78bfa' }}>
      {generating === field ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      Write with AI
    </button>
  );

  const SuggestBtn = ({ onClick, field }) => (
    <button type="button" onClick={onClick} disabled={!!generating}
      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border transition-all disabled:opacity-40"
      style={{ background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.3)', color: '#67e8f9' }}>
      {generating === field ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
      Get Suggestions
    </button>
  );

  const isValid = data.name?.trim();

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <User className="w-5 h-5 text-violet-400" />
        <h2 className="text-base font-bold text-white">Primary Identity</h2>
        <span className="text-[10px] text-slate-500 ml-auto">This becomes your Autopilot persona</span>
      </div>

      <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">

        {/* Name + Role */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Full / Persona Name *</label>
            <Input value={data.name || ''} onChange={e => set('name', e.target.value)}
              placeholder="Alex Mercer" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Professional Title</label>
            <div className="flex flex-wrap gap-1 mt-1">
              {ROLE_LABELS.slice(0,4).map(r => <Tag key={r} label={r} active={data.role_label === r} onClick={() => set('role_label', r)} />)}
            </div>
          </div>
        </div>

        {/* Skills */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Skills & Expertise</label>
            <SuggestBtn onClick={suggestSkills} field="skills" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {SKILLS_LIST.map(s => <Tag key={s} label={s} active={(data.skills || []).includes(s)} onClick={() => toggleArr('skills', s)} />)}
          </div>
        </div>

        {/* Tone */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Communication Tone</label>
          <div className="flex flex-wrap gap-1.5">
            {TONES.map(t => <Tag key={t} label={t} active={data.communication_tone === t} onClick={() => set('communication_tone', t)} />)}
          </div>
        </div>

        {/* Tagline */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Tagline / Headline</label>
            <AIWriteBtn field="tagline" />
          </div>
          <Input value={data.tagline || ''} onChange={e => set('tagline', e.target.value)}
            placeholder="Expert freelancer delivering quality results"
            className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </div>

        {/* Bio */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Professional Bio</label>
            <AIWriteBtn field="bio" />
          </div>
          <textarea value={data.bio || ''} onChange={e => set('bio', e.target.value)} rows={3}
            placeholder="Detailed bio used in proposals and profiles..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>

        {/* Proposal style */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider">Proposal Writing Instructions</label>
            <AIWriteBtn field="proposal_style" />
          </div>
          <textarea value={data.proposal_style || ''} onChange={e => set('proposal_style', e.target.value)} rows={2}
            placeholder="How the AI should write proposals for this identity..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 resize-none" />
        </div>

        {/* Email + Portfolio */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Identity Email</label>
            <Input value={data.email || ''} onChange={e => set('email', e.target.value)}
              placeholder="persona@email.com" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Portfolio / Website</label>
            <Input value={data.portfolio_url || ''} onChange={e => set('portfolio_url', e.target.value)}
              placeholder="https://mysite.com" className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        </div>

        {/* Social */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">LinkedIn</label>
            <Input value={data.linkedin || ''} onChange={e => set('linkedin', e.target.value)}
              placeholder="linkedin.com/in/..." className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Other Social / Profile</label>
            <Input value={data.social_other || ''} onChange={e => set('social_other', e.target.value)}
              placeholder="upwork.com/..." className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
          </div>
        </div>

        {/* Task routing */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Best Used For (Task Types)</label>
          <div className="flex flex-wrap gap-1.5">
            {TASK_TYPES.map(t => <Tag key={t} label={t} active={(data.auto_select_for_task_types || []).includes(t)} onClick={() => toggleArr('auto_select_for_task_types', t)} />)}
          </div>
        </div>

        {/* Accent Color */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1.5">Accent Color</label>
          <div className="flex gap-2">
            {ACCENT_COLORS.map(c => (
              <button key={c} type="button" onClick={() => set('color', c)}
                className={`w-6 h-6 rounded-lg transition-transform ${data.color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
                style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* Permissions */}
        <div className="grid grid-cols-2 gap-3">
          {[
            ['can_create_accounts', 'Allow Account Creation'],
            ['can_communicate', 'Allow Client Communication'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer bg-slate-800 border border-slate-700 rounded-lg px-3 py-2">
              <input type="checkbox" checked={!!data[key]} onChange={e => set(key, e.target.checked)}
                className="rounded border-slate-600 accent-violet-500" />
              <span className="text-xs text-slate-300">{label}</span>
            </label>
          ))}
        </div>

      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-slate-800">
        <Button onClick={onBack} variant="outline" size="sm" className="border-slate-700 text-slate-400 h-9 px-4">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Button>
        <Button onClick={onNext} disabled={!isValid} size="sm"
          className="flex-1 bg-violet-600 hover:bg-violet-500 text-white h-9">
          Next: KYC Setup <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}