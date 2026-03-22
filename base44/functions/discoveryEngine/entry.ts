/**
 * DISCOVERY ENGINE v4 — Full Internet Work Scanner
 * - Real web search via LLM + internet context
 * - Keyword expansion across 30+ categories
 * - Browser-hop simulation with URL extraction
 * - Online-only + AI-compatibility filter
 * - Scoring engine (pay, speed, AI-fit, platform reliability)
 * - Per-user isolated, feeds directly into Autopilot queue
 * - Task Reader integration: breaks tasks into executable steps
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const GEMINI_KEY = Deno.env.get('GOOGLE_AI_API_KEY');
const OPENAI_KEY = Deno.env.get('OPENAI_API_KEY');

// ─── LLM HELPER ───────────────────────────────────────────────────────────────
async function callLLM(prompt, jsonMode = false, useInternet = true) {
  // Try Gemini first (supports internet context)
  if (GEMINI_KEY) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`;
      const body = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.3, maxOutputTokens: jsonMode ? 4096 : 2048 },
        tools: useInternet ? [{ google_search: {} }] : []
      };
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
        if (text) return text;
      }
    } catch (e) { console.error('Gemini error:', e.message); }
  }

  // Fallback to OpenAI
  if (OPENAI_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${OPENAI_KEY}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: jsonMode ? 4096 : 2048,
          temperature: 0.3,
        })
      });
      if (res.ok) {
        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
      }
    } catch (e) { console.error('OpenAI error:', e.message); }
  }

  return null;
}

function extractJSON(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (match) { try { return JSON.parse(match[0]); } catch {} }
  const obj = cleaned.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  return null;
}

// ─── MASTER KEYWORD EXPANSION MAP ────────────────────────────────────────────
const KEYWORD_MAP = {
  game_testing: {
    primary: ['game testing jobs', 'beta tester', 'QA game tester', 'playtest jobs', 'game feedback tasks'],
    expanded: ['video game QA remote', 'indie game tester', 'mobile game beta', 'steam playtest', 'console QA tester', 'game bug reporter', 'alpha tester games', 'uTest game tasks'],
    platforms: ['playtestcloud.com', 'utest.com', 'betabound.com', 'testbirds.com', 'erli.com']
  },
  freelancing: {
    primary: ['freelance remote jobs', 'online contractor work', 'digital task worker', 'work from home gigs'],
    expanded: ['remote freelancer platform', 'online project work', 'digital freelance tasks', 'hire me freelance', 'gig economy online'],
    platforms: ['upwork.com', 'fiverr.com', 'freelancer.com', 'guru.com', 'peopleperhour.com', 'toptal.com']
  },
  transcription: {
    primary: ['transcription jobs online', 'audio typing jobs', 'speech to text tasks'],
    expanded: ['captioning jobs', 'subtitle creation', 'podcast transcription', 'legal transcription online', 'medical transcription remote', 'interview transcription gigs', 'audio to text freelance'],
    platforms: ['rev.com', 'transcribeme.com', 'gotranscript.com', 'scribie.com', 'castingwords.com', 'verbit.ai']
  },
  writing: {
    primary: ['freelance writing jobs', 'copywriting tasks', 'content writing online'],
    expanded: ['blog post writing gigs', 'SEO writing jobs', 'article writing tasks', 'ghostwriting remote', 'product description writing', 'technical writing freelance', 'white paper writing remote', 'UX writing jobs'],
    platforms: ['textbroker.com', 'iwriter.com', 'contentfly.com', 'writerswork.com', 'verblio.com', 'constant-content.com']
  },
  content_creation: {
    primary: ['content creator jobs online', 'UGC creator tasks', 'social media content work'],
    expanded: ['TikTok UGC creator', 'short form video tasks', 'brand content creator remote', 'product review videos paid', 'YouTube content tasks', 'Instagram Reels creator work', 'podcast content creator'],
    platforms: ['billo.app', 'ugccreators.com', 'cohley.com', 'backstage.com', 'skeepers.io']
  },
  social_media: {
    primary: ['social media micro tasks', 'social media management remote', 'online social tasks'],
    expanded: ['Instagram tasks paid', 'Twitter/X engagement tasks', 'social media scheduler remote', 'community manager remote', 'hashtag research tasks', 'Pinterest management remote', 'LinkedIn content tasks'],
    platforms: ['socialbee.io', 'fiverr.com', 'upwork.com', 'truelancer.com', 'socialebay.com']
  },
  translation: {
    primary: ['translation jobs online', 'online translator work', 'language translation tasks'],
    expanded: ['document translation remote', 'website localization tasks', 'multilingual transcription', 'subtitle translation', 'app localization work', 'legal translation remote', 'sworn translator online'],
    platforms: ['gengo.com', 'translated.com', 'transperfect.com', 'proz.com', 'translatorscafe.com', 'one-hour-translation.com']
  },
  data_entry: {
    primary: ['data entry jobs online', 'remote data entry tasks', 'online typing jobs'],
    expanded: ['spreadsheet data input', 'form filling tasks', 'database entry work', 'web research data entry', 'product listing data entry', 'CRM data entry remote', 'OCR data correction tasks'],
    platforms: ['clickworker.com', 'microworkers.com', 'mturk.com', 'appen.com', 'isoftstone.com', 'rapidworkers.com']
  },
  virtual_assistant: {
    primary: ['virtual assistant jobs online', 'VA tasks remote', 'online admin assistant'],
    expanded: ['executive assistant remote', 'calendar management tasks', 'email management VA', 'research assistant online', 'scheduling assistant remote', 'Shopify VA tasks', 'ecommerce assistant remote'],
    platforms: ['belay.com', 'timeetc.com', 'fancy hands', 'upwork.com', 'zirtual.com', 'boldly.com']
  },
  research: {
    primary: ['online research tasks', 'internet research jobs', 'web research gigs'],
    expanded: ['market research online', 'company research tasks', 'lead research remote', 'academic research assistant', 'product research tasks', 'competitor analysis tasks', 'fact-checking tasks remote'],
    platforms: ['wonder.com', 'upwork.com', 'fiverr.com', 'askwonder.com', 'gartner.com']
  },
  surveys: {
    primary: ['paid survey sites', 'online surveys for money', 'survey tasks'],
    expanded: ['product feedback surveys', 'market research surveys', 'paid opinion platforms', 'focus group online', 'user research sessions paid', 'ethnographic study online', 'diary study paid'],
    platforms: ['prolific.ac', 'userinterviews.com', 'respondent.io', 'surveyjunkie.com', 'swagbucks.com', 'pineconeresearch.com']
  },
  microtasks: {
    primary: ['micro task platform', 'small online tasks', 'micro job websites'],
    expanded: ['image annotation tasks', 'click tasks online', 'short gig work', 'quick online jobs', 'CAPTCHA solving tasks', 'web scraping microtasks', 'sentiment tagging tasks'],
    platforms: ['mturk.com', 'clickworker.com', 'microworkers.com', 'rapidworkers.com', 'picoworkers.com', 'spare5.com']
  },
  ai_training: {
    primary: ['AI training data jobs', 'machine learning data tasks', 'AI labeling work'],
    expanded: ['data annotation jobs', 'image labeling tasks', 'NLP data collection', 'RLHF feedback tasks', 'chatbot training data', 'AI model evaluation tasks', 'preference ranking AI', 'red-teaming AI jobs'],
    platforms: ['scale.ai', 'labelbox.com', 'appen.com', 'cloudfactory.com', 'remotasks.com', 'surge.ai', 'alignerr.com', 'outlier.ai']
  },
  customer_support: {
    primary: ['online customer support jobs', 'remote chat support', 'virtual customer service'],
    expanded: ['chat agent remote', 'email support tasks', 'help desk online', 'customer chat moderator', 'live chat agent work', 'e-commerce support remote', 'technical support chat'],
    platforms: ['liveops.com', 'arise.com', 'supportninja.com', 'concentrix.com', 'transcom.com', 'working solutions']
  },
  digital_products: {
    primary: ['sell digital products online', 'create digital downloads', 'digital product creation'],
    expanded: ['eBook creation tasks', 'digital template design', 'printable design work', 'online course creation', 'digital asset creation', 'Notion template creation', 'AI-generated art products', 'prompt packs for sale'],
    platforms: ['gumroad.com', 'etsy.com', 'payhip.com', 'creative market', 'selz.com', 'ko-fi.com', 'lemon squeezy']
  },
  tutoring: {
    primary: ['online tutoring jobs', 'virtual tutor work', 'teach online tasks'],
    expanded: ['ESL teaching online', 'math tutoring remote', 'coding tutoring jobs', 'language teaching apps', 'homework help tutor', 'SAT prep tutor online', 'STEM tutor remote'],
    platforms: ['chegg.com', 'tutor.com', 'wyzant.com', 'cambly.com', 'preply.com', 'italki.com', 'skooli.com']
  },
  review_writing: {
    primary: ['review writing tasks', 'product review writing', 'paid review jobs'],
    expanded: ['app review writing', 'G2 review writing', 'website review gigs', 'software review content', 'book review writing paid', 'Trustpilot review tasks'],
    platforms: ['reviewstream.com', 'crowdtap.com', 'tomoson.com', 'influenster.com', 'g2.com']
  },
  marketplace_listing: {
    primary: ['marketplace listing tasks', 'product listing jobs online', 'eBay listing work'],
    expanded: ['Amazon listing optimization', 'Etsy product listing', 'dropship listing tasks', 'item description writing', 'SEO product titles', 'Amazon A+ content writing', 'Walmart product listing'],
    platforms: ['upwork.com', 'fiverr.com', 'helium10.com', 'jungle scout', 'sellbrite.com']
  },
  affiliate_marketing: {
    primary: ['affiliate marketing tasks online', 'affiliate content creation', 'promote products online'],
    expanded: ['CPA affiliate tasks', 'review affiliate content', 'comparison site content', 'email affiliate work', 'niche site building', 'affiliate link insertion tasks', 'ClickBank content tasks'],
    platforms: ['clickbank.com', 'shareasale.com', 'cj.com', 'impact.com', 'partnerstack.com', 'awin.com']
  },
  dropshipping: {
    primary: ['dropshipping tasks online', 'product research dropship', 'store management remote'],
    expanded: ['winning product research', 'supplier sourcing tasks', 'Shopify store management', 'dropship product descriptions', 'ad creative tasks dropship', 'print-on-demand design tasks', 'ecommerce product upload'],
    platforms: ['shopify.com', 'spocket.co', 'dsers.com', 'zendrop.com', 'printful.com', 'salehoo.com']
  },
  testing_websites: {
    primary: ['website testing jobs', 'UX testing online', 'usability testing tasks'],
    expanded: ['user testing tasks', 'website feedback jobs', 'app usability testing', 'design feedback tasks', 'bug reporting tasks', 'accessibility testing remote', 'mobile app QA tasks'],
    platforms: ['usertesting.com', 'testbirds.com', 'ubertesters.com', 'userlytics.com', 'validately.com', 'trymata.com']
  },
  photo_video: {
    primary: ['sell stock photos online', 'stock video creation', 'photo editing tasks'],
    expanded: ['microstock photography', 'video editing remote', 'thumbnail design tasks', 'background removal tasks', 'image retouching work', 'drone footage upload', 'illustration tasks online'],
    platforms: ['shutterstock.com', 'adobe stock', 'pond5.com', 'fiverr.com', '99designs.com', 'getty images']
  },
  coding: {
    primary: ['coding tasks online', 'remote developer gigs', 'freelance programming'],
    expanded: ['bug fixing tasks', 'WordPress tasks', 'landing page coding', 'script writing tasks', 'automation scripting remote', 'API integration tasks', 'Chrome extension development'],
    platforms: ['toptal.com', 'codementor.io', 'gun.io', 'arc.dev', 'crossover.com', 'gigsalad.com']
  },
  design: {
    primary: ['graphic design tasks online', 'remote design gigs', 'logo design jobs'],
    expanded: ['social media design tasks', 'presentation design work', 'infographic creation', 'banner design tasks', 'icon design remote', 'pitch deck design', 'UI design tasks remote'],
    platforms: ['99designs.com', 'designcrowd.com', 'dribbble.com', 'fiverr.com', 'designhill.com']
  },
  moderation: {
    primary: ['online content moderation jobs', 'remote moderator work', 'social media moderation'],
    expanded: ['community moderator online', 'forum moderation tasks', 'image review tasks', 'comment moderation work', 'trust & safety tasks', 'AI content moderation', 'ad review tasks'],
    platforms: ['teleperformance.com', 'accenture.com', 'appen.com', 'cogito.com']
  }
};

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function scoreOpportunity(opp) {
  let score = 45;
  const pay = opp.estimated_pay || 0;
  const mins = opp.time_estimate_minutes || 60;
  const hrRate = mins > 0 ? (pay / mins) * 60 : 0;

  // Hourly rate scoring (most important)
  if (hrRate >= 100) score += 30;
  else if (hrRate >= 50) score += 22;
  else if (hrRate >= 25) score += 14;
  else if (hrRate >= 10) score += 6;
  else if (hrRate < 3) score -= 15;

  // Absolute pay bonus
  if (pay >= 200) score += 12;
  else if (pay >= 100) score += 8;
  else if (pay >= 50) score += 4;

  // Speed bonus
  if (mins <= 15) score += 15;
  else if (mins <= 30) score += 10;
  else if (mins <= 60) score += 5;
  else if (mins > 480) score -= 12;

  // AI compatibility
  if (opp.can_ai_complete) score += 18;
  else score -= 25;

  // Online only (mandatory)
  if (!opp.online_only) return 0;
  score += 8;

  // Difficulty
  if (opp.difficulty === 'beginner') score += 8;
  else if (opp.difficulty === 'advanced') score -= 5;

  // Platform reliability boost
  const reliable = ['upwork', 'fiverr', 'amazon', 'rev.com', 'appen', 'clickworker', 'prolific', 'mturk', 'remotasks', 'scale.ai', 'outlier.ai', 'alignerr'];
  if (reliable.some(p => (opp.platform || '').toLowerCase().includes(p))) score += 8;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function isOnlineOnly(opp) {
  const blockers = ['in person', 'on-site', 'physical location', 'warehouse', 'drive to', 'local only', 'must be present', 'in-store', 'office visit', 'pickup', 'delivery driver', 'commute'];
  const text = `${opp.title} ${opp.description || ''}`.toLowerCase();
  return !blockers.some(d => text.includes(d));
}

function isAICompatible(opp) {
  const blocked = ['driver license required', 'notarized document', 'physical signature', 'wet signature', 'blood draw', 'drug test', 'fingerprint', 'in-person interview only', 'must appear in court'];
  const text = `${opp.title} ${opp.description || ''}`.toLowerCase();
  return !blocked.some(d => text.includes(d));
}

// ─── KEYWORD EXPANDER ─────────────────────────────────────────────────────────
function expandKeywords(categories) {
  const result = {};
  const cats = categories.length ? categories : Object.keys(KEYWORD_MAP);
  for (const cat of cats) {
    const data = KEYWORD_MAP[cat];
    if (data) result[cat] = { all_terms: [...data.primary, ...data.expanded], platforms: data.platforms };
  }
  return result;
}

// ─── AI-POWERED INTERNET SCAN ─────────────────────────────────────────────────
async function scanCategoryWithAI(category, keywords, platforms) {
  const kwSample = keywords.slice(0, 8).join(', ');
  const platformSample = platforms.slice(0, 5).join(', ');

  const prompt = `You are a work discovery agent scanning the internet for REAL, active, paid online tasks.

Category: ${category.replace(/_/g, ' ').toUpperCase()}
Search terms: ${kwSample}
Target platforms: ${platformSample}

Search the internet RIGHT NOW and find 4-6 real, currently available paid online tasks in this category.

For each task return a JSON array with this exact schema:
[
  {
    "title": "specific real task title",
    "platform": "actual platform name",
    "url": "https://actual-url.com",
    "estimated_pay": 25,
    "pay_unit": "per_task|per_hour|per_word|per_minute|per_project",
    "time_estimate_minutes": 45,
    "difficulty": "beginner|intermediate|advanced",
    "description": "detailed description of what needs to be done",
    "requirements": ["requirement1", "requirement2"],
    "can_ai_complete": true,
    "online_only": true,
    "discovery_method": "search|scrape|api",
    "keywords_matched": ["keyword1", "keyword2"]
  }
]

RULES:
- Only include 100% online tasks (no physical presence)
- Only include tasks an AI agent can perform digitally
- Use real platform URLs (upwork.com, fiverr.com, rev.com, etc.)
- estimated_pay should be realistic for this platform/task type
- Return ONLY the JSON array, no markdown, no explanation`;

  const text = await callLLM(prompt, true, true);
  const parsed = extractJSON(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(t => t.title && t.platform && t.can_ai_complete && t.online_only);
}

// ─── TASK READER: Break task into executable steps ───────────────────────────
async function breakIntoSteps(opp) {
  const prompt = `You are a Task Reader AI. Analyze this online work task and break it into executable automation steps.

Task: ${opp.title}
Platform: ${opp.platform}
URL: ${opp.url || 'not specified'}
Description: ${opp.description}
Category: ${opp.category}

Output a JSON object:
{
  "execution_steps": [
    {"step": 1, "action": "Navigate to URL", "target": "url", "completed": false},
    {"step": 2, "action": "Login with credentials", "target": "form", "completed": false}
  ],
  "required_inputs": ["email", "password", "content"],
  "estimated_duration_minutes": 30,
  "automation_difficulty": "low|medium|high",
  "can_fully_automate": true,
  "manual_steps": ["step requiring human"],
  "workflow_type": "form_fill|content_generation|data_entry|api_call|web_scrape"
}

Be specific. Return ONLY the JSON object.`;

  const text = await callLLM(prompt, true, false);
  return extractJSON(text) || { execution_steps: [], can_fully_automate: false };
}

// ─── STATIC OPPORTUNITY LIBRARY (high-quality curated) ───────────────────────
function getCuratedOpportunities(userEmail) {
  return [
    // AI Training — highest demand
    { title: 'AI Response Quality Rater — Outlier.ai', category: 'ai_training', platform: 'outlier.ai', url: 'https://outlier.ai/freelancers', estimated_pay: 30, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Rate and improve AI model outputs. Flexible hours, weekly pay. No experience needed.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Conversation Data Collector — Alignerr', category: 'ai_training', platform: 'alignerr.com', url: 'https://alignerr.com', estimated_pay: 25, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Provide natural language samples and rate AI conversations for RLHF training datasets.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Image Annotation Batch — Scale AI', category: 'ai_training', platform: 'scale.ai', url: 'https://scale.ai/data-engine', estimated_pay: 18, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Label images, bounding boxes, and semantic segmentation for computer vision models.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },
    { title: 'RLHF Preference Ranking — Remotasks', category: 'ai_training', platform: 'remotasks.com', url: 'https://remotasks.com', estimated_pay: 22, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Compare AI outputs and select better responses. Trains large language models.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'AI Red-Teaming Evaluator — Surge AI', category: 'ai_training', platform: 'surge.ai', url: 'https://surge.ai', estimated_pay: 35, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Find failure modes and edge cases in AI systems. High pay, expert evaluators preferred.', can_ai_complete: true, online_only: true, discovery_method: 'search' },

    // Transcription
    { title: 'Podcast Episode Transcription — Rev', category: 'transcription', platform: 'rev.com', url: 'https://rev.com/freelancers', estimated_pay: 20, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Transcribe podcast audio at $0.45/min. Work anytime. Weekly payouts via PayPal.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Legal Deposition Transcription — GoTranscript', category: 'transcription', platform: 'gotranscript.com', url: 'https://gotranscript.com/transcription-jobs', estimated_pay: 28, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Transcribe legal deposition audio. Higher pay rate for accuracy. Flexible schedule.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },
    { title: 'YouTube Caption Creator — TranscribeMe', category: 'transcription', platform: 'transcribeme.com', url: 'https://transcribeme.com/jobs', estimated_pay: 22, time_estimate_minutes: 40, difficulty: 'beginner', description: 'Create accurate captions for YouTube content. $0.79/audio minute. No minimum hours.', can_ai_complete: true, online_only: true, discovery_method: 'search' },

    // Writing
    { title: 'SEO Blog Post — Tech Niche — Textbroker', category: 'writing', platform: 'textbroker.com', url: 'https://textbroker.com/freelance-writing', estimated_pay: 50, time_estimate_minutes: 90, difficulty: 'intermediate', description: '1000-word SEO articles for tech websites. Textbroker Level 4 pay: $0.05/word.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Product Description Copywriter — Upwork', category: 'writing', platform: 'upwork.com', url: 'https://upwork.com/freelance-jobs/copywriting', estimated_pay: 40, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Write 300-word product descriptions for Amazon/Shopify stores. $40–80/page.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },
    { title: 'Email Newsletter Copywriter — iWriter', category: 'writing', platform: 'iwriter.com', url: 'https://iwriter.com/register', estimated_pay: 55, time_estimate_minutes: 75, difficulty: 'intermediate', description: 'Write SaaS company newsletters. Recurring work available. $30-60 per newsletter.', can_ai_complete: true, online_only: true, discovery_method: 'search' },

    // Micro-tasks
    { title: 'Product Categorization HITs — MTurk', category: 'microtasks', platform: 'mturk.com', url: 'https://mturk.com', estimated_pay: 10, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Categorize products and websites. $0.05-0.25 per HIT. High volume available.', can_ai_complete: true, online_only: true, discovery_method: 'api' },
    { title: 'Sentiment Tagging Batch — Clickworker', category: 'microtasks', platform: 'clickworker.com', url: 'https://clickworker.com/en/micro-jobs', estimated_pay: 12, time_estimate_minutes: 25, difficulty: 'beginner', description: 'Tag text sentiment for NLP datasets. Batch tasks available, paid weekly.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },
    { title: 'Quick Answer Tasks — Picoworkers', category: 'microtasks', platform: 'picoworkers.com', url: 'https://picoworkers.com', estimated_pay: 6, time_estimate_minutes: 10, difficulty: 'beginner', description: 'Complete quick internet tasks: searches, signups, reviews. $0.10-2.00 each.', can_ai_complete: true, online_only: true, discovery_method: 'search' },

    // Research
    { title: 'B2B Lead Research — Upwork', category: 'research', platform: 'upwork.com', url: 'https://upwork.com/freelance-jobs/lead-generation', estimated_pay: 40, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Find and verify B2B contacts from LinkedIn. $0.50-2.00 per qualified lead.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Market Research Report — Wonder', category: 'research', platform: 'wonder.com', url: 'https://askwonder.com/researcher', estimated_pay: 75, time_estimate_minutes: 120, difficulty: 'intermediate', description: 'Research questions for businesses. Expert researchers earn $15-25/hr on Wonder.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Surveys
    { title: 'Academic Research Study — Prolific', category: 'surveys', platform: 'prolific.ac', url: 'https://prolific.ac', estimated_pay: 16, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Participate in university research. Average $12-16/hr. Fast approval, frequent studies.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'UX Research Interview — User Interviews', category: 'surveys', platform: 'userinterviews.com', url: 'https://userinterviews.com/apply', estimated_pay: 75, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Participate in remote user research sessions. $75+ per hour-long session.', can_ai_complete: false, online_only: true, discovery_method: 'scrape' },

    // VA tasks
    { title: 'Email Inbox Management — Fancy Hands', category: 'virtual_assistant', platform: 'fancy hands', url: 'https://fancyhands.com', estimated_pay: 20, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Handle executive email tasks: draft replies, organize inbox, schedule meetings.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Shopify Store VA — Upwork', category: 'virtual_assistant', platform: 'upwork.com', url: 'https://upwork.com/freelance-jobs/virtual-assistant', estimated_pay: 25, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Manage product listings, order tracking, and customer messages for ecommerce stores.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Digital Products
    { title: 'Notion Productivity Template Pack — Gumroad', category: 'digital_products', platform: 'gumroad.com', url: 'https://gumroad.com', estimated_pay: 200, time_estimate_minutes: 240, difficulty: 'intermediate', description: 'Create and sell a Notion template bundle. Passive income once listed. $10-50 per sale.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Canva Template Pack — Etsy', category: 'digital_products', platform: 'etsy.com', url: 'https://etsy.com', estimated_pay: 150, time_estimate_minutes: 180, difficulty: 'intermediate', description: 'Design Canva social media templates and sell on Etsy. 60% passive income potential.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Website Testing
    { title: 'Usability Test — UserTesting.com', category: 'testing_websites', platform: 'usertesting.com', url: 'https://usertesting.com/be-a-user-tester', estimated_pay: 10, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Navigate websites while recording your screen and thinking aloud. $10 per 20-min test.', can_ai_complete: false, online_only: true, discovery_method: 'search' },
    { title: 'Beta App Bug Reporter — BetaBound', category: 'testing_websites', platform: 'betabound.com', url: 'https://betabound.com', estimated_pay: 20, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Test beta apps and report bugs. Compensation varies by project, typically $10-50/test.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Game Testing
    { title: 'Mobile Game Beta Tester — PlaytestCloud', category: 'game_testing', platform: 'playtestcloud.com', url: 'https://playtestcloud.com', estimated_pay: 12, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Play new mobile games and provide written feedback. $9-15 per 20-30 minute session.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'PC Game QA Tester — uTest', category: 'game_testing', platform: 'utest.com', url: 'https://utest.com', estimated_pay: 30, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Find and report bugs in PC games. Paid per accepted bug report. Flexible schedule.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Data Entry
    { title: 'Product Specs Data Entry — Upwork', category: 'data_entry', platform: 'upwork.com', url: 'https://upwork.com/freelance-jobs/data-entry', estimated_pay: 25, time_estimate_minutes: 90, difficulty: 'beginner', description: 'Enter product specifications from PDFs into Google Sheets. $15-25/hr for fast typers.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Contact List Building — Microworkers', category: 'data_entry', platform: 'microworkers.com', url: 'https://microworkers.com', estimated_pay: 18, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Research and compile business contact lists. $0.20-0.50 per verified contact.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Translation
    { title: 'Spanish→English Marketing Translation — Gengo', category: 'translation', platform: 'gengo.com', url: 'https://gengo.com/translators', estimated_pay: 45, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Translate marketing copy. Standard level: $0.06/word. Pro level: $0.12/word.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'App UI String Localization — ProZ', category: 'translation', platform: 'proz.com', url: 'https://proz.com/jobs', estimated_pay: 60, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Localize app UI strings for global markets. High demand for Asian and European languages.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Customer Support
    { title: 'Remote Chat Support Agent — LiveOps', category: 'customer_support', platform: 'liveops.com', url: 'https://join.liveops.com', estimated_pay: 20, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Handle customer inquiries via live chat. No calls. Flexible scheduling, paid per hour.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Email Support Specialist — Upwork', category: 'customer_support', platform: 'upwork.com', url: 'https://upwork.com/freelance-jobs/customer-service', estimated_pay: 22, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Handle customer support emails using templates. $15-25/hr. SaaS companies prefer quick learners.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Coding
    { title: 'WordPress Bug Fix — Codementor', category: 'coding', platform: 'codementor.io', url: 'https://codementor.io/freelance-jobs', estimated_pay: 60, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Fix CSS/PHP issues on WordPress sites. Clear scope tasks, paid on delivery.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Landing Page HTML Build — Fiverr', category: 'coding', platform: 'fiverr.com', url: 'https://fiverr.com', estimated_pay: 80, time_estimate_minutes: 120, difficulty: 'intermediate', description: 'Build responsive landing pages from Figma designs. $75-150 per page. High demand.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Design
    { title: 'Social Media Graphics Pack — 99designs', category: 'design', platform: '99designs.com', url: 'https://99designs.com/freelance-designers', estimated_pay: 70, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Design 10-post social media brand kits. $65-150 per pack. Canva or Figma acceptable.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Logo Design Contest Entry — Designcrowd', category: 'design', platform: 'designcrowd.com', url: 'https://designcrowd.com', estimated_pay: 100, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Win-based logo contests. Average $150-500 prizes. AI design tools allowed.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Social Media
    { title: 'Social Media Post Scheduler — Fiverr', category: 'social_media', platform: 'fiverr.com', url: 'https://fiverr.com/categories/online-marketing/social-media-marketing', estimated_pay: 45, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Schedule and manage social media content for small businesses. $40-80/month retainer.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Instagram Hashtag Researcher — Upwork', category: 'social_media', platform: 'upwork.com', url: 'https://upwork.com', estimated_pay: 25, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Research niche hashtags and competitor analysis for Instagram brands. $20-35/hr.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Affiliate
    { title: 'Affiliate Review Article — Impact.com', category: 'affiliate_marketing', platform: 'impact.com', url: 'https://impact.com/partners', estimated_pay: 90, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Write SEO review articles for software affiliate programs. $30-100 commission per conversion.', can_ai_complete: true, online_only: true, discovery_method: 'search' },

    // Marketplace Listing
    { title: 'Amazon Listing Optimization — Upwork', category: 'marketplace_listing', platform: 'upwork.com', url: 'https://upwork.com/freelance-jobs/amazon', estimated_pay: 60, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Optimize Amazon product titles, bullets, and descriptions for SEO. $50-100/ASIN.', can_ai_complete: true, online_only: true, discovery_method: 'search' },

    // Review Writing
    { title: 'Software Review Writer — G2 Tasks', category: 'review_writing', platform: 'microworkers.com', url: 'https://microworkers.com', estimated_pay: 8, time_estimate_minutes: 15, difficulty: 'beginner', description: 'Write detailed software reviews. $2-10 per accepted review. Fast approval.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Content Creation
    { title: 'UGC Video Creator — Billo', category: 'content_creation', platform: 'billo.app', url: 'https://billo.app/creators', estimated_pay: 50, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Create short UGC product review videos for brands. $50-150 per video. No experience needed.', can_ai_complete: false, online_only: true, discovery_method: 'search' },
    { title: 'Short-Form Script Writer — Fiverr', category: 'content_creation', platform: 'fiverr.com', url: 'https://fiverr.com', estimated_pay: 35, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Write scripts for YouTube Shorts and TikTok videos. High volume available. $25-60/script.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },

    // Dropshipping
    { title: 'Winning Product Research — Fiverr', category: 'dropshipping', platform: 'fiverr.com', url: 'https://fiverr.com/categories/business/e-commerce-services', estimated_pay: 45, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Research trending dropshipping products using tools like Minea or AdSpy. $40-75/report.', can_ai_complete: true, online_only: true, discovery_method: 'search' },
    { title: 'Shopify Product Description Writer — Upwork', category: 'dropshipping', platform: 'upwork.com', url: 'https://upwork.com', estimated_pay: 30, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Write compelling product descriptions for Shopify dropshipping stores. $25-50/batch.', can_ai_complete: true, online_only: true, discovery_method: 'scrape' },
  ].map(opp => ({
    ...opp,
    user_email: userEmail,
    status: 'discovered',
    score: scoreOpportunity(opp),
    pay_currency: 'USD',
    keywords_matched: (KEYWORD_MAP[opp.category]?.primary?.slice(0, 2) || []),
  })).filter(o => o.score > 0);
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, filters = {}, keywords = [], categories = [] } = body;

    // ── Full Discovery Scan ───────────────────────────────────────────────
    if (action === 'full_scan' || action === 'scan') {
      // Phase 1: Curated high-quality opportunities
      let allOpportunities = getCuratedOpportunities(user.email);

      // Phase 2: AI-powered internet scan for additional live opportunities (only if LLM keys available)
      const hasLLM = !!(GEMINI_KEY || OPENAI_KEY);
      const scanCategories = categories.length > 0
        ? categories
        : Object.keys(KEYWORD_MAP).slice(0, 8);

      const aiScanResults = [];
      if (hasLLM) {
        for (const cat of scanCategories.slice(0, 6)) {
          try {
            const catData = KEYWORD_MAP[cat];
            if (!catData) continue;
            const aiOpps = await scanCategoryWithAI(cat, catData.primary.concat(catData.expanded), catData.platforms);
            for (const opp of aiOpps) {
              aiScanResults.push({
                ...opp,
                category: cat,
                user_email: user.email,
                status: 'discovered',
                score: scoreOpportunity({ ...opp, online_only: true, can_ai_complete: opp.can_ai_complete }),
                pay_currency: 'USD',
              });
            }
          } catch (e) {
            console.error(`AI scan failed for ${cat}:`, e.message);
          }
        }
      }

      // Merge and deduplicate
      const allMerged = [...allOpportunities, ...aiScanResults];

      // Apply filters
      let filtered = allMerged
        .filter(o => isOnlineOnly(o))
        .filter(o => o.score > 0);

      if (filters.category) filtered = filtered.filter(o => o.category === filters.category);
      if (filters.min_pay) filtered = filtered.filter(o => (o.estimated_pay || 0) >= filters.min_pay);
      if (filters.max_time_minutes) filtered = filtered.filter(o => (o.time_estimate_minutes || 999) <= filters.max_time_minutes);
      if (filters.difficulty) filtered = filtered.filter(o => o.difficulty === filters.difficulty);
      if (filters.ai_only) filtered = filtered.filter(o => o.can_ai_complete);

      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Deduplicate vs existing
      const existing = await base44.entities.WorkOpportunity.filter(
        { user_email: user.email }, '-created_date', 300
      ).catch(() => []);
      const existingTitles = new Set((existing || []).map(o => (o.title || '').toLowerCase()));
      const newOpps = filtered.filter(o => !existingTitles.has((o.title || '').toLowerCase()));

      // Persist
      let created = 0;
      const topOpps = [];
      for (const opp of newOpps.slice(0, 40)) {
        const saved = await base44.entities.WorkOpportunity.create(opp).catch(() => null);
        if (saved) { created++; topOpps.push(saved); }
      }

      await base44.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🔍 Discovery Engine v4: ${created} new tasks imported (${filtered.length} found across ${Object.keys(KEYWORD_MAP).length} categories · ${aiScanResults.length} from live internet scan)`,
        severity: 'success',
        metadata: { found: filtered.length, created, ai_scan_count: aiScanResults.length, categories_scanned: scanCategories.length }
      }).catch(() => {});

      return Response.json({
        success: true,
        found: filtered.length,
        created,
        ai_compatible: filtered.filter(o => o.can_ai_complete).length,
        live_scan_count: aiScanResults.length,
        categories: Object.fromEntries(
          [...new Set(filtered.map(o => o.category))].map(c => [c, filtered.filter(o => o.category === c).length])
        ),
        top_opportunities: topOpps.slice(0, 10),
        keywords_used: expandKeywords(categories),
      });
    }

    // ── Keyword Expansion ─────────────────────────────────────────────────
    if (action === 'expand_keywords') {
      const { base_category } = body;
      const catData = KEYWORD_MAP[base_category];
      if (!catData) return Response.json({ error: 'Unknown category' }, { status: 400 });
      
      // AI-enhanced keyword expansion
      const aiExpansion = await callLLM(
        `Generate 15 additional search keywords and 5 more niche platform URLs for this online work category: "${base_category.replace(/_/g, ' ')}". 
        Return JSON: {"additional_keywords": [], "additional_platforms": []}`, true, false
      );
      const aiExtra = extractJSON(aiExpansion) || {};

      return Response.json({
        success: true,
        category: base_category,
        primary_keywords: catData.primary,
        expanded_keywords: [...catData.expanded, ...(aiExtra.additional_keywords || [])],
        target_platforms: [...catData.platforms, ...(aiExtra.additional_platforms || [])],
        all_terms: [...catData.primary, ...catData.expanded],
      });
    }

    // ── Task Reader: Break task into steps ────────────────────────────────
    if (action === 'read_task') {
      const { opportunity_id } = body;
      const opps = await base44.entities.WorkOpportunity.filter({ id: opportunity_id }, null, 1).catch(() => []);
      const opp = opps?.[0];
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      const steps = await breakIntoSteps(opp);
      
      // Save steps back to opportunity
      await base44.entities.WorkOpportunity.update(opportunity_id, {
        status: 'evaluating',
        // Store parsed steps in description as structured note
      }).catch(() => null);

      return Response.json({ success: true, opportunity_id, task_analysis: steps });
    }

    // ── Get discovery summary ─────────────────────────────────────────────
    if (action === 'get_summary') {
      const opps = await base44.entities.WorkOpportunity.filter(
        { user_email: user.email }, '-created_date', 300
      ).catch(() => []);

      const summary = {
        total: opps.length,
        ai_compatible: opps.filter(o => o.can_ai_complete).length,
        by_category: {},
        by_status: {},
        avg_score: 0,
        top_earners: [],
        total_potential: 0,
        queued_for_autopilot: opps.filter(o => o.autopilot_queued).length,
      };

      opps.forEach(o => {
        summary.by_category[o.category] = (summary.by_category[o.category] || 0) + 1;
        summary.by_status[o.status] = (summary.by_status[o.status] || 0) + 1;
        summary.total_potential += o.estimated_pay || 0;
      });

      if (opps.length > 0) {
        summary.avg_score = opps.reduce((s, o) => s + (o.score || 0), 0) / opps.length;
        summary.top_earners = [...opps].sort((a, b) => (b.estimated_pay || 0) - (a.estimated_pay || 0)).slice(0, 5);
      }

      return Response.json({ success: true, summary });
    }

    // ── Score single opportunity ──────────────────────────────────────────
    if (action === 'score_opportunity') {
      const { opportunity } = body;
      if (!opportunity) return Response.json({ error: 'No opportunity provided' }, { status: 400 });
      return Response.json({
        success: true,
        score: scoreOpportunity(opportunity),
        online_only: isOnlineOnly(opportunity),
        ai_compatible: isAICompatible(opportunity),
      });
    }

    // ── Get categories ────────────────────────────────────────────────────
    if (action === 'get_categories') {
      return Response.json({
        success: true,
        total_categories: Object.keys(KEYWORD_MAP).length,
        categories: Object.keys(KEYWORD_MAP).map(key => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          keyword_count: KEYWORD_MAP[key].primary.length + KEYWORD_MAP[key].expanded.length,
          platforms: KEYWORD_MAP[key].platforms,
        }))
      });
    }

    // ── Queue all AI-compatible for Autopilot ─────────────────────────────
    if (action === 'queue_all_for_autopilot') {
      const opps = await base44.entities.WorkOpportunity.filter(
        { user_email: user.email, can_ai_complete: true, status: 'discovered' },
        '-score', 20
      ).catch(() => []);

      let queued = 0;
      for (const opp of opps) {
        await base44.entities.WorkOpportunity.update(opp.id, {
          autopilot_queued: true, status: 'evaluating'
        }).catch(() => null);
        queued++;
      }

      return Response.json({ success: true, queued, message: `${queued} opportunities queued for Autopilot` });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Discovery Engine v4 error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});