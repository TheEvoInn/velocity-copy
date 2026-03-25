/**
 * DISCOVERY ENGINE v5 — VELO AI Massive Internet Scanner
 * - 45+ opportunity categories
 * - 700+ targeted keywords
 * - 150+ platform targets
 * - AI-powered live internet scan (Gemini w/ Google Search)
 * - User skill + goal personalization
 * - Full scoring, dedup, and Autopilot feed
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Module-level client ref — set on each request for use in helper functions
let _base44 = null;

// ─── LLM HELPER — uses Base44 InvokeLLM (no quota issues) ────────────────────
async function callLLM(prompt, jsonMode = false, useInternet = true) {
  try {
    if (!_base44) throw new Error('No base44 client');
    const res = await _base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      add_context_from_internet: useInternet,
      model: useInternet ? 'gemini_3_flash' : undefined,
    });
    if (typeof res === 'string') return res;
    if (res?.content) return res.content;
    if (res?.text) return res.text;
    return String(res);
  } catch (e) {
    console.error('InvokeLLM error:', e.message);
    return null;
  }
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

// ─── MASTER KEYWORD MAP v5 — 45+ categories, 700+ terms ──────────────────────
const KEYWORD_MAP = {
  ai_training: {
    primary: ['AI training data jobs', 'machine learning data tasks', 'AI labeling work', 'RLHF feedback tasks', 'AI model evaluation'],
    expanded: ['data annotation remote', 'image labeling tasks', 'NLP data collection', 'chatbot training data', 'AI preference ranking', 'red-teaming AI jobs', 'AI safety evaluator', 'LLM output rating', 'synthetic data generation', 'AI conversation training', 'text classification tasks', 'prompt evaluation tasks', 'AI benchmark testing'],
    platforms: ['scale.ai', 'labelbox.com', 'appen.com', 'cloudfactory.com', 'remotasks.com', 'surge.ai', 'alignerr.com', 'outlier.ai', 'toloka.ai', 'taskus.com', 'lionbridge.com', 'defined.ai']
  },
  freelancing: {
    primary: ['freelance remote jobs', 'online contractor work', 'digital task worker', 'work from home gigs'],
    expanded: ['remote freelancer platform', 'online project work', 'digital freelance tasks', 'gig economy online', 'part-time remote contract', 'hourly freelance work', 'project-based work', 'freelance marketplace', 'independent contractor online', 'remote skilled work'],
    platforms: ['upwork.com', 'fiverr.com', 'freelancer.com', 'guru.com', 'peopleperhour.com', 'toptal.com', 'truelancer.com', 'workhoppers.com', 'servicescape.com', 'bark.com', '99designs.com']
  },
  transcription: {
    primary: ['transcription jobs online', 'audio typing jobs', 'speech to text tasks'],
    expanded: ['captioning jobs remote', 'subtitle creation freelance', 'podcast transcription work', 'legal transcription online', 'medical transcription remote', 'interview transcription gigs', 'audio to text freelance', 'video transcription tasks', 'closed captioning gigs', 'CART transcription', 'verbatim transcription online', 'deposition transcription remote'],
    platforms: ['rev.com', 'transcribeme.com', 'gotranscript.com', 'scribie.com', 'castingwords.com', 'verbit.ai', 'tigerfish.com', 'speechpad.com', 'crowdsurf.net', 'gmr-transcription.com']
  },
  writing: {
    primary: ['freelance writing jobs', 'copywriting tasks', 'content writing online'],
    expanded: ['blog post writing gigs', 'SEO content writing jobs', 'article writing tasks', 'ghostwriting remote', 'product description writing', 'technical writing freelance', 'white paper writing', 'UX writing jobs', 'email copywriting gigs', 'long-form content writing', 'press release writing', 'grant writing online', 'newsletter writing tasks', 'case study writing remote', 'thought leadership writing'],
    platforms: ['textbroker.com', 'iwriter.com', 'contentfly.com', 'writerswork.com', 'verblio.com', 'constant-content.com', 'skyword.com', 'contently.com', 'clearvoice.com', 'scripted.com', 'nDash.com']
  },
  content_creation: {
    primary: ['content creator jobs online', 'UGC creator tasks', 'social media content work'],
    expanded: ['TikTok UGC creator paid', 'short form video tasks', 'brand content creator remote', 'product review videos paid', 'YouTube content tasks', 'Instagram Reels creator', 'podcast content creator', 'faceless content creator', 'sponsored content creator', 'brand ambassador creator', 'video ad creator', 'lifestyle content work'],
    platforms: ['billo.app', 'ugccreators.com', 'cohley.com', 'backstage.com', 'skeepers.io', 'minisocial.com', 'insense.pro', 'tomoson.com', 'trend.io', 'grin.co']
  },
  social_media: {
    primary: ['social media micro tasks', 'social media management remote', 'online social tasks'],
    expanded: ['Instagram management tasks', 'Twitter/X strategy remote', 'social media scheduler', 'community manager remote', 'hashtag research tasks', 'Pinterest management remote', 'LinkedIn content tasks', 'TikTok account management', 'Facebook ads management', 'YouTube channel management', 'social listening tasks', 'engagement growth tasks'],
    platforms: ['socialbee.io', 'fiverr.com', 'upwork.com', 'truelancer.com', 'hire-a-nerd.com', 'solid-gigs.com', 'working-not-working.com']
  },
  translation: {
    primary: ['translation jobs online', 'online translator work', 'language translation tasks'],
    expanded: ['document translation remote', 'website localization tasks', 'multilingual transcription', 'subtitle translation jobs', 'app localization work', 'legal translation remote', 'technical translation freelance', 'financial document translation', 'marketing translation tasks', 'medical translation online', 'game localization work', 'software UI translation'],
    platforms: ['gengo.com', 'translated.com', 'transperfect.com', 'proz.com', 'translatorscafe.com', 'one-hour-translation.com', 'smartling.com', 'bureau-works.com', 'straker.co', 'languageline.com']
  },
  data_entry: {
    primary: ['data entry jobs online', 'remote data entry tasks', 'online typing jobs'],
    expanded: ['spreadsheet data input', 'form filling tasks online', 'database entry work', 'web research data entry', 'product listing data entry', 'CRM data entry remote', 'OCR data correction', 'ecommerce catalog data entry', 'contact list building', 'company info research', 'data mining tasks online', 'document digitization remote'],
    platforms: ['clickworker.com', 'microworkers.com', 'mturk.com', 'appen.com', 'isoftstone.com', 'rapidworkers.com', 'picoworkers.com', 'axion-data.com', 'virtual-bee.com', 'smart-crowd.com']
  },
  virtual_assistant: {
    primary: ['virtual assistant jobs online', 'VA tasks remote', 'online admin assistant'],
    expanded: ['executive assistant remote', 'calendar management tasks', 'email management VA work', 'research assistant online', 'scheduling assistant remote', 'Shopify VA tasks', 'ecommerce assistant work', 'travel planning VA', 'real estate VA tasks', 'medical VA remote', 'inbox management VA', 'lead generation VA'],
    platforms: ['belay.com', 'timeetc.com', 'fancyhands.com', 'upwork.com', 'zirtual.com', 'boldly.com', 'wing.com', 'mytasker.com', 'uassistme.co', 'ossisto.com', 'vapro.com']
  },
  research: {
    primary: ['online research tasks', 'internet research jobs', 'web research gigs'],
    expanded: ['market research online', 'company research tasks', 'lead research remote', 'academic research assistant', 'product research tasks', 'competitor analysis tasks', 'fact-checking tasks', 'industry research report', 'news research freelance', 'patent research remote', 'investment research tasks', 'due diligence research online'],
    platforms: ['wonder.com', 'upwork.com', 'fiverr.com', 'askwonder.com', 'techsparq.com', 'researchamerica.org', 'gartner.com', 'dialectica.com']
  },
  surveys: {
    primary: ['paid survey sites', 'online surveys for money', 'survey tasks paid'],
    expanded: ['product feedback surveys', 'market research surveys paid', 'paid opinion platforms', 'focus group online paid', 'user research sessions paid', 'ethnographic study online', 'diary study paid', 'concept testing surveys', 'usability test surveys', 'brand perception surveys', 'healthcare surveys paid'],
    platforms: ['prolific.ac', 'userinterviews.com', 'respondent.io', 'surveyjunkie.com', 'swagbucks.com', 'pineconeresearch.com', 'mindswarms.com', 'focusgroup.com', 'fieldwork.com', 'itracks.com', 'plaid.com/surveys']
  },
  microtasks: {
    primary: ['micro task platform', 'small online tasks', 'micro job websites'],
    expanded: ['image annotation tasks', 'click tasks online', 'short gig work', 'quick online jobs', 'CAPTCHA solving tasks', 'sentiment tagging tasks', 'text classification microtasks', 'audio review tasks', 'web scraping microtasks', 'data verification tasks', 'entity extraction tasks', 'content moderation microtasks'],
    platforms: ['mturk.com', 'clickworker.com', 'microworkers.com', 'rapidworkers.com', 'picoworkers.com', 'spare5.com', 'hive.com', 'figure-eight.com', 'playment.io', 'super-annotate.com']
  },
  customer_support: {
    primary: ['online customer support jobs', 'remote chat support', 'virtual customer service'],
    expanded: ['chat agent remote', 'email support tasks', 'help desk online', 'customer chat moderator', 'live chat agent work', 'e-commerce support remote', 'technical support chat', 'SaaS customer success', 'inbound calls remote', 'ticket resolution remote', 'customer onboarding support', 'refund handling support tasks'],
    platforms: ['liveops.com', 'arise.com', 'supportninja.com', 'concentrix.com', 'transcom.com', 'working-solutions.com', 'teletech.com', 'alorica.com', 'sitel.com', 'foundever.com']
  },
  digital_products: {
    primary: ['sell digital products online', 'create digital downloads', 'digital product creation'],
    expanded: ['eBook creation tasks', 'digital template design', 'printable design work', 'online course creation', 'digital asset creation', 'Notion template creation', 'AI-generated art products', 'prompt packs for sale', 'Canva template creation', 'Excel spreadsheet templates', 'digital planner creation', 'Lightroom preset packs', 'music sample packs'],
    platforms: ['gumroad.com', 'etsy.com', 'payhip.com', 'creativemarket.com', 'ko-fi.com', 'lemonsqueezy.com', 'sellfy.com', 'shopify.com', 'sendowl.com', 'podia.com', 'teachable.com', 'thinkific.com']
  },
  tutoring: {
    primary: ['online tutoring jobs', 'virtual tutor work', 'teach online tasks'],
    expanded: ['ESL teaching online', 'math tutoring remote', 'coding bootcamp tutoring', 'language teaching apps', 'homework help tutor', 'SAT/ACT prep tutor', 'STEM tutor remote', 'college essay coaching', 'test prep tutoring', 'music lessons online', 'art instruction online', 'fitness coaching remote'],
    platforms: ['chegg.com', 'tutor.com', 'wyzant.com', 'cambly.com', 'preply.com', 'italki.com', 'skooli.com', 'tutorme.com', 'varsitytutors.com', 'teachaway.com', 'verbling.com', 'outschool.com']
  },
  review_writing: {
    primary: ['review writing tasks', 'product review writing', 'paid review jobs'],
    expanded: ['app review writing paid', 'G2 reviewer incentives', 'website review gigs', 'software review content', 'book review writing paid', 'Trustpilot review tasks', 'Glassdoor review incentives', 'Amazon product review', 'Google Maps review work', 'App Store review tasks'],
    platforms: ['reviewstream.com', 'crowdtap.com', 'tomoson.com', 'influenster.com', 'g2.com', 'capterra.com', 'getapp.com', 'software-advice.com']
  },
  marketplace_listing: {
    primary: ['marketplace listing tasks', 'product listing jobs online', 'eBay listing work'],
    expanded: ['Amazon listing optimization', 'Etsy product listing', 'dropship listing tasks', 'item description writing', 'SEO product titles Amazon', 'Amazon A+ content writing', 'Walmart product listing', 'Shopify product upload', 'eBay auction listing', 'Poshmark listing work', 'Depop seller tasks', 'Mercari listing tasks'],
    platforms: ['upwork.com', 'fiverr.com', 'helium10.com', 'junglescout.com', 'sellbrite.com', 'channelAdvisor.com', 'listing-mirror.com']
  },
  affiliate_marketing: {
    primary: ['affiliate marketing tasks online', 'affiliate content creation', 'promote products online'],
    expanded: ['CPA affiliate tasks', 'review affiliate content', 'comparison site content', 'email affiliate marketing', 'niche site building tasks', 'affiliate link insertion', 'ClickBank content tasks', 'Amazon affiliate content', 'SaaS affiliate promotion', 'finance affiliate content', 'health supplement affiliate', 'software review affiliate'],
    platforms: ['clickbank.com', 'shareasale.com', 'cj.com', 'impact.com', 'partnerstack.com', 'awin.com', 'rakuten.com', 'commission-junction.com', 'flexoffers.com', 'maxbounty.com']
  },
  dropshipping: {
    primary: ['dropshipping tasks online', 'product research dropship', 'ecommerce store management'],
    expanded: ['winning product research', 'supplier sourcing tasks', 'Shopify store management', 'dropship product descriptions', 'ad creative tasks', 'print-on-demand design', 'ecommerce product upload', 'order fulfillment management', 'inventory management remote', 'dropship supplier research', 'TikTok shop dropshipping', 'TikTok live selling tasks'],
    platforms: ['shopify.com', 'spocket.co', 'dsers.com', 'zendrop.com', 'printful.com', 'salehoo.com', 'cjdropshipping.com', 'dropified.com', 'oberlo.com', 'modalyst.co']
  },
  testing_websites: {
    primary: ['website testing jobs', 'UX testing online', 'usability testing tasks'],
    expanded: ['user testing tasks paid', 'website feedback jobs', 'app usability testing', 'design feedback tasks', 'bug reporting tasks remote', 'accessibility testing', 'mobile app QA tasks', 'beta testing websites', 'A/B test participant', 'prototype testing tasks', 'app store review testing', 'checkout flow testing'],
    platforms: ['usertesting.com', 'testbirds.com', 'ubertesters.com', 'userlytics.com', 'validately.com', 'trymata.com', 'dscout.com', 'loop11.com', 'lookback.com', 'userzoom.com', 'maze.co', 'helio.app']
  },
  photo_video: {
    primary: ['sell stock photos online', 'stock video creation', 'photo editing tasks'],
    expanded: ['microstock photography', 'video editing remote', 'thumbnail design tasks', 'background removal tasks', 'image retouching work', 'drone footage upload', 'illustration tasks', 'stock footage creation', 'motion graphics tasks', 'video intro creation', 'reel editing tasks', 'product photography remote', 'food photography tasks'],
    platforms: ['shutterstock.com', 'adobe.stock.com', 'pond5.com', 'istockphoto.com', 'dreamstime.com', 'depositphotos.com', 'gettyimages.com', 'alamy.com', 'bigstockphoto.com', '500px.com']
  },
  coding: {
    primary: ['coding tasks online', 'remote developer gigs', 'freelance programming'],
    expanded: ['bug fixing tasks', 'WordPress development tasks', 'landing page coding', 'script writing tasks', 'automation scripting remote', 'API integration tasks', 'Chrome extension dev', 'Python scripting jobs', 'JavaScript freelance tasks', 'React developer gigs', 'data scraping scripts', 'n8n automation tasks', 'Zapier integration tasks'],
    platforms: ['toptal.com', 'codementor.io', 'gun.io', 'arc.dev', 'crossover.com', 'a-connect.io', 'lemon.io', 'hired.com', 'gun.io', 'codeable.io']
  },
  design: {
    primary: ['graphic design tasks online', 'remote design gigs', 'logo design jobs'],
    expanded: ['social media design tasks', 'presentation design work', 'infographic creation', 'banner design tasks', 'icon design remote', 'pitch deck design', 'UI design tasks remote', 'Canva template design', 'book cover design', 'packaging design tasks', 'brand identity design', 'merchandise design remote', 'print design tasks'],
    platforms: ['99designs.com', 'designcrowd.com', 'dribbble.com', 'fiverr.com', 'designhill.com', 'crowdspring.com', 'hatchwise.com', 'pickfu.com', 'penji.co', 'kimp.io']
  },
  moderation: {
    primary: ['online content moderation jobs', 'remote moderator work', 'social media moderation'],
    expanded: ['community moderator online', 'forum moderation tasks', 'image review tasks', 'comment moderation work', 'trust & safety tasks', 'AI content moderation', 'ad review tasks', 'video moderation tasks', 'marketplace moderation', 'user-generated content review', 'policy enforcement tasks'],
    platforms: ['teleperformance.com', 'accenture.com', 'appen.com', 'cogito.com', 'concentrix.com', 'two-hat.com', 'crisp-thinking.com']
  },
  game_testing: {
    primary: ['game testing jobs', 'beta tester', 'QA game tester', 'playtest jobs'],
    expanded: ['video game QA remote', 'indie game tester', 'mobile game beta testing', 'Steam playtest', 'console QA tester', 'game bug reporter', 'alpha tester games', 'uTest game tasks', 'play2earn game tasks', 'NFT game testing', 'esports research tasks'],
    platforms: ['playtestcloud.com', 'utest.com', 'betabound.com', 'testbirds.com', 'erli.com', 'testlio.com', 'applause.com', 'rainforest.qa']
  },
  grants: {
    primary: ['small business grants 2025 2026', 'free money grants online', 'government grant application'],
    expanded: ['minority business grants', 'woman-owned business grant', 'startup grants no equity', 'nonprofit grants online', 'SBIR government grants', 'rural business grants', 'tech startup grant funding', 'arts grants online apply', 'environmental grants 2026', 'education grants individual', 'community grants apply online', 'local government grants businesses'],
    platforms: ['grants.gov', 'sbir.gov', 'sba.gov', 'grantwatch.com', 'instrumentl.com', 'candid.org', 'fundsforngos.org', 'foundationcenter.org', 'grantsforward.com']
  },
  prizes_contests: {
    primary: ['paid contests online', 'prize competitions online', 'cash prize contests'],
    expanded: ['design contests paid', 'writing contest prizes', 'photo contest cash prize', 'video contest submission', 'business idea competition', 'hackathon prizes 2026', 'pitch competition prize', 'coding competition cash', 'essay contest money', 'recipe contest prize', 'innovation challenge prize', 'art competition cash'],
    platforms: ['challenge.gov', 'devpost.com', 'kaggle.com', 'topcoder.com', 'heroic.com', 'competitionguide.com', 'contestbig.com', '99designs.com/contests', 'freelancer.com/contest']
  },
  sweepstakes: {
    primary: ['free sweepstakes online', 'online giveaway entry', 'sweepstakes cash prizes'],
    expanded: ['daily sweepstakes entry', 'product giveaway entry', 'gift card sweepstakes', 'travel sweepstakes enter', 'cash sweepstakes 2026', 'no purchase necessary sweeps', 'instant win games online', 'free lottery online', 'prize draw entry', 'monthly sweepstakes'],
    platforms: ['sweepstakes-today.com', 'contestgirl.com', 'online-sweepstakes.com', 'iwon.com', 'theprizefinder.com', 'sweepstakesfanatics.com', 'bestfreesweeps.com']
  },
  crypto_earn: {
    primary: ['earn crypto online tasks', 'crypto micro tasks', 'blockchain earn tasks'],
    expanded: ['crypto faucet tasks', 'play to earn crypto', 'learn to earn crypto', 'DeFi yield farming', 'NFT flipping strategy', 'crypto airdrop claims', 'Web3 testing tasks', 'DAO contributor bounties', 'blockchain developer bounties', 'crypto referral programs', 'staking rewards passive', 'liquidity mining tasks'],
    platforms: ['coinbase.com/earn', 'binance.com/en/earn', 'brave.com', 'cointiply.com', 'freebitcoin.io', 'gitcoin.co', 'layer3.xyz', 'rabbithole.gg', 'dework.xyz']
  },
  arbitrage: {
    primary: ['online arbitrage tasks', 'retail arbitrage work', 'product flip online'],
    expanded: ['Amazon FBA arbitrage', 'eBay arbitrage flipping', 'digital product arbitrage', 'course resale arbitrage', 'domain flipping tasks', 'website flip arbitrage', 'app resale arbitrage', 'ticket arbitrage online', 'currency arbitrage tasks', 'crypto arbitrage bots', 'book arbitrage Amazon'],
    platforms: ['ebay.com', 'amazon.com', 'flippa.com', 'afternic.com', 'sedo.com', 'empire-flippers.com', 'motion-invest.com', 'quietlightbrokerage.com']
  },
  lead_generation: {
    primary: ['lead generation tasks online', 'B2B lead gen remote', 'sales prospect research'],
    expanded: ['LinkedIn lead generation', 'email list building tasks', 'cold email outreach tasks', 'prospect database building', 'B2C lead gen tasks', 'appointment setting remote', 'sales development remote', 'lead qualification tasks', 'contact data enrichment', 'CRM data population', 'market list building'],
    platforms: ['upwork.com', 'fiverr.com', 'apollo.io', 'hunter.io', 'zoominfo.com', 'lusha.com', 'clearbit.com', 'salesql.com']
  },
  seo_tasks: {
    primary: ['SEO tasks freelance', 'search engine optimization work', 'link building tasks'],
    expanded: ['backlink outreach tasks', 'keyword research freelance', 'on-page SEO audit', 'technical SEO tasks', 'local SEO work', 'guest post outreach', 'broken link building', 'competitor analysis SEO', 'content audit tasks', 'schema markup tasks', 'sitemap optimization', 'Google Search Console tasks'],
    platforms: ['upwork.com', 'fiverr.com', 'semrush.com', 'ahrefs.com', 'moz.com', 'ubersuggests.io', 'brightlocal.com', 'loganix.com']
  },
  email_marketing: {
    primary: ['email marketing freelance', 'email campaign tasks', 'newsletter management work'],
    expanded: ['Mailchimp campaign tasks', 'Klaviyo email setup', 'email sequence writing', 'drip campaign creation', 'list segmentation tasks', 'email template design', 'A/B test email campaigns', 'email deliverability work', 'reactivation campaign tasks', 'automated flow creation', 'ecommerce email strategy'],
    platforms: ['upwork.com', 'fiverr.com', 'mailchimp.com/jobs', 'hubspot.com', 'activecampaign.com', 'klaviyo.com/partners']
  },
  video_editing: {
    primary: ['video editing tasks online', 'remote video editor', 'freelance video work'],
    expanded: ['YouTube video editing', 'podcast video creation', 'short-form video editing', 'Reels/TikTok editing', 'corporate video editing', 'wedding video editing', 'documentary editing tasks', 'motion graphics creation', 'color grading tasks', 'subtitle addition tasks', 'screen recording editing', 'webinar recording edit'],
    platforms: ['fiverr.com', 'upwork.com', 'veed.io', 'descript.com', 'editorial.getty.com', 'vimeo.com/jobs', 'videohusky.com']
  },
  podcasting: {
    primary: ['podcast production tasks', 'podcast editing work', 'podcasting freelance'],
    expanded: ['podcast show notes writing', 'podcast intro creation', 'episode transcription', 'podcast promotion tasks', 'guest outreach podcasts', 'RSS feed management', 'podcast cover art creation', 'audio cleanup tasks', 'podcast guest booking', 'Spotify podcast optimization'],
    platforms: ['podchaser.com', 'fiverr.com', 'upwork.com', 'podiant.co', 'buzzsprout.com/jobs', 'ausha.co']
  },
  accounting_finance: {
    primary: ['online bookkeeping tasks', 'remote accounting work', 'virtual bookkeeper jobs'],
    expanded: ['QuickBooks data entry', 'bank reconciliation tasks', 'payroll processing remote', 'tax preparation remote', 'financial statement prep', 'accounts payable remote', 'expense categorization', 'invoice creation tasks', 'cash flow analysis tasks', 'crypto tax reporting', 'Xero accounting tasks'],
    platforms: ['upwork.com', 'beancountingpros.com', 'bookminders.com', 'fiverr.com', 'bench.co/partners', 'merritt-bookkeeping.com', 'numbero.com']
  },
  legal_tasks: {
    primary: ['online legal tasks freelance', 'remote paralegal work', 'legal document tasks'],
    expanded: ['contract review tasks', 'legal research online', 'document drafting remote', 'patent research tasks', 'trademark search tasks', 'legal proofreading work', 'compliance document tasks', 'legal summarization', 'terms of service drafting', 'privacy policy writing', 'legal translation remote'],
    platforms: ['upcounsel.com', 'lawclerk.legal', 'legalzoom.com/jobs', 'fiverr.com', 'upwork.com', 'priori.legal', 'axiom.law']
  },
  consulting: {
    primary: ['online consulting gigs', 'expert consulting tasks', 'remote advisory work'],
    expanded: ['business strategy consulting', 'startup advice remote', 'marketing consulting tasks', 'tech advisory sessions', 'HR consulting remote', 'operations consulting', 'financial consulting online', 'career coaching remote', 'executive coaching tasks', '1-on-1 expert sessions', 'fractional CMO tasks', 'fractional CFO work'],
    platforms: ['clarity.fm', 'expert360.com', 'catalant.com', 'btg.com', 'glg.com', 'guidepoint.com', 'alphasights.com', 'maven.com']
  },
  elearning: {
    primary: ['create online courses', 'eLearning content creation', 'instructional design remote'],
    expanded: ['Udemy course creation', 'Skillshare class creation', 'Coursera course tasks', 'LMS course building', 'educational video creation', 'quiz creation tasks', 'curriculum design remote', 'SCORM content creation', 'corporate training materials', 'microlearning module creation', 'interactive lesson design'],
    platforms: ['udemy.com', 'skillshare.com', 'coursera.org/instructors', 'teachable.com', 'thinkific.com', 'kajabi.com', 'podia.com', 'learnworlds.com']
  },
  healthcare_tasks: {
    primary: ['remote healthcare data tasks', 'medical coding remote', 'telehealth tasks online'],
    expanded: ['medical records coding', 'clinical documentation', 'health content writing', 'patient survey tasks', 'medical research online', 'pharmacy verification tasks', 'health coaching remote', 'wellness content writing', 'telemedicine support tasks', 'EHR data entry remote'],
    platforms: ['appen.com', 'mckesson.com', 'optum.com/jobs', 'healthstream.com', 'nimblr.ai', 'cerner.com/jobs']
  },
  real_estate: {
    primary: ['real estate virtual assistant', 'property research tasks online', 'real estate data entry'],
    expanded: ['MLS data entry tasks', 'property listing description', 'real estate cold calling', 'CRM management realtor', 'lead generation real estate', 'property comp research', 'wholesale property research', 'real estate transaction coordination', 'title research tasks', 'property management remote'],
    platforms: ['upwork.com', 'fiverr.com', 'myoutdesk.com', 'reals.com', 'prorealtyvirtual.com', 'virtualva.co']
  },
  app_development: {
    primary: ['mobile app development tasks', 'iOS developer remote', 'Android app gigs'],
    expanded: ['React Native tasks', 'Flutter development remote', 'Swift iOS tasks', 'Kotlin Android tasks', 'app maintenance remote', 'app UI design tasks', 'API backend tasks', 'app performance optimization', 'in-app purchase setup', 'push notification setup', 'app store optimization'],
    platforms: ['upwork.com', 'toptal.com', 'fiverr.com', 'arc.dev', 'X-team.com', 'codementor.io', 'github.com/jobs']
  },
  reselling: {
    primary: ['online reselling tasks', 'flip items online', 'product resale work'],
    expanded: ['thrift flip online', 'sneaker reselling tasks', 'luxury goods resale', 'electronics resale online', 'trading card flipping', 'vintage clothing resale', 'LEGO reselling tasks', 'collectible item resale', 'console game resale', 'book reselling Amazon', 'toy reselling eBay', 'sports memorabilia resale'],
    platforms: ['ebay.com', 'mercari.com', 'poshmark.com', 'depop.com', 'stockx.com', 'goat.com', 'offerup.com', 'letgo.com', 'craigslist.org', 'facebook.com/marketplace']
  },
  outreach: {
    primary: ['cold email outreach tasks', 'influencer outreach work', 'partnership outreach tasks'],
    expanded: ['podcast guest outreach', 'link building outreach', 'PR outreach tasks', 'journalist outreach', 'investor outreach tasks', 'brand partnership outreach', 'joint venture outreach', 'collaboration email tasks', 'media relations remote', 'blogger outreach tasks'],
    platforms: ['upwork.com', 'fiverr.com', 'hunter.io', 'apollo.io', 'gmass.co', 'mailshake.com', 'lemlist.com']
  },
  prompt_engineering: {
    primary: ['prompt engineering tasks', 'AI prompt writing jobs', 'prompt marketplace work'],
    expanded: ['ChatGPT prompt creation', 'Midjourney prompt packs', 'DALL-E prompt writing', 'system prompt creation', 'LLM jailbreak evaluation', 'prompt optimization tasks', 'AI agent prompt design', 'custom GPT creation', 'prompt pack selling', 'AI workflow creation tasks'],
    platforms: ['promptbase.com', 'snackprompt.com', 'aiprm.com', 'fiverr.com', 'upwork.com', 'prompts.chat', 'gptstore.ai']
  },
  automation_tools: {
    primary: ['automation tasks online', 'no-code automation work', 'workflow automation freelance'],
    expanded: ['n8n workflow tasks', 'Zapier automation setup', 'Make.com automation', 'Airtable automation tasks', 'Notion automation setup', 'Monday.com workflow', 'browser automation tasks', 'RPA freelance work', 'Python automation scripts', 'Google Sheets automation', 'webhook setup tasks', 'integration mapping tasks'],
    platforms: ['upwork.com', 'fiverr.com', 'n8n.io', 'zapier.com/jobs', 'make.com', 'automate.io', 'pabbly.com']
  },
  nft_web3: {
    primary: ['NFT creation tasks', 'Web3 freelance work', 'blockchain tasks online'],
    expanded: ['NFT art creation', 'smart contract review', 'whitepaper writing crypto', 'DAO community management', 'Web3 content writing', 'DeFi protocol tasks', 'blockchain QA testing', 'NFT marketplace listing', 'crypto project management', 'tokenomics consulting', 'Web3 developer tasks', 'airdrop farming strategy'],
    platforms: ['dework.xyz', 'gitcoin.co', 'layer3.xyz', 'rabbithole.gg', 'superteam.fun', 'web3.career', 'cryptojobslist.com', 'useweb3.xyz']
  }
};

// ─── SCORING ENGINE ───────────────────────────────────────────────────────────
function scoreOpportunity(opp) {
  let score = 45;
  const pay = opp.estimated_pay || 0;
  const mins = opp.time_estimate_minutes || 60;
  const hrRate = mins > 0 ? (pay / mins) * 60 : 0;

  if (hrRate >= 100) score += 30;
  else if (hrRate >= 50) score += 22;
  else if (hrRate >= 25) score += 14;
  else if (hrRate >= 10) score += 6;
  else if (hrRate < 3) score -= 15;

  if (pay >= 200) score += 12;
  else if (pay >= 100) score += 8;
  else if (pay >= 50) score += 4;

  if (mins <= 15) score += 15;
  else if (mins <= 30) score += 10;
  else if (mins <= 60) score += 5;
  else if (mins > 480) score -= 12;

  if (opp.can_ai_complete) score += 18;
  else score -= 25;

  if (!opp.online_only) return 0;
  score += 8;

  if (opp.difficulty === 'beginner') score += 8;
  else if (opp.difficulty === 'advanced') score -= 5;

  const reliable = ['upwork', 'fiverr', 'amazon', 'rev.com', 'appen', 'clickworker', 'prolific', 'mturk', 'remotasks', 'scale.ai', 'outlier.ai', 'alignerr', 'toptal', 'scribie', 'transcribeme', 'userinterviews', 'usertesting', 'respondent'];
  if (reliable.some(p => (opp.platform || '').toLowerCase().includes(p))) score += 8;

  return Math.min(100, Math.max(0, Math.round(score)));
}

function isOnlineOnly(opp) {
  const blockers = ['in person', 'on-site', 'physical location', 'warehouse', 'drive to', 'local only', 'must be present', 'in-store', 'office visit', 'pickup', 'delivery driver', 'commute'];
  const text = `${opp.title} ${opp.description || ''}`.toLowerCase();
  return !blockers.some(d => text.includes(d));
}

// ─── AI-POWERED CATEGORY SCAN ─────────────────────────────────────────────────
async function scanCategoryWithAI(category, keywords, platforms, userContext = {}) {
  const kwSample = keywords.slice(0, 10).join(', ');
  const platformSample = platforms.slice(0, 6).join(', ');
  const skillContext = userContext.skills?.length ? `User skills: ${userContext.skills.slice(0, 5).join(', ')}` : '';
  const targetContext = userContext.daily_target ? `Daily target: $${userContext.daily_target}` : '';

  const prompt = `You are SCOUT — an autonomous internet-wide opportunity discovery agent for VELO AI.

Category: ${category.replace(/_/g, ' ').toUpperCase()}
Search terms: ${kwSample}
Primary platforms: ${platformSample}
${skillContext}
${targetContext}

Search the internet RIGHT NOW using Google Search and find 6-8 real, currently active paid online opportunities in this category. Include both mainstream AND hidden/low-visibility sources.

Return a JSON array:
[
  {
    "title": "specific real task title",
    "platform": "platform.com",
    "url": "https://actual-url.com/path",
    "estimated_pay": 35,
    "pay_unit": "per_task|per_hour|per_word|per_project",
    "time_estimate_minutes": 45,
    "difficulty": "beginner|intermediate|advanced",
    "description": "detailed description of what needs to be done and how to apply",
    "requirements": ["requirement1"],
    "can_ai_complete": true,
    "online_only": true,
    "discovery_method": "search|scrape|api|hidden",
    "keywords_matched": ["kw1"],
    "opportunity_uniqueness": "mainstream|niche|hidden"
  }
]

RULES:
- Only 100% online tasks (no physical presence required)
- Prefer tasks an AI agent can perform
- Mix of mainstream platforms AND niche/hidden sources
- estimated_pay must be realistic for platform/task type
- Include hidden opportunities others might miss
- Return ONLY the JSON array`;

  const text = await callLLM(prompt, true, true);
  const parsed = extractJSON(text);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(t => t.title && t.platform && t.online_only);
}

// ─── CURATED HIGH-QUALITY BASE LIBRARY ───────────────────────────────────────
function getCuratedOpportunities(userEmail) {
  const base = [
    { title: 'AI Response Quality Rater', category: 'ai_training', platform: 'outlier.ai', url: 'https://outlier.ai/freelancers', estimated_pay: 30, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Rate and improve AI model outputs. Flexible hours, weekly pay.', can_ai_complete: true, online_only: true },
    { title: 'Conversation Data Collector', category: 'ai_training', platform: 'alignerr.com', url: 'https://alignerr.com', estimated_pay: 25, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Provide natural language samples and rate AI conversations for RLHF datasets.', can_ai_complete: true, online_only: true },
    { title: 'Image Annotation Batch', category: 'ai_training', platform: 'scale.ai', url: 'https://scale.ai', estimated_pay: 18, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Label images and bounding boxes for computer vision models.', can_ai_complete: true, online_only: true },
    { title: 'RLHF Preference Ranker', category: 'ai_training', platform: 'remotasks.com', url: 'https://remotasks.com', estimated_pay: 22, time_estimate_minutes: 45, difficulty: 'beginner', description: 'Compare AI outputs and select better responses. Trains LLMs.', can_ai_complete: true, online_only: true },
    { title: 'AI Red-Teaming Evaluator', category: 'ai_training', platform: 'surge.ai', url: 'https://surge.ai', estimated_pay: 35, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Find failure modes and edge cases in AI systems.', can_ai_complete: true, online_only: true },
    { title: 'Prompt Pack Creation — Midjourney', category: 'prompt_engineering', platform: 'promptbase.com', url: 'https://promptbase.com/sell', estimated_pay: 50, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Create and sell high-quality Midjourney prompt packs.', can_ai_complete: true, online_only: true },
    { title: 'Custom GPT Builder', category: 'prompt_engineering', platform: 'fiverr.com', url: 'https://fiverr.com', estimated_pay: 75, time_estimate_minutes: 120, difficulty: 'intermediate', description: 'Build custom GPT agents for clients on ChatGPT.', can_ai_complete: true, online_only: true },
    { title: 'Podcast Episode Transcription', category: 'transcription', platform: 'rev.com', url: 'https://rev.com/freelancers/transcription', estimated_pay: 15, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Transcribe audio/podcast episodes. $0.45–$0.75 per minute audio.', can_ai_complete: true, online_only: true },
    { title: 'Audio Transcription Tasks', category: 'transcription', platform: 'transcribeme.com', url: 'https://transcribeme.com/jobs', estimated_pay: 20, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Short audio clips transcription, earn per audio minute.', can_ai_complete: true, online_only: true },
    { title: 'Website Usability Test ($10/test)', category: 'testing_websites', platform: 'usertesting.com', url: 'https://usertesting.com/be-a-contributor', estimated_pay: 10, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Record yourself using websites and apps. $10 per 20-min test.', can_ai_complete: false, online_only: true },
    { title: 'App Testing Tasks', category: 'testing_websites', platform: 'testbirds.com', url: 'https://testbirds.com/crowd', estimated_pay: 15, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Test apps and websites, report bugs. Per-task payment.', can_ai_complete: false, online_only: true },
    { title: 'Product Survey ($15 completion)', category: 'surveys', platform: 'respondent.io', url: 'https://app.respondent.io', estimated_pay: 15, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Participate in product research interviews. $100+/hour for qualifications.', can_ai_complete: false, online_only: true },
    { title: 'Academic Study Participant', category: 'surveys', platform: 'prolific.ac', url: 'https://prolific.ac', estimated_pay: 12, time_estimate_minutes: 20, difficulty: 'beginner', description: 'Participate in academic research studies. Avg $6–$15/hr.', can_ai_complete: false, online_only: true },
    { title: 'n8n Automation Workflow Setup', category: 'automation_tools', platform: 'upwork.com', url: 'https://upwork.com', estimated_pay: 150, time_estimate_minutes: 180, difficulty: 'intermediate', description: 'Build n8n automation workflows for clients. High demand, strong pay.', can_ai_complete: true, online_only: true },
    { title: 'Zapier Integration Setup', category: 'automation_tools', platform: 'fiverr.com', url: 'https://fiverr.com', estimated_pay: 75, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Connect apps via Zapier for clients. Quick turnaround, repeat work.', can_ai_complete: true, online_only: true },
    { title: 'DAO Contributor Bounty', category: 'nft_web3', platform: 'dework.xyz', url: 'https://dework.xyz', estimated_pay: 200, time_estimate_minutes: 240, difficulty: 'intermediate', description: 'Complete bounties for Web3 DAOs. Writing, dev, design tasks paid in crypto.', can_ai_complete: true, online_only: true },
    { title: 'Gitcoin Hackathon Bounty', category: 'nft_web3', platform: 'gitcoin.co', url: 'https://gitcoin.co/bounties', estimated_pay: 500, time_estimate_minutes: 480, difficulty: 'advanced', description: 'Solve open-source blockchain problems for cash/crypto bounties.', can_ai_complete: true, online_only: true },
    { title: 'Blog Content Writing (500-word)', category: 'writing', platform: 'verblio.com', url: 'https://verblio.com/become-a-writer', estimated_pay: 40, time_estimate_minutes: 60, difficulty: 'beginner', description: 'Write SEO-optimized blog posts for clients. $40–$110 per post.', can_ai_complete: true, online_only: true },
    { title: 'Technical Article Writing', category: 'writing', platform: 'draft.dev', url: 'https://draft.dev/write', estimated_pay: 300, time_estimate_minutes: 300, difficulty: 'advanced', description: 'Write technical developer tutorials. $300–$500 per article.', can_ai_complete: true, online_only: true },
    { title: 'Canva Template Design Pack', category: 'digital_products', platform: 'etsy.com', url: 'https://etsy.com', estimated_pay: 60, time_estimate_minutes: 180, difficulty: 'intermediate', description: 'Create and sell Canva template packs on Etsy. Passive recurring income.', can_ai_complete: true, online_only: true },
    { title: 'Notion Dashboard Template', category: 'digital_products', platform: 'gumroad.com', url: 'https://gumroad.com', estimated_pay: 25, time_estimate_minutes: 120, difficulty: 'beginner', description: 'Create and sell Notion productivity templates. Low effort, passive sales.', can_ai_complete: true, online_only: true },
    { title: 'ESL Conversation Tutor', category: 'tutoring', platform: 'cambly.com', url: 'https://cambly.com/become-tutor', estimated_pay: 12, time_estimate_minutes: 30, difficulty: 'beginner', description: 'Have casual English conversations. No lesson prep needed. $0.17/min.', can_ai_complete: false, online_only: true },
    { title: 'Language Teacher', category: 'tutoring', platform: 'italki.com', url: 'https://italki.com/teacher', estimated_pay: 25, time_estimate_minutes: 60, difficulty: 'intermediate', description: 'Teach your native language online. Set your own rates.', can_ai_complete: false, online_only: true },
    { title: 'Amazon Product Listing Optimization', category: 'marketplace_listing', platform: 'upwork.com', url: 'https://upwork.com', estimated_pay: 50, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Optimize Amazon product titles, bullets, and descriptions for ranking.', can_ai_complete: true, online_only: true },
    { title: 'eBay Store Management', category: 'reselling', platform: 'ebay.com', url: 'https://ebay.com', estimated_pay: 80, time_estimate_minutes: 120, difficulty: 'beginner', description: 'List and manage products on eBay. Arbitrage + reselling.', can_ai_complete: true, online_only: true },
    { title: 'LinkedIn Lead Generation', category: 'lead_generation', platform: 'upwork.com', url: 'https://upwork.com', estimated_pay: 100, time_estimate_minutes: 120, difficulty: 'beginner', description: 'Find qualified B2B leads on LinkedIn for clients. High demand.', can_ai_complete: true, online_only: true },
    { title: 'Cold Email Campaign Setup', category: 'email_marketing', platform: 'fiverr.com', url: 'https://fiverr.com', estimated_pay: 80, time_estimate_minutes: 90, difficulty: 'intermediate', description: 'Write and configure cold email sequences. Apollo/Lemlist.', can_ai_complete: true, online_only: true },
    { title: 'SBA SBIR Grant Application', category: 'grants', platform: 'sbir.gov', url: 'https://sbir.gov/apply', estimated_pay: 50000, time_estimate_minutes: 2880, difficulty: 'advanced', description: 'Apply for Phase I SBIR grants — $50K–$250K for tech innovations.', can_ai_complete: false, online_only: true },
    { title: 'Hackathon Prize Competition', category: 'prizes_contests', platform: 'devpost.com', url: 'https://devpost.com/hackathons', estimated_pay: 1000, time_estimate_minutes: 1440, difficulty: 'intermediate', description: 'Enter online hackathons for cash prizes. Many have $1K–$10K prizes.', can_ai_complete: true, online_only: true },
    { title: 'Coinbase Learn & Earn', category: 'crypto_earn', platform: 'coinbase.com', url: 'https://coinbase.com/earn', estimated_pay: 30, time_estimate_minutes: 15, difficulty: 'beginner', description: 'Watch short videos and earn crypto. Simple quizzes, instant reward.', can_ai_complete: true, online_only: true },
  ];

  return base.map(opp => ({
    ...opp,
    user_email: userEmail,
    status: 'discovered',
    score: scoreOpportunity(opp),
    pay_currency: 'USD',
    keywords_matched: (KEYWORD_MAP[opp.category]?.primary?.slice(0, 2) || []),
  })).filter(o => o.score > 0);
}

// ─── PRIORITIZE CATEGORIES BY USER SKILLS ─────────────────────────────────────
function prioritizeCategoriesByUser(userSkills = [], preferredCategories = []) {
  const allCats = Object.keys(KEYWORD_MAP);
  const skillCategoryMap = {
    writing: ['writing', 'content_creation', 'email_marketing', 'seo_tasks', 'review_writing'],
    design: ['design', 'photo_video', 'digital_products', 'video_editing'],
    coding: ['coding', 'app_development', 'automation_tools', 'nft_web3', 'prompt_engineering'],
    marketing: ['affiliate_marketing', 'lead_generation', 'email_marketing', 'seo_tasks', 'social_media'],
    research: ['research', 'ai_training', 'data_entry', 'surveys'],
    finance: ['accounting_finance', 'arbitrage', 'crypto_earn', 'reselling'],
    teaching: ['tutoring', 'elearning', 'consulting'],
    video: ['video_editing', 'podcasting', 'photo_video', 'content_creation'],
    translation: ['translation', 'transcription'],
    legal: ['legal_tasks', 'consulting', 'grants'],
  };

  const boosted = new Set(preferredCategories);
  for (const skill of userSkills) {
    const normalized = skill.toLowerCase();
    for (const [key, cats] of Object.entries(skillCategoryMap)) {
      if (normalized.includes(key)) cats.forEach(c => boosted.add(c));
    }
  }

  // Boosted categories first, then rest
  const priority = [...boosted].filter(c => allCats.includes(c));
  const rest = allCats.filter(c => !boosted.has(c));
  return [...priority, ...rest];
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    _base44 = base44;
    const body = await req.json().catch(() => ({}));

    // Support both user-auth and service-role calls (from orchestrator)
    let user = null;
    try { user = await base44.auth.me(); } catch (e) {}
    const userEmail = user?.email || body.user_email;
    if (!userEmail) return Response.json({ error: 'Unauthorized — no user or user_email' }, { status: 401 });
    // Synthetic user object for service-role calls
    if (!user) user = { email: userEmail };

    const { action, filters = {}, categories = [] } = body;

    // ── FULL DISCOVERY SCAN ───────────────────────────────────────────────
    if (action === 'full_scan' || action === 'scan') {
      const userSkills = body.user_skills || [];
      const preferredCategories = body.preferred_categories || [];
      const dailyTarget = body.daily_target || 100;
      const riskTolerance = body.risk_tolerance || 'moderate';

      // Phase 1: Curated base library
      let allOpportunities = getCuratedOpportunities(userEmail);

      // Phase 2: AI-powered internet scan — prioritized by user skills
      const hasLLM = !!(GEMINI_KEY || OPENAI_KEY);
      const prioritizedCats = prioritizeCategoriesByUser(userSkills, preferredCategories);
      const scanCategories = categories.length > 0 ? categories : prioritizedCats;

      // Scan up to 14 categories per run (covers whole map over multiple scans)
      const batchSize = 14;
      const aiScanResults = [];

      if (hasLLM) {
        for (const cat of scanCategories.slice(0, batchSize)) {
          try {
            const catData = KEYWORD_MAP[cat];
            if (!catData) continue;
            const aiOpps = await scanCategoryWithAI(
              cat,
              [...catData.primary, ...catData.expanded],
              catData.platforms,
              { skills: userSkills, daily_target: dailyTarget }
            );
            for (const opp of aiOpps) {
              const scored = {
                ...opp,
                category: cat,
                user_email: user.email,
                status: 'discovered',
                pay_currency: 'USD',
                score: scoreOpportunity({ ...opp, online_only: true }),
              };
              if (scored.score > 0) aiScanResults.push(scored);
            }
          } catch (e) {
            console.error(`AI scan failed for ${cat}:`, e.message);
          }
        }
      }

      // Merge, apply filters, deduplicate
      const allMerged = [...allOpportunities, ...aiScanResults];
      let filtered = allMerged.filter(o => isOnlineOnly(o) && o.score > 0);

      if (filters.category) filtered = filtered.filter(o => o.category === filters.category);
      if (filters.min_pay) filtered = filtered.filter(o => (o.estimated_pay || 0) >= filters.min_pay);
      if (filters.max_time_minutes) filtered = filtered.filter(o => (o.time_estimate_minutes || 999) <= filters.max_time_minutes);
      if (filters.difficulty) filtered = filtered.filter(o => o.difficulty === filters.difficulty);
      if (filters.ai_only) filtered = filtered.filter(o => o.can_ai_complete);

      filtered.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Dedup vs existing DB
      const existing = await base44.asServiceRole.entities.WorkOpportunity.filter({ user_email: userEmail }, '-created_date', 400).catch(() => []);
      const existingTitles = new Set((existing || []).map(o => (o.title || '').toLowerCase().slice(0, 40)));
      const newOpps = filtered.filter(o => !existingTitles.has((o.title || '').toLowerCase().slice(0, 40)));

      // Persist top results
      let created = 0;
      const topOpps = [];
      for (const opp of newOpps.slice(0, 60)) {
        const withEmail = { ...opp, user_email: userEmail };
        const saved = await base44.asServiceRole.entities.WorkOpportunity.create(withEmail).catch(() => null);
        if (saved) { created++; topOpps.push(saved); }
      }

      // Auto-queue top AI-compatible for Autopilot
      const autoQueue = topOpps.filter(o => o.can_ai_complete && (o.score || 0) >= 70).slice(0, 10);
      for (const opp of autoQueue) {
        await base44.asServiceRole.entities.WorkOpportunity.update(opp.id, { autopilot_queued: true, status: 'evaluating' }).catch(() => null);
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🔍 SCOUT v5: ${created} new opportunities found across ${scanCategories.length} categories (${aiScanResults.length} live internet · ${autoQueue.length} auto-queued for Autopilot)`,
        severity: 'success',
        metadata: { found: filtered.length, created, ai_count: aiScanResults.length, categories_scanned: scanCategories.length, auto_queued: autoQueue.length }
      }).catch(() => {});

      return Response.json({
        success: true,
        found: filtered.length,
        created,
        ai_compatible: filtered.filter(o => o.can_ai_complete).length,
        live_scan_count: aiScanResults.length,
        auto_queued: autoQueue.length,
        categories_scanned: scanCategories.length,
        total_categories_available: Object.keys(KEYWORD_MAP).length,
        categories: Object.fromEntries(
          [...new Set(filtered.map(o => o.category))].map(c => [c, filtered.filter(o => o.category === c).length])
        ),
        top_opportunities: topOpps.slice(0, 12),
      });
    }

    // ── CATEGORY-SPECIFIC SCAN ────────────────────────────────────────────
    if (action === 'scan_category') {
      const { category } = body;
      const catData = KEYWORD_MAP[category];
      if (!catData) return Response.json({ error: 'Unknown category' }, { status: 400 });

      const aiOpps = await scanCategoryWithAI(category, [...catData.primary, ...catData.expanded], catData.platforms);
      const scored = aiOpps.map(o => ({
        ...o, category, user_email: userEmail, status: 'discovered',
        score: scoreOpportunity({ ...o, online_only: true }), pay_currency: 'USD',
      })).filter(o => o.score > 0);

      let created = 0;
      for (const opp of scored.slice(0, 20)) {
        await base44.asServiceRole.entities.WorkOpportunity.create(opp).catch(() => null);
        created++;
      }

      return Response.json({ success: true, category, found: scored.length, created });
    }

    // ── KEYWORD EXPANSION ─────────────────────────────────────────────────
    if (action === 'expand_keywords') {
      const { base_category } = body;
      const catData = KEYWORD_MAP[base_category];
      if (!catData) return Response.json({ error: 'Unknown category' }, { status: 400 });

      const aiExpansion = await callLLM(
        `Generate 20 additional niche search keywords and 8 more niche platform URLs for the online work category: "${base_category.replace(/_/g, ' ')}". 
        Focus on hidden, low-competition, high-pay variations. 
        Return JSON: {"additional_keywords": [], "additional_platforms": []}`, true, false
      );
      const aiExtra = extractJSON(aiExpansion) || {};

      return Response.json({
        success: true,
        category: base_category,
        primary_keywords: catData.primary,
        expanded_keywords: [...catData.expanded, ...(aiExtra.additional_keywords || [])],
        target_platforms: [...catData.platforms, ...(aiExtra.additional_platforms || [])],
        total_terms: catData.primary.length + catData.expanded.length + (aiExtra.additional_keywords?.length || 0),
      });
    }

    // ── GET CATEGORIES ────────────────────────────────────────────────────
    if (action === 'get_categories') {
      return Response.json({
        success: true,
        total_categories: Object.keys(KEYWORD_MAP).length,
        categories: Object.keys(KEYWORD_MAP).map(key => ({
          key,
          label: key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          keyword_count: KEYWORD_MAP[key].primary.length + KEYWORD_MAP[key].expanded.length,
          platform_count: KEYWORD_MAP[key].platforms.length,
          platforms: KEYWORD_MAP[key].platforms,
        }))
      });
    }

    // ── SUMMARY ───────────────────────────────────────────────────────────
    if (action === 'get_summary') {
      const opps = await base44.asServiceRole.entities.WorkOpportunity.filter({ user_email: userEmail }, '-created_date', 400).catch(() => []);
      const summary = {
        total: opps.length,
        ai_compatible: opps.filter(o => o.can_ai_complete).length,
        queued_for_autopilot: opps.filter(o => o.autopilot_queued).length,
        by_category: {},
        by_status: {},
        total_potential: opps.reduce((s, o) => s + (o.estimated_pay || 0), 0),
        avg_score: opps.length > 0 ? opps.reduce((s, o) => s + (o.score || 0), 0) / opps.length : 0,
        top_earners: [...opps].sort((a, b) => (b.estimated_pay || 0) - (a.estimated_pay || 0)).slice(0, 5),
      };
      opps.forEach(o => {
        summary.by_category[o.category] = (summary.by_category[o.category] || 0) + 1;
        summary.by_status[o.status] = (summary.by_status[o.status] || 0) + 1;
      });
      return Response.json({ success: true, summary });
    }

    // ── QUEUE ALL AI-COMPATIBLE FOR AUTOPILOT ─────────────────────────────
    if (action === 'queue_all_for_autopilot') {
      const opps = await base44.asServiceRole.entities.WorkOpportunity.filter(
        { user_email: userEmail, can_ai_complete: true, status: 'discovered' }, '-score', 30
      ).catch(() => []);

      let queued = 0;
      for (const opp of opps) {
        await base44.asServiceRole.entities.WorkOpportunity.update(opp.id, { autopilot_queued: true, status: 'evaluating' }).catch(() => null);
        queued++;
      }
      return Response.json({ success: true, queued, message: `${queued} opportunities queued for Autopilot` });
    }

    // ── SCORE OPPORTUNITY ─────────────────────────────────────────────────
    if (action === 'score_opportunity') {
      const { opportunity } = body;
      if (!opportunity) return Response.json({ error: 'No opportunity provided' }, { status: 400 });
      return Response.json({
        success: true,
        score: scoreOpportunity(opportunity),
        online_only: isOnlineOnly(opportunity),
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('Discovery Engine v5 error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});