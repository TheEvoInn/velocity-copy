import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both authenticated users and scheduled runs
    let goals = null;
    try {
      const allGoals = await base44.asServiceRole.entities.UserGoals.list();
      goals = allGoals?.[0] || null;
    } catch (_) { /* no goals yet */ }

    const userContext = goals ? `
User Profile:
- Capital: $${goals.available_capital || 0}
- Risk: ${goals.risk_tolerance || 'moderate'}
- Skills: ${(goals.skills || []).join(', ') || 'general'}
- Categories: ${(goals.ai_preferred_categories || goals.preferred_categories || []).join(', ') || 'all'}
- Daily Target: $${goals.ai_daily_target || 500}
- Custom Instructions: ${goals.ai_instructions || 'Find highest velocity, zero capital opportunities'}
` : 'Find top $0 capital opportunities with fastest time to first dollar.';

    const scanResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an elite market scanner. Scan current real-world profit opportunities.

${userContext}

Find 3 NEW, SPECIFIC, ACTIONABLE profit opportunities RIGHT NOW. Use real market knowledge.
Each must include realistic earning estimates based on actual market rates.
Prioritize opportunities with:
- Low or zero capital required
- Fast time to first revenue (under 48hrs preferred)
- Matching user skills/preferences

Return JSON with an array of 3 opportunities.`,
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
                profit_estimate_low: { type: "number" },
                profit_estimate_high: { type: "number" },
                capital_required: { type: "number" },
                velocity_score: { type: "number" },
                risk_score: { type: "number" },
                overall_score: { type: "number" },
                time_sensitivity: { type: "string" },
                source: { type: "string" },
                tags: { type: "array", items: { type: "string" } },
                execution_steps: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      step: { type: "number" },
                      action: { type: "string" },
                      completed: { type: "boolean" }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const newOpps = scanResult?.opportunities || [];
    const created = [];

    for (const opp of newOpps) {
      const record = await base44.asServiceRole.entities.Opportunity.create({
        ...opp,
        status: 'new',
        capital_required: opp.capital_required || 0
      });
      created.push(record);
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'scan',
      message: `Market scan complete. ${created.length} new opportunities added to the feed.`,
      severity: 'success'
    });

    return Response.json({ success: true, created: created.length, opportunities: created });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});