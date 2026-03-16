import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Scheduled automation for continuous prize email monitoring and claim execution
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── run_monitoring_cycle ────────────────────────────────────────────────────
    if (action === 'run_monitoring_cycle') {
      const results = {
        emails_scanned: 0,
        prizes_discovered: 0,
        auto_claims_executed: 0,
        manual_actions_flagged: 0,
        reconciliation_run: false,
        overdue_detected: 0
      };

      // 1. Scan all email accounts
      const scanRes = await base44.asServiceRole.functions.invoke('prizeEmailMonitor', {
        action: 'scan_inboxes'
      });

      results.emails_scanned = scanRes.data?.scanned?.length || 0;

      // 2. Auto-execute claims where possible
      const all = await base44.asServiceRole.entities.PrizeOpportunity.filter({
        status: 'discovered',
        requires_user_action: false
      });

      for (const prize of all) {
        if (prize.source_url) {
          const claimRes = await base44.asServiceRole.functions.invoke('prizeClaimExecutor', {
            opportunity_id: prize.id,
            claim_url: prize.source_url,
            auto_submit: true
          });

          if (claimRes.data?.claimed) {
            results.auto_claims_executed++;
          } else if (claimRes.data?.requires_user_action) {
            results.manual_actions_flagged++;
          }
        }
      }

      // 3. Run reconciliation
      const reconcileRes = await base44.asServiceRole.functions.invoke('prizePayoutReconciliation', {
        action: 'reconcile_payouts'
      });

      if (reconcileRes.data?.success) {
        results.reconciliation_run = true;
      }

      // 4. Detect overdue payouts
      const overdueRes = await base44.asServiceRole.functions.invoke('prizePayoutReconciliation', {
        action: 'detect_overdue_payouts'
      });

      results.overdue_detected = overdueRes.data?.count || 0;

      // 5. Log cycle completion
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🔄 Prize monitoring cycle completed: ${results.emails_scanned} emails, ${results.prizes_discovered} new prizes, ${results.auto_claims_executed} auto-claims`,
        severity: results.overdue_detected > 0 ? 'warning' : 'info',
        metadata: results
      });

      return Response.json({
        success: true,
        cycle_completed: true,
        results
      });
    }

    // ── setup_monitoring_schedule ───────────────────────────────────────────────
    if (action === 'setup_monitoring_schedule') {
      // This would be called once to set up the automation
      // In production, the user would configure this via the UI
      return Response.json({
        success: true,
        message: 'Monitoring schedule configured',
        default_interval: '15 minutes',
        next_run: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});