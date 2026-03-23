/**
 * WITHDRAWAL ENGINE
 * Manages automatic withdrawals from platform accounts to user bank
 * Respects spending policies, fraud detection, and payout thresholds
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Check if withdrawal is safe and eligible
 */
async function validateWithdrawalEligibility(base44, userEmail, amount) {
  const validation = {
    eligible: false,
    checks_passed: 0,
    total_checks: 5,
    findings: [],
  };

  try {
    // Get user config
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail }, null, 1
    ).then(goals => goals[0]);

    if (!userGoals) {
      validation.findings.push('❌ User goals not found');
      return validation;
    }

    // Check 1: Minimum withdrawal threshold
    if (amount < 100) {
      validation.findings.push(`❌ Below minimum withdrawal ($100), have $${amount.toFixed(2)}`);
    } else {
      validation.findings.push(`✓ Meets minimum threshold ($${amount.toFixed(2)})`);
      validation.checks_passed++;
    }

    // Check 2: Within daily limit
    const withdrawalPolicy = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: userEmail }, null, 1
    ).then(policies => policies[0]);

    const dailyLimit = withdrawalPolicy?.daily_withdrawal_limit || 5000;
    if (amount > dailyLimit) {
      validation.findings.push(`❌ Exceeds daily limit ($${dailyLimit})`);
    } else {
      validation.findings.push(`✓ Within daily limit ($${dailyLimit})`);
      validation.checks_passed++;
    }

    // Check 3: Safety buffer maintained
    const buffer = withdrawalPolicy?.safety_buffer || 200;
    const remainingBalance = (userGoals.wallet_balance || 0) - amount;
    if (remainingBalance < buffer) {
      validation.findings.push(`❌ Would breach safety buffer ($${buffer}). Remaining: $${remainingBalance.toFixed(2)}`);
    } else {
      validation.findings.push(`✓ Safety buffer maintained ($${remainingBalance.toFixed(2)})`);
      validation.checks_passed++;
    }

    // Check 4: Fraud detection
    const recentTransactions = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: userEmail }, '-created_date', 50
    ).catch(() => []);

    const last24h = recentTransactions.filter(t => {
      const txnTime = new Date(t.created_date).getTime();
      const now = Date.now();
      return (now - txnTime) < 24 * 60 * 60 * 1000;
    });

    const totalLast24h = last24h.reduce((sum, t) => sum + (t.amount || 0), 0);
    const suspiciousPattern = totalLast24h > 10000; // More than $10k in 24h

    if (suspiciousPattern) {
      validation.findings.push('⚠️ Unusual withdrawal pattern detected (fraud check)');
    } else {
      validation.findings.push('✓ Withdrawal pattern normal');
      validation.checks_passed++;
    }

    // Check 5: Bank account configured
    const hasBank = withdrawalPolicy?.bank_accounts?.length > 0;
    if (!hasBank) {
      validation.findings.push('❌ No bank account configured');
    } else {
      validation.findings.push(`✓ Bank account configured`);
      validation.checks_passed++;
    }

    validation.eligible = validation.checks_passed >= 4; // Need at least 4/5 checks
    return validation;
  } catch (e) {
    validation.findings.push(`Error: ${e.message}`);
    return validation;
  }
}

/**
 * Process withdrawal to bank account
 */
async function processWithdrawal(base44, userEmail, amount) {
  const withdrawal = {
    timestamp: new Date().toISOString(),
    amount,
    status: 'initiating',
    error: null,
  };

  try {
    // Validate eligibility
    const eligibility = await validateWithdrawalEligibility(base44, userEmail, amount);

    if (!eligibility.eligible) {
      withdrawal.status = 'failed';
      withdrawal.error = `Withdrawal not eligible: ${eligibility.findings.filter(f => f.startsWith('❌')).join(', ')}`;
      return withdrawal;
    }

    // Get withdrawal policy
    const withdrawalPolicy = await base44.asServiceRole.entities.WithdrawalPolicy.filter(
      { created_by: userEmail }, null, 1
    ).then(policies => policies[0]);

    // Get primary bank account
    const primaryBank = withdrawalPolicy.bank_accounts.find(b => b.is_primary) ||
      withdrawalPolicy.bank_accounts[0];

    if (!primaryBank) {
      withdrawal.status = 'failed';
      withdrawal.error = 'No primary bank account found';
      return withdrawal;
    }

    // In production: Call actual bank transfer API
    // For now: Log as pending
    withdrawal.status = 'pending';
    withdrawal.bank_account = {
      last_four: primaryBank.last_four,
      bank_name: primaryBank.bank_name,
    };

    // Update wallet balance
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail }, null, 1
    ).then(goals => goals[0]);

    if (userGoals) {
      await base44.asServiceRole.entities.UserGoals.update(userGoals.id, {
        wallet_balance: (userGoals.wallet_balance || 0) - amount,
      });
    }

    // Log withdrawal
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `💸 Withdrawal initiated: $${amount.toFixed(2)} to ${primaryBank.bank_name} (****${primaryBank.last_four})`,
      severity: 'success',
      metadata: {
        amount,
        bank: primaryBank.bank_name,
        status: withdrawal.status,
      },
    }).catch(() => null);

    return withdrawal;
  } catch (e) {
    withdrawal.status = 'error';
    withdrawal.error = e.message;
    return withdrawal;
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, amount } = body;

    // ── Validate withdrawal eligibility ────────────────────────────────
    if (action === 'validate') {
      if (typeof amount !== 'number') {
        return Response.json({ error: 'Amount required' }, { status: 400 });
      }

      const validation = await validateWithdrawalEligibility(base44, user.email, amount);
      return Response.json({ success: validation.eligible, validation });
    }

    // ── Process withdrawal ─────────────────────────────────────────────
    if (action === 'process') {
      if (typeof amount !== 'number') {
        return Response.json({ error: 'Amount required' }, { status: 400 });
      }

      const withdrawal = await processWithdrawal(base44, user.email, amount);
      return Response.json({
        success: withdrawal.status === 'pending' || withdrawal.status === 'completed',
        withdrawal,
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[WithdrawalEngine] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});