import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * AI Creative Engine — with Brand Asset Injection
 * All generation automatically incorporates the active identity's brand profile.
 * Uses base44 Core.GenerateImage (DALL-E) and Core.InvokeLLM.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    // Fetch active identity for brand injection
    const identity = await getActiveIdentity(base44, payload?.identity_id);

    switch (action) {
      case 'generate_image':           return await generateImage(base44, payload, identity);
      case 'edit_image':               return await editImage(base44, payload, identity);
      case 'remove_background':        return await removeBackground(base44, payload);
      case 'upscale_image':            return await upscaleImage(base44, payload);
      case 'generate_blog_asset':      return await generateBlogAsset(base44, payload, identity);
      case 'generate_social_image':    return await generateSocialImage(base44, payload, identity);
      case 'generate_creative_visual': return await generateCreativeVisual(base44, payload, identity);
      case 'perchance_generate':       return await generatePrompts(base44, payload, identity);
      case 'generate_creative_brief':  return await generateCreativeBrief(base44, payload, identity);
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[aiCreativeEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Brand Context Builder ─────────────────────────────────────────────────────
async function getActiveIdentity(base44, identityId = null) {
  try {
    if (identityId) {
      const results = await base44.asServiceRole.entities.AIIdentity.filter({ id: identityId }, '-created_date', 1);
      return results[0] || null;
    }
    const active = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, '-created_date', 1);
    return active[0] || null;
  } catch { return null; }
}

function buildBrandContext(identity) {
  if (!identity) return '';
  const b = identity.brand_assets || {};
  const lines = [];

  lines.push(`=== ACTIVE IDENTITY: ${identity.name} ===`);
  if (identity.role_label) lines.push(`Role: ${identity.role_label}`);
  if (identity.tagline) lines.push(`Tagline: "${identity.tagline}"`);
  if (identity.bio) lines.push(`Background: ${identity.bio}`);
  if (identity.communication_tone) lines.push(`Tone: ${identity.communication_tone}`);
  if (identity.skills?.length) lines.push(`Skills: ${identity.skills.join(', ')}`);

  if (b.ai_persona_instructions) {
    lines.push('\nPERSONA INSTRUCTIONS (follow exactly):');
    lines.push(b.ai_persona_instructions);
  }
  if (b.formality_level) lines.push(`Formality: ${b.formality_level.replace(/_/g, ' ')}`);
  if (b.vocabulary_style?.length) lines.push(`Vocabulary: ${b.vocabulary_style.join(', ')}`);
  if (b.industry_alignment?.length) lines.push(`Industry: ${b.industry_alignment.join(', ')}`);
  if (b.industry_language?.length) lines.push(`Use terms: ${b.industry_language.join(', ')}`);
  if (b.signature_phrases?.length) lines.push(`Signature phrases: "${b.signature_phrases.join('" | "')}"`);
  if (b.always_rules?.length) lines.push(`ALWAYS: ${b.always_rules.join('. ')}`);
  if (b.never_rules?.length) lines.push(`NEVER: ${b.never_rules.join('. ')}`);
  if (b.forbidden_phrases?.length) lines.push(`FORBIDDEN words: ${b.forbidden_phrases.join(', ')}`);
  if (b.strengths?.length) lines.push(`Strengths: ${b.strengths.join(', ')}`);
  if (b.differentiators?.length) lines.push(`Differentiators: ${b.differentiators.join(', ')}`);
  if (b.certifications?.length) lines.push(`Credentials: ${b.certifications.join(', ')}`);
  if (b.work_history_summary) lines.push(`Experience: ${b.work_history_summary}`);
  if (identity.proposal_style) lines.push(`Proposal Style: ${identity.proposal_style}`);

  lines.push('=== END IDENTITY CONTEXT ===\n');
  return lines.join('\n');
}

function buildBrandedImagePrompt(identity, basePrompt) {
  if (!identity) return basePrompt;
  const b = identity.brand_assets || {};
  const parts = [basePrompt];
  if (b.graphic_style?.length) parts.push(`style: ${b.graphic_style.join(', ')}`);
  if (b.primary_color) parts.push(`color palette: ${b.primary_color}${b.secondary_color ? ` and ${b.secondary_color}` : ''}`);
  if (b.font_primary) parts.push(`typography: ${b.font_primary} font`);
  if (b.layout_preferences) parts.push(b.layout_preferences);
  return parts.join(', ');
}

// ─── Core Image Generation ─────────────────────────────────────────────────────
async function generateImage(base44, { prompt, existing_image_url }, identity) {
  const brandedPrompt = buildBrandedImagePrompt(identity, prompt);
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt: brandedPrompt,
    ...(existing_image_url ? { existing_image_urls: [existing_image_url] } : {}),
  });
  return Response.json({ success: true, image_url: result.url, prompt: brandedPrompt, provider: 'dalle', identity_used: identity?.name || null });
}

// ─── Edit Image ────────────────────────────────────────────────────────────────
async function editImage(base44, { image_url, style_prompt }, identity) {
  const b = identity?.brand_assets || {};
  const styleHints = b.graphic_style?.length ? ` ${b.graphic_style.join(', ')} aesthetic.` : '';
  const enhancedPrompt = `${style_prompt}${styleHints} Maintain the core subject and composition from the reference image. High quality, detailed, professional.`;
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt: enhancedPrompt,
    existing_image_urls: [image_url],
  });
  return Response.json({ success: true, image_url: result.url, provider: 'dalle' });
}

// ─── Remove Background ─────────────────────────────────────────────────────────
async function removeBackground(base44, { image_url }) {
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt: 'Same subject, transparent/white background, clean cutout, product photo style, professional studio shot',
    existing_image_urls: [image_url],
  });
  return Response.json({ success: true, image_url: result.url, provider: 'dalle' });
}

// ─── Upscale / Enhance Image ──────────────────────────────────────────────────
async function upscaleImage(base44, { image_url }) {
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt: 'Ultra high resolution, 8K, sharp details, enhanced clarity, professional quality, same composition and subject',
    existing_image_urls: [image_url],
  });
  return Response.json({ success: true, image_url: result.url, provider: 'dalle' });
}

// ─── Blog Asset Generator ─────────────────────────────────────────────────────
async function generateBlogAsset(base44, { topic, style = 'modern', asset_type = 'header' }, identity) {
  const assetPrompts = {
    header:       `Blog header image for article about "${topic}". ${style} style, wide 16:9 format, bold typography-friendly composition, professional, eye-catching. Cinematic lighting, high contrast.`,
    illustration: `Editorial illustration for blog post about "${topic}". ${style} digital art style, conceptual, clean composition with negative space for text overlay.`,
    infographic:  `Infographic-style visual for "${topic}". Clean data visualization aesthetic, ${style} color palette, icons and chart elements, white background, professional business design.`,
    thumbnail:    `YouTube/social thumbnail for "${topic}". Bold, vibrant, ${style} style, high contrast, designed to stop scrolling.`,
  };

  const basePrompt = assetPrompts[asset_type] || assetPrompts.header;
  const brandedPrompt = buildBrandedImagePrompt(identity, basePrompt);
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: brandedPrompt });
  return Response.json({ success: true, image_url: result.url, prompt: brandedPrompt, asset_type, provider: 'dalle', identity_used: identity?.name || null });
}

// ─── Social Media Image Generator ────────────────────────────────────────────
async function generateSocialImage(base44, { topic, platform = 'instagram', style = 'professional' }, identity) {
  const platformSpecs = {
    instagram: 'Square 1:1 format, Instagram-optimized, bold visual, lifestyle aesthetic, scroll-stopping',
    twitter:   'Wide 16:9 Twitter card format, clean design, brand-friendly, readable at small sizes',
    linkedin:  'Professional LinkedIn post image, corporate aesthetic, business context, trustworthy colors',
    facebook:  'Facebook post image, engaging, warm colors, community-focused, shareable',
    pinterest: 'Tall 2:3 Pinterest pin, vertical format, beautiful lifestyle photography style, aspirational',
    youtube:   'YouTube thumbnail, bold text space, high contrast face or subject, professional',
  };

  const spec = platformSpecs[platform] || platformSpecs.instagram;
  const basePrompt = `${spec}. Topic: "${topic}". Style: ${style}. High quality, vibrant, professional social media content.`;
  const brandedPrompt = buildBrandedImagePrompt(identity, basePrompt);
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: brandedPrompt });
  return Response.json({ success: true, image_url: result.url, prompt: brandedPrompt, platform, provider: 'dalle', identity_used: identity?.name || null });
}

// ─── Creative Visual Generator ────────────────────────────────────────────────
async function generateCreativeVisual(base44, { concept, visual_type = 'logo', color_scheme = 'auto', industry = 'tech' }, identity) {
  const b = identity?.brand_assets || {};
  const colorHint = color_scheme !== 'auto' ? `${color_scheme} color palette,` : (b.primary_color ? `color palette: ${b.primary_color}${b.secondary_color ? ` and ${b.secondary_color}` : ''},` : '');
  const styleHint = b.graphic_style?.length ? `${b.graphic_style.join(', ')} style,` : '';

  const visualPrompts = {
    logo:       `Minimalist professional logo for a ${industry} company concept: "${concept}". ${colorHint} ${styleHint} clean vector style, memorable icon mark, white background, scalable design.`,
    banner:     `Wide marketing banner for "${concept}" in the ${industry} industry. ${colorHint} ${styleHint} bold typography space, gradient background, modern design.`,
    poster:     `Event/marketing poster design for "${concept}". ${colorHint} ${styleHint} eye-catching layout, bold headline space, professional ${industry} aesthetic.`,
    mockup:     `Product mockup visualization for "${concept}". Clean studio presentation, ${colorHint} ${styleHint} professional photography style, ${industry} market context.`,
    icon:       `App icon or UI icon set for "${concept}". Flat design, ${colorHint} ${styleHint} clean, modern, recognizable at small sizes, ${industry} context.`,
    background: `Desktop/website background for "${concept}" brand. ${colorHint} ${styleHint} subtle texture or gradient, professional, non-distracting.`,
  };

  const prompt = visualPrompts[visual_type] || visualPrompts.logo;
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
  return Response.json({ success: true, image_url: result.url, prompt, visual_type, provider: 'dalle', identity_used: identity?.name || null });
}

// ─── Creative Prompt Generator ────────────────────────────────────────────────
async function generatePrompts(base44, { generator, count = 5 }, identity) {
  const brandCtx = buildBrandContext(identity);
  const generatorInstructions = {
    'image-prompts':        `Generate ${count} vivid, detailed text-to-image prompts for AI art. Each evocative and specific.`,
    'job-titles':           `Generate ${count} creative professional job titles for a futuristic AI-driven freelance economy.`,
    'business-names':       `Generate ${count} catchy, memorable business names for a digital services or AI automation company.`,
    'product-descriptions': `Generate ${count} compelling digital product descriptions for marketplace listing. 1-2 sentences each.`,
    'blog-topics':          `Generate ${count} engaging blog post titles about AI, automation, or online income.`,
    'social-captions':      `Generate ${count} punchy social media captions for a digital entrepreneur brand. Include 2-3 hashtags.`,
  };

  const instruction = generatorInstructions[generator] || `Generate ${count} creative ideas related to: ${generator}.`;
  const prompt = `${brandCtx ? brandCtx + '\n\n' : ''}Output ONLY a numbered list, one item per line, no extra commentary.\n\n${instruction}`;

  const raw = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt });
  const results = String(raw).split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3)
    .map(l => l.replace(/^\d+[\.\)\-\*]\s*/, '').trim())
    .filter(l => l.length > 3)
    .slice(0, count);

  return Response.json({ success: true, results, generator, provider: 'base44-llm', identity_used: identity?.name || null });
}

// ─── AI Creative Brief ────────────────────────────────────────────────────────
async function generateCreativeBrief(base44, { type = 'logo', category = 'freelance' }, identity) {
  const brandCtx = buildBrandContext(identity);
  const promptRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `${brandCtx ? brandCtx + '\n\n' : ''}Write a single detailed text-to-image prompt for a professional ${type} for a ${category} business. Incorporate the brand identity above if provided. Include style, colors, composition, and mood. Output ONLY the prompt, under 80 words, no quotes, no preamble.`,
  });
  const promptText = String(promptRaw).trim();
  const imgResult = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: promptText });

  return Response.json({
    success: true,
    prompt_used: promptText,
    image_url: imgResult.url || null,
    provider: 'base44-llm+dalle',
    identity_used: identity?.name || null,
  });
}