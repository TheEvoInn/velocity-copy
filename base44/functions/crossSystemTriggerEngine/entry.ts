/**
 * Cross-System Trigger Engine
 * Monitors cross-department metrics and orchestrates unified actions
 * Admin-only: operates at platform-wide level with service role
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, trigger_id, metric_data, user_email } = await req.json();

    const adminBase44 = base44.asServiceRole;

    // ACTION: Check trigger conditions and execute actions
    if (action === 'evaluate_trigger') {
      const trigger = await adminBase44.entities.CrossSystemTrigger.read(trigger_id);

      if (!trigger || !trigger.enabled) {
        return Response.json({ status: 'skipped', reason: 'trigger_disabled' });
      }

      // Check cooldown
      if (trigger.last_triggered_at) {
        const secondsSinceLast = (Date.now() - new Date(trigger.last_triggered_at).getTime()) / 1000;
        if (secondsSinceLast < trigger.cooldown_seconds) {
          return Response.json({ status: 'skipped', reason: 'cooldown_active' });
        }
      }

      const { operator, threshold, percentage_change } = trigger.trigger_condition;
      const currentValue = metric_data.current_value;
      const baselineValue = metric_data.baseline_value;

      let conditionMet = false;

      // Check numeric threshold
      if (threshold !== undefined) {
        switch (operator) {
          case '>': conditionMet = currentValue > threshold; break;
          case '>=': conditionMet = currentValue >= threshold; break;
          case '<': conditionMet = currentValue < threshold; break;
          case '<=': conditionMet = currentValue <= threshold; break;
          case '==': conditionMet = currentValue === threshold; break;
          case '!=': conditionMet = currentValue !== threshold; break;
        }
      }

      // Check percentage change
      if (percentage_change && baselineValue) {
        const pctChange = ((currentValue - baselineValue) / Math.abs(baselineValue)) * 100;
        conditionMet = Math.abs(pctChange) >= percentage_change;
      }

      if (!conditionMet) {
        return Response.json({ status: 'condition_not_met' });
      }

      // Execute target system actions
      const results = [];
      for (const target of trigger.target_systems) {
        if (!target.enabled) continue;

        let scaledParams = { ...target.parameters };

        // Apply scaling if configured
        if (trigger.scaling_config?.scale_proportional) {
          const scaleFactor = currentValue / threshold;
          if (trigger.scaling_config.scale_formula === 'linear') {
            scaledParams.allocation = Math.min(
              trigger.scaling_config.max_scale,
              trigger.scaling_config.base_value * scaleFactor
            );
          } else if (trigger.scaling_config.scale_formula === 'exponential') {
            scaledParams.allocation = Math.min(
              trigger.scaling_config.max_scale,
              trigger.scaling_config.base_value * Math.pow(scaleFactor, 1.5)
            );
          }
        }

        try {
          // Execute action in target system
          const actionResult = await executeTargetAction(
            adminBase44,
            target.system,
            target.action,
            scaledParams,
            user_email
          );

          results.push({
            system: target.system,
            action: target.action,
            status: 'success',
            result: actionResult
          });
        } catch (err) {
          results.push({
            system: target.system,
            action: target.action,
            status: 'failed',
            error: err.message
          });
        }
      }

      // Update trigger execution history
      const execution_event = {
        triggered_at: new Date().toISOString(),
        metric_value: currentValue,
        status: 'success',
        actions_executed: results.length
      };

      await adminBase44.entities.CrossSystemTrigger.update(trigger_id, {
        total_triggers: (trigger.total_triggers || 0) + 1,
        successful_triggers: (trigger.successful_triggers || 0) + 1,
        last_triggered_at: new Date().toISOString(),
        last_triggered_value: currentValue,
        execution_history: [
          execution_event,
          ...(trigger.execution_history || []).slice(0, 99)
        ]
      });

      // Trigger cascading rules
      if (trigger.cascade_rules?.length > 0) {
        for (const cascadeTriggerId of trigger.cascade_rules) {
          await adminBase44.functions.invoke('crossSystemTriggerEngine', {
            action: 'evaluate_trigger',
            trigger_id: cascadeTriggerId,
            metric_data: metric_data,
            user_email: user_email
          });
        }
      }

      return Response.json({
        status: 'success',
        trigger_id,
        condition_met: true,
        actions_executed: results,
        cascaded: trigger.cascade_rules?.length || 0
      });
    }

    // ACTION: Monitor all active triggers
    if (action === 'monitor_all_triggers') {
      const triggers = await adminBase44.entities.CrossSystemTrigger.filter(
        { enabled: true },
        '-priority'
      );

      const results = [];

      for (const trigger of triggers) {
        try {
          // Fetch current metric from source system
          const metricValue = await getSystemMetric(
            adminBase44,
            trigger.source_system,
            trigger.source_entity,
            trigger.source_metric
          );

          // Get baseline for percentage changes
          const baselineValue = trigger.last_triggered_value || metricValue;

          // Evaluate trigger
          const evalResult = await base44.functions.invoke('crossSystemTriggerEngine', {
            action: 'evaluate_trigger',
            trigger_id: trigger.id,
            metric_data: {
              current_value: metricValue,
              baseline_value: baselineValue
            },
            user_email: user_email
          });

          results.push({
            trigger_id: trigger.id,
            trigger_name: trigger.trigger_name,
            result: evalResult
          });
        } catch (err) {
          results.push({
            trigger_id: trigger.id,
            trigger_name: trigger.trigger_name,
            error: err.message
          });
        }
      }

      return Response.json({
        status: 'success',
        triggers_evaluated: results.length,
        results: results
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Cross-system trigger error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Execute action in target system
 */
async function executeTargetAction(base44, system, action, params, userEmail) {
  switch (system) {
    case 'CryptoAutomation':
      if (action === 'scale_staking') {
        return await base44.functions.invoke('nedCryptoOrchestrator', {
          action: 'scale_staking_positions',
          allocation: params.allocation,
          user_email: userEmail
        });
      } else if (action === 'increase_mining_power') {
        return await base44.functions.invoke('nedCryptoOrchestrator', {
          action: 'buy_mining_power',
          amount: params.allocation,
          user_email: userEmail
        });
      }
      break;

    case 'DigitalCommerce':
      if (action === 'increase_email_spend') {
        return await base44.functions.invoke('autopilotResellOrchestrator', {
          action: 'scale_email_marketing',
          daily_budget: params.allocation,
          user_email: userEmail
        });
      } else if (action === 'generate_more_pages') {
        return await base44.functions.invoke('autopilotResellOrchestrator', {
          action: 'scale_page_generation',
          target_count: params.target_count,
          user_email: userEmail
        });
      }
      break;

    case 'Finance':
      if (action === 'allocate_to_crypto') {
        return await base44.functions.invoke('financialTracker', {
          action: 'allocate_funds',
          amount: params.allocation,
          destination: 'crypto_operations',
          user_email: userEmail
        });
      } else if (action === 'rebalance_portfolio') {
        return await base44.functions.invoke('financialTracker', {
          action: 'rebalance',
          crypto_allocation: params.crypto_percentage,
          commerce_allocation: params.commerce_percentage,
          user_email: userEmail
        });
      }
      break;

    case 'Discovery':
      if (action === 'intensify_scanning') {
        return await base44.functions.invoke('scanOpportunities', {
          action: 'scan_with_intensity',
          intensity_level: params.intensity,
          user_email: userEmail
        });
      }
      break;
  }

  throw new Error(`Unknown action: ${action} for system: ${system}`);
}

/**
 * Get metric value from source system
 */
async function getSystemMetric(base44, system, entity, metric) {
  try {
    const records = await base44.entities[entity].filter({}, `-${metric}`, 1);
    if (records.length > 0) {
      return records[0][metric] || 0;
    }
    return 0;
  } catch (err) {
    console.error(`Failed to fetch ${metric} from ${entity}:`, err.message);
    return 0;
  }
}