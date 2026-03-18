import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * REAL-TIME SYNC ORCHESTRATOR
 * 
 * Ensures continuous real-time synchronization across all modules:
 * - Wallet ↔ Opportunities
 * - Wallet ↔ Autopilot
 * - Wallet ↔ Identity Manager
 * - Wallet ↔ Prize Module
 * - Wallet ↔ Transaction Logs
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'sync_wallet_opportunities') {
      return await syncWalletOpportunities(base44, user);
    }

    if (action === 'sync_wallet_autopilot') {
      return await syncWalletAutopilot(base44, user);
    }

    if (action === 'sync_wallet_identities') {
      return await syncWalletIdentities(base44, user);
    }

    if (action === 'sync_opportunity_completion') {
      return await syncOpportunityCompletion(base44, user, payload);
    }

    if (action === 'sync_task_completion') {
      return await syncTaskCompletion(base44, user, payload);
    }

    if (action === 'update_wallet_realtime') {
      return await updateWalletRealtime(base44, user, payload);
    }

    if (action === 'broadcast_balance_update') {
      return await broadcastBalanceUpdate(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Sync Orchestrator Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Sync: Wallet ↔ Opportunities
 * When opportunity completes, deposit to wallet
 * When wallet updates, reflect in opportunities
 */
async function syncWalletOpportunities(base44, user) {
  const syncs = [];

  try {
    // Get completed opportunities without wallet deposits
    const opps = await base44.entities.Opportunity.filter({
      created_by: user.email,
      status: 'completed'
    }, '-created_date', 100);

    for (const opp of opps || []) {
      // Check for transaction
      const txs = await base44.entities.Transaction.filter({
        opportunity_id: opp.id,
        created_by: user.email
      }, null, 1);

      if (!txs || txs.length === 0) {
        // Create transaction
        const amount = opp.profit_estimate_high || 0;
        if (amount > 0) {
          const tx = await base44.entities.Transaction.create({
            type: 'income',
            amount,
            net_amount: amount * 0.75,
            platform: opp.platform,
            category: opp.category,
            opportunity_id: opp.id,
            description: `[SYNC] ${opp.title}`,
            payout_status: 'available',
            created_by: user.email
          });

          syncs.push({
            type: 'opportunity_deposit',
            opportunity_id: opp.id,
            transaction_id: tx.id,
            amount: amount
          });
        }
      }
    }

    // Update wallet
    const wallet = await base44.entities.UserGoals.filter({
      created_by: user.email
    }, null, 1);

    if (wallet?.[0]) {
      const txs = await base44.entities.Transaction.filter({
        created_by: user.email,
        type: 'income'
      }, null, 1000);

      let balance = 0;
      let totalEarned = 0;
      for (const tx of txs) {
        balance += tx.net_amount || tx.amount || 0;
        totalEarned += tx.amount || 0;
      }

      await base44.entities.UserGoals.update(wallet[0].id, {
        wallet_balance: Math.max(balance, 0),
        total_earned: totalEarned
      });
    }

    return Response.json({
      success: true,
      sync_type: 'wallet_↔_opportunities',
      syncs_performed: syncs.length,
      details: syncs
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync: Wallet ↔ Autopilot Tasks
 */
async function syncWalletAutopilot(base44, user) {
  const syncs = [];

  try {
    // Get completed AI tasks
    const tasks = await base44.entities.AITask.filter({
      created_by: user.email,
      status: 'completed'
    }, '-created_date', 100);

    for (const task of tasks || []) {
      if (task.revenue_generated && task.revenue_generated > 0) {
        // Check if already deposited
        const txs = await base44.entities.Transaction.filter({
          opportunity_id: task.id,
          created_by: user.email
        }, null, 1);

        if (!txs || txs.length === 0) {
          const tx = await base44.entities.Transaction.create({
            type: 'income',
            amount: task.revenue_generated,
            net_amount: task.revenue_generated * 0.75,
            platform: 'autopilot',
            category: task.category,
            description: `[AI Autopilot] ${task.title}`,
            payout_status: 'available',
            created_by: user.email
          });

          syncs.push({
            type: 'task_deposit',
            task_id: task.id,
            transaction_id: tx.id,
            amount: task.revenue_generated
          });
        }
      }
    }

    return Response.json({
      success: true,
      sync_type: 'wallet_↔_autopilot',
      syncs_performed: syncs.length,
      details: syncs
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync: Wallet ↔ Identity Earnings
 */
async function syncWalletIdentities(base44, user) {
  const syncs = [];

  try {
    const identities = await base44.entities.AIIdentity.list('-created_date', 100);

    for (const identity of identities || []) {
      // Calculate identity's total earnings
      const tasks = await base44.entities.AITask.filter({
        created_by: user.email
      }, '-created_date', 500);

      let totalEarnings = 0;
      for (const task of tasks) {
        totalEarnings += task.revenue_generated || 0;
      }

      if (identity.total_earned !== totalEarnings) {
        await base44.entities.AIIdentity.update(identity.id, {
          total_earned: totalEarnings
        });

        syncs.push({
          type: 'identity_earnings_sync',
          identity_id: identity.id,
          identity_name: identity.name,
          total_earnings: totalEarnings
        });
      }
    }

    return Response.json({
      success: true,
      sync_type: 'wallet_↔_identities',
      syncs_performed: syncs.length,
      details: syncs
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync on Opportunity Completion
 */
async function syncOpportunityCompletion(base44, user, payload) {
  const { opportunity_id, profit_amount, confirmation_data } = payload;

  try {
    // Create transaction
    const tx = await base44.entities.Transaction.create({
      type: 'income',
      amount: profit_amount,
      net_amount: profit_amount * 0.75,
      opportunity_id,
      payout_status: 'available',
      description: `[Opportunity] Completed`,
      confirmation_number: confirmation_data?.confirmation_number,
      created_by: user.email
    });

    // Update wallet
    const wallet = await base44.entities.UserGoals.filter({
      created_by: user.email
    }, null, 1);

    if (wallet?.[0]) {
      await base44.entities.UserGoals.update(wallet[0].id, {
        wallet_balance: (wallet[0].wallet_balance || 0) + (profit_amount * 0.75),
        total_earned: (wallet[0].total_earned || 0) + profit_amount,
        user_total_earned: (wallet[0].user_total_earned || 0) + profit_amount
      });
    }

    // Log activity
    await base44.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `Opportunity completed - $${profit_amount} deposited`,
      severity: 'success',
      metadata: {
        opportunity_id,
        transaction_id: tx.id,
        amount: profit_amount
      },
      created_by: user.email
    });

    return Response.json({
      success: true,
      transaction_id: tx.id,
      amount_deposited: profit_amount * 0.75
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Sync on Task Completion
 */
async function syncTaskCompletion(base44, user, payload) {
  const { task_id, revenue_generated, description } = payload;

  try {
    // Create transaction
    const tx = await base44.entities.Transaction.create({
      type: 'income',
      amount: revenue_generated,
      net_amount: revenue_generated * 0.75,
      platform: 'autopilot',
      description: `[AI Autopilot] ${description || 'Task completed'}`,
      payout_status: 'available',
      created_by: user.email
    });

    // Update wallet
    const wallet = await base44.entities.UserGoals.filter({
      created_by: user.email
    }, null, 1);

    if (wallet?.[0]) {
      await base44.entities.UserGoals.update(wallet[0].id, {
        wallet_balance: (wallet[0].wallet_balance || 0) + (revenue_generated * 0.75),
        total_earned: (wallet[0].total_earned || 0) + revenue_generated,
        ai_total_earned: (wallet[0].ai_total_earned || 0) + revenue_generated
      });
    }

    return Response.json({
      success: true,
      transaction_id: tx.id,
      amount_deposited: revenue_generated * 0.75
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Real-Time Wallet Update
 */
async function updateWalletRealtime(base44, user, payload) {
  const { amount, source, description, category } = payload;

  try {
    // Create transaction
    const tx = await base44.entities.Transaction.create({
      type: 'income',
      amount,
      net_amount: amount * 0.75,
      platform: source,
      category,
      description,
      payout_status: 'available',
      created_by: user.email
    });

    // Update wallet in real-time
    const wallet = await base44.entities.UserGoals.filter({
      created_by: user.email
    }, null, 1);

    if (wallet?.[0]) {
      const newBalance = (wallet[0].wallet_balance || 0) + (amount * 0.75);
      const newTotal = (wallet[0].total_earned || 0) + amount;

      await base44.entities.UserGoals.update(wallet[0].id, {
        wallet_balance: newBalance,
        total_earned: newTotal
      });
    }

    return Response.json({
      success: true,
      transaction_id: tx.id,
      new_wallet_balance: (wallet?.[0]?.wallet_balance || 0) + (amount * 0.75),
      amount_added: amount * 0.75
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Broadcast Balance Update to All Modules
 */
async function broadcastBalanceUpdate(base44, user) {
  try {
    // Get current wallet
    const wallet = await base44.entities.UserGoals.filter({
      created_by: user.email
    }, null, 1);

    if (!wallet?.[0]) {
      return Response.json({ error: 'Wallet not found' }, { status: 404 });
    }

    // Log broadcast
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `Real-time balance broadcast: $${wallet[0].wallet_balance}`,
      severity: 'info',
      metadata: {
        wallet_balance: wallet[0].wallet_balance,
        total_earned: wallet[0].total_earned,
        ai_earned: wallet[0].ai_total_earned,
        user_earned: wallet[0].user_total_earned
      },
      created_by: user.email
    });

    return Response.json({
      success: true,
      broadcast: {
        wallet_balance: wallet[0].wallet_balance,
        total_earned: wallet[0].total_earned,
        ai_earned: wallet[0].ai_total_earned,
        user_earned: wallet[0].user_total_earned,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}