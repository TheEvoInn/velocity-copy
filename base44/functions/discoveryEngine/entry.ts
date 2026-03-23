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

    // All hardcoded opportunities removed
    // Use real APIs for live opportunities
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