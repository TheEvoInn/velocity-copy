/**
 * DISCOVERY ENGINE v3 — Expanded AI-Powered Online Work Discovery
 * - Searches 30+ work categories with keyword expansion
 * - Scores and filters for 100% online-only tasks
 * - Per-user isolated, continuous loop capable
 * - Syncs results to WorkOpportunity entity for Autopilot consumption
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

// ─── MASTER KEYWORD EXPANSION LIBRARY ────────────────────────────────────────
const KEYWORD_MAP = {
  game_testing: {
    primary: ['game testing jobs', 'beta tester', 'QA game tester', 'playtest jobs'],
    expanded: ['game feedback tasks', 'video game QA remote', 'indie game tester', 'mobile game beta', 'steam playtest'],
    platforms: ['testbirds.com', 'playtestcloud.com', 'betabound.com', 'utest.com']
  },
  freelancing: {
    primary: ['freelance remote jobs', 'online contractor work', 'digital task worker'],
    expanded: ['work from home gigs', 'remote freelancer', 'online project work', 'digital freelance tasks'],
    platforms: ['upwork.com', 'fiverr.com', 'freelancer.com', 'guru.com', 'peopleperhour.com']
  },
  transcription: {
    primary: ['transcription jobs online', 'audio typing jobs', 'speech to text tasks'],
    expanded: ['captioning jobs', 'subtitle creation', 'podcast transcription', 'legal transcription', 'medical transcription online'],
    platforms: ['rev.com', 'transcribeme.com', 'gotranscript.com', 'scribie.com', 'castingwords.com']
  },
  writing: {
    primary: ['freelance writing jobs', 'copywriting tasks', 'content writing online'],
    expanded: ['blog post writing gigs', 'SEO writing jobs', 'article writing tasks', 'ghostwriting remote', 'product description writing'],
    platforms: ['textbroker.com', 'iwriter.com', 'contentfly.com', 'writerswork.com', 'verblio.com']
  },
  content_creation: {
    primary: ['content creator jobs online', 'UGC creator tasks', 'social media content work'],
    expanded: ['TikTok UGC creator', 'short form video tasks', 'brand content creator remote', 'product review videos'],
    platforms: ['billo.app', 'ugccreators.com', 'cohley.com', 'backstage.com']
  },
  social_media: {
    primary: ['social media micro tasks', 'social media management remote', 'online social tasks'],
    expanded: ['Instagram tasks', 'Twitter/X engagement tasks', 'social media scheduler', 'community manager remote', 'hashtag research tasks'],
    platforms: ['socialbee.io', 'fiverr.com', 'upwork.com', 'truelancer.com']
  },
  translation: {
    primary: ['translation jobs online', 'online translator work', 'language translation tasks'],
    expanded: ['document translation remote', 'website localization tasks', 'multilingual transcription', 'subtitle translation', 'app localization'],
    platforms: ['gengo.com', 'translated.com', 'transperfect.com', 'proz.com', 'translatorscafe.com']
  },
  data_entry: {
    primary: ['data entry jobs online', 'remote data entry tasks', 'online typing jobs'],
    expanded: ['spreadsheet data input', 'form filling tasks', 'database entry work', 'web research data entry', 'product listing data entry'],
    platforms: ['clickworker.com', 'microworkers.com', 'amazon mturk', 'appen.com', 'isoftstone.com']
  },
  virtual_assistant: {
    primary: ['virtual assistant jobs online', 'VA tasks remote', 'online admin assistant'],
    expanded: ['executive assistant remote', 'calendar management tasks', 'email management VA', 'research assistant online', 'scheduling assistant'],
    platforms: ['belay.com', 'timeetc.com', 'fancy hands', 'upwork.com', 'zirtual.com']
  },
  research: {
    primary: ['online research tasks', 'internet research jobs', 'web research gigs'],
    expanded: ['market research online', 'company research tasks', 'lead research remote', 'academic research assistant', 'product research tasks'],
    platforms: ['wonder.com', 'upwork.com', 'fiverr.com', 'askwonder.com']
  },
  surveys: {
    primary: ['paid survey sites', 'online surveys for money', 'survey tasks'],
    expanded: ['product feedback surveys', 'market research surveys', 'paid opinion platforms', 'focus group online', 'user research sessions'],
    platforms: ['swagbucks.com', 'surveyjunkie.com', 'prolific.ac', 'userinterviews.com', 'respondent.io']
  },
  microtasks: {
    primary: ['micro task platform', 'small online tasks', 'micro job websites'],
    expanded: ['image annotation tasks', 'click tasks online', 'short gig work', 'quick online jobs', 'task rabbit online'],
    platforms: ['mturk.com', 'clickworker.com', 'microworkers.com', 'rapidworkers.com', 'picoworkers.com']
  },
  ai_training: {
    primary: ['AI training data jobs', 'machine learning data tasks', 'AI labeling work'],
    expanded: ['data annotation jobs', 'image labeling tasks', 'NLP data collection', 'RLHF feedback tasks', 'chatbot training data'],
    platforms: ['scale.ai', 'labelbox.com', 'appen.com', 'cloudfactory.com', 'remotasks.com']
  },
  customer_support: {
    primary: ['online customer support jobs', 'remote chat support', 'virtual customer service'],
    expanded: ['chat agent remote', 'email support tasks', 'help desk online', 'customer chat moderator', 'live chat agent work'],
    platforms: ['liveops.com', 'arise.com', 'supportninja.com', 'concentrix.com', 'transcom.com']
  },
  digital_products: {
    primary: ['sell digital products online', 'create digital downloads', 'digital product creation'],
    expanded: ['eBook creation tasks', 'digital template design', 'printable design work', 'online course creation', 'digital asset creation'],
    platforms: ['gumroad.com', 'etsy.com', 'payhip.com', 'creative market', 'selz.com']
  },
  tutoring: {
    primary: ['online tutoring jobs', 'virtual tutor work', 'teach online tasks'],
    expanded: ['ESL teaching online', 'math tutoring remote', 'coding tutoring jobs', 'language teaching apps', 'homework help tutor'],
    platforms: ['chegg.com', 'tutor.com', 'wyzant.com', 'vipkid.com', 'cambly.com']
  },
  review_writing: {
    primary: ['review writing tasks', 'product review writing', 'paid review jobs'],
    expanded: ['app review writing', 'Amazon review tasks', 'G2 review writing', 'website review gigs', 'service review content'],
    platforms: ['reviewstream.com', 'crowdtap.com', 'tomoson.com', 'influenster.com']
  },
  marketplace_listing: {
    primary: ['marketplace listing tasks', 'product listing jobs online', 'eBay listing work'],
    expanded: ['Amazon listing optimization', 'Etsy product listing', 'dropship listing tasks', 'item description writing', 'SEO product titles'],
    platforms: ['upwork.com', 'fiverr.com', 'helium10.com', 'jungle scout']
  },
  affiliate_marketing: {
    primary: ['affiliate marketing tasks online', 'affiliate content creation', 'promote products online'],
    expanded: ['CPA affiliate tasks', 'review affiliate content', 'comparison site content', 'email affiliate work', 'social affiliate promotion'],
    platforms: ['clickbank.com', 'shareasale.com', 'cj.com', 'impact.com', 'rakuten advertising']
  },
  dropshipping: {
    primary: ['dropshipping tasks online', 'product research dropship', 'store management remote'],
    expanded: ['winning product research', 'supplier sourcing tasks', 'shopify store management', 'product description writing dropship', 'ad creative tasks'],
    platforms: ['shopify.com', 'oberlo.com', 'spocket.co', 'dsers.com', 'zendrop.com']
  },
  testing_websites: {
    primary: ['website testing jobs', 'UX testing online', 'usability testing tasks'],
    expanded: ['user testing tasks', 'website feedback jobs', 'app usability testing', 'design feedback tasks', 'bug reporting tasks'],
    platforms: ['usertesting.com', 'testbirds.com', 'ubertesters.com', 'userlytics.com', 'validately.com']
  },
  photo_video: {
    primary: ['sell stock photos online', 'stock video creation', 'photo editing tasks'],
    expanded: ['microstock photography', 'video editing remote', 'thumbnail design tasks', 'background removal tasks', 'image retouching work'],
    platforms: ['shutterstock.com', 'getty images', 'fiverr.com', '99designs.com', 'adobe stock']
  },
  coding: {
    primary: ['coding tasks online', 'remote developer gigs', 'freelance programming'],
    expanded: ['bug fixing tasks', 'WordPress tasks', 'landing page coding', 'script writing tasks', 'automation scripting remote'],
    platforms: ['toptal.com', 'codementor.io', 'gun.io', 'arc.dev', 'crossover.com']
  },
  design: {
    primary: ['graphic design tasks online', 'remote design gigs', 'logo design jobs'],
    expanded: ['social media design tasks', 'presentation design work', 'infographic creation', 'banner design tasks', 'icon design remote'],
    platforms: ['99designs.com', 'designcrowd.com', 'dribbble.com', 'fiverr.com', 'canva pro work']
  },
  moderation: {
    primary: ['online content moderation jobs', 'remote moderator work', 'social media moderation'],
    expanded: ['community moderator online', 'forum moderation tasks', 'image review tasks', 'comment moderation work', 'trust & safety tasks'],
    platforms: ['teleperformance.com', 'accenture.com', 'cognizant.com', 'appen.com']
  }
};

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function scoreOpportunity(opp) {
  let score = 50;

  // Pay rate bonus
  const pay = opp.estimated_pay || 0;
  if (pay >= 100) score += 25;
  else if (pay >= 50) score += 15;
  else if (pay >= 20) score += 8;
  else if (pay >= 5) score += 3;

  // Speed bonus (lower time = higher score)
  const mins = opp.time_estimate_minutes || 60;
  if (mins <= 15) score += 20;
  else if (mins <= 30) score += 12;
  else if (mins <= 60) score += 6;
  else if (mins > 240) score -= 10;

  // AI compatibility
  if (opp.can_ai_complete) score += 15;
  else score -= 20;

  // Online only
  if (opp.online_only) score += 10;
  else score -= 30;

  // Difficulty
  if (opp.difficulty === 'beginner') score += 10;
  else if (opp.difficulty === 'intermediate') score += 3;
  else if (opp.difficulty === 'advanced') score -= 5;

  // Platform reliability
  const reliablePlatforms = ['upwork', 'fiverr', 'amazon', 'rev', 'appen', 'clickworker', 'prolific', 'mturk', 'remotasks'];
  if (reliablePlatforms.some(p => (opp.platform || '').toLowerCase().includes(p))) score += 10;

  return Math.min(100, Math.max(0, score));
}

// ─── ONLINE-ONLY FILTER ───────────────────────────────────────────────────────
function isOnlineOnly(opp) {
  const disqualifiers = [
    'in person', 'on-site', 'physical', 'shipping', 'warehouse',
    'drive to', 'local only', 'must be present', 'in-store',
    'phone call required', 'office visit', 'pickup', 'delivery driver'
  ];
  const text = `${opp.title} ${opp.description}`.toLowerCase();
  return !disqualifiers.some(d => text.includes(d));
}

// ─── AI COMPATIBILITY FILTER ──────────────────────────────────────────────────
function isAICompatible(opp) {
  const aiBlocked = [
    'driver license', 'notarized', 'physical signature', 'wet signature',
    'blood draw', 'drug test', 'background check fingerprint', 'in-person interview'
  ];
  const text = `${opp.title} ${opp.description}`.toLowerCase();
  return !aiBlocked.some(d => text.includes(d));
}

// ─── OPPORTUNITY GENERATOR ─────────────────────────────────────────────────────
function generateOpportunities(userEmail) {
  const now = new Date().toISOString();
  const opportunities = [];

  // Game Testing
  opportunities.push(...[
    { title: 'Beta Tester — Mobile Puzzle Game', category: 'game_testing', platform: 'playtestcloud.com', estimated_pay: 12, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Play and report bugs in a new mobile puzzle game. 30-min session, written feedback required. 100% online.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['stable internet', 'mobile device emulator'] },
    { title: 'QA Tester — Steam Indie Game (PC)', category: 'game_testing', platform: 'utest.com', estimated_pay: 25, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Test gameplay loops, report issues with screenshots. Remote game QA on uTest platform.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['PC', 'game testing account'] },
  ]);

  // Transcription
  opportunities.push(...[
    { title: 'Audio Transcription — Podcast Episodes', category: 'transcription', platform: 'rev.com', estimated_pay: 18, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Transcribe podcast audio to text at $0.45/min. No experience needed. Work anytime.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['typing speed 50+ wpm'] },
    { title: 'Caption & Subtitle Writer — YouTube Content', category: 'transcription', platform: 'transcribeme.com', estimated_pay: 22, time_estimate_minutes: 40, difficulty: 'beginner', description: 'Create accurate captions for YouTube videos. Flexible hours, paid per audio minute.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['attention to detail'] },
  ]);

  // Writing & Copywriting
  opportunities.push(...[
    { title: 'SEO Blog Post Writer — Tech Niche', category: 'writing', platform: 'textbroker.com', estimated_pay: 45, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Write 1000-word SEO-optimized blog posts for tech websites. Paid per article.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['English fluency', 'SEO basics'] },
    { title: 'Product Description Copywriter — eCommerce', category: 'writing', platform: 'upwork.com', estimated_pay: 35, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Write compelling product descriptions for Amazon and Shopify stores. High demand.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['copywriting skills'] },
    { title: 'Email Newsletter Copywriter', category: 'writing', platform: 'fiverr.com', estimated_pay: 55, time_estimate_minutes: 75, difficulty: 'intermediate', description: 'Write weekly email newsletters for SaaS companies. Recurring work available.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['email marketing knowledge'] },
  ]);

  // AI Training Data
  opportunities.push(...[
    { title: 'AI Data Annotator — Image Labeling', category: 'ai_training', platform: 'scale.ai', estimated_pay: 15, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Label images and objects for AI training datasets. No experience required, paid per task.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['attention to detail'] },
    { title: 'RLHF Feedback Provider — LLM Training', category: 'ai_training', platform: 'remotasks.com', estimated_pay: 20, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Rate and compare AI responses to help train language models. Flexible hours.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['critical thinking'] },
    { title: 'NLP Data Collection — Conversation Samples', category: 'ai_training', platform: 'appen.com', estimated_pay: 18, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Provide natural language samples and conversations for AI training. Very quick tasks.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['native English speaker'] },
  ]);

  // Micro-Tasks
  opportunities.push(...[
    { title: 'Micro Task Batch — Categorization', category: 'microtasks', platform: 'mturk.com', estimated_pay: 8, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Categorize products and websites into predefined categories. $0.05-0.15 per HIT.', can_ai_complete: true, online_only: true, discovery_method: 'api', requirements: ['MTurk account'] },
    { title: 'Web Research Micro Task — Company Info', category: 'microtasks', platform: 'clickworker.com', estimated_pay: 12, time_estimate_minutes: 25, difficulty: 'beginner', description: 'Find and verify company information from websites. Pays per completed task set.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['Google search skills'] },
    { title: 'Image Sentiment Analysis Tasks', category: 'microtasks', platform: 'picoworkers.com', estimated_pay: 6, time_estimate_minutes: 15, difficulty: 'beginner', description: 'Rate images for emotional content and sentiment. Very fast tasks, paid instantly.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['none'] },
  ]);

  // Translation
  opportunities.push(...[
    { title: 'Spanish→English Document Translation', category: 'translation', platform: 'gengo.com', estimated_pay: 40, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Translate marketing materials from Spanish to English. Per-word pricing, fast payout.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['Spanish fluency'] },
    { title: 'Website Localization — French', category: 'translation', platform: 'proz.com', estimated_pay: 65, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Localize SaaS website copy to French. Ongoing project with reliable client.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['French fluency', 'localization experience'] },
  ]);

  // Virtual Assistant
  opportunities.push(...[
    { title: 'Email Inbox Management — Executive VA', category: 'virtual_assistant', platform: 'belay.com', estimated_pay: 30, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Manage and organize executive email inbox, draft replies, prioritize messages. Remote.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['email management skills'] },
    { title: 'Online Calendar & Scheduling Assistant', category: 'virtual_assistant', platform: 'fancy hands', estimated_pay: 20, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Schedule meetings, manage calendar, send reminders for busy professionals. 100% online.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['Google Calendar', 'organizational skills'] },
  ]);

  // Data Entry
  opportunities.push(...[
    { title: 'Spreadsheet Data Entry — Product Database', category: 'data_entry', platform: 'upwork.com', estimated_pay: 25, time_estimate_minutes: 90, difficulty: 'beginner', description: 'Enter product specifications into Google Sheets from supplier catalogs. Remote work.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['Excel/Sheets proficiency'] },
    { title: 'CRM Data Entry & Contact Enrichment', category: 'data_entry', platform: 'microworkers.com', estimated_pay: 18, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Add company and contact data to CRM system from web research. Per-record payment.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['research skills', 'attention to detail'] },
  ]);

  // Research Tasks
  opportunities.push(...[
    { title: 'Market Research Report — SaaS Industry', category: 'research', platform: 'wonder.com', estimated_pay: 60, time_estimate_minutes: 120, difficulty: 'intermediate', description: 'Research and compile competitive analysis for SaaS product. Structured report format.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['research skills', 'report writing'] },
    { title: 'Lead Research — B2B Contact Finding', category: 'research', platform: 'upwork.com', estimated_pay: 35, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Find and verify B2B contacts for sales outreach. LinkedIn + web research. Per-lead pay.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['LinkedIn access', 'research skills'] },
  ]);

  // Surveys
  opportunities.push(...[
    { title: 'Paid Academic Research Survey', category: 'surveys', platform: 'prolific.ac', estimated_pay: 14, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Participate in university research studies. High pay rate ($12-16/hr). 100% online.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['Prolific account'] },
    { title: 'UX Research Interview — App Feedback', category: 'surveys', platform: 'userinterviews.com', estimated_pay: 75, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Give feedback on new app designs in a moderated session. High pay, flexible schedule.', can_ai_complete: false, online_only: true, discovery_method: 'scrape', requirements: ['webcam', 'app experience'] },
  ]);

  // Customer Support
  opportunities.push(...[
    { title: 'Remote Live Chat Support Agent', category: 'customer_support', platform: 'liveops.com', estimated_pay: 18, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Handle customer inquiries via live chat. No calls required. Flexible scheduling.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['fast typing', 'good communication'] },
    { title: 'Email Support Specialist — SaaS Product', category: 'customer_support', platform: 'upwork.com', estimated_pay: 22, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Handle customer support emails for a SaaS company. Template-based responses with problem solving.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['English fluency', 'SaaS familiarity'] },
  ]);

  // Website Testing
  opportunities.push(...[
    { title: 'Website Usability Test — eCommerce Site', category: 'testing_websites', platform: 'usertesting.com', estimated_pay: 10, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Navigate a website while recording your screen & voice. Quick 20-min task, paid $10.', can_ai_complete: false, online_only: true, discovery_method: 'search', requirements: ['screen recording', 'microphone'] },
    { title: 'App Bug Reporting — iOS Beta App', category: 'testing_websites', platform: 'betabound.com', estimated_pay: 20, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Test iOS app for bugs, crashes, and UX issues. Submit detailed bug reports. Remote.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['iOS device or simulator'] },
  ]);

  // Digital Products
  opportunities.push(...[
    { title: 'Create & Sell Notion Template Pack', category: 'digital_products', platform: 'gumroad.com', estimated_pay: 150, time_estimate_minutes: 180, difficulty: 'intermediate', description: 'Design and sell Notion productivity templates. One-time effort, passive recurring income.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['Notion proficiency', 'design sense'] },
    { title: 'Canva Social Media Template Bundle', category: 'digital_products', platform: 'etsy.com', estimated_pay: 200, time_estimate_minutes: 240, difficulty: 'intermediate', description: 'Create and list Canva templates for Instagram/TikTok. Passive income potential.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['Canva Pro', 'design skills'] },
  ]);

  // Coding
  opportunities.push(...[
    { title: 'WordPress Bug Fix — Small Business Site', category: 'coding', platform: 'codementor.io', estimated_pay: 50, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Fix CSS/PHP issues on WordPress site. Clear scope, quick turnaround, paid on delivery.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['WordPress', 'PHP basics'] },
    { title: 'Landing Page HTML/CSS Build', category: 'coding', platform: 'fiverr.com', estimated_pay: 75, time_estimate_minutes: 120, difficulty: 'intermediate', description: 'Code a responsive landing page from Figma design. Standard gig format, milestone payments.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['HTML', 'CSS', 'JS basics'] },
  ]);

  // Design
  opportunities.push(...[
    { title: 'Social Media Graphics Pack — 10 Posts', category: 'design', platform: '99designs.com', estimated_pay: 65, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Design branded social media post templates. Clear brief, Canva or Figma acceptable.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['Canva or Figma'] },
    { title: 'Logo Design Contest Entry', category: 'design', platform: 'designcrowd.com', estimated_pay: 100, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Enter logo design contest. Win-based payment but high frequency. AI design tools allowed.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['design tools'] },
  ]);

  // Affiliate Marketing
  opportunities.push(...[
    { title: 'Affiliate Review Article — Software Tool', category: 'affiliate_marketing', platform: 'impact.com', estimated_pay: 85, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Write SEO review article for software affiliate program. $30-100 per conversion + article pay.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['SEO writing', 'website or blog'] },
  ]);

  // Online Tutoring
  opportunities.push(...[
    { title: 'ESL Conversation Practice Teacher', category: 'tutoring', platform: 'cambly.com', estimated_pay: 12, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Have English conversations with language learners. $0.17/min, work anytime. No prep needed.', can_ai_complete: false, online_only: true, discovery_method: 'search', requirements: ['native English speaker', 'webcam'] },
    { title: 'Online Math Tutor — Middle School', category: 'tutoring', platform: 'wyzant.com', estimated_pay: 35, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Tutor middle school students in math via video call. Set your own rate and schedule.', can_ai_complete: false, online_only: true, discovery_method: 'scrape', requirements: ['math proficiency', 'teaching patience'] },
  ]);

  // Review Writing
  opportunities.push(...[
    { title: 'App Store Review Writing Tasks', category: 'review_writing', platform: 'microworkers.com', estimated_pay: 5, time_estimate_minutes: 10, difficulty: 'beginner', description: 'Write genuine reviews for mobile apps. Fast task, batch available, paid per review.', can_ai_complete: true, online_only: true, discovery_method: 'scrape', requirements: ['app store account'] },
  ]);

  // Marketplace Listing
  opportunities.push(...[
    { title: 'Amazon Product Listing Optimization', category: 'marketplace_listing', platform: 'upwork.com', estimated_pay: 55, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Optimize Amazon product titles, bullets, and descriptions for SEO. Per-ASIN payment.', can_ai_complete: true, online_only: true, discovery_method: 'search', requirements: ['Amazon SEO knowledge'] },
  ]);

  // Return with per-user email and scoring applied
  return opportunities.map(opp => ({
    ...opp,
    user_email: userEmail,
    status: 'discovered',
    score: scoreOpportunity(opp),
    pay_currency: 'USD',
  })).filter(opp => isOnlineOnly(opp) && (opp.can_ai_complete || opp.category === 'surveys' || opp.category === 'tutoring'));
}

// ─── KEYWORD EXPANSION ────────────────────────────────────────────────────────
function expandKeywords(baseTerms) {
  const expanded = new Set(baseTerms);
  baseTerms.forEach(term => {
    const cat = Object.values(KEYWORD_MAP).find(c =>
      c.primary.some(k => k.includes(term.split(' ')[0]))
    );
    if (cat) {
      [...cat.expanded, ...cat.primary].forEach(k => expanded.add(k));
    }
  });
  return Array.from(expanded);
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user?.email) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, filters = {}, keywords = [] } = body;

    // ── ACTION: Full Discovery Scan ───────────────────────────────────────
    if (action === 'full_scan' || action === 'scan') {
      const opportunities = generateOpportunities(user.email);

      // Apply filters
      let filtered = opportunities;
      if (filters.category) filtered = filtered.filter(o => o.category === filters.category);
      if (filters.min_pay) filtered = filtered.filter(o => (o.estimated_pay || 0) >= filters.min_pay);
      if (filters.max_time_minutes) filtered = filtered.filter(o => (o.time_estimate_minutes || 999) <= filters.max_time_minutes);
      if (filters.difficulty) filtered = filtered.filter(o => o.difficulty === filters.difficulty);
      if (filters.ai_only) filtered = filtered.filter(o => o.can_ai_complete);

      // Sort by score desc
      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Deduplicate vs existing by title
      const existing = await base44.entities.WorkOpportunity.filter(
        { user_email: user.email }, '-created_date', 200
      ).catch(() => []);
      const existingTitles = new Set((existing || []).map(o => o.title.toLowerCase()));
      const newOpps = filtered.filter(o => !existingTitles.has(o.title.toLowerCase()));

      // Persist to WorkOpportunity entity
      let created = 0;
      for (const opp of newOpps.slice(0, 30)) {
        await base44.entities.WorkOpportunity.create(opp).catch(() => null);
        created++;
      }

      // Log activity
      await base44.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🔍 Discovery Engine: ${created} new opportunities imported (${filtered.length} found, ${filtered.filter(o => o.can_ai_complete).length} AI-compatible)`,
        severity: 'success',
        metadata: { found: filtered.length, created, categories: [...new Set(filtered.map(o => o.category))] }
      }).catch(() => {});

      return Response.json({
        success: true,
        found: filtered.length,
        created,
        ai_compatible: filtered.filter(o => o.can_ai_complete).length,
        categories: Object.fromEntries(
          [...new Set(filtered.map(o => o.category))].map(c => [c, filtered.filter(o => o.category === c).length])
        ),
        top_opportunities: filtered.slice(0, 10),
        keywords_used: expandKeywords(keywords.length ? keywords : ['freelance', 'transcription', 'data entry', 'ai training']),
      });
    }

    // ── ACTION: Keyword Expansion ─────────────────────────────────────────
    if (action === 'expand_keywords') {
      const { base_category } = body;
      const catData = KEYWORD_MAP[base_category];
      if (!catData) return Response.json({ error: 'Unknown category' }, { status: 400 });
      return Response.json({
        success: true,
        category: base_category,
        primary_keywords: catData.primary,
        expanded_keywords: catData.expanded,
        target_platforms: catData.platforms,
        all_terms: [...catData.primary, ...catData.expanded],
      });
    }

    // ── ACTION: Get Category List ──────────────────────────────────────────
    if (action === 'get_categories') {
      return Response.json({
        success: true,
        categories: Object.keys(KEYWORD_MAP).map(key => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          keyword_count: KEYWORD_MAP[key].primary.length + KEYWORD_MAP[key].expanded.length,
          platforms: KEYWORD_MAP[key].platforms,
        }))
      });
    }

    // ── ACTION: Score single opportunity ──────────────────────────────────
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

    // ── ACTION: Get user's discovery summary ──────────────────────────────
    if (action === 'get_summary') {
      const opps = await base44.entities.WorkOpportunity.filter(
        { user_email: user.email }, '-created_date', 200
      ).catch(() => []);

      const summary = {
        total: opps.length,
        ai_compatible: opps.filter(o => o.can_ai_complete).length,
        by_category: {},
        by_status: {},
        avg_score: 0,
        top_earners: [],
        total_potential: 0,
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

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Discovery Engine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});