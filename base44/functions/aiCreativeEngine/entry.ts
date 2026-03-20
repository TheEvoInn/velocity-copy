import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * AI Creative Engine
 * Integrates:
 * - DeepAI API: text-to-image generation, image editing, background removal
 * - Perchance API: creative prompt/text generation for content ideas
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'generate_image') return await generateImage(payload);
    if (action === 'edit_image') return await editImage(payload);
    if (action === 'remove_background') return await removeBackground(payload);
    if (action === 'upscale_image') return await upscaleImage(payload);
    if (action === 'deepai_chat') return await deepAIChat(payload);
    if (action === 'perchance_generate') return await perchanceGenerate(payload);
    if (action === 'generate_creative_brief') return await generateCreativeBrief(payload);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[aiCreativeEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ─── DeepAI: Text-to-Image ────────────────────────────────────────────────────
async function generateImage({ prompt, style = 'hd' }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');
  const endpoint = style === 'anime'
    ? 'https://api.deepai.org/api/anime-portrait-generator'
    : 'https://api.deepai.org/api/text2img';

  const formData = new FormData();
  formData.append('text', prompt);
  if (style === 'hd') formData.append('grid_size', '1');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.err) throw new Error(data.err || 'DeepAI image generation failed');

  return Response.json({
    success: true,
    image_url: data.output_url,
    prompt,
    provider: 'deepai',
  });
}

// ─── DeepAI: Image Editor (style transfer / edit) ────────────────────────────
async function editImage({ image_url, style_prompt }) {
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
  if (!res.ok || data.err) throw new Error(data.err || 'DeepAI image edit failed');

  return Response.json({ success: true, image_url: data.output_url, provider: 'deepai' });
}

// ─── DeepAI: Background Remover ──────────────────────────────────────────────
async function removeBackground({ image_url }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');
  const formData = new FormData();
  formData.append('image', image_url);

  const res = await fetch('https://api.deepai.org/api/background-remover', {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.err) throw new Error(data.err || 'Background removal failed');

  return Response.json({ success: true, image_url: data.output_url, provider: 'deepai' });
}

// ─── DeepAI: Super Resolution (upscale) ──────────────────────────────────────
async function upscaleImage({ image_url }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');
  const formData = new FormData();
  formData.append('image', image_url);

  const res = await fetch('https://api.deepai.org/api/torch-srgan', {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.err) throw new Error(data.err || 'Upscale failed');

  return Response.json({ success: true, image_url: data.output_url, provider: 'deepai' });
}

// ─── DeepAI: Chat ─────────────────────────────────────────────────────────────
async function deepAIChat({ message, history = [] }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');
  const formData = new FormData();

  const chatHistory = history.map(h => ({ role: h.role, content: h.content }));
  formData.append('chat_history', JSON.stringify(chatHistory));
  formData.append('user_input', message);

  const res = await fetch('https://api.deepai.org/api/chat-response', {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const data = await res.json();
  if (!res.ok || data.err) throw new Error(data.err || 'DeepAI chat failed');

  return Response.json({ success: true, reply: data.output, provider: 'deepai' });
}

// ─── Creative Prompt Generator (OpenAI-powered, Perchance-style) ─────────────
async function perchanceGenerate({ generator, count = 5 }) {
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');

  // Use OpenAI to generate Perchance-style creative prompts/content
  const generatorInstructions = {
    'ai-character': `Generate ${count} unique fictional AI character descriptions. Each should be 1-2 sentences with name, role, and personality trait.`,
    'image-prompts': `Generate ${count} vivid, detailed text-to-image prompts for AI art generation. Each should be evocative and specific with style, subject, lighting, and mood.`,
    'story-ideas': `Generate ${count} unique short story concepts in 1-2 sentences each. Include genre, protagonist type, and core conflict.`,
    'job-titles': `Generate ${count} creative and unusual professional job titles for a futuristic freelance economy. Make them specific and intriguing.`,
    'business-names': `Generate ${count} catchy, memorable business names for a digital services / AI company. Include a one-word tagline.`,
    'product-descriptions': `Generate ${count} compelling digital product descriptions (templates, tools, assets) ready for marketplace listing. Each 1-2 sentences.`,
  };

  const instruction = generatorInstructions[generator] || `Generate ${count} creative ideas related to: ${generator}. One per line.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a creative content generator. Output ONLY a numbered list, one item per line, no extra commentary.' },
        { role: 'user', content: instruction }
      ],
      max_tokens: 600,
    }),
  });

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content || '';
  const results = raw.split('\n')
    .filter(l => l.trim())
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length > 3)
    .slice(0, count);

  return Response.json({
    success: true,
    results,
    generator,
    provider: 'openai-creative',
  });
}

// ─── Combined: Generate Creative Brief (OpenAI prompt → DeepAI image) ────────
async function generateCreativeBrief({ type = 'logo', category = 'freelance' }) {
  const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');

  // Step 1: Use OpenAI to generate an optimal image prompt for the asset type
  const promptRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an expert prompt engineer for AI image generation. Output ONLY the image prompt, nothing else.' },
        { role: 'user', content: `Write a single, detailed text-to-image prompt for a professional ${type} for a ${category} business. Include style, colors, composition, and mood. Keep it under 100 words.` }
      ],
      max_tokens: 120,
    }),
  });
  const promptData = await promptRes.json();
  const promptText = promptData.choices?.[0]?.message?.content?.trim() || `Professional ${type} for ${category}, clean modern design, white background`;

  // Step 2: Generate image with DeepAI
  const formData = new FormData();
  formData.append('text', promptText);
  formData.append('grid_size', '1');

  const imgRes = await fetch('https://api.deepai.org/api/text2img', {
    method: 'POST',
    headers: { 'api-key': DEEPAI_KEY },
    body: formData,
  });
  const imgData = await imgRes.json();

  return Response.json({
    success: true,
    prompt_used: promptText,
    image_url: imgData.output_url || null,
    image_error: imgData.err || null,
    provider: 'openai+deepai',
  });
}