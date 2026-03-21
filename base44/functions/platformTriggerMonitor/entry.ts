/**
 * Platform-Wide Trigger Monitor
 * Scheduled automation that continuously monitors all cross-system triggers
 * Admin-only: platform-level orchestration
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const adminBase44 = base44.asServiceRole;

    // Get all active platform-wide triggers
    const triggers = await adminBase44.entities.CrossSystemTrigger.filter(
      { enabled: true, is_platform_wide: true },
      '-priority'
    );

    const monitorResults = [];
    let totalEvaluated = 0;
    let totalTriggered = 0;
    let totalFailed = 0;

    for (const trigger of triggers) {
      try {
        // Get current metric value from source
        const sourceValue = await getSourceMetric(
          adminBase44,
          trigger.source_system,
          trigger.source_entity,
          trigger.source_metric
        );

        // Evaluate condition
        const conditionMet = evaluateCondition(
          sourceValue,
          trigger.last_triggered_value || sourceValue,
          trigger.trigger_condition
        );

        totalEvaluated++;

        if (conditionMet) {
          // Execute trigger
          const execResult = await base44.functions.invoke('crossSystemTriggerEngine', {
            action: 'evaluate_trigger',
            trigger_id: trigger.id,
            metric_data: {
              current_value: sourceValue,
              baseline_value: trigger.last_triggered_value || sourceValue
            },
            user_email: user.email
          });

          totalTriggered++;

          monitorResults.push({
            trigger_id: trigger.id,
            trigger_name: trigger.trigger_name,
            status: 'executed',
            metric_value: sourceValue,
            result: execResult
          });
        } else {
          monitorResults.push({
            trigger_id: trigger.id,
            trigger_name: trigger.trigger_name,
            status: 'condition_not_met',
            metric_value: sourceValue
          });
        }
      } catch (err) {
        totalFailed++;
        monitorResults.push({
          trigger_id: trigger.id,
          trigger_name: trigger.trigger_name,
          status: 'error',
          error: err.message
        });
      }
    }

    // Log summary
    await adminBase44.entities.ActivityLog.create({
      action_type: 'system',
      message: 'Platform trigger monitor cycle complete',
      metadata: {
        triggers_evaluated: totalEvaluated,
        triggers_executed: totalTriggered,
        failures: totalFailed,
        cycle_timestamp: new Date().toISOString()
      },
      severity: totalFailed > 0 ? 'warning' : 'info'
    });

    return Response.json({
      status: 'success',
      cycle_timestamp: new Date().toISOString(),
      triggers_evaluated: totalEvaluated,
      triggers_executed: totalTriggered,
      failures: totalFailed,
      details: monitorResults
    });
  } catch (error) {
    console.error('Platform trigger monitor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get metric from source system
 */
async function getSourceMetric(base44, system, entity, metric) {
  try {
    const records = await base44.entities[entity].filter({}, `-${metric}`, 1);
    return records.length > 0 ? (records[0][metric] || 0) : 0;
  } catch (err) {
    console.error(`Failed to fetch metric from ${entity}:`, err.message);
    return 0;
  }
}

/**
 * Evaluate trigger condition
 */
function evaluateCondition(currentValue, baselineValue, triggerCondition) {
  const { operator, threshold, percentage_change } = triggerCondition;

  if (threshold !== undefined) {
    switch (operator) {
      case '>': return currentValue > threshold;
      case '>=': return currentValue >= threshold;
      case '<': return currentValue < threshold;
      case '<=': return currentValue <= threshold;
      case '==': return currentValue === threshold;
      case '!=': return currentValue !== threshold;
    }
  }

  if (percentage_change && baselineValue) {
    const pctChange = ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100;
    return Math.abs(pctChange) >= percentage_change;
  }

  return false;
}