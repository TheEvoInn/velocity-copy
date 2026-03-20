import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * AI Creative Engine
 * All generation uses base44 built-in integrations (no external API keys needed):
 * - Core.GenerateImage  → DALL-E powered image generation & editing
 * - Core.InvokeLLM      → Creative text, prompts, briefs
 *
 * Note: DeepAI key is set but account is free-tier (no API access).
 * All tools use base44 integrations which are fully operational.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    switch (action) {
      case 'generate_image':         return await generateImage(base44, payload);
      case 'edit_image':             return await editImage(base44, payload);
      case 'remove_background':      return await removeBackground(base44, payload);
      case 'upscale_image':          return await upscaleImage(base44, payload);
      case 'generate_blog_asset':    return await generateBlogAsset(base44, payload);
      case 'generate_social_image':  return await generateSocialImage(base44, payload);
      case 'generate_creative_visual': return await generateCreativeVisual(base44, payload);
      case 'perchance_generate':     return await generatePrompts(base44, payload);
      case 'generate_creative_brief': return await generateCreativeBrief(base44, payload);
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('[aiCreativeEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Core Image Generation ─────────────────────────────────────────────────────
async function generateImage(base44, { prompt, existing_image_url }) {
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt,
    ...(existing_image_url ? { existing_image_urls: [existing_image_url] } : {}),
  });
  return Response.json({ success: true, image_url: result.url, prompt, provider: 'dalle' });
}

// ─── Edit Image (style transfer via reference image) ──────────────────────────
async function editImage(base44, { image_url, style_prompt }) {
  const enhancedPrompt = `${style_prompt}. Maintain the core subject and composition from the reference image. High quality, detailed, professional.`;
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt: enhancedPrompt,
    existing_image_urls: [image_url],
  });
  return Response.json({ success: true, image_url: result.url, provider: 'dalle' });
}

// ─── Remove Background (generate clean version via prompt) ────────────────────
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
async function generateBlogAsset(base44, { topic, style = 'modern', asset_type = 'header' }) {
  const assetPrompts = {
    header: `Blog header image for article about "${topic}". ${style} style, wide 16:9 format, bold typography-friendly composition, professional, eye-catching, suitable for blog thumbnail. Cinematic lighting, high contrast.`,
    illustration: `Editorial illustration for blog post about "${topic}". ${style} digital art style, conceptual, thought-provoking, clean composition with negative space for text overlay.`,
    infographic: `Infographic-style visual for "${topic}". Clean data visualization aesthetic, ${style} color palette, icons and chart elements, white background, professional business design.`,
    thumbnail: `YouTube/social thumbnail for "${topic}". Bold, vibrant, ${style} style, high contrast, faces or key objects large and clear, designed to stop scrolling.`,
  };

  const prompt = assetPrompts[asset_type] || assetPrompts.header;
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
  return Response.json({ success: true, image_url: result.url, prompt, asset_type, provider: 'dalle' });
}

// ─── Social Media Image Generator ────────────────────────────────────────────
async function generateSocialImage(base44, { topic, platform = 'instagram', style = 'professional' }) {
  const platformSpecs = {
    instagram: 'Square 1:1 format, Instagram-optimized, bold visual, lifestyle aesthetic, scroll-stopping',
    twitter:   'Wide 16:9 Twitter card format, clean design, brand-friendly, readable at small sizes',
    linkedin:  'Professional LinkedIn post image, corporate aesthetic, business context, trustworthy colors',
    facebook:  'Facebook post image, engaging, warm colors, community-focused, shareable',
    pinterest: 'Tall 2:3 Pinterest pin, vertical format, beautiful lifestyle photography style, aspirational',
    youtube:   'YouTube thumbnail, bold text space, high contrast face or subject, clickbait-worthy but professional',
  };

  const spec = platformSpecs[platform] || platformSpecs.instagram;
  const prompt = `${spec}. Topic: "${topic}". Style: ${style}. High quality, vibrant, professional social media content.`;
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
  return Response.json({ success: true, image_url: result.url, prompt, platform, provider: 'dalle' });
}

// ─── Creative Visual Generator ────────────────────────────────────────────────
async function generateCreativeVisual(base44, { concept, visual_type = 'logo', color_scheme = 'auto', industry = 'tech' }) {
  const visualPrompts = {
    logo:        `Minimalist professional logo for a ${industry} company concept: "${concept}". ${color_scheme !== 'auto' ? color_scheme + ' color palette,' : ''} clean vector style, memorable icon mark, white background, scalable design.`,
    banner:      `Wide marketing banner for "${concept}" in the ${industry} industry. ${color_scheme !== 'auto' ? color_scheme + ' colors,' : ''} bold typography space, gradient background, modern design, call-to-action ready.`,
    poster:      `Event/marketing poster design for "${concept}". ${color_scheme !== 'auto' ? color_scheme + ' color scheme,' : ''} eye-catching layout, bold headline space, professional ${industry} aesthetic.`,
    mockup:      `Product mockup visualization for "${concept}". Clean studio presentation, ${color_scheme !== 'auto' ? color_scheme + ' tones,' : ''} professional product photography style, ${industry} market context.`,
    icon:        `App icon or UI icon set for "${concept}". Flat design, ${color_scheme !== 'auto' ? color_scheme + ' palette,' : ''} clean, modern, recognizable at small sizes, ${industry} context.`,
    background:  `Desktop/website background for "${concept}" brand. ${color_scheme !== 'auto' ? color_scheme + ' colors,' : ''} subtle texture or gradient, professional, non-distracting, works as backdrop.`,
  };

  const prompt = visualPrompts[visual_type] || visualPrompts.logo;
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt });
  return Response.json({ success: true, image_url: result.url, prompt, visual_type, provider: 'dalle' });
}

// ─── Creative Prompt Generator ────────────────────────────────────────────────
async function generatePrompts(base44, { generator, count = 5 }) {
  const generatorInstructions = {
    'ai-character':        `Generate ${count} unique fictional AI character descriptions. Each 1-2 sentences: name, role, personality trait.`,
    'image-prompts':       `Generate ${count} vivid, detailed text-to-image prompts for AI art. Each evocative and specific: style, subject, lighting, mood.`,
    'story-ideas':         `Generate ${count} unique short story concepts in 1-2 sentences. Include genre, protagonist, core conflict.`,
    'job-titles':          `Generate ${count} creative professional job titles for a futuristic AI-driven freelance economy.`,
    'business-names':      `Generate ${count} catchy, memorable business names for a digital services or AI automation company. Include a one-word tagline after each.`,
    'product-descriptions': `Generate ${count} compelling digital product descriptions (templates, tools, assets) for marketplace listing. 1-2 sentences each.`,
    'blog-topics':         `Generate ${count} engaging blog post titles about AI, automation, or online income. Clickworthy but informative.`,
    'social-captions':     `Generate ${count} punchy social media captions for a digital entrepreneur brand. Include 2-3 relevant hashtags each.`,
  };

  const prompt = generatorInstructions[generator] || `Generate ${count} creative ideas related to: ${generator}. One per line, no preamble.`;

  const raw = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Output ONLY a numbered list, one item per line, no extra commentary.\n\n${prompt}`,
  });

  const results = String(raw).split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 3)
    .map(l => l.replace(/^\d+[\.\)\-\*]\s*/, '').trim())
    .filter(l => l.length > 3)
    .slice(0, count);

  return Response.json({ success: true, results, generator, provider: 'base44-llm' });
}

// ─── AI Creative Brief (LLM prompt → DALL-E image) ───────────────────────────
async function generateCreativeBrief(base44, { type = 'logo', category = 'freelance' }) {
  const promptRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Write a single detailed text-to-image prompt for a professional ${type} for a ${category} business. Include style, colors, composition, and mood. Output ONLY the prompt, under 80 words, no quotes, no preamble.`,
  });
  const promptText = String(promptRaw).trim();

  const imgResult = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: promptText });

  return Response.json({
    success: true,
    prompt_used: promptText,
    image_url: imgResult.url || null,
    provider: 'base44-llm+dalle',
  });
}