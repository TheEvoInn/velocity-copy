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

// ─── Perchance: Text Generator ────────────────────────────────────────────────
async function perchanceGenerate({ generator, count = 5 }) {
  const res = await fetch(
    `https://perchance.org/api/generateList.php?generator=${encodeURIComponent(generator)}&count=${count}`,
    { headers: { 'Accept': 'application/json' } }
  );
  if (!res.ok) throw new Error(`Perchance API error: ${res.status}`);
  const data = await res.json();

  return Response.json({
    success: true,
    results: data,
    generator,
    provider: 'perchance',
  });
}

// ─── Combined: Generate Creative Brief (Perchance → DeepAI image) ────────────
async function generateCreativeBrief({ type = 'ai-character', category = 'freelance' }) {
  const DEEPAI_KEY = Deno.env.get('DEEPAI_API_KEY');

  // Step 1: Get a creative prompt from Perchance
  let promptText = null;
  try {
    const pcRes = await fetch(
      `https://perchance.org/api/generateList.php?generator=${encodeURIComponent(type)}&count=1`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (pcRes.ok) {
      const pcData = await pcRes.json();
      promptText = Array.isArray(pcData) ? pcData[0] : null;
    }
  } catch (_) { /* fallback to LLM prompt */ }

  // Step 2: If perchance didn't give us something useful, build a prompt
  if (!promptText || promptText.length < 5) {
    const prompts = {
      logo: `Professional minimalist logo design for a ${category} business, clean vector style, white background`,
      banner: `Eye-catching promotional banner for a ${category} service, vibrant colors, modern typography`,
      avatar: `Professional avatar portrait for a ${category} freelancer, photorealistic, neutral background`,
      product: `High-quality product mockup for digital ${category} services, studio lighting`,
    };
    promptText = prompts[type] || `Professional creative design for ${category} work`;
  }

  // Step 3: Generate image with DeepAI
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
    provider: 'deepai+perchance',
  });
}