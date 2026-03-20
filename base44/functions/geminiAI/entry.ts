/**
 * geminiAI — Google Gemini AI backend function
 * Supports: text generation, content analysis, proposal writing,
 *           opportunity scoring, creative copy, structured JSON output
 *
 * Actions:
 *   generate        — general text/content generation
 *   analyze         — analyze opportunity/task and return structured insights
 *   propose         — generate a job/grant/contest proposal
 *   score           — score an opportunity (velocity, risk, overall)
 *   creative        — generate creative marketing/ad copy
 *   research        — deep research on a topic with structured output
 *   chat            — conversational reply (for Chat page)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Default model — gemini-2.0-flash is fast + capable
const DEFAULT_MODEL = 'gemini-2.0-flash';
const PRO_MODEL = 'gemini-1.5-pro';

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

// OpenAI fallback when Gemini quota is exceeded
async function callOpenAIFallback(prompt, systemInstruction, jsonMode, temperature) {
  const messages = [];
  if (systemInstruction) messages.push({ role: 'system', content: systemInstruction });
  messages.push({ role: 'user', content: prompt });

  const body = { model: 'gpt-4o-mini', messages, temperature, max_tokens: 4096 };
  if (jsonMode) body.response_format = { type: 'json_object' };

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_API_KEY}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenAI fallback error ${res.status}`);
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  if (jsonMode) { try { return JSON.parse(text); } catch { return { raw: text }; } }
  return text;
}

async function callGemini(model, prompt, systemInstruction = null, jsonSchema = null, temperature = 0.7) {
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

  const contents = [{ role: 'user', parts: [{ text: prompt }] }];

  const body = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 8192,
      ...(jsonSchema ? { responseMimeType: 'application/json' } : {}),
    },
  };

  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (jsonSchema) {
    try { return JSON.parse(text); } catch { return { raw: text }; }
  }
  return text;
}

// Smart router: try Gemini first, fall back to OpenAI on quota/rate errors
async function callAI(model, prompt, systemInstruction = null, jsonSchema = null, temperature = 0.7) {
  try {
    return await callGemini(model, prompt, systemInstruction, jsonSchema, temperature);
  } catch (err) {
    if ((err.message.includes('429') || err.message.includes('quota') || err.message.includes('RESOURCE_EXHAUSTED')) && OPENAI_API_KEY) {
      console.log('Gemini quota hit — falling back to OpenAI');
      return await callOpenAIFallback(prompt, systemInstruction, !!jsonSchema, temperature);
    }
    throw err;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, ...params } = await req.json();

    // ── GENERATE ───────────────────────────────────────────────────────────────
    if (action === 'generate') {
      const { prompt, system, model = DEFAULT_MODEL, temperature = 0.7 } = params;
      const result = await callGemini(model, prompt, system, null, temperature);
      return Response.json({ success: true, text: result });
    }

    // ── ANALYZE ────────────────────────────────────────────────────────────────
    if (action === 'analyze') {
      const { title, description, platform, category, capital_required = 0 } = params;
      const prompt = `Analyze this profit opportunity and return structured insights:

Title: ${title}
Description: ${description}
Platform: ${platform || 'unknown'}
Category: ${category}
Capital Required: $${capital_required}

Return a JSON object with:
- summary: string (2-3 sentence summary)
- pros: array of strings (top 3 advantages)
- cons: array of strings (top 3 risks)
- best_identity_type: string (what persona/profile is best for this)
- execution_tips: array of strings (3-5 actionable steps)
- time_estimate: string (how long to execute)
- difficulty: "easy"|"medium"|"hard"`;

      const result = await callGemini(PRO_MODEL, prompt, 'You are an expert profit opportunity analyst. Always return valid JSON.', true, 0.3);
      return Response.json({ success: true, analysis: result });
    }

    // ── PROPOSE ────────────────────────────────────────────────────────────────
    if (action === 'propose') {
      const { opportunity, identity, style = 'professional', platform } = params;
      const system = identity?.brand_assets?.ai_persona_instructions
        || `You are ${identity?.name || 'a skilled professional'} writing a compelling proposal.`;

      const prompt = `Write a ${style} proposal/application for the following opportunity:

Platform: ${platform || opportunity?.platform || 'unknown'}
Title: ${opportunity?.title}
Description: ${opportunity?.description}

Identity Profile:
- Name: ${identity?.name || 'Professional'}
- Role: ${identity?.role_label || 'Freelancer'}
- Skills: ${identity?.skills?.join(', ') || 'General'}
- Bio: ${identity?.bio || ''}
- Tone: ${identity?.communication_tone || 'professional'}

Write a compelling, tailored proposal (150-300 words). Be specific, highlight relevant experience, and include a clear call to action. Do NOT use generic filler phrases.`;

      const result = await callGemini(PRO_MODEL, prompt, system, null, 0.75);
      return Response.json({ success: true, proposal: result });
    }

    // ── SCORE ──────────────────────────────────────────────────────────────────
    if (action === 'score') {
      const { title, description, category, platform, capital_required = 0, deadline } = params;
      const prompt = `Score this opportunity on three dimensions (1-100):

Title: ${title}
Description: ${description}
Category: ${category}
Platform: ${platform}
Capital Required: $${capital_required}
Deadline: ${deadline || 'none'}

Return JSON:
{
  "velocity_score": number (1-100, how fast income can be generated),
  "risk_score": number (1-100, 100=highest risk),
  "overall_score": number (1-100, combined priority score),
  "reasoning": string (1 sentence explanation)
}`;

      const result = await callGemini(DEFAULT_MODEL, prompt, 'You are a financial risk analyst. Return only valid JSON.', true, 0.2);
      return Response.json({ success: true, scores: result });
    }

    // ── CREATIVE ───────────────────────────────────────────────────────────────
    if (action === 'creative') {
      const { type, subject, brand_context, tone = 'professional', length = 'medium' } = params;
      const wordCounts = { short: '50-100', medium: '100-200', long: '200-400' };

      const prompt = `Create ${type} content for: "${subject}"

Brand Context: ${brand_context || 'Professional, modern, results-driven'}
Tone: ${tone}
Length: ${wordCounts[length] || wordCounts.medium} words

Types of content to generate:
- ad_copy: Attention-grabbing advertisement
- email: Professional email copy
- social: Social media post (platform-appropriate)
- listing: Product/service listing description
- bio: Professional bio or profile summary
- pitch: Sales pitch or elevator pitch

Current type: ${type}

Write compelling, conversion-focused content. No placeholder text.`;

      const result = await callGemini(PRO_MODEL, prompt, null, null, 0.85);
      return Response.json({ success: true, content: result });
    }

    // ── RESEARCH ───────────────────────────────────────────────────────────────
    if (action === 'research') {
      const { topic, focus = 'profit opportunities', depth = 'standard' } = params;
      const model = depth === 'deep' ? PRO_MODEL : DEFAULT_MODEL;

      const prompt = `Research the following topic and provide structured intelligence:

Topic: ${topic}
Focus: ${focus}

Return a JSON object with:
- overview: string (concise summary)
- key_findings: array of strings (top 5 insights)
- opportunities: array of objects with {title, description, potential_value, difficulty}
- risks: array of strings (top risks to be aware of)
- recommended_actions: array of strings (next steps)
- sources_to_check: array of strings (platforms/resources to explore)`;

      const result = await callGemini(model, prompt, 'You are an expert market researcher and profit strategist. Return valid JSON.', true, 0.4);
      return Response.json({ success: true, research: result });
    }

    // ── CHAT ───────────────────────────────────────────────────────────────────
    if (action === 'chat') {
      const { message, history = [], system_context = '' } = params;

      const system = `You are an advanced AI profit engine assistant. You help users maximize earnings through automation, freelancing, arbitrage, and digital opportunities.
${system_context}
Be concise, actionable, and data-driven. Use bullet points when listing items. Always suggest specific next steps.`;

      // Build conversation context from history
      const historyContext = history.slice(-6).map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n');
      const fullPrompt = historyContext ? `${historyContext}\nUser: ${message}` : message;

      const result = await callGemini(DEFAULT_MODEL, fullPrompt, system, null, 0.7);
      return Response.json({ success: true, reply: result });
    }

    // ── BATCH SCORE OPPORTUNITIES ──────────────────────────────────────────────
    if (action === 'batch_score') {
      const { opportunities = [] } = params;
      const results = [];

      for (const opp of opportunities.slice(0, 10)) {
        const prompt = `Score this opportunity (1-100 each): Title: "${opp.title}", Category: ${opp.category}, Platform: ${opp.platform || 'unknown'}.
Return JSON: {"velocity_score": number, "risk_score": number, "overall_score": number}`;
        const score = await callGemini(DEFAULT_MODEL, prompt, null, true, 0.2);
        results.push({ id: opp.id, ...score });
      }

      return Response.json({ success: true, scores: results });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});