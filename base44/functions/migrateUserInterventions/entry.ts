import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MIGRATE USER INTERVENTIONS
 * Backfill user_email on existing interventions
 * Run this once to fix RLS compatibility after schema change
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Only admins can run this
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin only' }, { status: 403 });
    }

    const migrated = [];
    const failed = [];

    // Get all interventions (service role bypasses RLS)
    const allInterventions = await base44.asServiceRole.entities.UserIntervention.list(
      '-created_date',
      1000
    );

    for (const intervention of allInterventions) {
      // Skip if already has user_email
      if (intervention.user_email) {
        continue;
      }

      try {
        // Try to infer user_email from task_id
        // For credential-sync-* tasks, use the default target email
        let userEmail = null;

        if (intervention.task_id?.startsWith('credential-sync')) {
          userEmail = 'dawnvernor@yahoo.com'; // Default from requestUserCredentialData
        } else if (intervention.opportunity_id) {
          // Try to get opportunity to find user email
          const opp = await base44.asServiceRole.entities.Opportunity.filter(
            { id: intervention.opportunity_id },
            '-created_date',
            1
          );
          if (opp?.[0]?.created_by) {
            userEmail = opp[0].created_by;
          }
        }

        // If we couldn't determine email, skip
        if (!userEmail) {
          failed.push({
            id: intervention.id,
            reason: 'Could not determine user email',
          });
          continue;
        }

        // Update the intervention with user_email
        await base44.asServiceRole.entities.UserIntervention.update(
          intervention.id,
          { user_email: userEmail }
        );

        migrated.push({
          id: intervention.id,
          user_email: userEmail,
          task_id: intervention.task_id,
        });
      } catch (e) {
        failed.push({
          id: intervention.id,
          error: e.message,
        });
      }
    }

    // Log migration results
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `✅ UserIntervention migration: ${migrated.length} updated, ${failed.length} failed`,
      severity: 'info',
      metadata: { migrated_count: migrated.length, failed_count: failed.length },
    }).catch(() => null);

    return Response.json({
      success: true,
      migrated_count: migrated.length,
      failed_count: failed.length,
      migrated,
      failed,
    });
  } catch (error) {
    console.error('[migrateUserInterventions]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});