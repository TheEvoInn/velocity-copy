import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Create an intervention for the current logged-in user
    const intervention = await base44.asServiceRole.entities.UserIntervention.create({
      user_email: user.email,
      task_id: 'test-intervention-' + Date.now(),
      requirement_type: 'missing_data',
      required_data: 'Test intervention for ' + user.email,
      status: 'pending',
      priority: 95,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });

    return Response.json({
      success: true,
      user_email: user.email,
      intervention_id: intervention.id,
      message: 'Test intervention created',
    });
  } catch (error) {
    console.error('[testCreateIntervention]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});