import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const goals = await base44.entities.UserGoals.list();
    const profile = goals[0] || {};
    const skills = (profile.skills || []).join(', ') || 'freelance writing, web development, graphic design';
    const riskTolerance = profile.risk_tolerance || 'moderate';
    const dailyTarget = profile.daily_target || 1000;

    // Use LLM with internet context to find real job postings
    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a freelance job scout. Search the web RIGHT NOW for active, real freelance job postings on Upwork, Fiverr, Freelancer.com, Toptal, PeoplePerHour, LinkedIn, and Remote.co that match these user skills: ${skills}.

User profile:
- Risk tolerance: ${riskTolerance}
- Daily income target: $${dailyTarget}
- Preferred: zero/low capital required, fast payment, high demand

Find 6-10 HIGH-POTENTIAL leads that are:
1. Currently active/posted within last 48 hours
2. Well-matched to user skills
3. Have clear deliverables and payment terms
4. Realistic to complete within 1-3 days

For each job, return detailed info. Use your internet access to find real postings.

Return a JSON with array of opportunities:
{
  "opportunities": [
    {
      "title": "specific job title from posting",
      "description": "what the job requires, deliverables, client details",
      "category": one of: freelance, service, lead_gen, digital_flip, arbitrage, resale,
      "platform": "Upwork/Fiverr/Freelancer/etc",
      "profit_estimate_low": number,
      "profit_estimate_high": number,
      "capital_required": 0,
      "velocity_score": number 1-100,
      "risk_score": number 1-100,
      "overall_score": number 1-100,
      "time_sensitivity": one of: immediate, hours, days, weeks,
      "apply_url": "direct URL to job posting if known, else platform URL",
      "execution_steps": [
        {"step": 1, "action": "what to do first", "completed": false},
        {"step": 2, "action": "next step", "completed": false}
      ],
      "source": "platform name",
      "tags": ["skill1", "skill2"]
    }
  ]
}`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          opportunities: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                category: { type: "string" },
                platform: { type: "string" },
                profit_estimate_low: { type: "number" },
                profit_estimate_high: { type: "number" },
                capital_required: { type: "number" },
                velocity_score: { type: "number" },
                risk_score: { type: "number" },
                overall_score: { type: "number" },
                time_sensitivity: { type: "string" },
                apply_url: { type: "string" },
                execution_steps: { type: "array", items: { type: "object" } },
                source: { type: "string" },
                tags: { type: "array", items: { type: "string" } }
              }
            }
          }
        }
      }
    });

    const opps = result.opportunities || [];
    const created = [];

    for (const opp of opps) {
      // Avoid duplicates by checking title
      const existing = await base44.asServiceRole.entities.Opportunity.filter({ title: opp.title });
      if (existing && existing.length > 0) continue;

      const record = await base44.asServiceRole.entities.Opportunity.create({
        title: opp.title,
        description: `[${opp.platform || 'Freelance'}] ${opp.description}`,
        category: opp.category || 'freelance',
        profit_estimate_low: opp.profit_estimate_low || 50,
        profit_estimate_high: opp.profit_estimate_high || 200,
        capital_required: opp.capital_required || 0,
        velocity_score: opp.velocity_score || 70,
        risk_score: opp.risk_score || 30,
        overall_score: opp.overall_score || 75,
        status: 'new',
        time_sensitivity: opp.time_sensitivity || 'days',
        execution_steps: opp.execution_steps || [],
        source: opp.apply_url || opp.source || opp.platform,
        tags: [...(opp.tags || []), opp.platform || 'freelance', 'scraped']
      });
      created.push(record);
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `Freelance job scraper found ${created.length} new opportunities matching your skills (${skills.slice(0, 60)}...)`,
      severity: 'success',
      metadata: { count: created.length, skills }
    });

    return Response.json({ success: true, found: opps.length, created: created.length, opportunities: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});