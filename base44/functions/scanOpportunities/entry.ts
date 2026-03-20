/**
 * Scan Opportunities — Unified real-data opportunity discovery
 * Source 1: AI web search (InvokeLLM + internet) for contests, grants, giveaways
 * Source 2: RapidAPI job feeds (real live jobs via realJobSearch)
 * Source 3: n8n MCP workflows (if configured)
 *
 * NO simulated or placeholder data is ever created.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const N8N_MCP_URL = 'https://velocitypulse.app.n8n.cloud/mcp-server/http';
const N8N_TOKEN = Deno.env.get('N8N_MCP_BEARER_TOKEN');

async function scanViaAIWebSearch(base44, categories) {
  const now = new Date();
  const results = [];

  for (const cat of categories) {
    try {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Search the internet right now for 3 real, currently active, legitimate ${cat.label} as of ${now.toISOString().slice(0, 10)}.

CRITICAL REQUIREMENT — DIGITAL ONLY:
Only include opportunities that can be completed 100% online/digitally with NO physical requirements whatsoever.
EXCLUDE anything that requires: in-person attendance, physical mail/shipping, physical documents, a physical product, in-store visit, phone calls, or any offline action.
INCLUDE only: online forms, digital submissions, email applications, web-based contests, online sweepstakes entries, digital grant applications, remote/online freelance work.

For each qualifying opportunity, return a JSON object with:
- title: exact name of the opportunity
- description: 1-2 sentences explaining what it is and how to earn
- url: direct link to apply/enter (must be a real, working URL)
- platform: the website name
- profit_low: minimum USD you can earn (number)
- profit_high: maximum USD you can earn (number)
- time_sensitivity: one of immediate/hours/days/weeks/ongoing
- deadline: ISO date string if known, otherwise null
- digital_completion: true (only include if this is true)

Only include opportunities that are definitively REAL, ACTIVE TODAY, and 100% DIGITALLY COMPLETABLE.
If you cannot find 3 qualifying ones, return fewer rather than invent any or include non-digital ones.
Return ONLY a JSON object: { "opportunities": [...] }`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            opportunities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  url: { type: 'string' },
                  platform: { type: 'string' },
                  profit_low: { type: 'number' },
                  profit_high: { type: 'number' },
                  time_sensitivity: { type: 'string' },
                  deadline: { type: 'string' },
                },
              },
            },
          },
        },
      });

      const opps = result?.opportunities || [];
      for (const opp of opps) {
        if (!opp.title || !opp.url) continue;
        // Skip if URL looks fake/generic
        if (opp.url.includes('example.com') || opp.url === '#') continue;
        results.push({ ...opp, category: cat.name, opportunity_type: cat.type, source: 'ai_web_search' });
      }
      console.log(`[AI Web Search] ${cat.name}: found ${opps.length} opportunities`);
    } catch (e) {
      console.error(`[AI Web Search] Error for ${cat.name}:`, e.message);
    }
  }
  return results;
}

async function scanViaN8nMCP(base44) {
  if (!N8N_TOKEN) return [];
  try {
    const mcpRes = await fetch(N8N_MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Authorization': `Bearer ${N8N_TOKEN}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/list',
        id: 1,
      }),
    });

    const text = await mcpRes.text();
    const contentType = mcpRes.headers.get('content-type') || '';
    let mcpData;
    if (contentType.includes('text/event-stream')) {
      for (const line of text.split('\n')) {
        if (line.startsWith('data:')) {
          try { mcpData = JSON.parse(line.slice(5).trim()); } catch { /* skip */ }
        }
      }
    } else {
      mcpData = JSON.parse(text);
    }

    const tools = mcpData?.result?.tools || [];
    const scanTool = tools.find(t => t.name?.toLowerCase().includes('scan') || t.name?.toLowerCase().includes('job') || t.name?.toLowerCase().includes('opportunity'));

    if (scanTool) {
      console.log(`[n8n MCP] Found scan tool: ${scanTool.name}`);
      const execRes = await fetch(N8N_MCP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/event-stream',
          'Authorization': `Bearer ${N8N_TOKEN}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: scanTool.name, arguments: {} },
          id: 2,
        }),
      });
      const execText = await execRes.text();
      const execContentType = execRes.headers.get('content-type') || '';
      let execData;
      if (execContentType.includes('text/event-stream')) {
        for (const line of execText.split('\n')) {
          if (line.startsWith('data:')) {
            try { execData = JSON.parse(line.slice(5).trim()); } catch { /* skip */ }
          }
        }
      } else {
        execData = JSON.parse(execText);
      }
      const content = execData?.result?.content?.[0]?.text;
      if (content) {
        const parsed = JSON.parse(content);
        const opps = Array.isArray(parsed) ? parsed : parsed.opportunities || [];
        console.log(`[n8n MCP] ${scanTool.name} returned ${opps.length} items`);
        return opps.map(o => ({ ...o, source: 'n8n_mcp' }));
      }
    }
  } catch (e) {
    console.error('[n8n MCP] Error:', e.message);
  }
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sources = body.sources || ['ai_web', 'rapidapi', 'n8n'];

    const allOpps = [];
    const scanSummary = [];

    // ── Source 1: AI Web Search (contests, grants, giveaways) ────────────────
    if (sources.includes('ai_web')) {
      const aiCategories = [
        { name: 'contest', type: 'contest', label: 'writing contests, design contests, hackathons with cash prizes open for entry' },
        { name: 'grant', type: 'grant', label: 'small business grants, creative grants, or startup grants currently accepting applications' },
        { name: 'giveaway', type: 'giveaway', label: 'legitimate sweepstakes and cash giveaways currently open for entry' },
      ];
      const aiOpps = await scanViaAIWebSearch(base44, aiCategories);
      allOpps.push(...aiOpps);
      scanSummary.push({ source: 'ai_web_search', found: aiOpps.length });
    }

    // ── Source 2: RapidAPI real job feeds ─────────────────────────────────────
    if (sources.includes('rapidapi') && Deno.env.get('RAPIDAPI_KEY')) {
      try {
        const jobRes = await base44.asServiceRole.functions.invoke('realJobSearch', {
          query: 'remote freelance writing development design marketing',
          sources: ['jsearch', 'freelancer'],
        });
        const jobData = jobRes?.data || jobRes;
        const jobsFound = jobData?.total_fetched || 0;
        scanSummary.push({ source: 'rapidapi_jobs', found: jobsFound, saved: jobData?.saved || 0 });
        console.log(`[RapidAPI] Fetched ${jobsFound} real jobs`);
      } catch (e) {
        console.error('[RapidAPI] Error:', e.message);
        scanSummary.push({ source: 'rapidapi_jobs', error: e.message });
      }
    }

    // ── Source 3: n8n MCP ─────────────────────────────────────────────────────
    if (sources.includes('n8n')) {
      const mcpOpps = await scanViaN8nMCP(base44);
      allOpps.push(...mcpOpps);
      scanSummary.push({ source: 'n8n_mcp', found: mcpOpps.length });
    }

    // ── Upwork API (enabled when UPWORK_ACCESS_TOKEN is configured) ───────────
    // Add UPWORK_ACCESS_TOKEN to Secrets to enable Upwork job scanning

    // ── Save AI web search + n8n opps to database ────────────────────────────
    let totalSaved = 0;
    for (const opp of allOpps) {
      if (!opp.title || !opp.url) continue;
      const existing = await base44.asServiceRole.entities.Opportunity.filter({ url: opp.url });
      if (existing.length > 0) continue;

      await base44.asServiceRole.entities.Opportunity.create({
        title: opp.title,
        description: opp.description || '',
        url: opp.url,
        category: opp.category || 'other',
        opportunity_type: opp.opportunity_type || opp.type || 'other',
        platform: opp.platform || '',
        profit_estimate_low: opp.profit_low || opp.profit_estimate_low || 0,
        profit_estimate_high: opp.profit_high || opp.profit_estimate_high || 0,
        time_sensitivity: opp.time_sensitivity || 'days',
        deadline: opp.deadline || null,
        status: 'new',
        auto_execute: false,
        source: opp.source || 'scan',
        overall_score: 65,
      });
      totalSaved++;
    }

    const totalFromRapidApi = scanSummary.find(s => s.source === 'rapidapi_jobs')?.saved || 0;
    const totalFromUpwork = scanSummary.find(s => s.source === 'upwork_api')?.saved || 0;
    const grandTotal = totalSaved + totalFromRapidApi + totalFromUpwork;

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `[Unified Scan] Saved ${grandTotal} new real opportunities across ${scanSummary.length} sources`,
      severity: grandTotal > 0 ? 'success' : 'info',
      metadata: { grand_total: grandTotal, sources: scanSummary },
    });

    return Response.json({
      success: true,
      grand_total_saved: grandTotal,
      sources: scanSummary,
    });

  } catch (error) {
    console.error('[scanOpportunities] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});