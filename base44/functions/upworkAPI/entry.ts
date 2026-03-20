/**
 * Upwork API Integration
 * Real job search, proposal submission, and earnings retrieval via Upwork REST API v3
 * Requires: UPWORK_CLIENT_ID, UPWORK_CLIENT_SECRET, UPWORK_ACCESS_TOKEN
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const UPWORK_ACCESS_TOKEN = Deno.env.get('UPWORK_ACCESS_TOKEN');
const UPWORK_CLIENT_ID = Deno.env.get('UPWORK_CLIENT_ID');
const BASE_URL = 'https://www.upwork.com/api';

function upworkHeaders() {
  return {
    'Authorization': `Bearer ${UPWORK_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  };
}

async function upworkGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers: upworkHeaders() });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upwork GET ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

async function upworkPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: upworkHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Upwork POST ${path} failed (${res.status}): ${err}`);
  }
  return res.json();
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (!UPWORK_ACCESS_TOKEN || UPWORK_ACCESS_TOKEN.trim() === '') {
      return Response.json({
        error: 'UPWORK_ACCESS_TOKEN not configured. Please add it in Settings → Secrets.',
        setup_url: 'https://www.upwork.com/developer/keys/apply',
        configured: false,
      }, { status: 503 });
    }

    const { action, payload } = await req.json();

    // Search for jobs
    if (action === 'search_jobs') {
      const { query, category, budget_min, budget_max, limit = 20 } = payload || {};
      const params = new URLSearchParams({
        q: query || '',
        paging: `0;${limit}`,
        sort: 'recency',
      });
      if (category) params.set('category2_uid', category);
      if (budget_min) params.set('budget', `[${budget_min} TO ${budget_max || '*'}]`);

      const data = await upworkGet(`/profiles/v2/search/jobs.json?${params}`);
      const jobs = (data.jobs?.job || []).map(j => ({
        title: j.title,
        description: j.snippet,
        url: `https://www.upwork.com/jobs/${j.id}`,
        platform: 'upwork',
        category: 'freelance',
        opportunity_type: 'job',
        profit_estimate_low: j.budget ? j.budget * 0.8 : 50,
        profit_estimate_high: j.budget || 500,
        time_sensitivity: 'days',
        source: 'upwork_api',
        tags: j.skills?.map(s => s.prettyName) || [],
        upwork_job_id: j.id,
      }));

      // Save to Opportunity entity
      let saved = 0;
      for (const job of jobs) {
        const existing = await base44.asServiceRole.entities.Opportunity.filter({ url: job.url });
        if (existing.length > 0) continue;
        await base44.asServiceRole.entities.Opportunity.create({
          ...job,
          status: 'new',
          auto_execute: false,
          overall_score: 75,
        });
        saved++;
      }

      return Response.json({ success: true, total: jobs.length, saved, jobs });
    }

    // Submit a proposal to a job
    if (action === 'submit_proposal') {
      const { job_id, cover_letter, bid_amount, duration } = payload;
      if (!job_id || !cover_letter) {
        return Response.json({ error: 'job_id and cover_letter are required' }, { status: 400 });
      }
      const result = await upworkPost(`/hr/v3/contracts/offers`, {
        job_posting_uid: job_id,
        cover_letter,
        bid_amount,
        agreed_hours: duration || 40,
      });
      await base44.entities.ActivityLog.create({
        action_type: 'task_execution',
        message: `📤 Upwork proposal submitted for job ${job_id}`,
        severity: 'success',
        metadata: { job_id, bid_amount, result },
      });
      return Response.json({ success: true, result });
    }

    // Get authenticated user's earnings
    if (action === 'get_earnings') {
      const profile = await upworkGet('/auth/v1/info.json');
      const userId = profile?.info?.uid;
      if (!userId) throw new Error('Could not retrieve Upwork user ID');
      const earnings = await upworkGet(`/reports/v2/timereports/companies/${userId}/hours.json?timePeriod=last_month`);
      return Response.json({ success: true, earnings, user_id: userId });
    }

    // Get current user's Upwork profile
    if (action === 'get_profile') {
      const data = await upworkGet('/auth/v1/info.json');
      return Response.json({ success: true, profile: data });
    }

    return Response.json({ error: 'Unknown action. Use: search_jobs, submit_proposal, get_earnings, get_profile' }, { status: 400 });

  } catch (error) {
    console.error('[upworkAPI] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});