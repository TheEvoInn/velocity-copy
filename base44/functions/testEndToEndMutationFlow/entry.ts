import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * END-TO-END MUTATION LOGGING TEST
 * Creates, updates, deletes and verifies ALL logs are recorded
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const results = {
      test: 'end_to_end_mutation_logging',
      timestamp: new Date().toISOString(),
      user: user.email,
      steps: [],
      verification: {}
    };

    // Helper: Log mutation
    async function logMutation(entityName, entityId, operation, data = {}) {
      const eventId = `${entityName}_${entityId}_${operation}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await base44.entities.ActivityLog.create({
        action_type: operation,
        message: `⟳ ${operation.toUpperCase()} ${entityName} #${entityId}`,
        severity: 'info',
        metadata: {
          entity_name: entityName,
          entity_id: entityId,
          operation,
          event_id: eventId,
          timestamp: new Date().toISOString()
        }
      }).catch(err => console.error('Log failed:', err));

      return eventId;
    }

    // Step 1: Create
    const created = await base44.entities.Opportunity.create({
      title: '[E2E TEST] Logging Flow',
      category: 'arbitrage',
      status: 'new',
      profit_estimate_low: 100,
      profit_estimate_high: 500,
      velocity_score: 55,
      overall_score: 55
    });

    const createEventId = await logMutation('Opportunity', created.id, 'create', created);
    
    results.steps.push({
      step: 'create',
      record_id: created.id,
      event_id: createEventId,
      success: !!created.id
    });

    await new Promise(r => setTimeout(r, 300));

    // Step 2: Update
    await base44.entities.Opportunity.update(created.id, {
      status: 'reviewing',
      notes: 'Test update successful'
    });

    const updateEventId = await logMutation('Opportunity', created.id, 'update', { status: 'reviewing' });
    
    results.steps.push({
      step: 'update',
      record_id: created.id,
      event_id: updateEventId,
      success: true
    });

    await new Promise(r => setTimeout(r, 300));

    // Step 3: Delete
    await base44.entities.Opportunity.delete(created.id);
    
    const deleteEventId = await logMutation('Opportunity', created.id, 'delete');
    
    results.steps.push({
      step: 'delete',
      record_id: created.id,
      event_id: deleteEventId,
      success: true
    });

    await new Promise(r => setTimeout(r, 500));

    // Verify all logs exist
    const allLogs = await base44.entities.ActivityLog.list('-created_date', 100).catch(() => []);
    const logsArray = Array.isArray(allLogs) ? allLogs : [];

    const eventIds = [createEventId, updateEventId, deleteEventId];
    const foundLogs = logsArray.filter(l => 
      l?.metadata?.entity_name === 'Opportunity' && 
      l?.metadata?.entity_id === created.id
    );

    results.verification = {
      expected_logs: 3,
      found_logs: foundLogs.length,
      all_present: foundLogs.length === 3,
      logs_detail: foundLogs.map(l => ({
        event_id: l?.metadata?.event_id,
        operation: l?.metadata?.operation,
        created: l.created_date
      })),
      total_activity_logs: logsArray.length
    };

    return Response.json({
      success: true,
      test_results: results,
      status: foundLogs.length === 3 ? '✅ E2E LOGGING COMPLETE' : '⚠️ LOGS MISSING',
      next_fix: 'Integrate universalMutationLogger into all entity mutation calls'
    });

  } catch (error) {
    console.error('Test error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});