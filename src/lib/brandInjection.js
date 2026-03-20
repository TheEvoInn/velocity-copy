/**
 * Brand Injection Utility
 * Builds identity-specific brand context that gets prepended to all AI prompts.
 * Used across: creative engine, proposal engine, agent worker, social posts, reports.
 */

import { base44 } from '@/api/base44Client';

/**
 * Fetch the active identity for the current user, or a specific identity by ID.
 * @param {string|null} identityId - Optional specific identity ID
 * @returns {Promise<object|null>} identity record or null
 */
export async function getActiveIdentity(identityId = null) {
  try {
    if (identityId) {
      const results = await base44.entities.AIIdentity.filter({ id: identityId }, '-created_date', 1);
      return results[0] || null;
    }
    // Get the active identity (is_active flag)
    const active = await base44.entities.AIIdentity.filter({ is_active: true }, '-created_date', 1);
    return active[0] || null;
  } catch {
    return null;
  }
}

/**
 * Build a full brand-injection system prompt from an identity record.
 * @param {object} identity - AIIdentity record with optional brand_assets
 * @returns {string} brand context string to prepend to AI prompts
 */
export function buildBrandContext(identity) {
  if (!identity) return '';
  const b = identity.brand_assets || {};
  const lines = [];

  lines.push(`=== ACTIVE IDENTITY: ${identity.name} ===`);
  if (identity.role_label) lines.push(`Role: ${identity.role_label}`);
  if (identity.tagline) lines.push(`Tagline: "${identity.tagline}"`);
  if (identity.bio) lines.push(`Background: ${identity.bio}`);
  if (identity.communication_tone) lines.push(`Tone: ${identity.communication_tone}`);
  if (identity.skills?.length) lines.push(`Skills: ${identity.skills.join(', ')}`);
  if (identity.email) lines.push(`Contact: ${identity.email}`);

  // Persona instructions (highest priority)
  if (b.ai_persona_instructions) {
    lines.push('');
    lines.push('PERSONA INSTRUCTIONS (follow exactly):');
    lines.push(b.ai_persona_instructions);
  }

  // Written style
  if (b.formality_level) lines.push(`Formality Level: ${b.formality_level.replace(/_/g, ' ')}`);
  if (b.vocabulary_style?.length) lines.push(`Vocabulary Style: ${b.vocabulary_style.join(', ')}`);
  if (b.industry_alignment?.length) lines.push(`Industry Focus: ${b.industry_alignment.join(', ')}`);
  if (b.industry_language?.length) lines.push(`Use these industry terms where appropriate: ${b.industry_language.join(', ')}`);
  if (b.signature_phrases?.length) lines.push(`Signature phrases to incorporate: "${b.signature_phrases.join('" | "')}"`);

  // Hard rules
  if (b.always_rules?.length) {
    lines.push('RULES — ALWAYS:');
    b.always_rules.forEach(r => lines.push(`  • ${r}`));
  }
  if (b.never_rules?.length) {
    lines.push('RULES — NEVER:');
    b.never_rules.forEach(r => lines.push(`  • ${r}`));
  }
  if (b.forbidden_phrases?.length) {
    lines.push(`FORBIDDEN words/phrases (never use): ${b.forbidden_phrases.join(', ')}`);
  }

  // Visual branding (for image/visual generation)
  if (b.graphic_style?.length || b.primary_color || b.font_primary) {
    lines.push('');
    lines.push('VISUAL BRAND:');
    if (b.graphic_style?.length) lines.push(`  Style: ${b.graphic_style.join(', ')}`);
    if (b.primary_color) {
      lines.push(`  Colors: primary=${b.primary_color}${b.secondary_color ? `, secondary=${b.secondary_color}` : ''}${b.accent_color ? `, accent=${b.accent_color}` : ''}`);
    }
    if (b.font_primary) lines.push(`  Fonts: ${b.font_primary}${b.font_secondary ? ` / ${b.font_secondary}` : ''}`);
    if (b.layout_preferences) lines.push(`  Layout: ${b.layout_preferences}`);
  }

  // Professional credentials
  if (b.strengths?.length) lines.push(`Key Strengths: ${b.strengths.join(', ')}`);
  if (b.differentiators?.length) lines.push(`Unique Value: ${b.differentiators.join(', ')}`);
  if (b.certifications?.length) lines.push(`Credentials: ${b.certifications.join(', ')}`);
  if (b.work_history_summary) lines.push(`Experience Summary: ${b.work_history_summary}`);
  if (b.preferred_project_types?.length) lines.push(`Project Types: ${b.preferred_project_types.join(', ')}`);

  // Proposal & communication style
  if (identity.proposal_style) {
    lines.push('');
    lines.push('PROPOSAL WRITING STYLE:');
    lines.push(identity.proposal_style);
  }
  if (identity.email_signature) {
    lines.push(`Email Signature: ${identity.email_signature}`);
  }

  lines.push('=== END IDENTITY CONTEXT ===');
  lines.push('All content must reflect this identity\'s brand, voice, and style consistently.');
  return lines.join('\n');
}

/**
 * Select the best-matching identity for a given opportunity based on skills, category, tone.
 * @param {object[]} identities - Array of all identity records
 * @param {object} opportunity - Opportunity record to match against
 * @returns {object|null} best matching identity
 */
export function selectBestIdentity(identities, opportunity) {
  if (!identities?.length) return null;
  if (identities.length === 1) return identities[0];

  const opp = opportunity || {};
  const scores = identities.map(id => {
    let score = 0;
    const b = id.brand_assets || {};

    // Auto-select task types match
    if (id.auto_select_for_task_types?.includes(opp.category)) score += 30;

    // Preferred categories match
    if (id.preferred_categories?.includes(opp.category)) score += 20;

    // Industry alignment match
    if (b.industry_alignment?.some(ind => opp.title?.toLowerCase().includes(ind.toLowerCase()) || opp.description?.toLowerCase().includes(ind.toLowerCase()))) score += 15;

    // Skills match
    if (id.skills?.some(skill => opp.title?.toLowerCase().includes(skill.toLowerCase()) || opp.description?.toLowerCase().includes(skill.toLowerCase()))) score += 25;

    // Platform match
    if (id.preferred_platforms?.includes(opp.platform)) score += 10;

    // Is active identity — slight bonus
    if (id.is_active) score += 5;

    return { identity: id, score };
  });

  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.identity || identities[0];
}

/**
 * Build a visual generation prompt that incorporates brand colors, style, and typography.
 * @param {object} identity - AIIdentity record
 * @param {string} basePrompt - The core image description
 * @returns {string} enhanced prompt with brand context
 */
export function buildBrandedImagePrompt(identity, basePrompt) {
  if (!identity) return basePrompt;
  const b = identity.brand_assets || {};
  const parts = [basePrompt];

  if (b.graphic_style?.length) parts.push(`visual style: ${b.graphic_style.join(', ')}`);
  if (b.primary_color) parts.push(`color palette: ${b.primary_color}${b.secondary_color ? ` and ${b.secondary_color}` : ''}`);
  if (b.font_primary) parts.push(`typography: ${b.font_primary} font`);
  if (b.layout_preferences) parts.push(b.layout_preferences);

  return parts.join(', ');
}