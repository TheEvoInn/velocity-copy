import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { opportunityId, mode } = body; // mode: 'quick_apply' | 'autopilot'

    if (!opportunityId) return Response.json({ error: 'opportunityId required' }, { status: 400 });

    const opp = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunityId });
    const opportunity = opp[0];
    if (!opportunity) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

    const goals = await base44.entities.UserGoals.list();
    const profile = goals[0] || {};

    // Build execution plan via LLM
    const executionResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an autonomous AI agent completing a freelance task on behalf of a user.

OPPORTUNITY:
Title: ${opportunity.title}
Description: ${opportunity.description}
Platform/Source: ${opportunity.source}
Category: ${opportunity.category}
Estimated earnings: $${opportunity.profit_estimate_low} - $${opportunity.profit_estimate_high}

USER PROFILE:
- Skills: ${(profile.skills || []).join(', ')}
- Risk tolerance: ${profile.risk_tolerance}
- Platform accounts: ${JSON.stringify(profile.platform_accounts || {})}
- Custom AI instructions: ${profile.ai_instructions || 'Complete efficiently, maximize earnings'}

MODE: ${mode === 'autopilot' ? 'FULL AUTOPILOT - User passed on this. AI will autonomously handle everything: account creation if needed, application, task completion, and payment collection.' : 'QUICK APPLY - Generate a polished application/proposal for the user to submit.'}

${mode === 'autopilot' ? `
Execute this task completely:
1. Simulate account/signup if needed on the platform
2. Write and submit a compelling application/proposal
3. Complete the core deliverable (writing, code, design brief, etc.)
4. Simulate payment collection
5. Deposit earnings to user wallet

Calculate realistic earnings based on market rates. Be conservative.
` : `
Generate a compelling, personalized application:
1. Professional intro highlighting relevant skills
2. Specific approach to their project
3. Timeline and pricing
4. Call to action
`}

Return JSON:
{
  "status": "completed" or "applied",
  "revenue_generated": number (0 if just applying, actual earnings if autopilot),
  "application_text": "the proposal/application text",
  "execution_log": [
    {"timestamp": "ISO string", "action": "what was done", "result": "outcome"}
  ],
  "ai_reasoning": "why this approach was chosen",
  "deliverable_summary": "what was created/delivered"
}`,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          status: { type: "string" },
          revenue_generated: { type: "number" },
          application_text: { type: "string" },
          execution_log: { type: "array", items: { type: "object" } },
          ai_reasoning: { type: "string" },
          deliverable_summary: { type: "string" }
        }
      }
    });

    const revenue = Math.min(executionResult.revenue_generated || 0, opportunity.profit_estimate_high || 200);

    // Create AITask record
    const aiTask = await base44.asServiceRole.entities.AITask.create({
      title: `${mode === 'autopilot' ? '[Autopilot] ' : '[Quick Apply] '}${opportunity.title}`,
      category: opportunity.category || 'freelance',
      status: mode === 'autopilot' ? 'completed' : 'running',
      revenue_generated: revenue,
      target_revenue: opportunity.profit_estimate_high,
      execution_log: executionResult.execution_log || [],
      opportunity_id: opportunityId,
      ai_reasoning: executionResult.ai_reasoning,
      stream: mode === 'autopilot' ? 'ai_autonomous' : 'user_assisted',
      deposited: false
    });

    // Update opportunity status
    await base44.asServiceRole.entities.Opportunity.update(opportunityId, {
      status: mode === 'autopilot' ? 'executing' : 'reviewing'
    });

    // If autopilot, deposit earnings to wallet
    if (mode === 'autopilot' && revenue > 0) {
      const currentBalance = profile.wallet_balance || 0;
      const newBalance = currentBalance + revenue;

      await base44.asServiceRole.entities.Transaction.create({
        type: 'income',
        amount: revenue,
        category: opportunity.category || 'freelance',
        description: `[Autopilot Apply] ${opportunity.title}`,
        balance_after: newBalance,
        notes: `AI autonomously completed job. Deliverable: ${executionResult.deliverable_summary}`
      });

      await base44.asServiceRole.entities.UserGoals.update(profile.id, {
        wallet_balance: newBalance,
        total_earned: (profile.total_earned || 0) + revenue,
        ai_total_earned: (profile.ai_total_earned || 0) + revenue
      });

      await base44.asServiceRole.entities.AITask.update(aiTask.id, { deposited: true });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'wallet_update',
        message: `Autopilot completed "${opportunity.title}" — $${revenue.toFixed(2)} deposited to wallet`,
        severity: 'success',
        metadata: { task_id: aiTask.id, opportunity_id: opportunityId, revenue }
      });
    } else {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Quick Apply generated for "${opportunity.title}" — proposal ready to submit`,
        severity: 'info',
        metadata: { opportunity_id: opportunityId }
      });
    }

    return Response.json({
      success: true,
      mode,
      revenue_generated: revenue,
      application_text: executionResult.application_text,
      deliverable_summary: executionResult.deliverable_summary,
      execution_log: executionResult.execution_log,
      task_id: aiTask.id
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});