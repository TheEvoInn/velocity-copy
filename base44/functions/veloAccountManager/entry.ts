/**
 * VELO Account Manager
 * Manages proactive job/gig application pipeline
 * Supports: apply_for_jobs, run_proactive_pipeline
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // ACTION: Apply for jobs/opportunities proactively
    if (action === 'apply_for_jobs') {
      const { max_applications = 5, min_score = 60 } = body;

      // Get active identity
      const identities = await base44.entities.AIIdentity.filter(
        { created_by: user.email, is_active: true },
        '-last_used_at',
        1
      );
      const bestIdentity = identities[0] || null;

      // Get available opportunities
      const opportunities = await base44.entities.Opportunity.filter(
        { created_by: user.email, status: 'new' },
        '-overall_score',
        max_applications * 2
      );

      // Filter by score
      const eligible = opportunities.filter(o =>
        (o.overall_score || 0) >= min_score && o.auto_execute !== false
      ).slice(0, max_applications);

      if (eligible.length === 0) {
        return Response.json({
          success: true,
          applied_count: 0,
          skipped_count: 0,
          applied: [],
          skipped: [],
          message: 'No eligible opportunities found matching criteria.'
        });
      }

      // Get linked accounts for routing
      const linkedAccounts = bestIdentity?.id
        ? await base44.entities.LinkedAccount.filter(
            { created_by: user.email, ai_can_use: true, health_status: 'healthy' },
            '-performance_score',
            10
          ).catch(() => [])
        : [];

      const applied = [];
      const skipped = [];

      for (const opp of eligible) {
        // Find best account for this platform
        const bestAccount = linkedAccounts.find(a => a.platform === opp.platform)
          || linkedAccounts[0]
          || null;

        // Queue this as a task in TaskExecutionQueue
        const task = await base44.entities.TaskExecutionQueue.create({
          opportunity_id: opp.id,
          identity_id: bestIdentity?.id,
          linked_account_id: bestAccount?.id,
          platform: opp.platform || bestAccount?.platform,
          opportunity_type: opp.opportunity_type || opp.category || 'other',
          url: opp.url || ('https://' + (opp.platform || 'opportunity') + '.com'),
          status: 'queued',
          priority: opp.overall_score || 50,
          notes: 'Queued by VELO AI application pipeline',
        }).catch(e => ({ error: e.message }));

        if (task.error) {
          skipped.push({
            opp_id: opp.id,
            title: opp.title,
            reason: task.error
          });
          continue;
        }

        // Update opportunity status — user-scoped (RLS: created_by only)
        await base44.entities.Opportunity.update(opp.id, {
          status: 'queued',
          identity_id: bestIdentity?.id,
          identity_name: bestIdentity?.name,
          task_execution_id: task.id,
        }).catch(() => null);

        // Log to AIWorkLog
        await base44.entities.AIWorkLog.create({
          log_type: 'task_decision',
          task_id: task.id,
          opportunity_id: opp.id,
          platform: opp.platform,
          subject: 'Application queued: ' + opp.title,
          status: 'sent',
          ai_decision_context: `VELO AI queued application for ${opp.title} on ${opp.platform} with identity ${bestIdentity?.name || 'default'}`,
        }).catch(() => null);

        applied.push({
          opp_id: opp.id,
          title: opp.title,
          platform: opp.platform,
          estimated_value: opp.profit_estimate_high || opp.profit_estimate_low || 0,
          identity: bestIdentity?.name || 'default',
          task_id: task.id
        });
      }

      const platforms = [...new Set(applied.map(a => a.platform).filter(Boolean))].join(', ');
      return Response.json({
        success: true,
        applied_count: applied.length,
        skipped_count: skipped.length,
        applied,
        skipped,
        message: `Queued ${applied.length} applications across ${platforms || 'various platforms'}.`
      });
    }

    // ACTION: Run proactive pipeline — scan then apply
    if (action === 'run_proactive_pipeline') {
      const { max_applications = 5 } = body;

      // Trigger opportunity scan
      await base44.functions.invoke('globalOpportunityDiscovery', {
        scan_type: 'quick',
        max_results: 20
      }).catch(() => null);

      // Then apply
      const applyResult = await base44.functions.invoke('veloAccountManager', {
        action: 'apply_for_jobs',
        max_applications,
        min_score: 55
      });

      return Response.json({
        success: true,
        pipeline_result: applyResult?.data || {},
        message: 'Proactive pipeline completed: scan + apply.'
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('VELO Account Manager error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});