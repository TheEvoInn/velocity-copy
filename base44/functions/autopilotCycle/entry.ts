import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Autopilot Cycle — Scheduled entry point
 * Delegates to unifiedOrchestrator for full cycle execution.
 * Called by the scheduled "Auto-Execute Batch" automation every 15 min.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // For scheduled automation calls, use service role
    // Support explicit action from frontend (e.g. process_queue)
    const action = body.action || 'full_cycle';

    const states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
    const ps = states[0];

    if (ps?.emergency_stop_engaged) {
      return Response.json({ success: false, message: 'Emergency stop engaged — cycle skipped' });
    }

    // Get all users with autopilot enabled
    const allGoals = await base44.asServiceRole.entities.UserGoals.list().catch(() => []);
    const enabledGoals = allGoals.filter(g => g.autopilot_enabled);

    if (enabledGoals.length === 0) {
      return Response.json({ success: false, message: 'No users have autopilot enabled — cycle skipped' });
    }

    // Run cycle for each enabled user
    const results = [];
    for (const goals of enabledGoals) {
      const userEmail = goals.created_by;
      if (!userEmail) continue;

      const cycleRes = await base44.asServiceRole.functions.invoke('unifiedOrchestrator', {
        action: action === 'process_queue' ? 'execute_queued_tasks' : 'full_cycle',
        user_email: userEmail,
      }).catch(e => ({ data: { success: false, error: e.message } }));

      results.push({ user: userEmail, result: cycleRes?.data });
    }

    return Response.json({
      success: true,
      source: 'autopilotCycle (scheduled)',
      users_processed: results.length,
      results,
    });

  } catch (error) {
    console.error('[autopilotCycle] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});