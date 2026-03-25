import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * GET BRAND SUGGESTIONS
 * Provides AI suggestions for all brand asset sections at once
 * Helps users quickly generate a complete brand profile
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { identity_id, current_brand } = await req.json();
    if (!identity_id) {
      return jsonResponse({ error: 'Missing identity_id' }, 400);
    }

    // Fetch identity
    const identity = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
    if (!identity || identity.created_by !== user.email) {
      return jsonResponse({ error: 'Identity not found or unauthorized' }, 404);
    }

    // Build comprehensive suggestion prompt
    const prompt = `You are a brand strategist helping an AI freelancer create a complete professional brand.

IDENTITY DATA:
- Name: ${identity.name}
- Role: ${identity.role_label || 'Not specified'}
- Tagline: ${identity.tagline || 'Not specified'}
- Bio: ${identity.bio || 'Not specified'}
- Skills: ${(identity.skills || []).join(', ') || 'Not specified'}
- Communication Tone: ${identity.communication_tone || 'professional'}

Generate 5 COMPLETE, READY-TO-USE brand profile suggestions (variations A-E).
Each should be internally consistent and ready to implement.

For EACH variation, provide:
1. formality_level: One of [very_formal, formal, semi_formal, casual, very_casual]
2. vocabulary_style: Array of 1-2 styles
3. signature_phrases: Array of 2 memorable phrases
4. primary_color: A hex color
5. graphic_style: Array of 2 styles
6. strengths: Array of 2-3 strengths
7. industry_alignment: Array of 1-2 industries
8. ai_persona_instructions: A 50-word persona description

Format as JSON with structure:
{
  "variations": [
    {
      "name": "Variation A: [Brief theme description]",
      "formality_level": "...",
      "vocabulary_style": [...],
      "signature_phrases": [...],
      "primary_color": "#...",
      "graphic_style": [...],
      "strengths": [...],
      "industry_alignment": [...],
      "ai_persona_instructions": "..."
    },
    ...
  ]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          variations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                formality_level: { type: 'string' },
                vocabulary_style: { type: 'array', items: { type: 'string' } },
                signature_phrases: { type: 'array', items: { type: 'string' } },
                primary_color: { type: 'string' },
                graphic_style: { type: 'array', items: { type: 'string' } },
                strengths: { type: 'array', items: { type: 'string' } },
                industry_alignment: { type: 'array', items: { type: 'string' } },
                ai_persona_instructions: { type: 'string' },
              },
            },
          },
        },
      },
    });

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🎨 Brand suggestions generated for identity ${identity.name}`,
      severity: 'info',
    }).catch(() => null);

    return jsonResponse({ suggestions: result.variations || [] });
  } catch (error) {
    console.error('[getBrandSuggestions]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}