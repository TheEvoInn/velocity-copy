/**
 * EARNINGS SYNC SCHEDULER
 * Runs every 4 hours via automation trigger
 * Syncs all platform earnings and updates wallet in real-time
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Execute real-time sync cycle
    const syncResult = await base44.functions.invoke('realtimeSyncOrchestrator', {
      action: 'run_sync_cycle',
    }).catch(e => ({
      data: {
        success: false,
        error: e.message,
        cycle: {
          started_at: new Date().toISOString(),
          platforms: [],
          total_earnings: 0,
          transactions_synced: 0,
          wallet_updated: false,
          errors: [e.message],
        },
      },
    }));

    if (!syncResult.data?.success) {
      return Response.json({
        success: false,
        error: syncResult.data?.error,
        cycle: syncResult.data?.cycle,
      }, { status: 500 });
    }

    // Log successful sync
    const cycle = syncResult.data?.cycle;
    console.log(`✓ Earnings sync completed: ${cycle.transactions_synced} transactions, $${cycle.total_earnings.toFixed(2)} available`);

    return Response.json({
      success: true,
      cycle: cycle,
      message: `Synced ${cycle.transactions_synced} transactions across ${cycle.platforms.length} platforms`,
    });
  } catch (error) {
    console.error('[EarningsSyncScheduler] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});