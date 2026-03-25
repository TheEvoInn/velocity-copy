/**
 * SEED TEST OPPORTUNITIES
 * Creates realistic test opportunities for real-world execution testing
 * Tests: Discovery → Queuing → Task Execution → Completion
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, target_email, count = 5 } = body;

    if (action === 'seed_test_opportunities') {
      const email = target_email || 'dawnvernor@yahoo.com';

      const opportunities = [];
      const categories = ['freelance', 'service', 'lead_gen', 'arbitrage'];
      const platforms = ['upwork', 'fiverr', 'freelancer.com', 'toptal'];

      for (let i = 0; i < count; i++) {
        const category = categories[i % categories.length];
        const platform = platforms[i % platforms.length];
        const baseAmount = 50 + (i * 10);

        const opp = await base44.asServiceRole.entities.Opportunity.create({
          title: `Test Task ${i + 1}: ${category} - ${platform}`,
          description: `Real-world test opportunity to validate end-to-end execution. Platform: ${platform}, Category: ${category}`,
          url: `https://${platform}.test/opportunity/${i + 1}`,
          category,
          opportunity_type: category === 'freelance' ? 'job' : 'other',
          platform,
          profit_estimate_low: baseAmount,
          profit_estimate_high: baseAmount * 2,
          capital_required: baseAmount * 0.2,
          velocity_score: 75 + Math.random() * 20,
          risk_score: 30 + Math.random() * 20,
          overall_score: 70 + Math.random() * 25,
          status: 'queued',
          time_sensitivity: i % 3 === 0 ? 'immediate' : 'days',
          deadline: new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString(),
          auto_execute: true,
          notes: `Test seed #${i + 1} for real-world execution validation`
        });

        opportunities.push(opp);
      }

      // Create corresponding tasks
      const tasks = [];
      for (const opp of opportunities) {
        const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
          opportunity_id: opp.id,
          url: opp.url,
          opportunity_type: opp.opportunity_type,
          platform: opp.platform,
          identity_id: 'test-identity',
          status: 'queued',
          priority: opp.overall_score,
          estimated_value: opp.profit_estimate_high,
          deadline: opp.deadline,
          queue_timestamp: new Date().toISOString(),
          notes: `Task for opportunity ${opp.id}`
        });
        tasks.push(task);
      }

      // Update user goals with seed metadata
      const goalsList = await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: email },
        '-created_date',
        1
      ).catch(() => []);

      if (goalsList[0]) {
        await base44.asServiceRole.entities.UserGoals.update(goalsList[0].id, {
          onboarded: true,
          autopilot_enabled: true
        }).catch(() => null);
      }

      // Log seeding
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🧪 Test seed: ${count} opportunities + ${count} tasks created for ${email}`,
        severity: 'success',
        metadata: { email, opportunity_count: count, task_count: count }
      }).catch(() => null);

      console.log(`[seedTestOpportunities] Created ${count} opportunities and ${count} tasks for ${email}`);

      return Response.json({
        seeded: true,
        email,
        opportunities_created: opportunities.length,
        tasks_created: tasks.length,
        opportunities: opportunities.map(o => ({
          id: o.id,
          title: o.title,
          platform: o.platform,
          profit_estimate_high: o.profit_estimate_high,
          status: o.status
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});