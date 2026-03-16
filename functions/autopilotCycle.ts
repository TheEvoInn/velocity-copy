import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Autopilot Full Cycle - simplified version
 * Runs a complete autopilot cycle: scan, queue, execute
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const cycleResults = {
      timestamp: new Date().toISOString(),
      opportunities_scanned: 0,
      opportunities_queued: 0,
      tasks_executed: 0,
      success: true,
      message: 'Autopilot cycle completed'
    };

    try {
      // Get user goals to check if autopilot is enabled
      const goals = await base44.entities.UserGoals.list();
      const userGoals = goals[0];

      if (!userGoals?.autopilot_enabled) {
        return Response.json({
          success: false,
          message: 'Autopilot is disabled',
          cycle: cycleResults
        });
      }

      // Fetch new opportunities that auto-execute is enabled
      const opportunities = await base44.entities.Opportunity.filter({
        status: 'new',
        auto_execute: true
      }, '-created_date', 15);

      cycleResults.opportunities_scanned = opportunities.length;

      // Queue opportunities
      for (const opp of opportunities.slice(0, 5)) {
        try {
          // Create activity log for the opportunity
          await base44.entities.ActivityLog.create({
            action_type: 'opportunity_found',
            message: `📋 Opportunity queued: ${opp.title}`,
            severity: 'success',
            metadata: { opportunity_id: opp.id }
          });

          // Update opportunity status to queued
          await base44.entities.Opportunity.update(opp.id, {
            status: 'queued'
          });

          cycleResults.opportunities_queued++;
        } catch (e) {
          console.error(`Failed to queue opportunity ${opp.id}:`, e.message);
        }
      }

      // Create activity log for cycle completion
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `🤖 Autopilot cycle: ${cycleResults.opportunities_queued}/${cycleResults.opportunities_scanned} opportunities queued`,
        severity: 'success',
        metadata: cycleResults
      });

      return Response.json({
        success: true,
        cycle: cycleResults
      });
    } catch (error) {
      console.error('Autopilot cycle error:', error);
      cycleResults.success = false;
      cycleResults.message = error.message;
      return Response.json({
        success: false,
        cycle: cycleResults,
        error: error.message
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Autopilot function error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});