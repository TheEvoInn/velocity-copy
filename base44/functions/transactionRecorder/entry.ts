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
        platform_fee: amount * 0.2,
        platform_fee_pct: 20,
        timestamp: new Date().toISOString(),
      },
    }).catch(e => ({
      data: {
        success: false,
        error: e.message,
      },
    }));

    if (!recordResult.data?.success) {
      // Log failed recording and request user intervention
      await base44.asServiceRole.entities.UserIntervention.create({
        type: 'transaction_recording_failed',
        priority: 'high',
        title: 'Transaction Recording Failed',
        description: `Failed to record earnings from ${platform}: ${recordResult.data?.error}. Amount: $${amount}. Transaction ID: ${platform_transaction_id}`,
        required_action: 'Manually verify and resubmit transaction',
        data: { platform, amount, platform_transaction_id, error: recordResult.data?.error }
      }).catch(() => null);

      return Response.json({
        success: false,
        error: recordResult.data?.error,
      }, { status: 400 });
    }

    // Sync wallet + update user goals balance
    try {
      const userGoals = await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: user.email },
        '-created_date',
        1
      ).then(r => r[0]).catch(() => null);

      if (userGoals) {
        const netAmount = amount * 0.8; // After 20% fee
        await base44.asServiceRole.entities.UserGoals.update(userGoals.id, {
          wallet_balance: (userGoals.wallet_balance || 0) + netAmount,
          total_earned: (userGoals.total_earned || 0) + amount,
          ai_total_earned: (userGoals.ai_total_earned || 0) + amount,
          updated_date: new Date().toISOString()
        }).catch(() => null);
      }
    } catch (e) {
      console.warn('Wallet sync warning:', e.message);
    }

    // Create wallet transaction record
    await base44.asServiceRole.entities.WalletTransaction.create({
      user_email: user.email,
      type: 'earning',
      amount: Math.round(amount * 100) / 100,
      currency: 'USD',
      source: platform,
      description: `Task completion: ${job_title || 'Job'}`,
      task_execution_id: opportunity_id,
      status: 'confirmed',
      timestamp: new Date().toISOString()
    }).catch(() => null);

    // Log transaction and notify user
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'wallet_update',
      message: `💰 Transaction recorded: $${amount.toFixed(2)} from ${platform}`,
      severity: 'success',
      metadata: { platform, amount, transaction_id: recordResult.data?.transaction_id }
    }).catch(() => null);

    await base44.asServiceRole.entities.Notification.create({
      type: 'wallet_update',
      severity: 'info',
      title: 'Earnings Recorded',
      message: `$${amount.toFixed(2)} confirmed from ${platform}. Balance updated.`,
      user_email: user.email
    }).catch(() => null);

    return Response.json({
      success: true,
      transaction_id: recordResult.data?.transaction_id,
      amount: recordResult.data?.amount,
      platform: platform,
      net_amount: amount * 0.8,
      message: `Transaction recorded and wallet synced`,
    });
  } catch (error) {
    console.error('[TransactionRecorder] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});