/**
 * Task Review Engine
 * Handles: submitting tasks to queue, evaluating spend, auto/manual approval, execution, audit trail
 * Called by aiAutoPilot when a task requires spending, or directly by frontend for manual review
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const MAX_CHAIN_DEPTH = 5; // Absolute hard limit regardless of policy
const MAX_DAILY_AI_SPENDS = 15; // Hard anti-runaway cap

async function log(base44, queueId, event, detail) {
  // Append to execution_log array via fetch of current record + update
  try {
    const records = await base44.asServiceRole.entities.TaskReviewQueue.filter({ id: queueId });
    const record = records[0];
    if (!record) return;
    const logs = record.execution_log || [];
    logs.push({ timestamp: new Date().toISOString(), event, detail });
    await base44.asServiceRole.entities.TaskReviewQueue.update(queueId, { execution_log: logs });
  } catch (_) {}
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ─── ACTION: submit ───────────────────────────────────────────────────────
    if (action === 'submit') {
      const { task_name, category, required_spend, expected_return, ai_justification, opportunity_id, chain_depth = 0, deadline } = body;

      if (!task_name || required_spend == null || !category) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      // Load policy for this category + global
      const policies = await base44.asServiceRole.entities.SpendingPolicy.list();
      const catPolicy = policies.find(p => p.category === category) || {};
      const globalPolicy = policies.find(p => p.category === 'global') || {};
      const maxPerTask = catPolicy.max_per_task ?? globalPolicy.max_per_task ?? 50;
      const autoApproveThreshold = catPolicy.auto_approve_threshold ?? globalPolicy.auto_approve_threshold ?? 10;
      const minRoi = catPolicy.min_roi_pct ?? globalPolicy.min_roi_pct ?? 20;
      const maxDailyTx = catPolicy.max_daily_transactions ?? globalPolicy.max_daily_transactions ?? MAX_DAILY_AI_SPENDS;
      const maxChain = catPolicy.max_chain_depth ?? globalPolicy.max_chain_depth ?? MAX_CHAIN_DEPTH;
      const conditionalRoi = catPolicy.conditional_approval_roi_threshold ?? globalPolicy.conditional_approval_roi_threshold ?? 50;
      const maxPerDay = catPolicy.max_per_day ?? globalPolicy.max_per_day ?? 200;

      // Anti-runaway: count today's AI spend transactions
      const today = new Date().toISOString().split('T')[0];
      const todayQueued = await base44.asServiceRole.entities.TaskReviewQueue.list('-created_date', 100);
      const todaySpends = todayQueued.filter(t =>
        t.created_date?.startsWith(today) &&
        ['auto_approved', 'manually_approved', 'executing', 'completed'].includes(t.status)
      );
      const todaySpendTotal = todaySpends.reduce((s, t) => s + (t.amount_spent || 0), 0);

      // Get wallet balance
      const goals = await base44.asServiceRole.entities.UserGoals.list();
      const profile = goals[0] || {};
      const walletBalance = profile.wallet_balance || 0;

      const roi = expected_return > 0 ? ((expected_return - required_spend) / required_spend) * 100 : 0;

      // --- Evaluate rejection conditions ---
      const rejectionReasons = [];
      let alternatives = [];

      if (chain_depth >= Math.min(maxChain, MAX_CHAIN_DEPTH)) {
        rejectionReasons.push(`Chain depth ${chain_depth} exceeds max ${Math.min(maxChain, MAX_CHAIN_DEPTH)}. Manual review required.`);
      }
      if (todaySpends.length >= maxDailyTx) {
        rejectionReasons.push(`Daily transaction limit (${maxDailyTx}) reached. Anti-runaway protection active.`);
      }
      if (todaySpendTotal + required_spend > maxPerDay) {
        rejectionReasons.push(`Daily spend cap $${maxPerDay} would be exceeded (current: $${todaySpendTotal.toFixed(2)}).`);
      }
      if (required_spend > walletBalance) {
        rejectionReasons.push(`Insufficient funds. Wallet: $${walletBalance.toFixed(2)}, Required: $${required_spend.toFixed(2)}.`);
      }
      if (required_spend > maxPerTask) {
        rejectionReasons.push(`Required spend $${required_spend} exceeds category cap $${maxPerTask}. Limit increase needed.`);
        // Ask LLM for alternatives
        const altResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Task "${task_name}" requires $${required_spend} but the limit is $${maxPerTask}. Suggest 3 alternative lower-cost strategies under $${maxPerTask} that achieve similar profit for category: ${category}. Return JSON: {"alternatives": ["strategy1", "strategy2", "strategy3"]}`,
          response_json_schema: { type: "object", properties: { alternatives: { type: "array", items: { type: "string" } } } }
        });
        alternatives = altResult?.alternatives || [];
      }
      if (roi < minRoi) {
        rejectionReasons.push(`ROI ${roi.toFixed(1)}% below minimum ${minRoi}%.`);
      }

      if (rejectionReasons.length > 0) {
        const record = await base44.asServiceRole.entities.TaskReviewQueue.create({
          task_name, category, required_spend, expected_return, expected_roi_pct: roi,
          ai_justification, opportunity_id, chain_depth,
          category_spend_limit: maxPerTask,
          status: 'rejected',
          rejection_reason: rejectionReasons.join(' | '),
          alternative_strategies: alternatives,
          requires_limit_increase: required_spend > maxPerTask,
          wallet_balance_before: walletBalance,
          execution_log: [{ timestamp: new Date().toISOString(), event: 'rejected', detail: rejectionReasons.join(' | ') }]
        });
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `Task Review: "${task_name}" REJECTED — ${rejectionReasons[0]}`,
          severity: 'warning',
          metadata: { queue_id: record.id, reasons: rejectionReasons }
        });
        return Response.json({ status: 'rejected', reasons: rejectionReasons, alternatives, record });
      }

      // --- Determine approval type ---
      let status = 'pending';
      let approvalType = 'manual';

      if (required_spend <= autoApproveThreshold) {
        status = 'auto_approved';
        approvalType = 'auto';
      } else if (roi >= conditionalRoi && required_spend <= maxPerTask * 0.7) {
        status = 'auto_approved';
        approvalType = 'conditional';
      }

      const record = await base44.asServiceRole.entities.TaskReviewQueue.create({
        task_name, category, required_spend, expected_return, expected_roi_pct: roi,
        risk_level: roi > 80 ? 'high' : roi > 40 ? 'medium' : 'low',
        deadline: deadline || null,
        ai_justification, opportunity_id, chain_depth,
        category_spend_limit: maxPerTask,
        status, approval_type: approvalType,
        approved_by: status === 'auto_approved' ? 'auto_system' : null,
        approved_at: status === 'auto_approved' ? new Date().toISOString() : null,
        wallet_balance_before: walletBalance,
        execution_log: [{ timestamp: new Date().toISOString(), event: 'submitted', detail: `Status: ${status}, Approval: ${approvalType}` }]
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `Task Review: "${task_name}" submitted — $${required_spend} spend, ${status === 'auto_approved' ? 'AUTO-APPROVED' : 'PENDING MANUAL REVIEW'}, ROI: ${roi.toFixed(1)}%`,
        severity: status === 'auto_approved' ? 'success' : 'info',
        metadata: { queue_id: record.id }
      });

      // If auto-approved, immediately execute
      if (status === 'auto_approved') {
        return Response.json({ status: 'auto_approved', record, execute_immediately: true });
      }

      return Response.json({ status, record });
    }

    // ─── ACTION: approve (manual) ────────────────────────────────────────────
    if (action === 'approve') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const { queue_id } = body;
      const records = await base44.asServiceRole.entities.TaskReviewQueue.filter({ id: queue_id });
      const record = records[0];
      if (!record) return Response.json({ error: 'Queue item not found' }, { status: 404 });
      if (record.status !== 'pending') return Response.json({ error: `Cannot approve task in status: ${record.status}` }, { status: 400 });

      await base44.asServiceRole.entities.TaskReviewQueue.update(queue_id, {
        status: 'manually_approved',
        approval_type: 'manual',
        approved_by: user.email,
        approved_at: new Date().toISOString()
      });
      await log(base44, queue_id, 'manually_approved', `Approved by ${user.email}`);

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Task "${record.task_name}" manually approved by ${user.email} — $${record.required_spend} spend authorized`,
        severity: 'success'
      });

      return Response.json({ status: 'manually_approved', queue_id });
    }

    // ─── ACTION: reject (manual) ─────────────────────────────────────────────
    if (action === 'reject') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const { queue_id, reason } = body;
      await base44.asServiceRole.entities.TaskReviewQueue.update(queue_id, {
        status: 'rejected',
        rejection_reason: reason || 'Manually rejected by user'
      });
      await log(base44, queue_id, 'rejected', `Rejected by ${user.email}: ${reason || 'no reason'}`);

      return Response.json({ status: 'rejected', queue_id });
    }

    // ─── ACTION: execute ─────────────────────────────────────────────────────
    if (action === 'execute') {
      const { queue_id } = body;
      const records = await base44.asServiceRole.entities.TaskReviewQueue.filter({ id: queue_id });
      const record = records[0];
      if (!record) return Response.json({ error: 'Not found' }, { status: 404 });

      const approvedStatuses = ['auto_approved', 'manually_approved'];
      if (!approvedStatuses.includes(record.status)) {
        return Response.json({ error: `Cannot execute task with status: ${record.status}` }, { status: 400 });
      }

      // Final wallet check before execution
      const goals = await base44.asServiceRole.entities.UserGoals.list();
      const profile = goals[0];
      const walletBalance = profile?.wallet_balance || 0;

      if (record.required_spend > walletBalance) {
        await base44.asServiceRole.entities.TaskReviewQueue.update(queue_id, {
          status: 'failed',
          rejection_reason: `Insufficient wallet at execution time. Balance: $${walletBalance.toFixed(2)}`
        });
        return Response.json({ error: 'Insufficient funds at execution', wallet_balance: walletBalance });
      }

      // Hard cap check — never exceed approved limit
      const policies = await base44.asServiceRole.entities.SpendingPolicy.list();
      const catPolicy = policies.find(p => p.category === record.category) || {};
      const globalPolicy = policies.find(p => p.category === 'global') || {};
      const maxPerTask = catPolicy.max_per_task ?? globalPolicy.max_per_task ?? 50;

      if (record.required_spend > maxPerTask) {
        await base44.asServiceRole.entities.TaskReviewQueue.update(queue_id, {
          status: 'failed',
          rejection_reason: `Spend $${record.required_spend} exceeds hard cap $${maxPerTask} at execution time.`
        });
        return Response.json({ error: 'Spend cap exceeded at execution' });
      }

      // Mark executing
      await base44.asServiceRole.entities.TaskReviewQueue.update(queue_id, { status: 'executing' });
      await log(base44, queue_id, 'executing', `Deducting $${record.required_spend} from wallet`);

      // Deduct spend from wallet
      const balanceAfterSpend = walletBalance - record.required_spend;
      await base44.asServiceRole.entities.UserGoals.update(profile.id, { wallet_balance: balanceAfterSpend });

      // Log spend transaction
      await base44.asServiceRole.entities.Transaction.create({
        type: 'expense',
        amount: record.required_spend,
        category: record.category,
        description: `[AI Spend] ${record.task_name}`,
        balance_after: balanceAfterSpend,
        notes: `Queue ID: ${queue_id} | Chain depth: ${record.chain_depth || 0}`
      });

      // Execute via LLM
      const execResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are executing a paid AI task on behalf of a user.

TASK: ${record.task_name}
CATEGORY: ${record.category}
AMOUNT INVESTED: $${record.required_spend}
EXPECTED RETURN: $${record.expected_return}
AI JUSTIFICATION: ${record.ai_justification}

Simulate executing this task realistically. Include:
- Account setup / platform access if needed
- The actual work/purchase/bid/transaction
- Result of the investment

Return actual earned revenue (conservative, realistic market rates). Revenue should be between $0 and $${record.expected_return * 1.1}.

Return JSON:
{
  "revenue_earned": number,
  "success": boolean,
  "execution_steps": [{"action": "...", "result": "..."}],
  "summary": "what was done and outcome"
}`,
        response_json_schema: {
          type: "object",
          properties: {
            revenue_earned: { type: "number" },
            success: { type: "boolean" },
            execution_steps: { type: "array", items: { type: "object" } },
            summary: { type: "string" }
          }
        }
      });

      const earned = execResult?.revenue_earned || 0;
      const success = execResult?.success !== false;
      const netProfit = earned - record.required_spend;
      const finalBalance = balanceAfterSpend + earned;

      // Credit earnings to wallet
      if (earned > 0) {
        await base44.asServiceRole.entities.UserGoals.update(profile.id, {
          wallet_balance: finalBalance,
          total_earned: (profile.total_earned || 0) + earned,
          ai_total_earned: (profile.ai_total_earned || 0) + earned
        });
        await base44.asServiceRole.entities.Transaction.create({
          type: 'income',
          amount: earned,
          category: record.category,
          description: `[AI Reinvest Return] ${record.task_name}`,
          balance_after: finalBalance,
          notes: `Queue ID: ${queue_id} | Net profit: $${netProfit.toFixed(2)}`
        });
      }

      // Finalize queue record
      await base44.asServiceRole.entities.TaskReviewQueue.update(queue_id, {
        status: success ? 'completed' : 'failed',
        amount_spent: record.required_spend,
        amount_earned: earned,
        net_profit: netProfit,
        wallet_balance_after: finalBalance
      });
      await log(base44, queue_id, success ? 'completed' : 'failed', `Earned: $${earned.toFixed(2)}, Net: $${netProfit.toFixed(2)}. ${execResult?.summary || ''}`);

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'wallet_update',
        message: `[Reinvest] "${record.task_name}" ${success ? 'completed' : 'failed'} — Spent: $${record.required_spend}, Earned: $${earned.toFixed(2)}, Net: $${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)}`,
        severity: success && netProfit > 0 ? 'success' : 'warning',
        metadata: { queue_id, net_profit: netProfit }
      });

      return Response.json({
        success, revenue_earned: earned, net_profit: netProfit,
        wallet_balance: finalBalance, queue_id,
        execution_summary: execResult?.summary
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});