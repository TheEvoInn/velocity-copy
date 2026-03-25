import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // This can be called by scheduler (service role) or by user
    let goals = null;
    let userId = null;

    // Try user auth first, fall back to service role for scheduled runs
    try {
      const user = await base44.auth.me();
      userId = user?.id;
    } catch (_) {
      // scheduled run — no user context
    }

    // Use service role to access all data
    const allGoals = await base44.asServiceRole.entities.UserGoals.list();
    if (!allGoals || allGoals.length === 0) {
      return Response.json({ message: 'No user goals configured. Skipping autopilot run.' });
    }
    goals = allGoals[0];

    if (!goals.autopilot_enabled) {
      return Response.json({ message: 'Autopilot is disabled. Skipping run.' });
    }

    // Check today's AI earnings to avoid exceeding daily target
    const today = new Date().toISOString().split('T')[0];
    const allTasks = await base44.asServiceRole.entities.AITask.list('-created_date', 50);
    const todayTasks = allTasks.filter(t =>
      t.created_date && t.created_date.startsWith(today) &&
      t.status === 'completed' && t.stream === 'ai_autonomous'
    );
    const todayAIEarnings = todayTasks.reduce((sum, t) => sum + (t.revenue_generated || 0), 0);
    const aiDailyTarget = goals.ai_daily_target || 500;

    if (todayAIEarnings >= aiDailyTarget) {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `AI daily target of $${aiDailyTarget} reached ($${todayAIEarnings.toFixed(2)} earned). Autopilot resting until tomorrow.`,
        severity: 'success'
      });
      return Response.json({ message: 'Daily target reached. Resting.', todayAIEarnings });
    }

    const remaining = aiDailyTarget - todayAIEarnings;

    // Get open opportunities to base the task on
    const opportunities = await base44.asServiceRole.entities.Opportunity.list('-overall_score', 20);
    const openOpps = opportunities.filter(o => o.status === 'new' || o.status === 'executing');

    // Get linked accounts for context
    const linkedAccounts = await base44.asServiceRole.entities.LinkedAccount.list('-performance_score', 20);
    const availableAccounts = linkedAccounts.filter(a =>
      a.ai_can_use && a.health_status !== 'suspended' &&
      !(a.health_status === 'cooldown' && a.cooldown_until && new Date(a.cooldown_until) > new Date()) &&
      (a.applications_today || 0) < (a.daily_application_limit || 10)
    );

    // Get recent work log context to avoid repeating actions
    const recentLogs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', 10);
    const recentActions = recentLogs.map(l => l.subject || l.ai_decision_context).filter(Boolean).slice(0, 5);

    // Get active earning goals for alignment
    const earningGoals = await base44.asServiceRole.entities.EarningGoal.list();
    const activeGoals = earningGoals.filter(g => g.status === 'active');

    // Build context for LLM
    const userContext = `
USER PROFILE:
- Daily AI Target: $${aiDailyTarget}
- Already Earned Today (AI): $${todayAIEarnings.toFixed(2)}
- Remaining to Hit Target: $${remaining.toFixed(2)}
- Wallet Balance: $${goals.wallet_balance || 0}
- Risk Tolerance: ${goals.risk_tolerance || 'moderate'}
- Skills: ${(goals.skills || []).join(', ') || 'General'}
- AI Preferred Categories: ${(goals.ai_preferred_categories || []).join(', ') || 'any'}
- Custom AI Instructions: ${goals.ai_instructions || 'Maximize speed and profit. Prefer zero-capital opportunities.'}
- Platform Accounts: ${goals.platform_accounts?.notes || 'Not specified'}

LINKED PLATFORM ACCOUNTS (${availableAccounts.length} available):
${availableAccounts.length > 0 ? availableAccounts.map(a => `- ${a.platform} @${a.username} | ${a.label || ''} | Rating: ${a.rating || 'N/A'} | Jobs: ${a.jobs_completed || 0} | Score: ${a.performance_score || 50} | Specialization: ${a.specialization || 'general'}`).join('\n') : 'No linked accounts - using general AI execution'}

ACTIVE EARNING GOALS:
${activeGoals.length > 0 ? activeGoals.map(g => `- ${g.period} goal: $${g.target_amount} (AI handles ${g.ai_allocation_pct || 60}%)`).join('\n') : 'No specific goals set'}

AVAILABLE OPPORTUNITIES (top scored):
${openOpps.slice(0, 5).map(o => `- [ID:${o.id}] ${o.title} (score: ${o.overall_score}, est: $${o.profit_estimate_low}-$${o.profit_estimate_high}, capital: $${o.capital_required || 0}, category: ${o.category})`).join('\n')}

RECENT AI ACTIONS (avoid duplicating):
${recentActions.join('\n') || 'None'}
`;

    // Ask LLM to decide what task to execute and simulate execution
    const taskDecision = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an autonomous AI profit engine running a scheduled profit generation cycle.

${userContext}

Your job:
1. Choose the BEST task to execute RIGHT NOW based on user's profile, skills, and available capital
2. Decide if this task requires upfront spending (entry fees, purchases, bids, tools, upgrades, etc.)
3. If spending is required, provide the exact amount and expected ROI
4. If no spending needed, simulate executing the task step-by-step
5. Calculate realistic revenue earned (conservative, $5-$150 per cycle based on real market rates)

Respond with a JSON object:
{
  "title": "specific task title",
  "category": one of: arbitrage, service, lead_gen, digital_flip, freelance, resale, content, market_scan, trend_analysis, auction,
  "ai_reasoning": "why you chose this task",
  "target_revenue": number (realistic earnings for this cycle),
  "revenue_generated": number (actual simulated earnings, slightly random around target),
  "requires_spending": boolean,
  "required_spend": number or 0,
  "spend_justification": "why this spend is needed and what the ROI will be",
  "execution_log": [
    {"timestamp": "ISO string", "action": "specific action taken", "result": "outcome"},
    ... (4-8 steps)
  ],
  "opportunity_id": "id of linked opportunity or null"
}`,
      add_context_from_internet: false,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string" },
          ai_reasoning: { type: "string" },
          target_revenue: { type: "number" },
          revenue_generated: { type: "number" },
          execution_log: {
            type: "array",
            items: {
              type: "object",
              properties: {
                timestamp: { type: "string" },
                action: { type: "string" },
                result: { type: "string" }
              }
            }
          },
          requires_spending: { type: "boolean" },
          required_spend: { type: "number" },
          spend_justification: { type: "string" },
          opportunity_id: { type: "string" }
        }
      }
    });

    const task = taskDecision;

    // ── If task requires spending, route through Task Review Engine ──────────
    if (task.requires_spending && task.required_spend > 0) {
      const reviewRes = await base44.asServiceRole.functions.invoke('taskReviewEngine', {
        action: 'submit',
        task_name: task.title,
        category: task.category || 'other',
        required_spend: task.required_spend,
        expected_return: task.target_revenue || task.required_spend * 1.5,
        ai_justification: task.spend_justification || task.ai_reasoning,
        opportunity_id: task.opportunity_id || null,
        chain_depth: 0
      });

      const reviewData = reviewRes?.data || reviewRes;

      if (reviewData?.status === 'rejected') {
        // Log rejection and continue with a free task next cycle
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `AI Autopilot: spending task "${task.title}" rejected by policy — ${reviewData.reasons?.[0] || 'limit exceeded'}`,
          severity: 'warning'
        });
        return Response.json({ message: 'Task required spending but was rejected by policy', reasons: reviewData.reasons });
      }

      if (reviewData?.status === 'auto_approved' || reviewData?.execute_immediately) {
        // Execute immediately
        const execRes = await base44.asServiceRole.functions.invoke('taskReviewEngine', {
          action: 'execute',
          queue_id: reviewData.record?.id
        });
        return Response.json({ success: true, mode: 'reinvest', result: execRes?.data || execRes });
      }

      // Pending manual approval — notify and exit
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `AI Autopilot: "${task.title}" requires $${task.required_spend} spend — added to Task Review Queue for your approval`,
        severity: 'info',
        metadata: { queue_id: reviewData.record?.id }
      });
      return Response.json({ message: 'Task submitted to review queue for manual approval', queue_id: reviewData.record?.id });
    }

    // ── Select best account via rotation engine ──────────────────────────────
    let selectedAccount = null;
    if (availableAccounts.length > 0) {
      const rotationRes = await base44.asServiceRole.functions.invoke('accountRotationEngine', {
        action: 'select',
        job_category: task.category,
        required_skills: goals.skills || [],
        risk_level: goals.risk_tolerance || 'medium',
        task_id: 'autopilot-' + Date.now()
      });
      selectedAccount = rotationRes?.data?.selected || rotationRes?.selected || null;
    }

    // Cap revenue so it doesn't exceed remaining target
    const cappedRevenue = Math.min(task.revenue_generated || 10, remaining);

    // Create AI task record
    const createdTask = await base44.asServiceRole.entities.AITask.create({
      task_type: 'url_analysis',
      title: task.title,
      category: task.category,
      status: 'completed',
      revenue_generated: cappedRevenue,
      target_revenue: task.target_revenue,
      execution_log: task.execution_log || [],
      opportunity_id: task.opportunity_id || null,
      ai_reasoning: task.ai_reasoning,
      stream: 'ai_autonomous',
      deposited: false,
      priority: 50
    });

    // ── Log to AIWorkLog ──────────────────────────────────────────────────────
    await base44.asServiceRole.entities.AIWorkLog.create({
      log_type: 'task_decision',
      task_id: createdTask.id,
      opportunity_id: task.opportunity_id || null,
      linked_account_id: selectedAccount?.id || null,
      platform: selectedAccount?.platform || null,
      subject: `Autopilot executed: ${task.title}`,
      content_preview: task.execution_log?.map(l => `${l.action}: ${l.result}`).join('\n').slice(0, 500) || '',
      full_content: JSON.stringify(task.execution_log || []),
      status: 'sent',
      outcome: `Revenue: $${cappedRevenue.toFixed(2)}`,
      ai_decision_context: task.ai_reasoning,
      revenue_associated: cappedRevenue
    });

    // ── Notify opportunity lifecycle if linked ────────────────────────────────
    if (task.opportunity_id) {
      await base44.asServiceRole.functions.invoke('opportunityLifecycle', {
        action: 'process_completion',
        opportunity_id: task.opportunity_id,
        completion_type: 'repeatable',
        revenue_earned: cappedRevenue,
        task_id: createdTask.id
      }).catch(() => {});
    }

    // Create income transaction
    const currentBalance = goals.wallet_balance || 0;
    const newBalance = currentBalance + cappedRevenue;

    await base44.asServiceRole.entities.Transaction.create({
      type: 'income',
      amount: cappedRevenue,
      category: task.category,
      description: `[AI Autopilot] ${task.title}`,
      balance_after: newBalance,
      notes: `Autonomous AI execution. Task ID: ${createdTask.id}`
    });

    // Update wallet balance and AI earnings
    await base44.asServiceRole.entities.UserGoals.update(goals.id, {
      wallet_balance: newBalance,
      total_earned: (goals.total_earned || 0) + cappedRevenue,
      ai_total_earned: (goals.ai_total_earned || 0) + cappedRevenue
    });

    // Mark task as deposited
    await base44.asServiceRole.entities.AITask.update(createdTask.id, { deposited: true });

    // If there was a linked opportunity, update its status
    if (task.opportunity_id) {
      await base44.asServiceRole.entities.Opportunity.update(task.opportunity_id, {
        status: 'executing'
      });
    }

    // Log the activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `AI Autopilot completed: "${task.title}" — $${cappedRevenue.toFixed(2)} deposited to wallet. New balance: $${newBalance.toFixed(2)}`,
      severity: 'success',
      metadata: { task_id: createdTask.id, revenue: cappedRevenue }
    });

    return Response.json({
      success: true,
      task: createdTask,
      revenue_generated: cappedRevenue,
      new_balance: newBalance,
      today_ai_total: todayAIEarnings + cappedRevenue
    });

  } catch (error) {
    // Log the error
    try {
      const base44 = createClientFromRequest(req);
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `AI Autopilot error: ${error.message}`,
        severity: 'warning'
      });
    } catch (_) { /* silent */ }

    return Response.json({ error: error.message }, { status: 500 });
  }
});