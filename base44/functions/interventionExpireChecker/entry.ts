import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Find pending interventions older than 24 hours
    const expiredInterventions = await base44.entities.UserIntervention.filter({
      status: 'pending',
      created_date: { $lt: twentyFourHoursAgo.toISOString() }
    });

    const expirePromises = expiredInterventions.map(intervention =>
      base44.entities.UserIntervention.update(intervention.id, {
        status: 'expired',
        resolved_at: now.toISOString()
      })
    );

    await Promise.all(expirePromises);

    // Check critical interventions (priority >= 80) and send escalation notifications
    const criticalInterventions = await base44.entities.UserIntervention.filter(
      { status: 'pending', priority: { $gte: 80 } },
      '-created_date',
      100
    );

    for (const intervention of criticalInterventions) {
      const createdTime = new Date(intervention.created_date);
      const minsWaiting = (now - createdTime) / 60000;

      // Escalate if waiting more than 1 hour
      if (minsWaiting > 60) {
        await base44.entities.UserIntervention.update(intervention.id, {
          status: 'escalated'
        });

        // Create notification
        await base44.entities.Notification.create({
          type: 'user_action_required',
          severity: 'critical',
          title: 'Critical Intervention Escalated',
          message: `High-priority intervention for task ${intervention.task_id} has been escalated after ${Math.round(minsWaiting)}m wait`,
          related_entity_type: 'UserIntervention',
          related_entity_id: intervention.id,
          user_email: intervention.created_by
        });
      }
    }

    return Response.json({
      expired_count: expirePromises.length,
      escalated_count: criticalInterventions.filter(
        i => (new Date() - new Date(i.created_date)) / 60000 > 60
      ).length
    });
  } catch (error) {
    console.error('Intervention expiry check error:', error);
    return Response.json(
      { error: error.message || 'Check failed' },
      { status: 500 }
    );
  }
});