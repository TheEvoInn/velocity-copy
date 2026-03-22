import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Wallet Manager - Complete wallet lifecycle management
 * Handles deposits, withdrawals, reconciliation, and real-time balance updates
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'get_wallet_summary') {
      return await getWalletSummary(base44, user);
    }

    if (action === 'deposit') {
      return await depositToWallet(base44, user, payload);
    }

    if (action === 'withdraw') {
      return await withdrawFromWallet(base44, user, payload);
    }

    if (action === 'reconcile_platform_payouts') {
      return await reconcilePlatformPayouts(base44, user, payload);
    }

    if (action === 'get_balance') {
      return await getWalletBalance(base44, user);
    }

    if (action === 'record_earning') {
      return await recordEarning(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Wallet Manager Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get complete wallet summary
 */
async function getWalletSummary(base44, user) {
  try {
    // Get user's wallet data
    const userGoals = (await base44.entities.UserGoals.filter(
      { created_by: user?.email },
      null,
      1
    ).catch(() => [])) || [];

    let wallet = (Array.isArray(userGoals) && userGoals.length > 0) ? userGoals[0] : null;

    // Create wallet if doesn't exist
    if (!wallet) {
      wallet = await base44.entities.UserGoals.create({
        created_by: user.email,
        daily_target: 1000,
        wallet_balance: 0,
        total_earned: 0,
        ai_total_earned: 0,
        user_total_earned: 0,
        available_capital: 0
      });
    }

    // Get recent transactions
    const transactions = (await base44.entities.Transaction.filter(
      { created_by: user?.email },
      '-created_date',
      20
    ).catch(() => [])) || [];

    // Calculate current balance from transactions
    let calculatedBalance = 0;
    const safeTxs = Array.isArray(transactions) ? transactions : [];
    safeTxs.forEach(t => {
      if (!t) return;
      try {
        if (t.type === 'income') {
          calculatedBalance += (typeof t.net_amount === 'number' ? t.net_amount : (typeof t.amount === 'number' ? t.amount : 0)) - (typeof t.tax_withheld === 'number' ? t.tax_withheld : 0);
        } else if (t.type === 'expense') {
          calculatedBalance -= typeof t.amount === 'number' ? t.amount : 0;
        }
      } catch (e) {
        console.error('Transaction processing error:', e.message);
      }
    });

    // Get today's earnings
    const today = new Date().toDateString();
    const todayTransactions = safeTxs.filter(t => {
      if (!t || !t.created_date) return false;
      try { return new Date(t.created_date).toDateString() === today && t.type === 'income'; } catch { return false; }
    });
    const todayEarnings = todayTransactions.reduce((sum, t) => sum + (typeof t?.net_amount === 'number' ? t.net_amount : (typeof t?.amount === 'number' ? t.amount : 0)), 0);

    return Response.json({
      success: true,
      wallet_id: wallet?.id || null,
      current_balance: calculatedBalance > 0 ? calculatedBalance : (typeof wallet?.wallet_balance === 'number' ? wallet.wallet_balance : 0),
      total_earned: typeof wallet?.total_earned === 'number' ? wallet.total_earned : 0,
      ai_total_earned: typeof wallet?.ai_total_earned === 'number' ? wallet.ai_total_earned : 0,
      user_total_earned: typeof wallet?.user_total_earned === 'number' ? wallet.user_total_earned : 0,
      available_capital: typeof wallet?.available_capital === 'number' ? wallet.available_capital : 0,
      today_earnings: todayEarnings,
      daily_target: typeof wallet?.daily_target === 'number' ? wallet.daily_target : 1000,
      recent_transactions: Array.isArray(safeTxs) ? safeTxs.slice(0, 10) : [],
      transaction_count: safeTxs.length || 0
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Deposit earnings to wallet
 */
async function depositToWallet(base44, user, payload) {
  const {
    amount,
    source_platform,
    source_type,
    category,
    identity_id,
    task_id,
    opportunity_id,
    description,
    confirmation_code
  } = payload;

  if (!amount || amount <= 0) {
    return Response.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    // Get current wallet
    const userGoals = await base44.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    );

    const wallet = userGoals?.[0];
    if (!wallet) {
      return Response.json({ error: 'Wallet not initialized' }, { status: 404 });
    }

    // Calculate fees and net amount
    const platformFee = source_platform ? (amount * 0.15) : 0; // 15% platform fee estimate
    const taxEstimate = amount * 0.25; // 25% tax estimate
    const netAmount = amount - platformFee - taxEstimate;

    // Create transaction record
    const transaction = await base44.entities.Transaction.create({
      type: 'income',
      amount,
      net_amount: netAmount,
      platform_fee: platformFee,
      platform_fee_pct: 15,
      tax_withheld: taxEstimate,
      tax_rate_pct: 25,
      platform: source_platform || 'unknown',
      category: category || source_type,
      description: description || `Earning from ${source_platform}`,
      opportunity_id,
      linked_account_id: identity_id,
      balance_after: wallet.wallet_balance + netAmount,
      payout_status: 'available',
      confirmation_number: confirmation_code,
      created_by: user.email
    });

    // Update wallet balance
    await base44.entities.UserGoals.update(wallet.id, {
      wallet_balance: wallet.wallet_balance + netAmount,
      total_earned: wallet.total_earned + amount,
      available_capital: wallet.available_capital + netAmount
    });

    // Update identity-specific earnings
    if (identity_id) {
      const identity = await base44.entities.AIIdentity.filter(
        { id: identity_id },
        null,
        1
      );
      
      if (identity?.[0]) {
        await base44.entities.AIIdentity.update(identity_id, {
          total_earned: (identity[0].total_earned || 0) + amount
        });
      }
    }

    // Log the action
    await base44.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `Deposited $${netAmount.toFixed(2)} from ${source_platform} to wallet`,
      metadata: {
        amount,
        net_amount: netAmount,
        source: source_platform,
        transaction_id: transaction.id
      },
      severity: 'success',
      created_by: user.email
    });

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      amount_deposited: netAmount,
      new_balance: wallet.wallet_balance + netAmount,
      message: `$${netAmount.toFixed(2)} deposited from ${source_platform}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Withdraw from wallet
 */
async function withdrawFromWallet(base44, user, payload) {
  const { amount, destination_account, withdrawal_type } = payload;

  if (!amount || amount <= 0) {
    return Response.json({ error: 'Invalid amount' }, { status: 400 });
  }

  try {
    const userGoals = await base44.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    );

    const wallet = userGoals?.[0];
    if (!wallet || wallet.wallet_balance < amount) {
      return Response.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Create withdrawal transaction
    const transaction = await base44.entities.Transaction.create({
      type: 'transfer',
      amount,
      platform: destination_account || 'external_bank',
      payout_status: 'pending',
      balance_after: wallet.wallet_balance - amount,
      description: `Withdrawal to ${destination_account}`,
      created_by: user.email
    });

    // Update wallet
    await base44.entities.UserGoals.update(wallet.id, {
      wallet_balance: wallet.wallet_balance - amount
    });

    return Response.json({
      success: true,
      transaction_id: transaction.id,
      amount_withdrawn: amount,
      new_balance: wallet.wallet_balance - amount,
      status: 'pending'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Record earning from any source
 */
async function recordEarning(base44, user, payload) {
   const {
     amount,
     source,
     category,
     description,
     identity_id,
     opportunity_id
   } = payload;

   if (!amount || amount <= 0) {
     return Response.json({ error: 'Invalid amount' }, { status: 400 });
   }

   try {
     // Enforce user-specific isolation
     const depositResult = await depositToWallet(base44, user, {
       amount,
       source_platform: source,
       category,
       description,
       identity_id,
       opportunity_id,
       created_by: user.email  // Force user-specific isolation
     });

     const depositJson = await depositResult.json();
     if (!depositResult.ok) {
       return depositResult;
     }

     // Sync across modules in real-time
     await base44.functions.invoke('realTimeSyncOrchestrator', {
       action: 'update_wallet_realtime',
       payload: {
         amount,
         source,
         description,
         category
       }
     });

     return Response.json({
       success: true,
       message: `Earning recorded: $${amount} from ${source}`,
       ...depositJson
     });
   } catch (error) {
     return Response.json({ error: error.message }, { status: 500 });
   }
 }

/**
 * Reconcile platform payouts
 */
async function reconcilePlatformPayouts(base44, user, payload) {
  const { platform } = payload;

  try {
    // Get all opportunities completed on this platform
    const completedOpportunities = await base44.entities.Opportunity.filter({
      platform: platform || undefined,
      status: 'completed'
    }, '-created_date', 100);

    let totalReconciled = 0;
    const unreconciled = [];

    for (const opp of completedOpportunities || []) {
      // Check if this opportunity has a corresponding transaction
      const transaction = await base44.entities.Transaction.filter({
        opportunity_id: opp.id
      }, null, 1);

      if (!transaction || transaction.length === 0) {
        // This is unreconciled - needs deposit
        if (opp.profit_estimate_high && opp.profit_estimate_high > 0) {
          const depositRes = await depositToWallet(base44, user, {
            amount: opp.profit_estimate_high,
            source_platform: opp.platform,
            category: opp.category,
            description: `Reconciled: ${opp.title}`,
            opportunity_id: opp.id
          });

          if (depositRes.ok) {
            totalReconciled += opp.profit_estimate_high;
          }
        }
      }
    }

    return Response.json({
      success: true,
      platform,
      opportunities_checked: completedOpportunities?.length || 0,
      total_reconciled_amount: totalReconciled,
      message: `Reconciliation complete: $${totalReconciled.toFixed(2)} deposited`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Get current wallet balance
 */
async function getWalletBalance(base44, user) {
  try {
    const summary = await getWalletSummary(base44, user);
    return summary;
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}