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
    const goals = await base44.asServiceRole.entities.UserGoals.list();
    const userGoals = goals[0];

    if (!userGoals?.autopilot_enabled) {
      return Response.json({ success: false, message: 'Autopilot disabled in user goals — cycle skipped' });
    }

    // Check platform state
    const states = await base44.asServiceRole.entities.PlatformState.list();
    const ps = states[0];

    if (ps?.emergency_stop_engaged) {
      return Response.json({ success: false, message: 'Emergency stop engaged — cycle skipped' });
    }

    // Delegate to unifiedOrchestrator full_cycle via service role
    const cycleRes = await base44.asServiceRole.functions.invoke('unifiedOrchestrator', {
      action: 'full_cycle'
    });

    return Response.json({
      success: true,
      source: 'autopilotCycle (scheduled)',
      cycle: cycleRes.data
    });

  } catch (error) {
    console.error('[autopilotCycle] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});