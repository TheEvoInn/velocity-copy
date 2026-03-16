import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action } = await req.json();

    if (action === 'ensure_default_identity') {
      // Check if user already has a default identity
      const existingIdentities = await base44.entities.AIIdentity.filter({
        created_by: user.email,
        is_user_specific: true
      }, '-created_date', 1);

      let identityId;

      if (existingIdentities.length > 0) {
        // Use existing identity
        identityId = existingIdentities[0].id;
      } else {
        // Create default identity
        const defaultIdentity = await base44.entities.AIIdentity.create({
          name: `${user.full_name || 'User'}'s Primary Identity`,
          role_label: 'Autonomous Agent',
          email: user.email,
          bio: `Auto-generated identity for autonomous execution`,
          communication_tone: 'professional',
          is_active: true,
          is_user_specific: true,
          created_by: user.email,
          tasks_executed: 0,
          total_earned: 0,
          color: '#10b981',
          skills: ['autonomous_execution', 'task_completion', 'opportunity_evaluation'],
          preferred_categories: ['arbitrage', 'service', 'lead_gen', 'digital_flip', 'freelance'],
          linked_account_ids: [],
          spending_limit_per_task: 100
        });

        identityId = defaultIdentity.id;
      }

      // Update PlatformState with active identity
      const platformStates = await base44.entities.PlatformState.list();
      const platformState = platformStates[0];

      if (platformState) {
        await base44.entities.PlatformState.update(platformState.id, {
          active_identity_id: identityId
        });
      }

      // Update UserGoals with autopilot enabled
      const userGoals = await base44.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
      if (userGoals.length > 0) {
        await base44.entities.UserGoals.update(userGoals[0].id, {
          autopilot_enabled: true
        });
      }

      return Response.json({
        success: true,
        identity_id: identityId,
        message: 'Default identity assigned for autonomous execution'
      });
    }

    if (action === 'get_active_identity') {
      const userGoals = await base44.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
      
      if (userGoals.length === 0) {
        return Response.json({ error: 'User profile not configured' }, { status: 400 });
      }

      const platformStates = await base44.entities.PlatformState.list();
      const platformState = platformStates[0];
      const activeIdentityId = platformState?.active_identity_id;

      if (!activeIdentityId) {
        return Response.json({ 
          success: false, 
          message: 'No active identity. Please run ensure_default_identity first.' 
        });
      }

      const identity = await base44.entities.AIIdentity.filter(
        { id: activeIdentityId },
        '-created_date',
        1
      );

      return Response.json({
        success: true,
        identity: identity[0] || null
      });
    }

    if (action === 'verify_identity_ready') {
      // Verify user has identity + credentials for execution
      const userGoals = await base44.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1);
      
      if (userGoals.length === 0) {
        return Response.json({ 
          ready: false, 
          reason: 'User profile not configured' 
        });
      }

      const platformStates = await base44.entities.PlatformState.list();
      const platformState = platformStates[0];
      const activeIdentityId = platformState?.active_identity_id;

      if (!activeIdentityId) {
        return Response.json({ 
          ready: false, 
          reason: 'No active identity assigned' 
        });
      }

      const identity = await base44.entities.AIIdentity.filter(
        { id: activeIdentityId },
        '-created_date',
        1
      );

      if (identity.length === 0) {
        return Response.json({ 
          ready: false, 
          reason: 'Identity not found' 
        });
      }

      return Response.json({
        ready: true,
        identity_name: identity[0].name,
        identity_id: identity[0].id,
        message: 'Identity ready for autonomous execution'
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});