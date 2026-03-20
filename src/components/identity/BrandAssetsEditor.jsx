import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Palette, Type, Mic2, Briefcase, Save, ChevronDown, ChevronUp,
  Plus, X, AlertCircle, Sparkles, LayoutTemplate, PenLine
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

const GRAPHIC_STYLES = ['minimalist', 'bold', 'corporate', 'playful', 'luxury', 'technical', 'artistic', 'modern'];
const FONT_FAMILIES = ['Inter', 'Helvetica Neue', 'Georgia', 'Playfair Display', 'Roboto', 'Montserrat', 'Lato', 'Merriweather'];
const FORMALITY_LEVELS = ['very_formal', 'formal', 'semi_formal', 'casual', 'very_casual'];
const VOCABULARY_STYLES = ['simple', 'technical', 'academic', 'conversational', 'industry_specific', 'creative'];
const INDUSTRY_OPTIONS = ['technology', 'design', 'marketing', 'finance', 'healthcare', 'legal', 'education', 'e-commerce', 'consulting', 'creative_arts', 'real_estate', 'other'];
const PROJECT_TYPES = ['short_term', 'long_term', 'one_time', 'recurring', 'agency', 'enterprise', 'startup', 'nonprofit'];

function Section({ icon: Icon, title, color = 'text-violet-400', children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 hover:bg-slate-800/40 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color}`} />
          <span className="text-sm font-semibold text-white">{title}</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="px-4 pb-4 space-y-4 border-t border-slate-800">{children}</div>}
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="pt-3">
      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-slate-600 mt-1">{hint}</p>}
    </div>
  );
}

function ChipSelect({ options, value = [], onChange, color = 'violet' }) {
  const toggle = (opt) => onChange(value.includes(opt) ? value.filter(v => v !== opt) : [...value, opt]);
  const activeClass = color === 'violet' ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
    : color === 'blue' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
    : color === 'emerald' ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
    : 'bg-amber-600/20 border-amber-500/40 text-amber-300';
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => toggle(o)}
          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors capitalize ${
            value.includes(o) ? activeClass : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
          }`}>
          {o.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  );
}

function SingleSelect({ options, value, onChange, color = 'violet' }) {
  const activeClass = color === 'violet' ? 'bg-violet-600/20 border-violet-500/40 text-violet-300'
    : color === 'blue' ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
    : 'bg-amber-600/20 border-amber-500/40 text-amber-300';
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" onClick={() => onChange(o)}
          className={`px-2.5 py-1 rounded-lg text-xs border transition-colors capitalize ${
            value === o ? activeClass : 'bg-slate-800 border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300'
          }`}>
          {o.replace(/_/g, ' ')}
        </button>
      ))}
    </div>
  );
}

function ColorSwatch({ value, onChange, label }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#10b981'}
        onChange={e => onChange(e.target.value)}
        className="w-9 h-9 rounded-lg border border-slate-700 cursor-pointer bg-transparent"
      />
      <Input
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder="#10b981"
        className="bg-slate-800 border-slate-700 text-white text-xs h-9 w-32"
      />
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}

function TagList({ value = [], onChange, placeholder }) {
  const [input, setInput] = useState('');
  const add = () => {
    const trimmed = input.trim();
    if (trimmed && !value.includes(trimmed)) { onChange([...value, trimmed]); }
    setInput('');
  };
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="bg-slate-800 border-slate-700 text-white text-xs h-8 flex-1"
        />
        <Button onClick={add} size="sm" variant="outline" className="border-slate-700 h-8 px-2">
          <Plus className="w-3.5 h-3.5" />
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag, i) => (
            <span key={i} className="flex items-center gap-1 px-2 py-0.5 bg-slate-800 border border-slate-700 rounded text-xs text-slate-300">
              {tag}
              <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400">
                <X className="w-2.5 h-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function BrandAssetsEditor({ identity }) {
  const queryClient = useQueryClient();

  const [brand, setBrand] = useState({
    // Visual
    primary_color: identity?.brand_assets?.primary_color || identity?.color || '#10b981',
    secondary_color: identity?.brand_assets?.secondary_color || '#3b82f6',
    accent_color: identity?.brand_assets?.accent_color || '',
    font_primary: identity?.brand_assets?.font_primary || 'Inter',
    font_secondary: identity?.brand_assets?.font_secondary || '',
    graphic_style: identity?.brand_assets?.graphic_style || [],
    layout_preferences: identity?.brand_assets?.layout_preferences || '',
    logo_url: identity?.brand_assets?.logo_url || '',
    // Written & Communication
    formality_level: identity?.brand_assets?.formality_level || 'formal',
    vocabulary_style: identity?.brand_assets?.vocabulary_style || [],
    signature_phrases: identity?.brand_assets?.signature_phrases || [],
    writing_rules: identity?.brand_assets?.writing_rules || [],
    industry_language: identity?.brand_assets?.industry_language || [],
    forbidden_phrases: identity?.brand_assets?.forbidden_phrases || [],
    // Professional
    industry_alignment: identity?.brand_assets?.industry_alignment || [],
    certifications: identity?.brand_assets?.certifications || [],
    portfolio_references: identity?.brand_assets?.portfolio_references || [],
    work_history_summary: identity?.brand_assets?.work_history_summary || '',
    preferred_project_types: identity?.brand_assets?.preferred_project_types || [],
    strengths: identity?.brand_assets?.strengths || [],
    differentiators: identity?.brand_assets?.differentiators || [],
    // Behavioral rules
    always_rules: identity?.brand_assets?.always_rules || [],
    never_rules: identity?.brand_assets?.never_rules || [],
    ai_persona_instructions: identity?.brand_assets?.ai_persona_instructions || '',
  });

  const set = (k, v) => setBrand(p => ({ ...p, [k]: v }));

  const saveMutation = useMutation({
    mutationFn: () => base44.entities.AIIdentity.update(identity.id, { brand_assets: brand }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userIdentities'] });
      toast.success('Brand assets saved');
    },
    onError: err => toast.error(`Save failed: ${err.message}`),
  });

  if (!identity) return null;

  return (
    <div className="space-y-3">
      {/* Brand Injection Notice */}
      <div className="bg-violet-950/30 border border-violet-800/30 rounded-xl p-4 flex gap-3">
        <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-violet-300">Automatic Brand Injection Active</p>
          <p className="text-xs text-violet-400/70 mt-0.5">
            All AI outputs — proposals, visuals, social posts, reports, and client communications —
            will automatically follow this identity's brand rules. No manual setup needed per task.
          </p>
        </div>
      </div>

      {/* 1. Visual Branding */}
      <Section icon={Palette} title="Visual Branding" color="text-pink-400" defaultOpen={true}>
        <Field label="Color Palette">
          <div className="space-y-2">
            <ColorSwatch value={brand.primary_color} onChange={v => set('primary_color', v)} label="Primary" />
            <ColorSwatch value={brand.secondary_color} onChange={v => set('secondary_color', v)} label="Secondary" />
            <ColorSwatch value={brand.accent_color} onChange={v => set('accent_color', v)} label="Accent (optional)" />
          </div>
        </Field>

        <Field label="Typography" hint="Used in all generated documents, visuals, and content">
          <div className="space-y-2">
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500 w-20 shrink-0">Primary Font</span>
              <SingleSelect options={FONT_FAMILIES} value={brand.font_primary} onChange={v => set('font_primary', v)} color="blue" />
            </div>
            <div className="flex gap-2 items-center">
              <span className="text-xs text-slate-500 w-20 shrink-0">Secondary</span>
              <SingleSelect options={FONT_FAMILIES} value={brand.font_secondary} onChange={v => set('font_secondary', v)} color="blue" />
            </div>
          </div>
        </Field>

        <Field label="Graphic Style Preferences" hint="How visual assets should look">
          <ChipSelect options={GRAPHIC_STYLES} value={brand.graphic_style} onChange={v => set('graphic_style', v)} color="violet" />
        </Field>

        <Field label="Layout & Spacing Notes" hint="e.g. 'wide margins, clean whitespace, card-based layouts'">
          <textarea
            value={brand.layout_preferences}
            onChange={e => set('layout_preferences', e.target.value)}
            rows={2}
            placeholder="Describe preferred layout style, spacing, density..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-violet-500/50 resize-none"
          />
        </Field>

        <Field label="Logo / Icon URL (optional)">
          <Input value={brand.logo_url} onChange={e => set('logo_url', e.target.value)}
            placeholder="https://..." className="bg-slate-800 border-slate-700 text-white text-xs h-8" />
        </Field>
      </Section>

      {/* 2. Written & Communication Style */}
      <Section icon={PenLine} title="Written & Communication Style" color="text-blue-400">
        <Field label="Formality Level">
          <SingleSelect options={FORMALITY_LEVELS} value={brand.formality_level} onChange={v => set('formality_level', v)} color="blue" />
        </Field>

        <Field label="Vocabulary Style">
          <ChipSelect options={VOCABULARY_STYLES} value={brand.vocabulary_style} onChange={v => set('vocabulary_style', v)} color="blue" />
        </Field>

        <Field label="Signature Phrases" hint="Recurring phrases that define this identity's voice">
          <TagList value={brand.signature_phrases} onChange={v => set('signature_phrases', v)} placeholder="Add a signature phrase..." />
        </Field>

        <Field label="Industry-Specific Language / Terms">
          <TagList value={brand.industry_language} onChange={v => set('industry_language', v)} placeholder="Add industry term or jargon..." />
        </Field>

        <Field label="Forbidden Phrases" hint="Words or phrases this identity must never use">
          <TagList value={brand.forbidden_phrases} onChange={v => set('forbidden_phrases', v)} placeholder="e.g. 'synergy', emojis, slang..." />
        </Field>
      </Section>

      {/* 3. Behavioral Rules */}
      <Section icon={Mic2} title="AI Behavioral Rules" color="text-amber-400">
        <Field label="Always Do" hint="Rules the AI must always follow for this identity">
          <TagList value={brand.always_rules} onChange={v => set('always_rules', v)} placeholder='e.g. "Always cite sources"' />
        </Field>

        <Field label="Never Do" hint="Hard restrictions on AI behavior">
          <TagList value={brand.never_rules} onChange={v => set('never_rules', v)} placeholder='e.g. "Never use first-person"' />
        </Field>

        <Field label="Custom AI Persona Instructions" hint="Full-text prompt instructions injected into all AI calls">
          <textarea
            value={brand.ai_persona_instructions}
            onChange={e => set('ai_persona_instructions', e.target.value)}
            rows={4}
            placeholder="e.g. You are Alex Mercer, a senior UX designer with 10 years of experience in fintech. Write in a confident but approachable tone. Always lead with outcomes, not process. Avoid jargon unless speaking to a technical audience..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500/50 resize-none"
          />
        </Field>
      </Section>

      {/* 4. Professional Identity */}
      <Section icon={Briefcase} title="Professional Identity & Metadata" color="text-emerald-400">
        <Field label="Industry Alignment">
          <ChipSelect options={INDUSTRY_OPTIONS} value={brand.industry_alignment} onChange={v => set('industry_alignment', v)} color="emerald" />
        </Field>

        <Field label="Preferred Project Types">
          <ChipSelect options={PROJECT_TYPES} value={brand.preferred_project_types} onChange={v => set('preferred_project_types', v)} color="emerald" />
        </Field>

        <Field label="Certifications & Credentials">
          <TagList value={brand.certifications} onChange={v => set('certifications', v)} placeholder="e.g. AWS Certified, PMP, Google Analytics..." />
        </Field>

        <Field label="Key Strengths">
          <TagList value={brand.strengths} onChange={v => set('strengths', v)} placeholder="e.g. fast turnaround, pixel-perfect design..." />
        </Field>

        <Field label="Differentiators" hint="What makes this identity stand out from competitors">
          <TagList value={brand.differentiators} onChange={v => set('differentiators', v)} placeholder="e.g. 5-star rating, niche expertise..." />
        </Field>

        <Field label="Portfolio / Work History References">
          <TagList value={brand.portfolio_references} onChange={v => set('portfolio_references', v)} placeholder="URL or description of past work..." />
        </Field>

        <Field label="Work History Summary" hint="Used in proposals, bios, and client comms">
          <textarea
            value={brand.work_history_summary}
            onChange={e => set('work_history_summary', e.target.value)}
            rows={3}
            placeholder="Brief summary of relevant work experience..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500/50 resize-none"
          />
        </Field>
      </Section>

      {/* Save */}
      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full bg-violet-600 hover:bg-violet-500 gap-2"
      >
        <Save className="w-4 h-4" />
        {saveMutation.isPending ? 'Saving Brand Assets...' : 'Save Brand Assets'}
      </Button>

      {/* Preview of injected prompt */}
      <details className="bg-slate-900 border border-slate-800 rounded-xl">
        <summary className="p-4 text-xs text-slate-500 cursor-pointer hover:text-slate-300 select-none">
          Preview: Brand injection context that will be added to AI prompts
        </summary>
        <div className="px-4 pb-4">
          <pre className="text-[10px] text-slate-400 whitespace-pre-wrap font-mono bg-slate-800 rounded-lg p-3 max-h-48 overflow-y-auto">
            {buildBrandPrompt(identity, brand)}
          </pre>
        </div>
      </details>
    </div>
  );
}

// Exported helper — also used by brand injection utility
export function buildBrandPrompt(identity, brand) {
  if (!identity) return '';
  const b = brand || identity?.brand_assets || {};
  const lines = [];

  lines.push(`=== IDENTITY BRAND PROFILE: ${identity.name} ===`);
  if (identity.role_label) lines.push(`Role: ${identity.role_label}`);
  if (identity.tagline) lines.push(`Tagline: ${identity.tagline}`);
  if (identity.bio) lines.push(`Bio: ${identity.bio}`);
  if (identity.communication_tone) lines.push(`Communication Tone: ${identity.communication_tone}`);
  if (identity.skills?.length) lines.push(`Skills: ${identity.skills.join(', ')}`);

  if (b.ai_persona_instructions) {
    lines.push('');
    lines.push('PERSONA INSTRUCTIONS:');
    lines.push(b.ai_persona_instructions);
  }

  if (b.formality_level) lines.push(`Formality: ${b.formality_level.replace(/_/g, ' ')}`);
  if (b.vocabulary_style?.length) lines.push(`Vocabulary: ${b.vocabulary_style.join(', ')}`);
  if (b.industry_alignment?.length) lines.push(`Industry: ${b.industry_alignment.join(', ')}`);

  if (b.graphic_style?.length) lines.push(`Visual Style: ${b.graphic_style.join(', ')}`);
  if (b.primary_color) lines.push(`Brand Colors: primary=${b.primary_color}${b.secondary_color ? `, secondary=${b.secondary_color}` : ''}${b.accent_color ? `, accent=${b.accent_color}` : ''}`);
  if (b.font_primary) lines.push(`Typography: ${b.font_primary}${b.font_secondary ? ` + ${b.font_secondary}` : ''}`);
  if (b.layout_preferences) lines.push(`Layout: ${b.layout_preferences}`);

  if (b.signature_phrases?.length) lines.push(`Signature Phrases: ${b.signature_phrases.join(' | ')}`);
  if (b.industry_language?.length) lines.push(`Preferred Terms: ${b.industry_language.join(', ')}`);
  if (b.forbidden_phrases?.length) lines.push(`FORBIDDEN: Never use: ${b.forbidden_phrases.join(', ')}`);

  if (b.always_rules?.length) lines.push(`ALWAYS: ${b.always_rules.join('. ')}`);
  if (b.never_rules?.length) lines.push(`NEVER: ${b.never_rules.join('. ')}`);

  if (b.certifications?.length) lines.push(`Credentials: ${b.certifications.join(', ')}`);
  if (b.strengths?.length) lines.push(`Strengths: ${b.strengths.join(', ')}`);
  if (b.differentiators?.length) lines.push(`Differentiators: ${b.differentiators.join(', ')}`);
  if (b.work_history_summary) lines.push(`Experience: ${b.work_history_summary}`);

  if (identity.proposal_style) {
    lines.push('');
    lines.push('PROPOSAL STYLE:');
    lines.push(identity.proposal_style);
  }
  if (identity.email_signature) lines.push(`Email Signature:\n${identity.email_signature}`);

  lines.push('=== END BRAND PROFILE ===');
  return lines.join('\n');
}