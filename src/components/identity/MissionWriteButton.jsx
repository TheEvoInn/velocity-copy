import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Sparkles, Loader2 } from 'lucide-react';

/**
 * "Write with MISSION" AI button
 * Generates content for a specific field using the identity context.
 * 
 * Props:
 *   field      - 'tagline' | 'bio' | 'email_signature' | 'proposal_style'
 *   identity   - current form values (name, role_label, skills, tone, etc.)
 *   onResult   - callback(generatedText) to apply the result
 */

const PROMPTS = {
  tagline: (id) => `You are writing a professional headline/tagline for an AI persona named "${id.name}" with the role "${id.role_label || 'Freelancer'}".
Their tone is ${id.communication_tone || 'professional'} and their skills are: ${id.skills || 'general freelancing'}.
Write a single punchy, compelling tagline (max 12 words) that would appear on their freelance profile.
Return ONLY the tagline text, no quotes.`,

  bio: (id) => `You are writing a professional bio for an AI persona named "${id.name}", role: "${id.role_label || 'Freelancer'}".
Communication tone: ${id.communication_tone || 'professional'}.
Skills: ${id.skills || 'writing, research, communication'}.
Preferred platforms: ${(id.preferred_platforms || []).join(', ') || 'Upwork, Fiverr'}.
Preferred categories: ${(id.preferred_categories || []).join(', ') || 'freelance services'}.
${id.tagline ? `Their tagline is: "${id.tagline}"` : ''}

Write a compelling, thorough 3-4 sentence professional bio that:
- Highlights their expertise and value proposition
- Mentions specific skills and platforms
- Builds trust and credibility
- Is written in first person
Return ONLY the bio text.`,

  email_signature: (id) => `Write a professional email signature for "${id.name}", a ${id.role_label || 'Freelancer'} with a ${id.communication_tone || 'professional'} tone.
It should be concise (3-5 lines max), include their name and role, and optionally a brief tagline.
${id.tagline ? `Their tagline: "${id.tagline}"` : ''}
Return ONLY the signature text, no explanation.`,

  proposal_style: (id) => `Write a set of clear proposal writing instructions for an AI persona named "${id.name}" who is a "${id.role_label || 'Freelancer'}".
Their tone is ${id.communication_tone || 'professional'} and they specialize in: ${id.skills || 'general freelancing'}.
These instructions will guide the AI on HOW to write proposals on their behalf.

Create 4-6 specific, actionable instructions covering:
- How to open the proposal
- How to structure deliverables
- What tone/voice to use  
- How to close and create urgency
- Any specific language or phrases to use or avoid

Return as plain text bullet points starting with "- ".`,
};

export default function MissionWriteButton({ field, identity, onResult }) {
  const [loading, setLoading] = useState(false);

  const handleWrite = async () => {
    const promptFn = PROMPTS[field];
    if (!promptFn) return;
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: promptFn(identity),
      });
      if (result && typeof result === 'string') {
        onResult(result.trim());
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleWrite}
      disabled={loading}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-50"
      style={{
        background: loading ? 'rgba(139,92,246,0.1)' : 'rgba(139,92,246,0.15)',
        border: '1px solid rgba(139,92,246,0.4)',
        color: '#a78bfa',
      }}
      title={`AI-generate ${field.replace(/_/g, ' ')} based on this identity`}
    >
      {loading
        ? <Loader2 className="w-3 h-3 animate-spin" />
        : <Sparkles className="w-3 h-3" />}
      {loading ? 'Writing...' : 'Write with MISSION'}
    </button>
  );
}