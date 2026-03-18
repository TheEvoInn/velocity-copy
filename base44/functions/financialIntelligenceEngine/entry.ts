import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Financial Intelligence Engine - Phase 5
 * Real-time revenue tracking, ROI analysis, wallet management,
 * tax estimation, and automated payout orchestration
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'record_earnings') {
      return await recordEarnings(base44, user, payload);
    }

    if (action === 'calculate_roi') {
      return await calculateROI(base44, user, payload);
    }

    if (action === 'generate_financial_report') {
      return await generateFinancialReport(base44, user);
    }

    if (action === 'estimate_taxes') {
      return await estimateTaxes(base44, user, payload);
    }

    if (action === 'schedule_payout') {
      return await schedulePayout(base44, user, payload);
    }

    if (action === 'process_payout') {
      return await processPayout(base44, user, payload);
    }

    if (action === 'get_revenue_metrics') {
      return await getRevenueMetrics(base44, user);
    }

    if (action === 'analyze_earnings_stream') {
      return await analyzeEarningsStream(base44, user, payload);
    }

    if (action === 'sync_wallet_balance') {
      return await syncWalletBalance(base44, user);
    }

    if (action === 'get_platform_breakdown') {
      return await getPlatformBreakdown(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Financial Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Record earnings from opportunity completion
 */
async function recordEarnings(base44, user, payload) {
   const {
     opportunity_id,
     amount,
     platform,
     category,
     source_type = 'opportunity', // 'opportunity', 'bonus', 'referral', 'affiliate'
     platform_fee_pct = 0,
     tax_rate_pct = 0
   } = payload;

   try {
     const platformFee = Math.round(amount * (platform_fee_pct / 100));
     const netAmount = amount - platformFee;
     const taxWithheld = Math.round(netAmount * (tax_rate_pct / 100));
     const finalAmount = netAmount - taxWithheld;

     // Create transaction record with USER ISOLATION
     const transaction = await base44.entities.Transaction.create({
       type: 'income',
       amount: amount,
       net_amount: netAmount,
       platform_fee: platformFee,
       platform_fee_pct: platform_fee_pct,
       tax_withheld: taxWithheld,
       tax_rate_pct: tax_rate_pct,
       platform: platform,
       category: category,
       payout_status: 'available',
       opportunity_id: opportunity_id,
       description: `Income from ${source_type} (${platform})`,
       created_by: user.email  // ENFORCE USER ISOLATION
     });

     // Update user goals with earnings - ONLY FOR CURRENT USER
     const userGoals = await base44.entities.UserGoals.filter({
       created_by: user.email
     }, null, 1);

     if (userGoals && userGoals.length > 0) {
       const goals = userGoals[0];
       const newTotal = (goals.total_earned || 0) + amount;
       const newWallet = (goals.wallet_balance || 0) + finalAmount;

       await base44.entities.UserGoals.update(goals.id, {
         total_earned: newTotal,
         wallet_balance: newWallet
       });
     }

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `💰 Earned: $${amount} from ${platform} (Net: $${finalAmount})`,
      severity: 'success',
      metadata: {
        transaction_id: transaction.id,
        net: finalAmount,
        fees: platformFee,
        tax: taxWithheld
      }
    });

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      gross_amount: amount,
      net_amount: netAmount,
      final_amount: finalAmount,
      fees: platformFee,
      tax: taxWithheld
    });
  } catch (error) {
    console.error('Record earnings error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Calculate ROI for opportunity
 */
async function calculateROI(base44, user, payload) {
  const { opportunity_id, investment = 0, revenue = 0, time_hours = 0 } = payload;

  try {
    const opp = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opp || opp.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opportunity = opp[0];
    const profit = revenue - investment;
    const roi = investment > 0 ? ((profit / investment) * 100).toFixed(2) : 0;
    const hourlyRate = time_hours > 0 ? (revenue / time_hours).toFixed(2) : 0;
    const profitPerHour = time_hours > 0 ? (profit / time_hours).toFixed(2) : 0;

    return Response.json({
      success: true,
      opportunity_id,
      revenue,
      investment,
      profit,
      roi: parseFloat(roi),
      hourly_rate: parseFloat(hourlyRate),
      profit_per_hour: parseFloat(profitPerHour),
      time_hours,
      efficiency_score: calculateEfficiencyScore(roi, hourlyRate, profit)
    });
  } catch (error) {
    console.error('Calculate ROI error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate comprehensive financial report
 */
async function generateFinancialReport(base44, user) {
   try {
     const userGoals = await base44.entities.UserGoals.filter({
       created_by: user.email
     }, null, 1);
     const transactions = await base44.entities.Transaction.filter({
       created_by: user.email
     }, '-created_date', 500);

    const goals = userGoals[0] || {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        wallet_balance: goals.wallet_balance || 0,
        total_earned: goals.total_earned || 0,
        daily_target: goals.daily_target || 1000,
        ai_total_earned: goals.ai_total_earned || 0,
        user_total_earned: goals.user_total_earned || 0
      },
      today: {
        earned: 0,
        transactions_count: 0,
        ai_earned: 0,
        user_earned: 0
      },
      week: {
        earned: 0,
        average_daily: 0
      },
      month: {
        earned: 0,
        average_daily: 0
      },
      by_platform: {},
      by_category: {},
      by_source: {
        income: 0,
        expense: 0,
        transfer: 0,
        investment: 0
      },
      pending_payouts: 0,
      tax_liability: 0
    };

    // Process transactions
    for (const tx of transactions) {
      const txDate = new Date(tx.created_date);
      const daysAgo = Math.floor((today - txDate) / (1000 * 60 * 60 * 24));

      if (daysAgo === 0 && tx.type === 'income') {
        report.today.earned += tx.amount || 0;
        report.today.transactions_count++;
        if (tx.description?.startsWith('[AI')) {
          report.today.ai_earned += tx.amount || 0;
        } else {
          report.today.user_earned += tx.amount || 0;
        }
      }

      if (daysAgo < 7 && tx.type === 'income') {
        report.week.earned += tx.amount || 0;
      }

      if (daysAgo < 30 && tx.type === 'income') {
        report.month.earned += tx.amount || 0;
      }

      // By platform
      if (tx.platform) {
        if (!report.by_platform[tx.platform]) {
          report.by_platform[tx.platform] = { earned: 0, count: 0 };
        }
        report.by_platform[tx.platform].earned += tx.amount || 0;
        report.by_platform[tx.platform].count++;
      }

      // By category
      if (tx.category) {
        if (!report.by_category[tx.category]) {
          report.by_category[tx.category] = { earned: 0, count: 0 };
        }
        report.by_category[tx.category].earned += tx.amount || 0;
        report.by_category[tx.category].count++;
      }

      // By source
      report.by_source[tx.type] = (report.by_source[tx.type] || 0) + (tx.amount || 0);

      // Pending payouts
      if (tx.payout_status === 'pending' || tx.payout_status === 'in_transit') {
        report.pending_payouts += tx.amount || 0;
      }

      // Tax liability
      report.tax_liability += tx.tax_withheld || 0;
    }

    // Calculate averages
    report.week.average_daily = report.week.earned / 7;
    report.month.average_daily = report.month.earned / 30;

    // Sort platforms by earnings
    const sortedPlatforms = Object.entries(report.by_platform)
      .sort((a, b) => b[1].earned - a[1].earned)
      .slice(0, 10);
    report.by_platform = Object.fromEntries(sortedPlatforms);

    return Response.json({
      success: true,
      ...report
    });
  } catch (error) {
    console.error('Generate report error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Estimate tax liability
 */
async function estimateTaxes(base44, user, payload) {
   const { period = 'year' } = payload; // 'month', 'quarter', 'year'

   try {
     const transactions = await base44.entities.Transaction.filter(
       { type: 'income', created_by: user.email },
       '-created_date',
       1000
     );

    let filteredTxs = transactions;
    const now = new Date();

    if (period === 'month') {
      filteredTxs = transactions.filter(tx => {
        const txDate = new Date(tx.created_date);
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      });
    } else if (period === 'quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      filteredTxs = transactions.filter(tx => {
        const txDate = new Date(tx.created_date);
        return Math.floor(txDate.getMonth() / 3) === quarter && txDate.getFullYear() === now.getFullYear();
      });
    }

    const totalIncome = filteredTxs.reduce((sum, tx) => sum + (tx.net_amount || 0), 0);
    const totalExpenses = transactions
      .filter(tx => tx.type === 'expense')
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const taxableIncome = Math.max(totalIncome - totalExpenses, 0);
    const selfEmploymentTax = Math.round(taxableIncome * 0.153); // 15.3%
    const incomeTax = calculateIncomeTax(taxableIncome);
    const totalTaxLiability = selfEmploymentTax + incomeTax;

    const withholding = filteredTxs.reduce((sum, tx) => sum + (tx.tax_withheld || 0), 0);
    const estimatedPayment = Math.max(totalTaxLiability - withholding, 0);

    return Response.json({
      success: true,
      period,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      taxable_income: taxableIncome,
      self_employment_tax: selfEmploymentTax,
      income_tax: incomeTax,
      total_tax_liability: totalTaxLiability,
      withheld_to_date: withholding,
      estimated_payment_due: estimatedPayment,
      effective_tax_rate: taxableIncome > 0 ? ((totalTaxLiability / taxableIncome) * 100).toFixed(2) : 0
    });
  } catch (error) {
    console.error('Estimate taxes error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Schedule payout
 */
async function schedulePayout(base44, user, payload) {
   const { amount, destination, scheduled_date, reason = 'withdrawal' } = payload;

   try {
     const userGoals = await base44.entities.UserGoals.filter({
       created_by: user.email
     }, null, 1);
     if (!userGoals || userGoals.length === 0) {
       return Response.json({ error: 'User goals not found' }, { status: 404 });
     }

    const goals = userGoals[0];
    if ((goals.wallet_balance || 0) < amount) {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create transaction record
    const transaction = await base44.entities.Transaction.create({
      type: 'transfer',
      amount: amount,
      platform: 'wallet',
      payout_status: 'pending',
      payout_date: scheduled_date,
      description: `Payout scheduled: ${reason}`,
      notes: `Destination: ${destination}`
    });

    // Update wallet balance
    await base44.entities.UserGoals.update(goals.id, {
      wallet_balance: (goals.wallet_balance || 0) - amount
    });

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `📤 Payout scheduled: $${amount} (${scheduled_date})`,
      severity: 'info',
      metadata: { transaction_id: transaction.id, destination }
    });

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      amount,
      scheduled_date,
      status: 'pending'
    });
  } catch (error) {
    console.error('Schedule payout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Process pending payout
 */
async function processPayout(base44, user, payload) {
  const { transaction_id } = payload;

  try {
    const transactions = await base44.entities.Transaction.filter(
      { id: transaction_id },
      null,
      1
    );

    if (!transactions || !transactions.length) {
      return Response.json({ error: 'Transaction not found' }, { status: 404 });
    }

    const tx = transactions[0];

    // Update transaction status
    await base44.entities.Transaction.update(transaction_id, {
      payout_status: 'processing',
      payout_date: new Date().toISOString().split('T')[0]
    });

    // Simulate processing delay
    setTimeout(async () => {
      await base44.entities.Transaction.update(transaction_id, {
        payout_status: 'cleared'
      });
    }, 5000);

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `✓ Payout processed: $${tx.amount}`,
      severity: 'success',
      metadata: { transaction_id }
    });

    return Response.json({
      success: true,
      transaction_id,
      status: 'processing',
      message: 'Payout is being processed'
    });
  } catch (error) {
    console.error('Process payout error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get real-time revenue metrics
 */
async function getRevenueMetrics(base44, user) {
   try {
     const transactions = await base44.entities.Transaction.filter(
       { type: 'income', created_by: user.email },
       '-created_date',
       300
     );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const metrics = {
      current_hour: 0,
      today: 0,
      week: 0,
      month: 0,
      all_time: 0,
      velocity: {
        hourly_rate: 0,
        daily_rate: 0,
        weekly_rate: 0
      },
      streaks: {
        consecutive_days: 0,
        highest_earning_day: 0
      }
    };

    let lastEarningDate = null;
    let consecutiveDays = 0;

    for (const tx of transactions) {
      const txDate = new Date(tx.created_date);
      const amount = tx.amount || 0;
      const daysAgo = Math.floor((today - txDate) / (1000 * 60 * 60 * 24));

      // Track all time
      metrics.all_time += amount;

      // Hourly
      const hoursAgo = (Date.now() - txDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo < 1) {
        metrics.current_hour += amount;
      }

      // Daily
      if (daysAgo === 0) {
        metrics.today += amount;
      }

      // Weekly
      if (daysAgo < 7) {
        metrics.week += amount;
      }

      // Monthly
      if (daysAgo < 30) {
        metrics.month += amount;
      }

      // Streak tracking
      if (daysAgo === 0) {
        if (!lastEarningDate || (lastEarningDate - txDate) / (1000 * 60 * 60 * 24) <= 1) {
          consecutiveDays++;
        }
        lastEarningDate = txDate;
      }

      metrics.streaks.highest_earning_day = Math.max(metrics.streaks.highest_earning_day, amount);
    }

    metrics.streaks.consecutive_days = consecutiveDays;
    metrics.velocity.hourly_rate = (metrics.today / 24).toFixed(2);
    metrics.velocity.daily_rate = (metrics.week / 7).toFixed(2);
    metrics.velocity.weekly_rate = (metrics.month / 4.3).toFixed(2);

    return Response.json({
      success: true,
      metrics
    });
  } catch (error) {
    console.error('Get revenue metrics error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Analyze earnings by stream (AI vs User)
 */
async function analyzeEarningsStream(base44, user, payload) {
   const { period = 'month' } = payload;

   try {
     const transactions = await base44.entities.Transaction.filter(
       { type: 'income', created_by: user.email },
       '-created_date',
       500
     );

    const now = new Date();
    let filteredTxs = transactions;

    if (period === 'day') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      filteredTxs = transactions.filter(tx => {
        const txDate = new Date(tx.created_date);
        txDate.setHours(0, 0, 0, 0);
        return txDate.getTime() === today.getTime();
      });
    } else if (period === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filteredTxs = transactions.filter(tx => new Date(tx.created_date) >= weekAgo);
    } else if (period === 'month') {
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      filteredTxs = transactions.filter(tx => new Date(tx.created_date) >= monthAgo);
    }

    const aiEarned = filteredTxs
      .filter(tx => tx.description?.includes('[AI'))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const userEarned = filteredTxs
      .filter(tx => !tx.description?.includes('[AI'))
      .reduce((sum, tx) => sum + (tx.amount || 0), 0);

    const total = aiEarned + userEarned;
    const aiPercentage = total > 0 ? ((aiEarned / total) * 100).toFixed(1) : 0;

    return Response.json({
      success: true,
      period,
      ai_earned: aiEarned,
      user_earned: userEarned,
      total_earned: total,
      ai_percentage: parseFloat(aiPercentage),
      user_percentage: parseFloat(100 - aiPercentage),
      transaction_count: filteredTxs.length
    });
  } catch (error) {
    console.error('Analyze earnings stream error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync wallet balance from transactions
 */
async function syncWalletBalance(base44, user) {
   try {
     const transactions = await base44.entities.Transaction.filter({
       created_by: user.email
     }, '-created_date', 1000);
     const userGoals = await base44.entities.UserGoals.filter({
       created_by: user.email
     }, null, 1);

    if (!userGoals.length) {
      return Response.json({ error: 'User goals not found' }, { status: 404 });
    }

    let balance = 0;
    for (const tx of transactions) {
      if (tx.type === 'income') {
        balance += tx.net_amount || 0;
      } else if (tx.type === 'expense' || tx.type === 'transfer') {
        balance -= tx.amount || 0;
      }
    }

    // Update user goals
    await base44.entities.UserGoals.update(userGoals[0].id, {
      wallet_balance: Math.max(balance, 0)
    });

    return Response.json({
      success: true,
      synced_balance: Math.max(balance, 0),
      transaction_count: transactions.length
    });
  } catch (error) {
    console.error('Sync wallet error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get platform breakdown
 */
async function getPlatformBreakdown(base44, user) {
   try {
     const transactions = await base44.entities.Transaction.filter(
       { type: 'income', created_by: user.email },
       '-created_date',
       300
     );

    const breakdown = {};

    for (const tx of transactions) {
      const platform = tx.platform || 'unknown';
      if (!breakdown[platform]) {
        breakdown[platform] = {
          total: 0,
          count: 0,
          avg_transaction: 0,
          platforms_fees: 0
        };
      }
      breakdown[platform].total += tx.amount || 0;
      breakdown[platform].platforms_fees += tx.platform_fee || 0;
      breakdown[platform].count++;
    }

    // Calculate averages
    for (const platform in breakdown) {
      breakdown[platform].avg_transaction = Math.round(
        breakdown[platform].total / breakdown[platform].count
      );
    }

    // Sort by total earnings
    const sorted = Object.entries(breakdown)
      .sort((a, b) => b[1].total - a[1].total);

    return Response.json({
      success: true,
      breakdown: Object.fromEntries(sorted),
      total_platforms: Object.keys(breakdown).length
    });
  } catch (error) {
    console.error('Get platform breakdown error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function calculateIncomeTax(taxableIncome) {
  // 2024 tax brackets (single filer)
  const brackets = [
    { limit: 11000, rate: 0.10 },
    { limit: 44725, rate: 0.12 },
    { limit: 95375, rate: 0.22 },
    { limit: 182100, rate: 0.24 },
    { limit: 231250, rate: 0.32 },
    { limit: 578125, rate: 0.35 },
    { limit: Infinity, rate: 0.37 }
  ];

  let tax = 0;
  let previousLimit = 0;

  for (const bracket of brackets) {
    if (taxableIncome <= previousLimit) break;

    const incomeInBracket = Math.min(taxableIncome, bracket.limit) - previousLimit;
    tax += incomeInBracket * bracket.rate;
    previousLimit = bracket.limit;
  }

  return Math.round(tax);
}

function calculateEfficiencyScore(roi, hourlyRate, profit) {
  let score = 50;

  // ROI bonus
  if (roi >= 200) score += 30;
  else if (roi >= 100) score += 20;
  else if (roi >= 50) score += 10;

  // Hourly rate bonus
  if (hourlyRate >= 100) score += 20;
  else if (hourlyRate >= 50) score += 10;

  // Profit bonus
  if (profit >= 1000) score += 10;

  return Math.min(score, 100);
}