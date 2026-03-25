import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * GENERATE BRAND ASSETS WITH AI
 * Generates brand content for a specific section using AI
 * Sections: Visual Branding, Written & Communication Style, AI Behavioral Rules, Professional Identity & Metadata
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { identity_id, section, current_brand } = await req.json();
    if (!identity_id || !section) {
      return jsonResponse({ error: 'Missing identity_id or section' }, 400);
    }

    // Fetch identity
    const identity = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
    if (!identity || identity.created_by !== user.email) {
      return jsonResponse({ error: 'Identity not found or unauthorized' }, 404);
    }

    // Build AI prompt based on section
    let prompt = '';
    let generatedFields = {};

    if (section === 'Visual Branding') {
      prompt = `Generate visual branding assets for an AI identity named "${identity.name}". 
Current data: Role: ${identity.role_label || 'Not specified'}, Tagline: ${identity.tagline || 'Not specified'}.

Generate:
1. primary_color: A hex color that aligns with the identity's role
2. secondary_color: A complementary hex color
3. accent_color: An accent hex color (optional)
4. graphic_style: Array of 2-3 styles from [minimalist, bold, corporate, playful, luxury, technical, artistic, modern]
5. font_primary: Best font from [Inter, Helvetica Neue, Georgia, Playfair Display, Roboto, Montserrat, Lato, Merriweather]
6. layout_preferences: Brief description of layout style (max 50 words)

Return ONLY valid JSON with these fields.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            primary_color: { type: 'string' },
            secondary_color: { type: 'string' },
            accent_color: { type: 'string' },
            graphic_style: { type: 'array', items: { type: 'string' } },
            font_primary: { type: 'string' },
            layout_preferences: { type: 'string' },
          },
        },
      });
      generatedFields = result;
    } else if (section === 'Written & Communication Style') {
      prompt = `Generate communication style for an AI identity named "${identity.name}".
Role: ${identity.role_label || 'Not specified'}, Bio: ${identity.bio || 'Not specified'}, Current tone: ${identity.communication_tone || 'Not specified'}.

Generate:
1. formality_level: One of [very_formal, formal, semi_formal, casual, very_casual]
2. vocabulary_style: Array of 1-3 from [simple, technical, academic, conversational, industry_specific, creative]
3. signature_phrases: Array of 2-3 memorable phrases unique to this identity
4. industry_language: Array of 2-3 industry-specific terms this identity uses
5. writing_rules: Array of 2-3 specific writing rules (e.g. "Always lead with outcomes", "Use active voice")

Return ONLY valid JSON.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            formality_level: { type: 'string' },
            vocabulary_style: { type: 'array', items: { type: 'string' } },
            signature_phrases: { type: 'array', items: { type: 'string' } },
            industry_language: { type: 'array', items: { type: 'string' } },
            writing_rules: { type: 'array', items: { type: 'string' } },
          },
        },
      });
      generatedFields = result;
    } else if (section === 'AI Behavioral Rules') {
      prompt = `Generate behavioral rules for an AI identity named "${identity.name}".
Skills: ${(identity.skills || []).join(', ')}, Communication tone: ${identity.communication_tone || 'professional'}.

Generate:
1. always_rules: Array of 2-3 rules the AI must always follow
2. never_rules: Array of 2-3 hard restrictions for the AI
3. ai_persona_instructions: A detailed 50-100 word persona description to inject into AI prompts

Return ONLY valid JSON.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            always_rules: { type: 'array', items: { type: 'string' } },
            never_rules: { type: 'array', items: { type: 'string' } },
            ai_persona_instructions: { type: 'string' },
          },
        },
      });
      generatedFields = result;
    } else if (section === 'Professional Identity & Metadata') {
      prompt = `Generate professional metadata for an AI identity named "${identity.name}".
Role: ${identity.role_label || 'Not specified'}, Skills: ${(identity.skills || []).join(', ')}.

Generate:
1. industry_alignment: Array of 1-2 industries from [technology, design, marketing, finance, healthcare, legal, education, e-commerce, consulting, creative_arts, real_estate]
2. strengths: Array of 3-4 key strengths (e.g. "fast turnaround", "pixel-perfect design")
3. differentiators: Array of 2-3 differentiators (e.g. "5-star rating", "niche expertise")
4. work_history_summary: A 50-100 word summary of work experience

Return ONLY valid JSON.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            industry_alignment: { type: 'array', items: { type: 'string' } },
            strengths: { type: 'array', items: { type: 'string' } },
            differentiators: { type: 'array', items: { type: 'string' } },
            work_history_summary: { type: 'string' },
          },
        },
      });
      generatedFields = result;
    }

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✨ Brand assets generated via AI for identity ${identity.name} (section: ${section})`,
      severity: 'info',
    }).catch(() => null);

    return jsonResponse({ generated: generatedFields });
  } catch (error) {
    console.error('[generateBrandAssets]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}