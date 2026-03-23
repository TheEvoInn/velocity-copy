import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { intervention_id, action, response_data } = await req.json();

    if (!intervention_id) {
      return Response.json({ error: 'Missing intervention_id' }, { status: 400 });
    }

    // Fetch intervention
    const intervention = await base44.entities.UserIntervention.get(intervention_id);
    if (!intervention) {
      return Response.json({ error: 'Intervention not found' }, { status: 404 });
    }

    // Update status based on action
    let newStatus = 'pending';
    if (action === 'resolve') newStatus = 'resolved';
    else if (action === 'reject') newStatus = 'rejected';
    else if (action === 'escalate') newStatus = 'escalated';

    const updatedIntervention = await base44.entities.UserIntervention.update(
      intervention_id,
      {
        status: newStatus,
        user_response: response_data || {},
        resolved_at: new Date().toISOString()
      }
    );

    // If resolved, trigger task continuation
    if (newStatus === 'resolved' && intervention.task_id) {
      try {
        await base44.functions.invoke('taskExecutionContinue', {
          task_id: intervention.task_id,
          intervention_response: response_data
        });
      } catch (err) {
        console.log('Task continuation may not be available:', err.message);
      }
    }

    // Log action
    await base44.entities.ActivityLog.create({
      action_type: 'user_action',
      message: `Intervention ${newStatus}: ${intervention.requirement_type} for task ${intervention.task_id}`,
      metadata: {
        intervention_id,
        action,
        admin_email: user.email
      },
      severity: 'info'
    });

    return Response.json({
      success: true,
      intervention: updatedIntervention
    });
  } catch (error) {
    console.error('Intervention resolver error:', error);
    return Response.json(
      { error: error.message || 'Resolver failed' },
      { status: 500 }
    );
  }
});