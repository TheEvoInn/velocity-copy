import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

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

    // Use service role to safely initialize user data
    const service = base44.asServiceRole;

    // Ensure PlatformState exists and autopilot is ON by default
    let platformStates = await service.entities.PlatformState.filter({ created_by: user.email }, '', 1);
    let platformState = platformStates[0];
    
    if (!platformState) {
      // Create default platform state
      platformState = await service.entities.PlatformState.create({
        autopilot_enabled: true,
        autopilot_mode: 'continuous',
        system_health: 'healthy',
        execution_log: [{
          timestamp: new Date().toISOString(),
          action: 'INIT',
          status: 'success',
          details: 'Platform initialized with autopilot enabled'
        }]
      });
    }

    // Ensure UserGoals exists
    let userGoals = (await service.entities.UserGoals.filter({ created_by: user.email }, '', 1))[0];
    if (!userGoals) {
      userGoals = await service.entities.UserGoals.create({
        daily_target: 1000,
        risk_tolerance: 'moderate',
        autopilot_enabled: true,
        ai_daily_target: 500,
        ai_preferred_categories: ['freelance', 'grant', 'contest']
      });
    }

    // Ensure at least one AI Identity exists
    const identities = await service.entities.AIIdentity.filter({ created_by: user.email }, '', 1);
    if (identities.length === 0) {
      await service.entities.AIIdentity.create({
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
        autopilot_enabled: platformState?.autopilot_enabled ?? true,
        system_health: platformState?.system_health ?? 'healthy',
        user_ready: !!userGoals
      }
    });
  } catch (error) {
    console.error('Platform initialization error:', error);
    return Response.json({ 
      error: error.message,
      success: true
    }, { status: 200 });
  }
});