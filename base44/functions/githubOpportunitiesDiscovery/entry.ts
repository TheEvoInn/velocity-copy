import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const githubToken = Deno.env.get('GITHUB_API_TOKEN');
    if (!githubToken) {
      return Response.json({ 
        error: 'GitHub token not configured. Add GITHUB_API_TOKEN to secrets.' 
      }, { status: 500 });
    }

    // Fetch real opportunities from GitHub
    const opportunities = [];

    // Search for bounty/job related issues
    const searchQueries = [
      'label:bounty is:open',
      'label:paid-work is:open',
      'label:freelance is:open',
      'label:for-hire is:open',
      'label:help-wanted is:open milestone:paid'
    ];

    for (const query of searchQueries) {
      const response = await fetch(
        `https://api.github.com/search/issues?q=${encodeURIComponent(query)}+type:issue&sort=updated&order=desc&per_page=20`,
        {
          headers: {
            'Authorization': `token ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) continue;

      const data = await response.json();
      
      for (const issue of data.items || []) {
        const opp = {
          title: issue.title,
          description: issue.body?.substring(0, 500) || '',
          url: issue.html_url,
          platform: 'GitHub',
          category: 'freelance',
          opportunity_type: 'bounty',
          source: `GitHub - ${issue.repository_url.split('/').slice(-1)[0]}`,
          profit_estimate_low: 50,
          profit_estimate_high: 500,
          deadline: issue.milestone?.due_on || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          time_sensitivity: 'days',
          status: 'new',
          auto_execute: true,
          tags: ['github', 'bounty', issue.state]
        };

        opportunities.push(opp);
      }
    }

    // Create opportunities in database
    if (opportunities.length > 0) {
      await base44.asServiceRole.entities.Opportunity.bulkCreate(opportunities);
    }

    return Response.json({
      success: true,
      discovered: opportunities.length,
      opportunities: opportunities
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});