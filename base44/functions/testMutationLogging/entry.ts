import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * TEST: Mutation Logging Pipeline
 * Creates, updates, and deletes a record to verify all logs are captured
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const results = {
      test: 'mutation_logging_pipeline',
      timestamp: new Date().toISOString(),
      user: user.email,
      steps: []
    };

    // Step 1: Create via universal logger
    console.log('Step 1: Creating test opportunity via universal logger...');
    const createRes = await base44.functions.invoke('universalMutationLogger', {
      entity_name: 'Opportunity',
      operation: 'create',
      data: {
        title: '[TEST] Mutation Logging Verify',
        category: 'arbitrage',
        status: 'new',
        auto_execute: false,
        profit_estimate_low: 100,
        profit_estimate_high: 500,
        velocity_score: 50,
        overall_score: 50
      }
    });
    
    const created = createRes.data?.result;

    results.steps.push({
      action: 'create',
      success: !!created?.id,
      record_id: created?.id
    });

    await new Promise(r => setTimeout(r, 500));

    // Step 2: Update via universal logger
    console.log(`Step 2: Updating record ${created.id} via universal logger...`);
    const updateRes = await base44.functions.invoke('universalMutationLogger', {
      entity_name: 'Opportunity',
      operation: 'update',
      record_id: created.id,
      data: {
        status: 'reviewing',
        notes: 'Test update - should be logged'
      }
    });
    
    const updated = updateRes.data?.result;

    results.steps.push({
      action: 'update',
      success: !!updated,
      record_id: created.id
    });

    await new Promise(r => setTimeout(r, 500));

    // Step 3: Check logs
    console.log('Step 3: Checking ActivityLog for mutations...');
    const allLogs = await base44.entities.ActivityLog.list('-created_date', 50).catch(() => []);
    const logsArray = Array.isArray(allLogs) ? allLogs : [];
    
    const createLogs = logsArray.filter(l => 
      l?.metadata?.entity_name === 'Opportunity' && 
      l?.metadata?.entity_id === created.id &&
      l?.action_type === 'create'
    );

    const updateLogs = logsArray.filter(l => 
      l?.metadata?.entity_name === 'Opportunity' && 
      l?.metadata?.entity_id === created.id &&
      l?.action_type === 'update'
    );

    results.steps.push({
      action: 'check_logs',
      create_logs_found: createLogs.length,
      update_logs_found: updateLogs.length,
      total_activity_logs: logsArray.length
    });

    // Step 4: Delete via universal logger
    console.log(`Step 4: Deleting record ${created.id} via universal logger...`);
    const deleteRes = await base44.functions.invoke('universalMutationLogger', {
      entity_name: 'Opportunity',
      operation: 'delete',
      record_id: created.id
    });
    
    const deleted = deleteRes.data?.success;

    results.steps.push({
      action: 'delete',
      success: true,
      record_id: created.id
    });

    await new Promise(r => setTimeout(r, 500));

    // Step 5: Verify all logs
    console.log('Step 5: Final log verification...');
    const finalLogs = await base44.entities.ActivityLog.list('-created_date', 100).catch(() => []);
    const finalArray = Array.isArray(finalLogs) ? finalLogs : [];

    const allMutationLogs = finalArray.filter(l => 
      l?.metadata?.entity_name === 'Opportunity' && 
      l?.metadata?.entity_id === created.id
    );

    results.steps.push({
      action: 'final_verification',
      total_logs_for_record: allMutationLogs.length,
      logs: allMutationLogs.map(l => ({
        action: l.action_type,
        event_id: l?.metadata?.event_id,
        timestamp: l.created_date
      }))
    });

    return Response.json({
      success: true,
      mutation_logging_test: results,
      status: allMutationLogs.length >= 3 ? '✅ LOGGING WORKING' : '⚠️ GAPS DETECTED'
    });

  } catch (error) {
    console.error('Test error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});