/**
 * Dynamic Email Template Builder
 * - Liquid-style variable interpolation: {{client.name}}, {{persona.tagline}}, etc.
 * - Live preview with mock client data or real active persona
 * - Tone auto-adjusted to active AI persona's communication_tone
 * - Save/load templates via WorkflowTemplate entity
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Save, Sparkles, Eye, EyeOff, Copy, Trash2, PlusCircle,
  FileText, ChevronDown, ChevronUp, Loader2, LayoutTemplate,
  User, RefreshCw, Tag
} from 'lucide-react';
import { toast } from 'sonner';

// ─── Liquid-style renderer ────────────────────────────────────────────────────
function renderTemplate(template, vars) {
  if (!template) return '';
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    const parts = key.split('.');
    let val = vars;
    for (const p of parts) val = val?.[p];
    return val !== undefined && val !== null ? String(val) : match;
  });
}

// ─── Available variables reference ───────────────────────────────────────────
const VARIABLE_GROUPS = [
  {
    label: 'Client',
    vars: ['client.name', 'client.email', 'client.company', 'client.title', 'client.platform', 'client.budget'],
  },
  {
    label: 'Opportunity',
    vars: ['opportunity.title', 'opportunity.platform', 'opportunity.category', 'opportunity.profit_estimate_high', 'opportunity.deadline'],
  },
  {
    label: 'Persona',
    vars: ['persona.name', 'persona.tagline', 'persona.role_label', 'persona.bio', 'persona.email_signature', 'persona.communication_tone'],
  },
  {
    label: 'System',
    vars: ['system.date', 'system.time', 'system.day_of_week'],
  },
];

// ─── Mock preview data (overridden by real persona when available) ───────────
const MOCK_PREVIEW_DATA = {
  client: { name: 'Alex Johnson', email: 'alex@acme.com', company: 'Acme Corp', title: 'Head of Product', platform: 'Upwork', budget: '$2,500' },
  opportunity: { title: 'Full-Stack Web App Development', platform: 'Upwork', category: 'freelance', profit_estimate_high: 2500, deadline: '2026-04-15' },
  persona: { name: 'Jordan Craft', tagline: 'Building software that scales', role_label: 'Senior Developer', bio: '8 years of full-stack experience', email_signature: 'Best,\nJordan', communication_tone: 'professional' },
  system: { date: new Date().toLocaleDateString(), time: new Date().toLocaleTimeString(), day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }) },
};

function VariableChip({ variable, onInsert }) {
  return (
    <button
      onClick={() => onInsert(variable)}
      className="text-[10px] px-1.5 py-0.5 bg-violet-500/15 hover:bg-violet-500/30 text-violet-300 border border-violet-500/25 rounded-md transition-colors font-mono"
      title={`Insert {{${variable}}}`}
    >
      {`{{${variable}}}`}
    </button>
  );
}

function TemplateCard({ template, onLoad, onDelete }) {
  const [deleting, setDeleting] = useState(false);
  const toneColor = {
    professional: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
    friendly: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
    assertive: 'text-amber-400 border-amber-500/30 bg-amber-500/10',
    casual: 'text-pink-400 border-pink-500/30 bg-pink-500/10',
    technical: 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10',
    persuasive: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
  }[template.autopilot_config?.tone] || 'text-slate-400 border-slate-500/30 bg-slate-500/10';

  return (
    <div className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-xl p-3 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white truncate">{template.name}</p>
          <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{template.description || 'No description'}</p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {template.autopilot_config?.tone && (
            <Badge className={`text-[9px] border ${toneColor} px-1.5`}>{template.autopilot_config.tone}</Badge>
          )}
        </div>
      </div>
      {template.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 bg-slate-800 text-slate-500 rounded">{t}</span>
          ))}
        </div>
      )}
      <div className="flex gap-1.5 mt-3">
        <button onClick={() => onLoad(template)}
          className="flex-1 text-xs py-1 bg-violet-600/80 hover:bg-violet-500 text-white rounded-lg transition-colors text-center">
          Load
        </button>
        <button
          onClick={async () => { setDeleting(true); await onDelete(template.id); setDeleting(false); }}
          disabled={deleting}
          className="px-2 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg transition-colors">
          {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
        </button>
      </div>
    </div>
  );
}

export default function TemplateBuilder({ opportunity, onUseTemplate }) {
  const queryClient = useQueryClient();

  // ── State ──────────────────────────────────────────────────────────────────
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [subjectTemplate, setSubjectTemplate] = useState('');
  const [bodyTemplate, setBodyTemplate] = useState('');
  const [tags, setTags] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showVars, setShowVars] = useState(true);
  const [activeField, setActiveField] = useState('body'); // 'subject' | 'body'
  const [generating, setGenerating] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const subjectRef = React.useRef(null);
  const bodyRef = React.useRef(null);

  // ── Fetch active persona ───────────────────────────────────────────────────
  const { data: identities = [] } = useQuery({
    queryKey: ['aiIdentities'],
    queryFn: () => base44.entities.AIIdentity.list(),
  });
  const activePersona = identities.find(i => i.is_active) || identities[0];

  // ── Fetch saved email templates (category=service, platform=email) ─────────
  const { data: savedTemplates = [], isLoading: loadingTemplates } = useQuery({
    queryKey: ['emailTemplates'],
    queryFn: () => base44.entities.WorkflowTemplate.filter({ platform: 'email' }),
  });

  // ── Preview data = mock + real persona injected ────────────────────────────
  const previewData = useMemo(() => ({
    ...MOCK_PREVIEW_DATA,
    persona: activePersona ? {
      name: activePersona.name,
      tagline: activePersona.tagline || MOCK_PREVIEW_DATA.persona.tagline,
      role_label: activePersona.role_label || MOCK_PREVIEW_DATA.persona.role_label,
      bio: activePersona.bio || MOCK_PREVIEW_DATA.persona.bio,
      email_signature: activePersona.email_signature || `Best,\n${activePersona.name}`,
      communication_tone: activePersona.communication_tone || 'professional',
    } : MOCK_PREVIEW_DATA.persona,
    opportunity: opportunity ? {
      title: opportunity.title,
      platform: opportunity.platform || '',
      category: opportunity.category || '',
      profit_estimate_high: opportunity.profit_estimate_high || '',
      deadline: opportunity.deadline ? new Date(opportunity.deadline).toLocaleDateString() : '',
    } : MOCK_PREVIEW_DATA.opportunity,
    system: {
      date: new Date().toLocaleDateString(),
      time: new Date().toLocaleTimeString(),
      day_of_week: new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    },
  }), [activePersona, opportunity]);

  const renderedSubject = useMemo(() => renderTemplate(subjectTemplate, previewData), [subjectTemplate, previewData]);
  const renderedBody = useMemo(() => renderTemplate(bodyTemplate, previewData), [bodyTemplate, previewData]);

  // ── Insert variable at cursor ──────────────────────────────────────────────
  const handleInsertVar = (variable) => {
    const tag = `{{${variable}}}`;
    if (activeField === 'subject') {
      const el = subjectRef.current;
      if (el) {
        const start = el.selectionStart ?? subjectTemplate.length;
        const end = el.selectionEnd ?? subjectTemplate.length;
        const updated = subjectTemplate.slice(0, start) + tag + subjectTemplate.slice(end);
        setSubjectTemplate(updated);
        setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 0);
      } else {
        setSubjectTemplate(v => v + tag);
      }
    } else {
      const el = bodyRef.current;
      if (el) {
        const start = el.selectionStart ?? bodyTemplate.length;
        const end = el.selectionEnd ?? bodyTemplate.length;
        const updated = bodyTemplate.slice(0, start) + tag + bodyTemplate.slice(end);
        setBodyTemplate(updated);
        setTimeout(() => { el.focus(); el.setSelectionRange(start + tag.length, start + tag.length); }, 0);
      } else {
        setBodyTemplate(v => v + tag);
      }
    }
  };

  // ── AI-generate a template seeded from active persona tone ─────────────────
  const handleAIGenerate = async () => {
    setGenerating(true);
    const tone = activePersona?.communication_tone || 'professional';
    const persona_name = activePersona?.name || 'AI Agent';
    const opp_context = opportunity ? `for the opportunity: "${opportunity.title}" on ${opportunity.platform}` : 'for a freelance outreach';
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a reusable outreach email template ${opp_context}.
The sender persona is "${persona_name}" with a ${tone} communication tone.
Use Liquid-style variables: {{client.name}}, {{client.company}}, {{opportunity.title}}, {{persona.name}}, {{persona.tagline}}, {{persona.email_signature}}.
Return JSON: { "subject": "<subject with variables>", "body": "<body with variables, ~150 words>" }`,
        response_json_schema: {
          type: 'object',
          properties: { subject: { type: 'string' }, body: { type: 'string' } },
        },
      });
      if (res.subject) setSubjectTemplate(res.subject);
      if (res.body) setBodyTemplate(res.body);
      if (!name) setName(`${tone.charAt(0).toUpperCase() + tone.slice(1)} Outreach — ${persona_name}`);
      toast.success('AI template generated');
    } catch (e) {
      toast.error('AI generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Save template ──────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: name || 'Untitled Template',
        description,
        platform: 'email',
        category: 'service',
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        autopilot_config: {
          tone: activePersona?.communication_tone || 'professional',
          persona_id: activePersona?.id,
          persona_name: activePersona?.name,
        },
        execution_rules: { subject_template: subjectTemplate, body_template: bodyTemplate },
      };
      if (editingId) {
        return base44.entities.WorkflowTemplate.update(editingId, payload);
      }
      return base44.entities.WorkflowTemplate.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? 'Template updated' : 'Template saved');
      queryClient.invalidateQueries({ queryKey: ['emailTemplates'] });
      setEditingId(null);
    },
    onError: () => toast.error('Save failed'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WorkflowTemplate.delete(id),
    onSuccess: () => { toast.success('Template deleted'); queryClient.invalidateQueries({ queryKey: ['emailTemplates'] }); },
  });

  // ── Load a saved template into editor ─────────────────────────────────────
  const handleLoad = (template) => {
    setName(template.name);
    setDescription(template.description || '');
    setSubjectTemplate(template.execution_rules?.subject_template || '');
    setBodyTemplate(template.execution_rules?.body_template || '');
    setTags(template.tags?.join(', ') || '');
    setEditingId(template.id);
    toast.success(`Loaded: ${template.name}`);
  };

  // ── Use template (pass rendered output to parent) ─────────────────────────
  const handleUse = () => {
    if (!renderedSubject && !renderedBody) { toast.error('Template is empty'); return; }
    onUseTemplate?.({ subject: renderedSubject, body: renderedBody });
    toast.success('Template applied to draft');
  };

  const handleNew = () => {
    setName(''); setDescription(''); setSubjectTemplate(''); setBodyTemplate(''); setTags(''); setEditingId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

      {/* ── Left: Saved Templates ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <LayoutTemplate className="w-3.5 h-3.5" /> Saved Templates
          </h3>
          <button onClick={handleNew} className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1">
            <PlusCircle className="w-3.5 h-3.5" /> New
          </button>
        </div>
        {loadingTemplates ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 text-slate-600 animate-spin" />
          </div>
        ) : savedTemplates.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-5 text-center">
            <FileText className="w-7 h-7 text-slate-700 mx-auto mb-2" />
            <p className="text-xs text-slate-500">No saved templates yet</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[480px] overflow-y-auto pr-0.5">
            {savedTemplates.map(t => (
              <TemplateCard
                key={t.id}
                template={t}
                onLoad={handleLoad}
                onDelete={(id) => deleteMutation.mutateAsync(id)}
              />
            ))}
          </div>
        )}

        {/* Active persona badge */}
        {activePersona && (
          <div className="bg-violet-950/30 border border-violet-500/25 rounded-xl p-3 flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-violet-300 font-medium truncate">{activePersona.name}</p>
              <p className="text-[10px] text-violet-400/60 capitalize">{activePersona.communication_tone || 'professional'} tone</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Middle: Editor ────────────────────────────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            {editingId ? '✏️ Editing Template' : '➕ New Template'}
          </h3>
          <Button size="sm" variant="outline"
            onClick={handleAIGenerate}
            disabled={generating}
            className="h-7 text-xs border-violet-500/40 text-violet-300 hover:bg-violet-500/10 gap-1">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generating ? 'Generating...' : 'AI Generate'}
          </Button>
        </div>

        <Input
          placeholder="Template name"
          value={name}
          onChange={e => setName(e.target.value)}
          className="bg-slate-900 border-slate-700 text-white text-xs h-8"
        />
        <Input
          placeholder="Short description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
          className="bg-slate-900 border-slate-700 text-white text-xs h-8"
        />

        {/* Subject */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Subject</label>
          <input
            ref={subjectRef}
            value={subjectTemplate}
            onChange={e => setSubjectTemplate(e.target.value)}
            onFocus={() => setActiveField('subject')}
            placeholder="e.g. Re: {{opportunity.title}} — {{persona.name}}"
            className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none transition-all font-mono ${
              activeField === 'subject' ? 'border-violet-500/60' : 'border-slate-700'
            }`}
          />
        </div>

        {/* Body */}
        <div>
          <label className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 block">Body</label>
          <textarea
            ref={bodyRef}
            value={bodyTemplate}
            onChange={e => setBodyTemplate(e.target.value)}
            onFocus={() => setActiveField('body')}
            placeholder={"Hi {{client.name}},\n\nI came across your project on {{opportunity.platform}}..."}
            rows={9}
            className={`w-full bg-slate-900 border rounded-lg px-3 py-2 text-xs text-white placeholder-slate-600 outline-none resize-none transition-all font-mono ${
              activeField === 'body' ? 'border-violet-500/60' : 'border-slate-700'
            }`}
          />
        </div>

        {/* Tags */}
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <Input
            placeholder="Tags: upwork, freelance, intro"
            value={tags}
            onChange={e => setTags(e.target.value)}
            className="bg-slate-900 border-slate-700 text-white text-xs h-8"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
            className="flex-1 bg-violet-600 hover:bg-violet-500 text-white text-xs h-8 gap-1.5">
            {saveMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            {editingId ? 'Update' : 'Save'}
          </Button>
          {onUseTemplate && (
            <Button onClick={handleUse} variant="outline"
              className="flex-1 text-xs h-8 gap-1.5 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10">
              <Copy className="w-3 h-3" /> Use in Draft
            </Button>
          )}
          <button onClick={() => setShowPreview(v => !v)}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
            {showPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── Right: Variables + Preview ────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Variable reference */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <button
            onClick={() => setShowVars(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-800/40 transition-colors"
          >
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Variables</span>
            {showVars ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
          </button>
          {showVars && (
            <div className="px-3 pb-3 space-y-3">
              <p className="text-[10px] text-slate-500">
                Click to insert at cursor position in the <span className={activeField === 'subject' ? 'text-violet-400' : 'text-slate-300'}>{activeField}</span> field.
              </p>
              {VARIABLE_GROUPS.map(group => (
                <div key={group.label}>
                  <p className="text-[10px] text-slate-500 uppercase mb-1.5">{group.label}</p>
                  <div className="flex flex-wrap gap-1">
                    {group.vars.map(v => (
                      <VariableChip key={v} variable={v} onInsert={handleInsertVar} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Live Preview */}
        {showPreview && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5" /> Live Preview
              </span>
              <span className="text-[10px] text-slate-600">using mock client data</span>
            </div>
            <div className="px-3 py-3 space-y-2">
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Subject</p>
                <p className="text-xs text-white bg-slate-800/60 rounded-lg px-2 py-1.5 min-h-[28px]">{renderedSubject || <span className="text-slate-600">—</span>}</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-500 uppercase mb-1">Body</p>
                <pre className="text-xs text-slate-300 bg-slate-800/60 rounded-lg px-2 py-1.5 whitespace-pre-wrap font-sans min-h-[80px] max-h-52 overflow-y-auto">
                  {renderedBody || <span className="text-slate-600">—</span>}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* Persona tone hint */}
        {!showPreview && activePersona && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-3">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1.5">Active Persona Tone</p>
            <p className="text-xs text-white capitalize">{activePersona.communication_tone || 'professional'}</p>
            {activePersona.tagline && (
              <p className="text-[10px] text-slate-500 italic mt-1">"{activePersona.tagline}"</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}