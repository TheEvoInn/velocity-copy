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
  const [form, setForm] = useState({
    name: identity?.name || '',
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

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      const data = {
        ...formData,
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
    if (!form.name?.trim()) {
      toast.error('Identity name is required');
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
            </div>
          </div>

          {/* Basic Info */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white mb-2">Identity Name *</label>
              <Input
                value={form.name}
                onChange={(e) => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g., Alex Freeman"
                className="bg-slate-800 border-slate-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-white mb-2">Role</label>
              <Select value={form.role_label} onValueChange={(v) => setForm(p => ({ ...p, role_label: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            <label className="block text-sm font-medium text-white mb-2">Skills (comma separated)</label>
            <Textarea
              value={form.skills}
              onChange={(e) => setForm(p => ({ ...p, skills: e.target.value }))}
              placeholder="Python, React, UI Design, ..."
              className="bg-slate-800 border-slate-700 h-20"
            />
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