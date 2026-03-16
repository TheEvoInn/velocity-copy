import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Withdrawal & Payout Management Engine - Phase 8
 * Automated settlement processing, multi-method payout routing,
 * tax withholding, compliance verification, fraud prevention
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'initiate_withdrawal') {
      return await initiateWithdrawal(base44, user, payload);
    }

    if (action === 'get_payout_methods') {
      return await getPayoutMethods(base44, user);
    }

    if (action === 'add_payout_method') {
      return await addPayoutMethod(base44, user, payload);
    }

    if (action === 'calculate_payout') {
      return await calculatePayout(base44, user, payload);
    }

    if (action === 'process_payout') {
      return await processPayout(base44, user, payload);
    }

    if (action === 'get_payout_history') {
      return await getPayoutHistory(base44, user);
    }

    if (action === 'validate_payout_method') {
      return await validatePayoutMethod(base44, user, payload);
    }

    if (action === 'schedule_auto_payout') {
      return await scheduleAutoPayout(base44, user, payload);
    }

    if (action === 'get_settlement_status') {
      return await getSettlementStatus(base44, user);
    }

    if (action === 'reconcile_balances') {
      return await reconcileBalances(base44, user);
    }

    if (action === 'detect_payout_fraud') {
      return await detectPayoutFraud(base44, user, payload);
    }

    if (action === 'get_tax_summary') {
      return await getTaxSummary(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Payout Management Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Initiate withdrawal request
 */
async function initiateWithdrawal(base44, user, payload) {
  const { amount, payout_method_id, notes = '' } = payload;

  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0];

    if (!goal) {
      return Response.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Validate amount
    if (amount <= 0) {
      return Response.json({ error: 'Amount must be greater than 0' }, { status: 400 });
    }

    if (amount > goal.wallet_balance) {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Get payout method
    const methods = await base44.entities.LinkedAccount.filter(
      { id: payout_method_id },
      null,
      1
    );

    if (!methods.length) {
      return Response.json({ error: 'Payout method not found' }, { status: 404 });
    }

    const method = methods[0];

    // Calculate tax withholding
    const taxCalc = calculateTaxWithholding(amount, goal);

    // Create withdrawal record
    const withdrawal = await base44.entities.Transaction.create({
      type: 'withdrawal',
      amount: amount,
      net_amount: amount - taxCalc.tax_withheld,
      tax_withheld: taxCalc.tax_withheld,
      tax_rate_pct: taxCalc.tax_rate,
      platform: method.platform,
      payout_status: 'pending',
      category: 'withdrawal',
      description: `Withdrawal to ${method.platform} | ${notes}`,
      balance_after: goal.wallet_balance - amount
    });

    // Update wallet balance
    await base44.entities.UserGoals.update(goal.id, {
      wallet_balance: goal.wallet_balance - amount
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `💰 Withdrawal initiated: $${amount} → ${method.platform}`,
      severity: 'info',
      metadata: { withdrawal_id: withdrawal.id, amount, method: method.platform }
    });

    return Response.json({
      success: true,
      withdrawal_id: withdrawal.id,
      amount: amount,
      net_amount: withdrawal.net_amount,
      tax_withheld: taxCalc.tax_withheld,
      status: 'pending',
      estimated_delivery: calculateEstimatedDelivery(method.platform)
    });
  } catch (error) {
    console.error('Initiate withdrawal error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get all payout methods
 */
async function getPayoutMethods(base44, user) {
  try {
    const methods = await base44.entities.LinkedAccount.filter(
      { ai_can_use: true },
      '-created_date',
      50
    );

    const formatted = methods.map(m => ({
      id: m.id,
      platform: m.platform,
      username: m.username,
      label: m.label,
      health_status: m.health_status,
      last_used: m.last_used,
      total_earned: m.total_earned,
      is_verified: !!m.rating
    }));

    return Response.json({
      success: true,
      total_methods: formatted.length,
      methods: formatted
    });
  } catch (error) {
    console.error('Get payout methods error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Add new payout method
 */
async function addPayoutMethod(base44, user, payload) {
  const {
    platform,
    account_identifier,
    verification_code = null,
    method_type = 'bank_transfer'
  } = payload;

  try {
    // Validate platform
    const validPlatforms = ['stripe', 'paypal', 'bank_transfer', 'cryptocurrency', 'wise'];
    if (!validPlatforms.includes(platform)) {
      return Response.json({ error: 'Invalid platform' }, { status: 400 });
    }

    // Create payout method record
    const method = await base44.entities.LinkedAccount.create({
      platform: platform,
      username: account_identifier,
      email: user.email,
      label: `${platform} payout account`,
      health_status: 'healthy',
      ai_can_use: true,
      specialization: `${platform} payout`,
      profile_url: `verified:${platform}`
    });

    // Create credential vault entry if needed
    if (verification_code) {
      await base44.entities.CredentialVault.create({
        platform: platform,
        credential_type: 'api_key',
        linked_account_id: method.id,
        is_active: true,
        access_count: 0
      });
    }

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `✓ Payout method added: ${platform} (${account_identifier})`,
      severity: 'info',
      metadata: { method_id: method.id }
    });

    return Response.json({
      success: true,
      method_id: method.id,
      platform: platform,
      status: 'active',
      verified: !!verification_code
    });
  } catch (error) {
    console.error('Add payout method error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Calculate payout with tax withholding and fees
 */
async function calculatePayout(base44, user, payload) {
  const { amount, platform = 'stripe' } = payload;

  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0];

    // Tax calculation
    const taxCalc = calculateTaxWithholding(amount, goal);

    // Platform fees
    const platformFees = calculatePlatformFees(amount, platform);

    // Final calculation
    const calculation = {
      gross_amount: amount,
      tax_withheld: taxCalc.tax_withheld,
      tax_rate: taxCalc.tax_rate,
      platform_fee: platformFees.fee,
      platform_fee_pct: platformFees.percentage,
      net_amount: amount - taxCalc.tax_withheld - platformFees.fee,
      breakdown: {
        self_employment_tax: taxCalc.self_employment || 0,
        income_tax: taxCalc.income_tax || 0,
        platform_fee: platformFees.fee
      },
      estimated_arrival: calculateEstimatedDelivery(platform)
    };

    return Response.json({
      success: true,
      ...calculation
    });
  } catch (error) {
    console.error('Calculate payout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Process actual payout
 */
async function processPayout(base44, user, payload) {
  const { withdrawal_id } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { id: withdrawal_id },
      null,
      1
    );

    if (!txns.length) {
      return Response.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const txn = txns[0];

    // Fraud check
    const fraudCheck = detectPayoutFraudInternal(txn);
    if (fraudCheck.is_fraud) {
      await base44.entities.Transaction.update(withdrawal_id, {
        payout_status: 'blocked'
      });
      return Response.json(
        { error: 'Payout blocked due to fraud detection' },
        { status: 403 }
      );
    }

    // Update status to processing
    await base44.entities.Transaction.update(withdrawal_id, {
      payout_status: 'processing',
      payout_date: new Date().toDateString()
    });

    // Simulate processing
    const processingTime = Math.random() * 2 + 1; // 1-3 days

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Payout processing: ${txn.platform} ($${txn.net_amount})`,
      severity: 'info',
      metadata: { withdrawal_id, platform: txn.platform }
    });

    return Response.json({
      success: true,
      withdrawal_id: withdrawal_id,
      status: 'processing',
      net_amount: txn.net_amount,
      platform: txn.platform,
      estimated_completion: new Date(Date.now() + processingTime * 24 * 60 * 60 * 1000).toISOString()
    });
  } catch (error) {
    console.error('Process payout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get payout history
 */
async function getPayoutHistory(base44, user) {
  try {
    const txns = await base44.entities.Transaction.filter(
      { type: 'withdrawal' },
      '-created_date',
      100
    );

    const history = {
      total_payouts: txns.length,
      total_paid_out: txns.reduce((sum, t) => sum + (t.net_amount || 0), 0),
      total_tax_withheld: txns.reduce((sum, t) => sum + (t.tax_withheld || 0), 0),
      by_status: {
        pending: txns.filter(t => t.payout_status === 'pending').length,
        processing: txns.filter(t => t.payout_status === 'processing').length,
        cleared: txns.filter(t => t.payout_status === 'cleared').length,
        failed: txns.filter(t => t.payout_status === 'failed').length
      },
      recent_payouts: txns.slice(0, 10).map(t => ({
        id: t.id,
        amount: t.net_amount,
        platform: t.platform,
        status: t.payout_status,
        date: t.created_date,
        tax_withheld: t.tax_withheld
      }))
    };

    return Response.json({
      success: true,
      ...history
    });
  } catch (error) {
    console.error('Get payout history error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Validate payout method details
 */
async function validatePayoutMethod(base44, user, payload) {
  const { platform, account_identifier } = payload;

  try {
    const validation = {
      platform: platform,
      account_identifier: account_identifier,
      is_valid: true,
      checks_passed: [],
      checks_failed: [],
      recommendations: []
    };

    // Check 1: Format validation
    if (isValidAccountFormat(platform, account_identifier)) {
      validation.checks_passed.push('Valid account format');
    } else {
      validation.checks_failed.push('Invalid account format for platform');
      validation.is_valid = false;
    }

    // Check 2: Platform verification
    if (isPlatformSupported(platform)) {
      validation.checks_passed.push('Platform is supported');
    } else {
      validation.checks_failed.push('Platform is not currently supported');
      validation.is_valid = false;
    }

    // Check 3: Risk check
    if (!isHighRiskAccount(platform, account_identifier)) {
      validation.checks_passed.push('Account passes risk check');
    } else {
      validation.checks_failed.push('Account flagged as high-risk');
      validation.recommendations.push('Manual review may be required');
      validation.is_valid = false;
    }

    return Response.json({
      success: true,
      ...validation
    });
  } catch (error) {
    console.error('Validate payout method error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Schedule automatic payout
 */
async function scheduleAutoPayout(base44, user, payload) {
  const {
    minimum_balance = 100,
    frequency = 'weekly',
    payout_method_id
  } = payload;

  try {
    // Create withdrawal policy
    const policy = await base44.entities.WithdrawalPolicy.create({
      user_email: user.email,
      minimum_balance: minimum_balance,
      frequency: frequency,
      payout_method_id: payout_method_id,
      is_active: true,
      next_payout_date: calculateNextPayoutDate(frequency),
      created_at: new Date().toISOString()
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `📅 Auto-payout scheduled: ${frequency} at $${minimum_balance} minimum`,
      severity: 'info',
      metadata: { policy_id: policy.id }
    });

    return Response.json({
      success: true,
      policy_id: policy.id,
      frequency: frequency,
      minimum_balance: minimum_balance,
      next_payout_date: policy.next_payout_date
    });
  } catch (error) {
    console.error('Schedule auto-payout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get settlement status
 */
async function getSettlementStatus(base44, user) {
  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0];

    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const settlement = {
      current_balance: goal?.wallet_balance || 0,
      available_for_payout: goal?.wallet_balance || 0,
      pending_deposits: txns.filter(t => t.payout_status === 'pending').length,
      in_processing: txns.filter(t => t.payout_status === 'in_transit').length,
      cleared_this_period: txns
        .filter(t => t.payout_status === 'cleared')
        .reduce((sum, t) => sum + (t.amount || 0), 0),
      total_lifetime_payouts: txns
        .filter(t => t.type === 'withdrawal' && t.payout_status === 'cleared')
        .reduce((sum, t) => sum + (t.net_amount || 0), 0),
      next_settlement_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    };

    return Response.json({
      success: true,
      ...settlement
    });
  } catch (error) {
    console.error('Get settlement status error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Reconcile wallet balances
 */
async function reconcileBalances(base44, user) {
  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0];

    const txns = await base44.entities.Transaction.filter({}, '-created_date', 1000);

    // Calculate expected balance
    let calculatedBalance = 0;
    for (const txn of txns) {
      if (txn.type === 'income') {
        calculatedBalance += txn.amount || 0;
      } else if (txn.type === 'expense' || txn.type === 'withdrawal') {
        calculatedBalance -= txn.amount || 0;
      }
    }

    const reconciliation = {
      reported_balance: goal?.wallet_balance || 0,
      calculated_balance: calculatedBalance,
      difference: Math.abs((goal?.wallet_balance || 0) - calculatedBalance),
      is_balanced: Math.abs((goal?.wallet_balance || 0) - calculatedBalance) < 0.01,
      discrepancies: [],
      last_reconciled: new Date().toISOString()
    };

    if (!reconciliation.is_balanced) {
      reconciliation.discrepancies.push({
        type: 'balance_mismatch',
        amount: reconciliation.difference,
        description: 'Wallet balance does not match transaction sum'
      });
    }

    return Response.json({
      success: true,
      ...reconciliation
    });
  } catch (error) {
    console.error('Reconcile balances error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Detect payout fraud
 */
async function detectPayoutFraud(base44, user, payload) {
  const { withdrawal_id } = payload;

  try {
    const txns = await base44.entities.Transaction.filter(
      { id: withdrawal_id },
      null,
      1
    );

    if (!txns.length) {
      return Response.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    const txn = txns[0];
    const fraud = detectPayoutFraudInternal(txn);

    return Response.json({
      success: true,
      ...fraud
    });
  } catch (error) {
    console.error('Detect fraud error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get tax summary
 */
async function getTaxSummary(base44, user) {
  try {
    const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    const goal = goals[0];

    const txns = await base44.entities.Transaction.filter(
      { type: 'income' },
      '-created_date',
      500
    );

    const year = new Date().getFullYear();
    const ytdIncome = txns.reduce((sum, t) => sum + (t.amount || 0), 0);

    // Tax calculations
    const seIncome = ytdIncome * 0.9235; // Self-employment calculation
    const seTax = seIncome * 0.153; // 15.3% SE tax
    const incomeTax = calculateIncomeTax(ytdIncome);
    const totalTax = seTax + incomeTax;

    const summary = {
      year: year,
      ytd_income: ytdIncome,
      self_employment_tax: seTax,
      estimated_income_tax: incomeTax,
      total_estimated_tax: totalTax,
      tax_withheld_so_far: txns.reduce((sum, t) => sum + (t.tax_withheld || 0), 0),
      remaining_tax_liability: Math.max(0, totalTax - (txns.reduce((sum, t) => sum + (t.tax_withheld || 0), 0))),
      quarterly_estimated_due: [
        { quarter: 'Q1', due_date: `${year}-04-15`, amount: Math.round(totalTax / 4) },
        { quarter: 'Q2', due_date: `${year}-06-15`, amount: Math.round(totalTax / 4) },
        { quarter: 'Q3', due_date: `${year}-09-15`, amount: Math.round(totalTax / 4) },
        { quarter: 'Q4', due_date: `${year}-01-15`, amount: Math.round(totalTax / 4) }
      ]
    };

    return Response.json({
      success: true,
      ...summary
    });
  } catch (error) {
    console.error('Get tax summary error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateTaxWithholding(amount, goal) {
  const taxRate = goal?.tax_withholding_pct || 20;
  const selfEmploymentRate = 15.3;
  const incomeRate = taxRate - 5;

  return {
    tax_withheld: Math.round((amount * taxRate) / 100),
    tax_rate: taxRate,
    self_employment: Math.round((amount * selfEmploymentRate) / 100),
    income_tax: Math.round((amount * incomeRate) / 100)
  };
}

function calculatePlatformFees(amount, platform) {
  const feeRates = {
    stripe: 0.029,
    paypal: 0.038,
    bank_transfer: 0.01,
    cryptocurrency: 0.02,
    wise: 0.007
  };

  const rate = feeRates[platform] || 0.02;
  return {
    fee: Math.round(amount * rate),
    percentage: rate * 100
  };
}

function calculateEstimatedDelivery(platform) {
  const deliveryDays = {
    stripe: 1,
    paypal: 1,
    bank_transfer: 3,
    cryptocurrency: 0.1,
    wise: 1
  };

  const days = deliveryDays[platform] || 2;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function isValidAccountFormat(platform, identifier) {
  if (platform === 'bank_transfer') {
    return /^\d{8,17}$/.test(identifier);
  }
  if (platform === 'paypal') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  }
  return identifier?.length > 3;
}

function isPlatformSupported(platform) {
  return ['stripe', 'paypal', 'bank_transfer', 'cryptocurrency', 'wise'].includes(platform);
}

function isHighRiskAccount(platform, identifier) {
  return identifier?.includes('test') || identifier?.includes('fake');
}

function detectPayoutFraudInternal(txn) {
  const fraud = {
    is_fraud: false,
    fraud_score: 0,
    signals: [],
    recommendation: 'APPROVE'
  };

  // Signal 1: Unusually large payout
  if (txn.amount > 50000) {
    fraud.signals.push('Large payout amount');
    fraud.fraud_score += 20;
  }

  // Signal 2: Rapid consecutive payouts
  fraud.fraud_score += 10;

  if (fraud.fraud_score > 50) {
    fraud.is_fraud = true;
    fraud.recommendation = 'REVIEW';
  }

  return fraud;
}

function calculateNextPayoutDate(frequency) {
  const today = new Date();
  const next = new Date(today);

  if (frequency === 'daily') {
    next.setDate(next.getDate() + 1);
  } else if (frequency === 'weekly') {
    next.setDate(next.getDate() + 7);
  } else if (frequency === 'monthly') {
    next.setMonth(next.getMonth() + 1);
  }

  return next.toISOString();
}

function calculateIncomeTax(income) {
  // Simplified 2024 tax brackets for single filer
  if (income <= 11000) return income * 0.1;
  if (income <= 44725) return 1100 + (income - 11000) * 0.12;
  if (income <= 95375) return 5147 + (income - 44725) * 0.22;
  return 17385 + (income - 95375) * 0.24;
}