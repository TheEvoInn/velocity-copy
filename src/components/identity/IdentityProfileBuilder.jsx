import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Save, X, Upload, Palette, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const ROLES = ['Freelancer', 'Developer', 'Designer', 'Writer', 'Marketer', 'Sales Agent', 'Support Agent', 'Custom'];
const TONES = ['professional', 'friendly', 'authoritative', 'casual', 'technical', 'persuasive', 'empathetic'];
const COLORS = ['#10b981', '#8b5cf6', '#3b82f6', '#ec4899', '#f59e0b', '#ef4444', '#14b8a6', '#6366f1'];

export default function IdentityProfileBuilder({ identity, mode = 'create', onComplete, onCancel }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  // Parse identity name into first/middle/last
  const parseName = (fullName) => {
    const parts = (fullName || '').trim().split(/\s+/);
    return {
      firstName: parts[0] || '',
      middleName: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
      lastName: parts.length > 1 ? parts[parts.length - 1] : ''
    };
  };

  const initialNameParts = parseName(identity?.name);

  const [form, setForm] = useState({
    firstName: initialNameParts.firstName,
    middleName: initialNameParts.middleName,
    lastName: initialNameParts.lastName,
    role_label: identity?.role_label || 'Freelancer',
    email: identity?.email || '',
    phone: identity?.phone || '',
    tagline: identity?.tagline || '',
    bio: identity?.bio || '',
    communication_tone: identity?.communication_tone || 'professional',
    email_signature: identity?.email_signature || '',
    proposal_style: identity?.proposal_style || '',
    skills: identity?.skills?.join(', ') || '',
    color: identity?.color || '#10b981',
  });

  const [avatarUrl, setAvatarUrl] = useState(identity?.avatar_url || '');
  const [uploading, setUploading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState({});
  const [suggestedSkills, setSuggestedSkills] = useState([]);
  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [showAvatarPrompt, setShowAvatarPrompt] = useState(false);
  const [customRole, setCustomRole] = useState('');
  const [showCustomRoleInput, setShowCustomRoleInput] = useState(form.role_label === 'Custom');
  const [researchingRole, setResearchingRole] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      // Combine name parts
      const nameParts = [formData.firstName, formData.middleName, formData.lastName]
        .filter(Boolean);
      const fullName = nameParts.join(' ');

      const data = {
        name: fullName,
        role_label: formData.role_label,
        email: formData.email,
        phone: formData.phone,
        tagline: formData.tagline,
        bio: formData.bio,
        communication_tone: formData.communication_tone,
        email_signature: formData.email_signature,
        proposal_style: formData.proposal_style,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        avatar_url: avatarUrl,
        created_by: user?.email,
        is_user_specific: true
      };

      if (identity?.id) {
        return await base44.entities.AIIdentity.update(identity.id, data);
      } else {
        return await base44.entities.AIIdentity.create(data);
      }
    },
    onSuccess: () => {
      // Invalidate all identity-related query keys
      queryClient.invalidateQueries({ queryKey: ['userIdentities'] });
      queryClient.invalidateQueries({ queryKey: ['identities'] });
      toast.success(identity ? 'Identity updated' : 'Identity created');
      onComplete?.();
    },
    onError: (err) => toast.error(`Error: ${err.message}`)
  });

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const res = await base44.integrations.Core.UploadFile({ file });
      setAvatarUrl(res.file_url);
      toast.success('Avatar uploaded');
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = () => {
    if (!form.firstName?.trim() || !form.lastName?.trim()) {
      toast.error('First and last name are required');
      return;
    }
    saveMutation.mutate(form);
  };

  const generateWithAI = async (field) => {
    if (!form.name?.trim()) {
      toast.error('Enter identity name first');
      return;
    }

    setAiGenerating(p => ({ ...p, [field]: true }));
    try {
      const context = `Identity: ${form.name} (${form.role_label})\nSkills: ${form.skills}\nTone: ${form.communication_tone}`;
      let prompt = '';

      if (field === 'tagline') {
        prompt = `Write a professional one-line tagline for a freelance ${form.role_label} named "${form.name}". The tone should be ${form.communication_tone}. Maximum 10 words.`;
      } else if (field === 'bio') {
        prompt = `Write a compelling 2-3 paragraph professional bio for ${form.name}, a ${form.role_label} with skills in: ${form.skills}. Use a ${form.communication_tone} tone. Focus on expertise and value proposition.`;
      } else if (field === 'proposal_style') {
        prompt = `Write a brief style guide (5-7 sentences) for how AI should write proposals from the perspective of ${form.name}, a ${form.role_label}. Style: ${form.communication_tone}. Include tips for customization and personalization.`;
      } else if (field === 'email_signature') {
        prompt = `Write a professional email signature for ${form.name}. Include name, role (${form.role_label}), and end with a professional sign-off appropriate for ${form.communication_tone} tone.`;
      }

      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash'
      });

      const text = res.trim();
      setForm(p => ({ ...p, [field]: text }));
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} generated`);
    } catch (err) {
      toast.error(`AI generation failed: ${err.message}`);
    } finally {
      setAiGenerating(p => ({ ...p, [field]: false }));
    }
  };

  const generateSkillSuggestions = async () => {
    setAiGenerating(p => ({ ...p, skills: true }));
    try {
      const prompt = `Generate 8-10 relevant skills for a ${form.role_label} professional. Return only skill names separated by commas, no explanations. Example format: Python, React, UI Design, Project Management`;
      const res = await base44.integrations.Core.InvokeLLM({
        prompt,
        model: 'gemini_3_flash'
      });
      const suggestions = res.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10);
      setSuggestedSkills(suggestions);
      toast.success('Skills suggested');
    } catch (err) {
      toast.error(`Suggestion failed: ${err.message}`);
    } finally {
      setAiGenerating(p => ({ ...p, skills: false }));
    }
  };

  const addSkill = (skill) => {
    const current = form.skills.split(',').map(s => s.trim()).filter(Boolean);
    if (!current.includes(skill)) {
      setForm(p => ({ ...p, skills: [...current, skill].join(', ') }));
      setSuggestedSkills(prev => prev.filter(s => s !== skill));
    }
  };

  const researchCustomRole = async () => {
    if (!customRole.trim()) {
      toast.error('Enter a custom role to research');
      return;
    }

    setResearchingRole(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `Research the role "${customRole}" and provide JSON with: tagline (1 sentence professional summary), bio (2-3 sentence description), skills (array of 5-8 relevant skills), and proposal_style (writing approach). Return valid JSON only.`,
        response_json_schema: {
          type: 'object',
          properties: {
            tagline: { type: 'string' },
            bio: { type: 'string' },
            skills: { type: 'array', items: { type: 'string' } },
            proposal_style: { type: 'string' }
          }
        }
      });

      setForm(p => ({
        ...p,
        role_label: customRole,
        tagline: res.tagline,
        bio: res.bio,
        skills: res.skills.join(', '),
        proposal_style: res.proposal_style
      }));
      setShowCustomRoleInput(false);
      setCustomRole('');
      toast.success(`Role "${customRole}" researched and added`);
    } catch (err) {
      toast.error(`Research failed: ${err.message}`);
    } finally {
      setResearchingRole(false);
    }
  };

  const generateAvatar = async () => {
    if (!avatarPrompt.trim()) {
      toast.error('Enter a description for your avatar');
      return;
    }

    setAiGenerating(p => ({ ...p, avatar: true }));
    try {
      const prompt = `Create a professional profile photo for a ${form.role_label} named ${form.name}. ${avatarPrompt}. High quality, PNG format, square aspect ratio.`;
      const res = await base44.integrations.Core.GenerateImage({
        prompt
      });
      setAvatarUrl(res.url);
      setShowAvatarPrompt(false);
      setAvatarPrompt('');
      toast.success('Avatar generated');
    } catch (err) {
      toast.error(`Generation failed: ${err.message}`);
    } finally {
      setAiGenerating(p => ({ ...p, avatar: false }));
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 p-6">
        <h2 className="text-lg font-semibold text-white mb-6">
          {mode === 'create' ? 'Create New Identity' : 'Edit Identity'}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Avatar Section */}
          <div className="space-y-3">
            <label className="text-sm font-medium text-white">Avatar</label>
            <div className="w-32 h-32 rounded-xl border-2 border-dashed border-slate-700 flex items-center justify-center bg-slate-800/50 overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="text-center text-slate-500 text-xs">No avatar</div>
              )}
            </div>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
                id="avatar-upload"
              />
              <label
                  htmlFor="avatar-upload"
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg cursor-pointer text-sm text-slate-300 transition-colors"
                >
                  <Upload className="w-4 h-4" /> {uploading ? 'Uploading...' : 'Upload'}
                </label>
              <Button
                onClick={() => setShowAvatarPrompt(!showAvatarPrompt)}
                size="sm"
                variant="ghost"
                className="w-full px-4 py-2 text-xs gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-4 h-4" />
                Generate with AI
              </Button>
              {showAvatarPrompt && (
                <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                  <Input
                    value={avatarPrompt}
                    onChange={(e) => setAvatarPrompt(e.target.value)}
                    placeholder="e.g., professional headshot, casual tech startup vibe, corporate"
                    className="bg-slate-700 border-slate-600 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={generateAvatar}
                      disabled={aiGenerating.avatar}
                      size="sm"
                      className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-xs"
                    >
                      {aiGenerating.avatar ? 'Generating...' : 'Generate'}
                    </Button>
                    <Button
                      onClick={() => setShowAvatarPrompt(false)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-xs"
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-white">Identity Name *</label>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  value={form.firstName}
                  onChange={(e) => setForm(p => ({ ...p, firstName: e.target.value }))}
                  placeholder="First *"
                  className="bg-slate-800 border-slate-700"
                />
                <Input
                  value={form.middleName}
                  onChange={(e) => setForm(p => ({ ...p, middleName: e.target.value }))}
                  placeholder="Middle"
                  className="bg-slate-800 border-slate-700"
                />
                <Input
                  value={form.lastName}
                  onChange={(e) => setForm(p => ({ ...p, lastName: e.target.value }))}
                  placeholder="Last *"
                  className="bg-slate-800 border-slate-700"
                />
              </div>
              <p className="text-xs text-slate-500">Full name: {[form.firstName, form.middleName, form.lastName].filter(Boolean).join(' ') || 'Enter name'}</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-white">Role</label>
              <Select value={showCustomRoleInput ? 'Custom' : form.role_label} onValueChange={(v) => {
                if (v === 'Custom') {
                  setShowCustomRoleInput(true);
                } else {
                  setForm(p => ({ ...p, role_label: v }));
                  setShowCustomRoleInput(false);
                }
              }}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                  <SelectItem value="Custom">Custom Role</SelectItem>
                </SelectContent>
              </Select>
              {showCustomRoleInput && (
                <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 space-y-2">
                  <Input
                    value={customRole}
                    onChange={(e) => setCustomRole(e.target.value)}
                    placeholder="e.g., AI Prompt Engineer, Supply Chain Manager"
                    className="bg-slate-700 border-slate-600 text-sm"
                  />
                  <Button
                    onClick={researchCustomRole}
                    disabled={researchingRole}
                    size="sm"
                    className="w-full bg-violet-600 hover:bg-violet-500 text-xs"
                  >
                    {researchingRole ? 'Researching...' : 'Research & Auto-Fill'}
                  </Button>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Brand Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setForm(p => ({ ...p, color }))}
                    className={`w-10 h-10 rounded-lg border-2 transition-all ${
                      form.color === color ? 'border-white' : 'border-slate-700'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="identity@example.com"
              className="bg-slate-800 border-slate-700"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Phone</label>
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm(p => ({ ...p, phone: e.target.value }))}
              placeholder="+1 (555) 000-0000"
              className="bg-slate-800 border-slate-700"
            />
          </div>
        </div>

        {/* Tagline & Bio */}
        <div className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Tagline</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => generateWithAI('tagline')}
                disabled={aiGenerating.tagline}
                className="h-6 px-2 text-xs gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-3 h-3" />
                {aiGenerating.tagline ? 'Writing...' : 'Write'}
              </Button>
            </div>
            <Input
              value={form.tagline}
              onChange={(e) => setForm(p => ({ ...p, tagline: e.target.value }))}
              placeholder="Short bio for profiles"
              className="bg-slate-800 border-slate-700"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Full Bio</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => generateWithAI('bio')}
                disabled={aiGenerating.bio}
                className="h-6 px-2 text-xs gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-3 h-3" />
                {aiGenerating.bio ? 'Writing...' : 'Write'}
              </Button>
            </div>
            <Textarea
              value={form.bio}
              onChange={(e) => setForm(p => ({ ...p, bio: e.target.value }))}
              placeholder="Detailed background and experience..."
              className="bg-slate-800 border-slate-700 h-24"
            />
          </div>
        </div>

        {/* Skills & Communication */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Skills (comma separated)</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={generateSkillSuggestions}
                disabled={aiGenerating.skills}
                className="h-6 px-2 text-xs gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-3 h-3" />
                {aiGenerating.skills ? 'Suggesting...' : 'Get suggestions'}
              </Button>
            </div>
            <Textarea
              value={form.skills}
              onChange={(e) => setForm(p => ({ ...p, skills: e.target.value }))}
              placeholder="Python, React, UI Design, ..."
              className="bg-slate-800 border-slate-700 h-20"
            />
            {suggestedSkills.length > 0 && (
              <div className="mt-3 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <p className="text-xs text-slate-400 mb-2">Suggested skills:</p>
                <div className="flex flex-wrap gap-2">
                  {suggestedSkills.map(skill => (
                    <button
                      key={skill}
                      onClick={() => addSkill(skill)}
                      className="px-3 py-1 text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-full hover:bg-cyan-500/30 hover:border-cyan-500/60 transition-all active:scale-95"
                    >
                      + {skill}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-white mb-2">Communication Tone</label>
            <Select value={form.communication_tone} onValueChange={(v) => setForm(p => ({ ...p, communication_tone: v }))}>
              <SelectTrigger className="bg-slate-800 border-slate-700">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONES.map(tone => (
                  <SelectItem key={tone} value={tone}>{tone}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Advanced Settings */}
        <div className="mt-6 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Email Signature</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => generateWithAI('email_signature')}
                disabled={aiGenerating.email_signature}
                className="h-6 px-2 text-xs gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-3 h-3" />
                {aiGenerating.email_signature ? 'Writing...' : 'Write'}
              </Button>
            </div>
            <Textarea
              value={form.email_signature}
              onChange={(e) => setForm(p => ({ ...p, email_signature: e.target.value }))}
              placeholder="Best regards,\n[Your Name]"
              className="bg-slate-800 border-slate-700 h-16 text-xs"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Proposal Style Guide</label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => generateWithAI('proposal_style')}
                disabled={aiGenerating.proposal_style}
                className="h-6 px-2 text-xs gap-1 text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Sparkles className="w-3 h-3" />
                {aiGenerating.proposal_style ? 'Writing...' : 'Write'}
              </Button>
            </div>
            <Textarea
              value={form.proposal_style}
              onChange={(e) => setForm(p => ({ ...p, proposal_style: e.target.value }))}
              placeholder="How should AI write proposals for this identity?"
              className="bg-slate-800 border-slate-700 h-16 text-xs"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-8">
          <Button
            onClick={handleSubmit}
            disabled={saveMutation.isPending}
            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white gap-2"
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? 'Saving...' : mode === 'create' ? 'Create Identity' : 'Save Changes'}
          </Button>
          {onCancel && (
            <Button onClick={onCancel} variant="outline" className="border-slate-700">
              Cancel
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}