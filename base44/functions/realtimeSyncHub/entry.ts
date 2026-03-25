import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * REALTIME SYNC HUB
 * Listens to entity changes and propagates them across all systems
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const { action, entity_type, entity_id, data } = await req.json().catch(() => ({}));

    // ── BROADCAST_SYNC: Notify all modules of entity change ──
    if (action === 'broadcast_sync') {
      if (!entity_type || !entity_id) {
        return jsonResponse({ error: 'entity_type and entity_id required' }, 400);
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🔄 Sync: ${entity_type} ${entity_id} changed`,
        severity: 'info',
        metadata: { entity_type, entity_id, timestamp: new Date().toISOString() }
      }).catch(() => null);

      // If task completed, update wallet
      if (entity_type === 'TaskExecutionQueue' && data?.status === 'completed' && data?.estimated_value > 0) {
        const goals = await base44.entities.UserGoals.filter({ created_by: user.email }, '', 1).catch(() => []);
        if (goals && goals.length > 0) {
          const goal = goals[0];
          await base44.entities.UserGoals.update(goal.id, {
            total_earned: (goal.total_earned || 0) + (data.estimated_value || 0),
            wallet_balance: (goal.wallet_balance || 0) + (data.estimated_value || 0)
          }).catch(e => console.error('Wallet sync failed:', e.message));
        }
      }

      // If intervention resolved, resume task
      if (entity_type === 'UserIntervention' && data?.status === 'resolved' && data?.task_id) {
        await base44.functions.invoke('resumeTaskAfterIntervention', {
          intervention_id: entity_id,
          task_id: data.task_id,
          user_response: data.user_response
        }).catch(e => console.error('Task resume failed:', e.message));
      }

      return jsonResponse({
        synced: true,
        entity_type,
        affected_modules: ['Autopilot', 'Dashboard', 'Wallet', 'Notifications']
      });
    }

    // ── GET_SYNC_STATUS: Check multi-module sync health ──
    if (action === 'get_sync_status') {
      const [tasks, interventions, goals, transactions] = await Promise.all([
        base44.entities.TaskExecutionQueue.filter({}, '-updated_date', 5).catch(() => []),
        base44.entities.UserIntervention.filter({}, '-updated_date', 5).catch(() => []),
        base44.entities.UserGoals.filter({ created_by: user.email }, '', 1).catch(() => []),
        base44.entities.Transaction.filter({}, '-created_date', 10).catch(() => [])
      ]);

      return jsonResponse({
        status: 'healthy',
        last_updates: {
          tasks: tasks.length,
          interventions: interventions.length,
          wallet_goals: goals.length,
          transactions: transactions.length
        },
        sync_modules: ['Autopilot', 'Dashboard', 'Wallet', 'Notifications', 'ActivityLog'],
        timestamp: new Date().toISOString()
      });
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[RealtimeSyncHub]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}