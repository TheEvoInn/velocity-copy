import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * AI Creative Engine
 * Uses base44 built-in integrations (no external API keys needed):
 * - Core.GenerateImage: AI image generation (DALL-E powered)
 * - Core.InvokeLLM: Creative text/prompt generation
 *
 * DeepAI endpoints (bg remove, upscale, image edit) still use DEEPAI_API_KEY
 * if the user has a Pro DeepAI account. Falls back gracefully if not available.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'generate_image') return await generateImage(base44, payload);
    if (action === 'edit_image') return await editImageDeepAI(payload);
    if (action === 'remove_background') return await deepAITool('background-remover', payload);
    if (action === 'upscale_image') return await deepAITool('torch-srgan', payload);
    if (action === 'perchance_generate') return await generatePrompts(base44, payload);
    if (action === 'generate_creative_brief') return await generateCreativeBrief(base44, payload);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[aiCreativeEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── Image Generation (base44 built-in DALL-E) ────────────────────────────────
async function generateImage(base44, { prompt, existing_image_url }) {
  const result = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt,
    ...(existing_image_url ? { existing_image_urls: [existing_image_url] } : {}),
  });

  return Response.json({
    success: true,
    image_url: result.url,
    prompt,
    provider: 'base44-dalle',
  });
}

// ─── DeepAI: Image Editor (requires DeepAI Pro) ───────────────────────────────
async function editImageDeepAI({ image_url, style_prompt }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');
  const formData = new FormData();
  formData.append('image', image_url);
  formData.append('text', style_prompt);

  const res = await fetch('https://api.deepai.org/api/image-editor', {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.err || data.status?.includes('Pro')) {
    throw new Error(data.err || data.status || 'DeepAI Pro subscription required for image editing');
  }

  return Response.json({ success: true, image_url: data.output_url, provider: 'deepai' });
}

// ─── DeepAI: Generic tool (bg remove, upscale) ───────────────────────────────
async function deepAITool(endpoint, { image_url }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');
  const formData = new FormData();
  formData.append('image', image_url);

  const res = await fetch(`https://api.deepai.org/api/${endpoint}`, {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.err || data.status?.includes('Pro')) {
    throw new Error(data.err || data.status || 'DeepAI Pro subscription required');
  }

  return Response.json({ success: true, image_url: data.output_url, provider: 'deepai' });
}

// ─── Creative Prompt Generator (base44 InvokeLLM) ────────────────────────────
async function generatePrompts(base44, { generator, count = 5 }) {
  const generatorInstructions = {
    'ai-character': `Generate ${count} unique fictional AI character descriptions. Each should be 1-2 sentences with name, role, and personality trait.`,
    'image-prompts': `Generate ${count} vivid, detailed text-to-image prompts for AI art generation. Each should be evocative and specific, describing style, subject, lighting, and mood.`,
    'story-ideas': `Generate ${count} unique short story concepts in 1-2 sentences each. Include genre, protagonist type, and core conflict.`,
    'job-titles': `Generate ${count} creative and intriguing professional job titles for a futuristic AI-driven freelance economy.`,
    'business-names': `Generate ${count} catchy, memorable business names for a digital services or AI automation company. Include a one-word tagline after each.`,
    'product-descriptions': `Generate ${count} compelling digital product descriptions (templates, tools, assets) ready for marketplace listing. Keep each to 1-2 sentences.`,
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

  return Response.json({
    success: true,
    results,
    generator,
    provider: 'base44-llm',
  });
}

// ─── Creative Brief: AI prompt → base44 image ────────────────────────────────
async function generateCreativeBrief(base44, { type = 'logo', category = 'freelance' }) {
  // Step 1: Generate an optimized image prompt using LLM
  const promptRaw = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Write a single, detailed text-to-image prompt for a professional ${type} for a ${category} business. Include style, colors, composition, and mood. Output ONLY the prompt, under 80 words, no quotes, no preamble.`,
  });
  const promptText = String(promptRaw).trim();

  // Step 2: Generate the image
  const imgResult = await base44.asServiceRole.integrations.Core.GenerateImage({
    prompt: promptText,
  });

  return Response.json({
    success: true,
    prompt_used: promptText,
    image_url: imgResult.url || null,
    provider: 'base44-llm+dalle',
  });
}