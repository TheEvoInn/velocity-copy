import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Platform Initializer
 * Runs on app load to ensure persistent state and autopilot defaults
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure PlatformState exists and autopilot is ON by default
    let platformState = (await base44.entities.PlatformState.list())[0];
    
    if (!platformState) {
      // Create default platform state
      platformState = await base44.entities.PlatformState.create({
        autopilot_enabled: true, // ✓ Always starts ON
        autopilot_mode: 'continuous',
        system_health: 'healthy',
        execution_log: [
          {
            timestamp: new Date().toISOString(),
            action: 'INIT',
            status: 'success',
            details: 'Platform initialized with autopilot enabled'
          }
        ]
      });
    } else if (!platformState.autopilot_enabled) {
      // Re-enable if somehow disabled
      await base44.entities.PlatformState.update(platformState.id, {
        autopilot_enabled: true
      });
      platformState.autopilot_enabled = true;
    }

    // Ensure UserGoals exists
    let userGoals = (await base44.entities.UserGoals.list())[0];
    if (!userGoals) {
      userGoals = await base44.entities.UserGoals.create({
        daily_target: 1000,
        risk_tolerance: 'moderate',
        autopilot_enabled: true,
        ai_daily_target: 500,
        ai_preferred_categories: ['freelance', 'grant', 'contest']
      });
    }

    // Ensure at least one AI Identity exists
    const identities = await base44.entities.AIIdentity.list('', 1);
    if (identities.length === 0) {
      await base44.entities.AIIdentity.create({
        name: 'Default AI Agent',
        role_label: 'Autonomous Worker',
        is_active: true,
        communication_tone: 'professional',
        email: `ai-${Date.now()}@autopilot.local`
      });
    }

    return Response.json({
      success: true,
      message: 'Platform initialized',
      state: {
        autopilot_enabled: platformState.autopilot_enabled,
        system_health: platformState.system_health,
        user_ready: !!userGoals
      }
    });
  } catch (error) {
    console.error('Platform initialization error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});