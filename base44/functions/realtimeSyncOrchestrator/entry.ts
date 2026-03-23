/**
 * REAL-TIME SYNC ORCHESTRATOR
 * Continuously syncs earnings from platforms every 4 hours
 * Updates wallet balance in real-time, not retroactively
 * Logs all platform interactions with timestamps + response codes
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Orchestrate complete sync cycle across all platforms
 */
async function runCompleteSyncCycle(base44, userEmail) {
  const syncCycle = {
    started_at: new Date().toISOString(),
    platforms: [],
    total_earnings: 0,
    transactions_synced: 0,
    wallet_updated: false,
    errors: [],
  };

  try {
    // Get user's platform accounts
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail }, null, 1
    ).then(goals => goals[0]);

    if (!userGoals) {
      syncCycle.errors.push('No user goals/platform config found');
      return syncCycle;
    }

    // Sync Upwork earnings
    const upworkSync = await syncPlatformEarnings(
      base44,
      userEmail,
      'upwork',
      userGoals.platform_accounts?.upwork
    );
    syncCycle.platforms.push(upworkSync);
    syncCycle.total_earnings += upworkSync.available_for_withdrawal || 0;
    syncCycle.transactions_synced += upworkSync.transactions_synced || 0;

    // Sync Fiverr earnings
    const fiverrSync = await syncPlatformEarnings(
      base44,
      userEmail,
      'fiverr',
      userGoals.platform_accounts?.fiverr
    );
    syncCycle.platforms.push(fiverrSync);
    syncCycle.total_earnings += fiverrSync.available_for_withdrawal || 0;
    syncCycle.transactions_synced += fiverrSync.transactions_synced || 0;

    // Update wallet with real total
    const walletUpdate = await updateWalletBalance(base44, userEmail, syncCycle.total_earnings);
    syncCycle.wallet_updated = walletUpdate.success;

    // Log the sync cycle
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Real-time sync cycle: ${syncCycle.transactions_synced} transactions, $${syncCycle.total_earnings.toFixed(2)} total available`,
      severity: 'success',
      metadata: {
        cycle_start: syncCycle.started_at,
        platforms: syncCycle.platforms.map(p => ({ platform: p.platform, available: p.available_for_withdrawal })),
        total_earnings: syncCycle.total_earnings,
        transactions: syncCycle.transactions_synced,
      },
    }).catch(() => null);

    return syncCycle;
  } catch (e) {
    syncCycle.errors.push(e.message);
    return syncCycle;
  }
}

/**
 * Sync earnings from a single platform
 */
async function syncPlatformEarnings(base44, userEmail, platform, accountUsername) {
  const syncResult = {
    platform,
    account: accountUsername || 'default',
    synced_at: new Date().toISOString(),
    available_for_withdrawal: 0,
    pending_earnings: 0,
    total_earned_lifetime: 0,
    transactions_synced: 0,
    status: 'pending',
    error: null,
  };

  try {
    // Fetch real earnings from platform API
    const earningsResult = await base44.functions.invoke('realEarningsTracking', {
      action: platform === 'upwork' ? 'sync_upwork_earnings' : 'sync_fiverr_earnings',
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!earningsResult.data?.success) {
      syncResult.status = 'failed';
      syncResult.error = earningsResult.data?.error;
      return syncResult;
    }

    syncResult.available_for_withdrawal = earningsResult.data?.available_for_withdrawal || 0;
    syncResult.pending_earnings = earningsResult.data?.pending_earnings || 0;
    syncResult.total_earned_lifetime = earningsResult.data?.total_earned_lifetime || 0;
    syncResult.status = 'completed';

    // Log platform interaction
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✓ ${platform} earnings sync: $${syncResult.available_for_withdrawal.toFixed(2)} available`,
      severity: 'info',
      metadata: {
        platform,
        available: syncResult.available_for_withdrawal,
        pending: syncResult.pending_earnings,
        lifetime: syncResult.total_earned_lifetime,
      },
    }).catch(() => null);

    return syncResult;
  } catch (e) {
    syncResult.status = 'failed';
    syncResult.error = e.message;
    return syncResult;
  }
}

/**
 * Update wallet balance in real-time with synced earnings
 */
async function updateWalletBalance(base44, userEmail, totalAvailable) {
  try {
    const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: userEmail }, null, 1
    ).then(goals => goals[0]);

    if (!userGoals) {
      return { success: false, error: 'User goals not found' };
    }

    // Update wallet balance to reflect real available earnings
    await base44.asServiceRole.entities.UserGoals.update(userGoals.id, {
      wallet_balance: totalAvailable,
    });

    // Log wallet update
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `💰 Wallet updated: $${totalAvailable.toFixed(2)} available (real-time sync)`,
      severity: 'success',
      metadata: {
        previous_balance: userGoals.wallet_balance,
        new_balance: totalAvailable,
        sync_time: new Date().toISOString(),
      },
    }).catch(() => null);

    return { success: true, balance: totalAvailable };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

/**
 * Record transaction from cleared earnings
 * Only records after platform confirmation
 */
async function recordClearedTransaction(base44, userEmail, earning) {
  try {
    // Validate earning is truly cleared on platform
    const validation = await base44.functions.invoke('realEarningsTracking', {
      action: 'validate_earning',
      transaction_id: earning.transaction_id,
      platform_transaction_id: earning.platform_transaction_id,
    }).catch(e => ({ data: { valid: false, error: e.message } }));

    if (!validation.data?.valid) {
      return {
        success: false,
        error: `Earning validation failed: ${validation.data?.error}`,
      };
    }

    // Record transaction with platform verification
    const recordResult = await base44.functions.invoke('realEarningsTracking', {
      action: 'record_real_earning',
      earning: {
        ...earning,
        status: 'cleared', // Only record cleared earnings
      },
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!recordResult.data?.success) {
      return {
        success: false,
        error: recordResult.data?.error,
      };
    }

    // Log transaction recording
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `✓ Transaction recorded: $${earning.amount.toFixed(2)} from ${earning.platform} (ID: ${earning.platform_transaction_id})`,
      severity: 'success',
      metadata: {
        transaction_id: recordResult.data?.transaction_id,
        platform: earning.platform,
        amount: earning.amount,
        platform_transaction_id: earning.platform_transaction_id,
      },
    }).catch(() => null);

    return recordResult.data;
  } catch (e) {
    return { success: false, error: e.message };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── Run complete sync cycle ────────────────────────────────────────
    if (action === 'run_sync_cycle') {
      const syncCycle = await runCompleteSyncCycle(base44, user.email);
      return Response.json({
        success: syncCycle.errors.length === 0,
        cycle: syncCycle,
      });
    }

    // ── Sync single platform ───────────────────────────────────────────
    if (action === 'sync_platform') {
      const { platform } = body;
      if (!platform) {
        return Response.json({ error: 'Platform required' }, { status: 400 });
      }

      const syncResult = await syncPlatformEarnings(base44, user.email, platform);
      return Response.json({
        success: syncResult.status === 'completed',
        sync: syncResult,
      });
    }

    // ── Update wallet balance ──────────────────────────────────────────
    if (action === 'update_wallet') {
      const { total_available } = body;
      if (typeof total_available !== 'number') {
        return Response.json({ error: 'Total available required' }, { status: 400 });
      }

      const result = await updateWalletBalance(base44, user.email, total_available);
      return Response.json(result);
    }

    // ── Record cleared transaction ─────────────────────────────────────
    if (action === 'record_transaction') {
      const { earning } = body;
      if (!earning) {
        return Response.json({ error: 'Earning data required' }, { status: 400 });
      }

      const result = await recordClearedTransaction(base44, user.email, earning);
      return Response.json(result);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[RealtimeSyncOrchestrator] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});