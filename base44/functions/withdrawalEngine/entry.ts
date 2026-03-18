/**
 * Withdrawal & Reinvestment Engine
 * Actions:
 *   run_cycle        — main autonomous loop (scheduled every 30 min)
 *   get_status       — current engine state, pending payouts, balances
 *   manual_withdraw  — user-triggered withdrawal
 *   manual_reinvest  — user-triggered reinvestment
 *   update_policy    — save engine configuration
 *   emergency_stop   — halt all automations immediately
 *   override_action  — user overrides a pending engine action
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n) { return (n || 0).toFixed(2); }

async function auditLog(base44, type, data) {
  await base44.asServiceRole.entities.EngineAuditLog.create({
    action_type: type,
    ...data,
    metadata: { ...data.metadata, timestamp: new Date().toISOString() }
  }).catch(() => {});
}

async function activityLog(base44, message, severity = 'info', metadata = {}) {
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'wallet_update',
    message,
    severity,
    metadata
  }).catch(() => {});
}

// ─── Payout clearance monitor ──────────────────────────────────────────────
async function checkPayoutClearances(base44, profile) {
  const pendingTxs = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
  const pending = pendingTxs.filter(t =>
    t.type === 'income' &&
    (t.payout_status === 'pending' || t.payout_status === 'in_transit' || t.payout_status === 'processing')
  );

  const cleared = [];
  const delayed = [];
  const now = new Date();

  for (const tx of pending) {
    const created = new Date(tx.created_date);
    const ageHours = (now - created) / 3600000;

    // Platform-specific clearance windows
    const CLEARANCE_HOURS = {
      upwork: 120, fiverr: 336, freelancer: 168, peopleperhour: 120, other: 72
    };
    const platform = (tx.platform || 'other').toLowerCase();
    const expectedClearHours = CLEARANCE_HOURS[platform] || 72;

    if (tx.payout_date && new Date(tx.payout_date) <= now) {
      // Payout date passed → mark cleared
      await base44.asServiceRole.entities.Transaction.update(tx.id, {
        payout_status: 'cleared'
      });
      cleared.push(tx);
      await auditLog(base44, 'payout_cleared', {
        amount: tx.net_amount || tx.amount,
        source_account: tx.platform || 'unknown',
        ai_reasoning: `Payout date ${tx.payout_date} reached, funds cleared`,
        wallet_balance_before: profile.wallet_balance || 0,
        wallet_balance_after: profile.wallet_balance || 0,
        status: 'success',
        linked_transaction_id: tx.id
      });
    } else if (ageHours > expectedClearHours * 1.5) {
      // Significantly overdue
      delayed.push(tx);
      await auditLog(base44, 'payout_delayed', {
        amount: tx.net_amount || tx.amount,
        source_account: tx.platform || 'unknown',
        ai_reasoning: `Transaction ${ageHours.toFixed(0)}h old, expected clearance at ${expectedClearHours}h`,
        status: 'flagged',
        linked_transaction_id: tx.id
      });
    }
  }

  return { cleared, delayed, totalPendingAmount: pending.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0) };
}

// ─── Fraud detection ───────────────────────────────────────────────────────
async function runFraudChecks(base44, transactions, policy) {
  if (!policy.fraud_detection_enabled) return { flagged: false };

  const recent = transactions.filter(t => {
    const age = (new Date() - new Date(t.created_date)) / 3600000;
    return age < 24;
  });

  const recentTotal = recent.reduce((s, t) => s + (t.amount || 0), 0);
  const flags = [];

  // Unusual spike: >10x daily average
  const allIncome = transactions.filter(t => t.type === 'income');
  const avgDaily = allIncome.length > 7
    ? allIncome.slice(0, 30).reduce((s, t) => s + t.amount, 0) / 30
    : 0;

  if (avgDaily > 0 && recentTotal > avgDaily * 10) {
    flags.push(`Unusual volume spike: $${fmt(recentTotal)} in 24h vs avg $${fmt(avgDaily)}/day`);
  }

  // Duplicate amounts
  const amounts = recent.map(t => t.amount);
  const dupes = amounts.filter((a, i) => amounts.indexOf(a) !== i);
  if (dupes.length > 3) {
    flags.push(`${dupes.length} duplicate-amount transactions in 24h`);
  }

  if (flags.length > 0) {
    await auditLog(base44, 'fraud_flag', {
      ai_reasoning: flags.join(' | '),
      status: 'flagged',
      metadata: { flags, recent_total: recentTotal }
    });
  }

  return { flagged: flags.length > 0, flags };
}

// ─── Withdrawal decision ───────────────────────────────────────────────────
async function evaluateWithdrawal(base44, profile, policy, transactions) {
  const balance = profile.wallet_balance || 0;
  const safetyBuffer = policy.safety_buffer || 200;
  const minThreshold = policy.min_withdrawal_threshold || 100;
  const withdrawPct = (policy.withdrawal_pct || 60) / 100;
  const dailyLimit = policy.daily_withdrawal_limit || 5000;

  const eligibleForWithdrawal = balance - safetyBuffer;
  if (eligibleForWithdrawal < minThreshold) {
    return { should_withdraw: false, reason: `Eligible $${fmt(eligibleForWithdrawal)} below threshold $${fmt(minThreshold)}` };
  }

  // Check daily withdrawal already done
  const today = new Date().toISOString().split('T')[0];
  const todayWithdrawals = transactions.filter(t =>
    t.type === 'expense' &&
    t.description?.includes('Auto-Withdrawal') &&
    t.created_date?.startsWith(today)
  );
  const todayWithdrawnTotal = todayWithdrawals.reduce((s, t) => s + t.amount, 0);
  if (todayWithdrawnTotal >= dailyLimit) {
    return { should_withdraw: false, reason: `Daily limit $${fmt(dailyLimit)} reached ($${fmt(todayWithdrawnTotal)} withdrawn today)` };
  }

  const proposedAmount = Math.min(eligibleForWithdrawal * withdrawPct, dailyLimit - todayWithdrawnTotal);

  // Use LLM to validate decision
  const aiDecision = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a financial automation engine deciding whether to trigger an auto-withdrawal.

Current wallet balance: $${fmt(balance)}
Safety buffer required: $${fmt(safetyBuffer)}
Eligible for withdrawal: $${fmt(eligibleForWithdrawal)}
Proposed withdrawal amount: $${fmt(proposedAmount)}
Min threshold: $${fmt(minThreshold)}
Daily limit remaining: $${fmt(dailyLimit - todayWithdrawnTotal)}
Recent earning trend (last 7 days): ${transactions.filter(t => t.type === 'income' && (new Date() - new Date(t.created_date)) < 7 * 86400000).reduce((s, t) => s + t.amount, 0).toFixed(2)}

Decide if it's optimal to withdraw now. Consider: is the user likely to need this capital for reinvestment soon? Are there pending high-ROI opportunities? Is this an efficient time to withdraw?

Return JSON: { "proceed": boolean, "recommended_amount": number, "reasoning": string, "risk_level": "low|medium|high" }`,
    response_json_schema: {
      type: "object",
      properties: {
        proceed: { type: "boolean" },
        recommended_amount: { type: "number" },
        reasoning: { type: "string" },
        risk_level: { type: "string" }
      }
    }
  });

  return {
    should_withdraw: aiDecision?.proceed !== false,
    amount: aiDecision?.recommended_amount || proposedAmount,
    reasoning: aiDecision?.reasoning || 'Threshold met, proceeding with withdrawal',
    risk_level: aiDecision?.risk_level || 'low',
    balance_after: balance - (aiDecision?.recommended_amount || proposedAmount)
  };
}

// ─── Reinvestment decision ─────────────────────────────────────────────────
async function evaluateReinvestment(base44, profile, policy, opportunities) {
  const balance = profile.wallet_balance || 0;
  const safetyBuffer = policy.safety_buffer || 200;
  const minThreshold = policy.min_reinvestment_threshold || 50;
  const maxReinvestPct = (policy.max_reinvestment_pct || 40) / 100;
  const dailyLimit = policy.daily_reinvestment_limit || 500;
  const preferredCategories = policy.preferred_reinvestment_categories || [];

  const eligible = balance - safetyBuffer;
  if (eligible < minThreshold) {
    return { should_reinvest: false, reason: `Available $${fmt(eligible)} below reinvestment threshold $${fmt(minThreshold)}` };
  }

  const maxAmount = Math.min(eligible * maxReinvestPct, dailyLimit);

  // Filter viable opportunities
  const highYield = opportunities.filter(o =>
    o.status === 'new' &&
    (o.capital_required || 0) <= maxAmount &&
    (o.capital_required || 0) > 0 &&
    (o.overall_score || 0) >= 60 &&
    (preferredCategories.length === 0 || preferredCategories.includes(o.category))
  ).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));

  if (highYield.length === 0) {
    return { should_reinvest: false, reason: 'No eligible high-yield opportunities match reinvestment criteria' };
  }

  const best = highYield[0];
  const aiDecision = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a financial reinvestment engine selecting the best opportunity.

Wallet balance: $${fmt(balance)}
Safety buffer: $${fmt(safetyBuffer)}  
Max reinvestment: $${fmt(maxAmount)}
User's preferred categories: ${preferredCategories.join(', ') || 'any'}

Top opportunity:
- Title: ${best.title}
- Category: ${best.category}
- Capital required: $${fmt(best.capital_required)}
- Profit estimate: $${fmt(best.profit_estimate_low)}–$${fmt(best.profit_estimate_high)}
- Overall score: ${best.overall_score}/100
- Risk score: ${best.risk_score}/100
- Time sensitivity: ${best.time_sensitivity}
- Description: ${best.description?.slice(0, 200) || 'N/A'}

Evaluate: Should we reinvest $${fmt(best.capital_required)} into this opportunity? Weigh ROI vs risk vs capital preservation.

Return JSON: { "proceed": boolean, "amount": number, "opportunity_id": "${best.id}", "reasoning": string, "expected_roi_pct": number }`,
    response_json_schema: {
      type: "object",
      properties: {
        proceed: { type: "boolean" },
        amount: { type: "number" },
        opportunity_id: { type: "string" },
        reasoning: { type: "string" },
        expected_roi_pct: { type: "number" }
      }
    }
  });

  return {
    should_reinvest: aiDecision?.proceed !== false,
    amount: aiDecision?.amount || best.capital_required,
    opportunity: best,
    opportunity_id: best.id,
    reasoning: aiDecision?.reasoning || 'High-yield opportunity identified',
    expected_roi_pct: aiDecision?.expected_roi_pct || 0
  };
}

// ─── Execute withdrawal ────────────────────────────────────────────────────
async function executeWithdrawal(base44, profile, amount, bankAccount, reasoning, policy) {
  const newBalance = (profile.wallet_balance || 0) - amount;
  let retries = 0;
  const maxRetries = policy.max_retry_attempts || 3;

  while (retries <= maxRetries) {
    try {
      await base44.asServiceRole.entities.Transaction.create({
        type: 'expense',
        amount,
        category: 'other',
        description: `Auto-Withdrawal to ${bankAccount?.bank_name || 'Primary Bank'} ****${bankAccount?.last_four || '????'}`,
        balance_after: newBalance,
        notes: `Engine auto-withdrawal | Priority: ${bankAccount?.priority || 1} | Reasoning: ${reasoning}`
      });

      await base44.asServiceRole.entities.UserGoals.update(profile.id, {
        wallet_balance: newBalance
      });

      // Update policy totals
      const policies = await base44.asServiceRole.entities.WithdrawalPolicy.list();
      if (policies[0]) {
        await base44.asServiceRole.entities.WithdrawalPolicy.update(policies[0].id, {
          total_auto_withdrawn: (policies[0].total_auto_withdrawn || 0) + amount,
          last_run_at: new Date().toISOString(),
          last_action_summary: `Auto-withdrew $${fmt(amount)} to ${bankAccount?.bank_name || 'bank'}`
        });
      }

      await auditLog(base44, 'withdrawal_completed', {
        amount,
        destination_account: bankAccount ? `${bankAccount.bank_name} ****${bankAccount.last_four}` : 'Primary',
        ai_reasoning: reasoning,
        wallet_balance_before: profile.wallet_balance,
        wallet_balance_after: newBalance,
        status: 'success',
        retry_count: retries,
        thresholds_at_time: {
          safety_buffer: policy.safety_buffer,
          min_threshold: policy.min_withdrawal_threshold,
          withdrawal_pct: policy.withdrawal_pct
        }
      });

      await activityLog(base44,
        `💰 Auto-Withdrawal: $${fmt(amount)} sent to ${bankAccount?.bank_name || 'bank'} ****${bankAccount?.last_four || '????'} | Balance: $${fmt(newBalance)}`,
        'success',
        { amount, balance_after: newBalance }
      );

      return { success: true, amount, new_balance: newBalance };
    } catch (err) {
      retries++;
      if (retries > maxRetries) {
        await auditLog(base44, 'withdrawal_failed', {
          amount,
          ai_reasoning: reasoning,
          status: 'failed',
          retry_count: retries,
          error_message: err.message
        });
        await activityLog(base44, `⚠️ Auto-Withdrawal FAILED after ${maxRetries} retries: ${err.message}`, 'critical');
        return { success: false, error: err.message };
      }
      await auditLog(base44, 'withdrawal_retried', { amount, retry_count: retries, status: 'pending', error_message: err.message });
      await new Promise(r => setTimeout(r, 1000 * retries));
    }
  }
}

// ─── Execute reinvestment ──────────────────────────────────────────────────
async function executeReinvestment(base44, profile, reinvestDecision, policy) {
  const { amount, opportunity, reasoning, expected_roi_pct } = reinvestDecision;

  // Route through task review engine
  const reviewResult = await base44.asServiceRole.functions.invoke('taskReviewEngine', {
    action: 'submit',
    task_name: `[Auto-Reinvest] ${opportunity.title}`,
    category: opportunity.category || 'other',
    required_spend: amount,
    expected_return: amount * (1 + (expected_roi_pct || 50) / 100),
    ai_justification: reasoning,
    opportunity_id: opportunity.id,
    chain_depth: 0
  });

  const status = reviewResult?.data?.status || 'pending';

  // Update policy totals
  const policies = await base44.asServiceRole.entities.WithdrawalPolicy.list();
  if (policies[0]) {
    await base44.asServiceRole.entities.WithdrawalPolicy.update(policies[0].id, {
      total_auto_reinvested: (policies[0].total_auto_reinvested || 0) + amount,
      last_run_at: new Date().toISOString(),
      last_action_summary: `Auto-reinvested $${fmt(amount)} into "${opportunity.title}"`
    });
  }

  await auditLog(base44, 'reinvestment_triggered', {
    amount,
    destination_account: opportunity.title,
    ai_reasoning: reasoning,
    wallet_balance_before: profile.wallet_balance || 0,
    status: status === 'auto_approved' ? 'success' : 'pending',
    thresholds_at_time: {
      safety_buffer: policy.safety_buffer,
      min_threshold: policy.min_reinvestment_threshold,
      max_pct: policy.max_reinvestment_pct
    },
    metadata: { opportunity_id: opportunity.id, category: opportunity.category, expected_roi_pct, review_status: status }
  });

  await activityLog(base44,
    `🔁 Auto-Reinvest: $${fmt(amount)} → "${opportunity.title}" (${opportunity.category}) | ROI est: ${expected_roi_pct?.toFixed(0)}% | Status: ${status}`,
    status === 'auto_approved' ? 'success' : 'info',
    { amount, opportunity_id: opportunity.id, status }
  );

  return { success: true, status, amount, opportunity_title: opportunity.title };
}

// ─── MAIN SERVE ────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { action = 'run_cycle' } = body;

    // ── get_status ────────────────────────────────────────────────────────────
    if (action === 'get_status') {
      const [policies, transactions, goals, accounts, auditLogs, opportunities] = await Promise.all([
        base44.asServiceRole.entities.WithdrawalPolicy.list(),
        base44.asServiceRole.entities.Transaction.list('-created_date', 100),
        base44.asServiceRole.entities.UserGoals.list(),
        base44.asServiceRole.entities.LinkedAccount.list(),
        base44.asServiceRole.entities.EngineAuditLog.list('-created_date', 50),
        base44.asServiceRole.entities.Opportunity.filter({ status: 'new' })
      ]);

      const policy = policies[0] || {};
      const profile = goals[0] || {};
      const balance = profile.wallet_balance || 0;
      const safetyBuffer = policy.safety_buffer || 200;

      const pendingTxs = transactions.filter(t =>
        t.type === 'income' &&
        ['pending', 'in_transit', 'processing'].includes(t.payout_status)
      );
      const pendingTotal = pendingTxs.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0);

      const eligibleWithdraw = Math.max(0, balance - safetyBuffer - (policy.min_withdrawal_threshold || 100));
      const eligibleReinvest = Math.max(0, balance - safetyBuffer - (policy.min_reinvestment_threshold || 50));
      const maxReinvestAmount = eligibleReinvest * ((policy.max_reinvestment_pct || 40) / 100);

      // Per-account payout breakdown
      const accountPayouts = accounts.map(acc => {
        const accTxs = transactions.filter(t => t.linked_account_id === acc.id && t.type === 'income');
        const accPending = accTxs.filter(t => ['pending', 'in_transit', 'processing'].includes(t.payout_status));
        return {
          account_id: acc.id,
          platform: acc.platform,
          username: acc.username,
          label: acc.label,
          total_earned: accTxs.reduce((s, t) => s + (t.amount || 0), 0),
          pending_amount: accPending.reduce((s, t) => s + (t.net_amount || t.amount || 0), 0),
          pending_count: accPending.length,
          health_status: acc.health_status
        };
      }).filter(a => a.total_earned > 0 || a.pending_count > 0);

      return Response.json({
        success: true,
        engine: {
          enabled: policy.engine_enabled || false,
          emergency_stop: policy.emergency_stop || false,
          last_run_at: policy.last_run_at,
          last_action: policy.last_action_summary,
          total_auto_withdrawn: policy.total_auto_withdrawn || 0,
          total_auto_reinvested: policy.total_auto_reinvested || 0
        },
        wallet: {
          balance,
          safety_buffer: safetyBuffer,
          eligible_for_withdrawal: eligibleWithdraw,
          eligible_for_reinvestment: eligibleReinvest,
          max_reinvestment_amount: maxReinvestAmount
        },
        payouts: {
          pending_count: pendingTxs.length,
          pending_total: pendingTotal,
          by_account: accountPayouts
        },
        recent_audit: auditLogs.slice(0, 20),
        policy,
        viable_opportunities_count: opportunities.filter(o =>
          (o.capital_required || 0) > 0 &&
          (o.capital_required || 0) <= maxReinvestAmount &&
          (o.overall_score || 0) >= 60
        ).length
      });
    }

    // ── update_policy ─────────────────────────────────────────────────────────
    if (action === 'update_policy') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const { policy_data } = body;
      const existing = await base44.asServiceRole.entities.WithdrawalPolicy.list();

      if (existing.length > 0) {
        await base44.asServiceRole.entities.WithdrawalPolicy.update(existing[0].id, policy_data);
      } else {
        await base44.asServiceRole.entities.WithdrawalPolicy.create({ ...policy_data, label: 'Default Policy' });
      }

      await auditLog(base44, 'threshold_check', {
        ai_reasoning: `Policy updated by ${user.email}`,
        status: 'success',
        metadata: { updated_fields: Object.keys(policy_data), updated_by: user.email }
      });

      return Response.json({ success: true });
    }

    // ── emergency_stop ────────────────────────────────────────────────────────
    if (action === 'emergency_stop') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

      const existing = await base44.asServiceRole.entities.WithdrawalPolicy.list();
      if (existing.length > 0) {
        await base44.asServiceRole.entities.WithdrawalPolicy.update(existing[0].id, {
          emergency_stop: true,
          engine_enabled: false
        });
      }

      await auditLog(base44, 'emergency_stop', {
        ai_reasoning: `Emergency stop triggered by ${user.email}`,
        status: 'success',
        metadata: { triggered_by: user.email }
      });
      await activityLog(base44, `🚨 EMERGENCY STOP activated by ${user.email} — all automations halted`, 'critical');

      return Response.json({ success: true, message: 'Emergency stop activated' });
    }

    // ── override_action ───────────────────────────────────────────────────────
    if (action === 'override_action') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { override_type, reason } = body;

      await auditLog(base44, 'override_applied', {
        ai_reasoning: `Override by ${user.email}: ${reason}`,
        status: 'success',
        metadata: { override_type, reason, applied_by: user.email }
      });
      await activityLog(base44, `👤 User override applied: ${override_type} — ${reason}`, 'info');

      return Response.json({ success: true });
    }

    // ── manual_withdraw ───────────────────────────────────────────────────────
    if (action === 'manual_withdraw') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { amount, bank_account } = body;

      const goals = await base44.asServiceRole.entities.UserGoals.list();
      const profile = goals[0];
      if (!profile) return Response.json({ error: 'No profile found' }, { status: 404 });

      const policies = await base44.asServiceRole.entities.WithdrawalPolicy.list();
      const policy = policies[0] || {};

      if ((profile.wallet_balance || 0) < amount) {
        return Response.json({ error: `Insufficient funds. Balance: $${fmt(profile.wallet_balance)}` }, { status: 400 });
      }
      if ((profile.wallet_balance || 0) - amount < (policy.safety_buffer || 0)) {
        return Response.json({ error: `Would breach safety buffer of $${fmt(policy.safety_buffer)}` }, { status: 400 });
      }

      const result = await executeWithdrawal(base44, profile, amount, bank_account, `Manual withdrawal by ${user.email}`, policy);
      return Response.json(result);
    }

    // ── manual_reinvest ───────────────────────────────────────────────────────
    if (action === 'manual_reinvest') {
      const user = await base44.auth.me();
      if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
      const { opportunity_id, amount } = body;

      const goals = await base44.asServiceRole.entities.UserGoals.list();
      const profile = goals[0];
      const policies = await base44.asServiceRole.entities.WithdrawalPolicy.list();
      const policy = policies[0] || {};

      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      const result = await executeReinvestment(base44, profile, {
        amount: amount || opp.capital_required,
        opportunity: opp,
        reasoning: `Manual reinvestment by ${user.email}`,
        expected_roi_pct: opp.profit_estimate_high > 0 && opp.capital_required > 0
          ? ((opp.profit_estimate_high - opp.capital_required) / opp.capital_required) * 100
          : 50
      }, policy);

      return Response.json(result);
    }

    // ── run_cycle (main autonomous loop) ──────────────────────────────────────
    if (action === 'run_cycle') {
      const [policies, transactions, goals, opportunities] = await Promise.all([
        base44.asServiceRole.entities.WithdrawalPolicy.list(),
        base44.asServiceRole.entities.Transaction.list('-created_date', 200),
        base44.asServiceRole.entities.UserGoals.list(),
        base44.asServiceRole.entities.Opportunity.list('-overall_score', 50)
      ]);

      const policy = policies[0];
      const profile = goals[0];

      if (!policy || !profile) {
        return Response.json({ skipped: true, reason: 'No policy or profile configured' });
      }
      if (policy.emergency_stop) {
        return Response.json({ skipped: true, reason: 'Emergency stop is active' });
      }
      if (!policy.engine_enabled) {
        return Response.json({ skipped: true, reason: 'Engine is disabled' });
      }

      await auditLog(base44, 'engine_cycle', {
        ai_reasoning: 'Autonomous cycle started',
        wallet_balance_before: profile.wallet_balance,
        status: 'pending'
      });

      const cycleResults = {
        payouts_cleared: 0,
        payouts_delayed: 0,
        withdrawal_executed: null,
        reinvestment_executed: null,
        fraud_flagged: false,
        skipped_reasons: []
      };

      // 1. Check payout clearances
      const payoutResult = await checkPayoutClearances(base44, profile);
      cycleResults.payouts_cleared = payoutResult.cleared.length;
      cycleResults.payouts_delayed = payoutResult.delayed.length;

      // Refresh profile after payout updates
      const freshGoals = await base44.asServiceRole.entities.UserGoals.list();
      const freshProfile = freshGoals[0] || profile;

      // 2. Fraud check
      const fraudResult = await runFraudChecks(base44, transactions, policy);
      if (fraudResult.flagged) {
        cycleResults.fraud_flagged = true;
        cycleResults.skipped_reasons.push('Fraud flags detected — pausing automations');
        return Response.json({ cycle_complete: true, ...cycleResults });
      }

      // 3. Account health check
      const accounts = await base44.asServiceRole.entities.LinkedAccount.list();
      const suspendedAccounts = accounts.filter(a => a.health_status === 'suspended' || a.health_status === 'limited');
      if (suspendedAccounts.length > 0) {
        await auditLog(base44, 'account_health_alert', {
          ai_reasoning: `${suspendedAccounts.length} accounts with health issues: ${suspendedAccounts.map(a => `${a.platform}@${a.username}`).join(', ')}`,
          status: 'flagged'
        });
      }

      // 4. Evaluate & execute withdrawal
      const withdrawDecision = await evaluateWithdrawal(base44, freshProfile, policy, transactions);
      if (withdrawDecision.should_withdraw && policy.bank_accounts?.length > 0) {
        const primaryBank = policy.bank_accounts.sort((a, b) => (a.priority || 9) - (b.priority || 9))[0];
        const withdrawResult = await executeWithdrawal(
          base44, freshProfile, withdrawDecision.amount, primaryBank,
          withdrawDecision.reasoning, policy
        );
        cycleResults.withdrawal_executed = withdrawResult;

        // Refresh after withdrawal
        const afterWithdrawGoals = await base44.asServiceRole.entities.UserGoals.list();
        freshProfile.wallet_balance = afterWithdrawGoals[0]?.wallet_balance || freshProfile.wallet_balance;
      } else if (!withdrawDecision.should_withdraw) {
        cycleResults.skipped_reasons.push(`Withdrawal: ${withdrawDecision.reason}`);
      } else {
        cycleResults.skipped_reasons.push('Withdrawal: No bank accounts configured');
      }

      // 5. Evaluate & execute reinvestment
      const reinvestDecision = await evaluateReinvestment(base44, freshProfile, policy, opportunities);
      if (reinvestDecision.should_reinvest) {
        const reinvestResult = await executeReinvestment(base44, freshProfile, reinvestDecision, policy);
        cycleResults.reinvestment_executed = reinvestResult;
      } else {
        cycleResults.skipped_reasons.push(`Reinvestment: ${reinvestDecision.reason}`);
      }

      // Update last run
      if (policies[0]) {
        await base44.asServiceRole.entities.WithdrawalPolicy.update(policies[0].id, {
          last_run_at: new Date().toISOString()
        });
      }

      await activityLog(base44,
        `⚙️ Engine cycle complete — ${cycleResults.payouts_cleared} cleared, ${cycleResults.withdrawal_executed ? '✓ withdrew' : '✗ no withdrawal'}, ${cycleResults.reinvestment_executed ? '✓ reinvested' : '✗ no reinvestment'}`,
        'info',
        cycleResults
      );

      return Response.json({ cycle_complete: true, ...cycleResults });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});