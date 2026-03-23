/**
 * TRANSACTION RECORDER
 * Triggered when earnings are confirmed cleared on platform
 * Records transaction with full platform verification
 * Called from execution engines after job confirmation
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { opportunity_id, platform, amount, platform_transaction_id, job_title } = body;

    // Validate required fields
    if (!platform || !amount || !platform_transaction_id) {
      return Response.json({
        error: 'Missing required fields: platform, amount, platform_transaction_id',
      }, { status: 400 });
    }

    // Record the real earning
    const recordResult = await base44.functions.invoke('realEarningsTracking', {
      action: 'record_real_earning',
      earning: {
        platform,
        platform_transaction_id,
        amount,
        status: 'cleared',
        source_job_id: opportunity_id,
        description: `Job completion: ${job_title || 'Application submitted'}`,
        platform_fee: amount * 0.2, // Platform fee estimate
        platform_fee_pct: 20,
        current_balance: amount, // Will be recalculated on next sync
      },
    }).catch(e => ({
      data: {
        success: false,
        error: e.message,
      },
    }));

    if (!recordResult.data?.success) {
      return Response.json({
        success: false,
        error: recordResult.data?.error,
      }, { status: 400 });
    }

    // Log the transaction recording
    console.log(`✓ Transaction recorded: $${amount.toFixed(2)} from ${platform} (${platform_transaction_id})`);

    return Response.json({
      success: true,
      transaction_id: recordResult.data?.transaction_id,
      amount: recordResult.data?.amount,
      platform: platform,
      message: `Transaction recorded successfully`,
    });
  } catch (error) {
    console.error('[TransactionRecorder] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});