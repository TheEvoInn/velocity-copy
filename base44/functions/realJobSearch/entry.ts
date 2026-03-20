/**
 * Real Job Search — pulls live jobs from RapidAPI job board aggregators
 * Sources: JSearch (Google Jobs), Freelancer, LinkedIn Jobs via RapidAPI
 * Falls back gracefully if an endpoint is unavailable.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const RAPIDAPI_KEY = Deno.env.get('RAPIDAPI_KEY');

async function searchJSearch(query, numPages = 1) {
  // NOTE: Requires subscribing to "JSearch" at https://rapidapi.com/letscrape-6bRBa3QguO5/api/jsearch
  const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=${numPages}&date_posted=today`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'jsearch.p.rapidapi.com',
    },
  });
  if (!res.ok) throw new Error(`JSearch error: ${res.status}`);
  const data = await res.json();
  return (data.data || []).map(job => ({
    title: job.job_title,
    description: job.job_description?.slice(0, 500) || '',
    url: job.job_apply_link || job.job_google_link,
    platform: job.employer_name || job.job_publisher,
    category: 'freelance',
    opportunity_type: 'job',
    profit_estimate_low: job.job_min_salary || 50,
    profit_estimate_high: job.job_max_salary || (job.job_salary_period === 'HOUR' ? 100 : 500),
    time_sensitivity: 'days',
    source: 'jsearch_rapidapi',
    tags: [job.job_employment_type, job.job_city, job.job_country].filter(Boolean),
  }));
}

async function searchFreelancerAPI(query) {
  const url = `https://freelancer-api.p.rapidapi.com/api/projects/0.1/projects/active/?query=${encodeURIComponent(query)}&limit=10&sort_field=time_updated&job_details=true`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'freelancer-api.p.rapidapi.com',
    },
  });
  if (!res.ok) throw new Error(`Freelancer API error: ${res.status}`);
  const data = await res.json();
  const projects = data.result?.projects || [];
  return projects.map(p => ({
    title: p.title,
    description: p.description?.slice(0, 500) || '',
    url: `https://www.freelancer.com/projects/${p.seo_url || p.id}`,
    platform: 'freelancer.com',
    category: 'freelance',
    opportunity_type: 'job',
    profit_estimate_low: p.budget?.minimum || 0,
    profit_estimate_high: p.budget?.maximum || 0,
    time_sensitivity: p.upgrades?.urgent ? 'immediate' : 'days',
    source: 'freelancer_rapidapi',
    tags: Object.values(p.jobs || {}).map(j => j.name).filter(Boolean),
  }));
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!RAPIDAPI_KEY) {
      return Response.json({ error: 'RAPIDAPI_KEY not configured' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const query = body.query || 'freelance remote software development writing design';
    const sources = body.sources || ['jsearch', 'freelancer'];

    const results = { jobs: [], errors: [], total: 0 };

    // JSearch (Google Jobs aggregator — covers Indeed, LinkedIn, etc.)
    if (sources.includes('jsearch')) {
      try {
        const jobs = await searchJSearch(query);
        results.jobs.push(...jobs);
        console.log(`[JSearch] Found ${jobs.length} jobs`);
      } catch (e) {
        console.error('[JSearch] Error:', e.message);
        results.errors.push({ source: 'jsearch', error: e.message });
      }
    }

    // Freelancer.com
    if (sources.includes('freelancer')) {
      try {
        const jobs = await searchFreelancerAPI(query);
        results.jobs.push(...jobs);
        console.log(`[Freelancer] Found ${jobs.length} projects`);
      } catch (e) {
        console.error('[Freelancer API] Error:', e.message);
        results.errors.push({ source: 'freelancer', error: e.message });
      }
    }

    results.total = results.jobs.length;

    // Deduplicate by URL and save to Opportunity entity
    let saved = 0;
    for (const job of results.jobs) {
      if (!job.url || !job.title) continue;
      const existing = await base44.asServiceRole.entities.Opportunity.filter({ url: job.url });
      if (existing.length > 0) continue;

      await base44.asServiceRole.entities.Opportunity.create({
        title: job.title,
        description: job.description,
        url: job.url,
        category: job.category,
        opportunity_type: job.opportunity_type,
        platform: job.platform,
        profit_estimate_low: job.profit_estimate_low || 0,
        profit_estimate_high: job.profit_estimate_high || 0,
        time_sensitivity: job.time_sensitivity || 'days',
        status: 'new',
        auto_execute: false, // Real jobs require manual application initiation
        source: job.source,
        tags: job.tags || [],
        overall_score: Math.min(95, 55 + (job.profit_estimate_high > 500 ? 20 : 10)),
      });
      saved++;
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `[Real Job Search] Fetched ${results.total} live jobs, saved ${saved} new opportunities`,
      severity: saved > 0 ? 'success' : 'info',
      metadata: { total_fetched: results.total, saved, errors: results.errors },
    });

    return Response.json({
      success: true,
      total_fetched: results.total,
      saved,
      errors: results.errors,
      jobs: results.jobs.slice(0, 20), // Return preview
    });

  } catch (error) {
    console.error('[realJobSearch] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});