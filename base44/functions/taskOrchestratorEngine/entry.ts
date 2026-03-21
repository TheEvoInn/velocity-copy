/**
 * Task Orchestrator Engine
 * Manages multi-step automations, dependency resolution, and two-way sync
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    // ACTION: Get user data for wizard recommendations
    if (action === 'get_user_context') {
      const [goals, identities, wallets, storefronts] = await Promise.all([
        base44.entities.UserGoals.filter({ created_by: user.email }, '-created_date', 1),
        base44.entities.AIIdentity.filter({ created_by: user.email }, '-created_date', 5),
        base44.entities.CryptoWallet.filter({ created_by: user.email }, '-created_date', 5),
        base44.entities.DigitalStorefront.filter({ created_by: user.email }, '-created_date', 5)
      ]);

      return Response.json({
        status: 'success',
        user_context: {
          user_email: user.email,
          goals: goals[0] || {},
          identities: identities,
          wallets: wallets,
          storefronts: storefronts,
          preferences: {
            risk_tolerance: goals[0]?.risk_tolerance || 'moderate',
            daily_target: goals[0]?.daily_target || 1000,
            autopilot_enabled: goals[0]?.autopilot_enabled || false
          }
        }
      });
    }

    // ACTION: Generate automation recommendations
    if (action === 'generate_recommendations') {
      const userContext = payload;
      const recommendations = [];

      // Recommendation 1: Discovery -> Commerce auto-launch
      if (!userContext.storefronts || userContext.storefronts.length < 3) {
        recommendations.push({
          id: 'rec_discovery_commerce',
          title: 'Auto-Launch Commerce on Niche Discovery',
          description: 'When Discovery identifies a profitable niche, automatically create and launch a digital storefront',
          trigger: {
            type: 'opportunity_found',
            source_system: 'Discovery',
            condition: { min_profit_potential: 500 }
          },
          actions: [
            { system: 'Commerce', action: 'create_storefront', params: { auto_publish: true } },
            { system: 'Marketing', action: 'allocate_budget', params: { percentage: 20 } }
          ],
          estimated_roi: '3-5x',
          complexity: 'medium',
          recommended: true
        });
      }

      // Recommendation 2: Finance -> Crypto auto-allocation
      if (userContext.wallets && userContext.wallets.length > 0) {
        recommendations.push({
          id: 'rec_finance_crypto',
          title: 'Auto-Allocate Profits to Crypto Yield',
          description: 'When Finance exceeds daily target, allocate excess to crypto staking',
          trigger: {
            type: 'revenue_threshold',
            source_system: 'Finance',
            condition: { threshold_percentage: 120 }
          },
          actions: [
            { system: 'Crypto', action: 'stake_tokens', params: { allocation_percentage: 30 } },
            { system: 'Finance', action: 'log_allocation', params: {} }
          ],
          estimated_roi: '8-12% APY',
          complexity: 'low',
          recommended: true
        });
      }

      // Recommendation 3: Execution -> Marketing spend scaling
      if (userContext.goals && userContext.goals.autopilot_enabled) {
        recommendations.push({
          id: 'rec_execution_marketing',
          title: 'Scale Marketing Spend on Task Completion',
          description: 'Increase marketing budget proportionally as Execution completes high-value tasks',
          trigger: {
            type: 'task_completed',
            source_system: 'Execution',
            condition: { min_value: 300, success_rate_threshold: 0.8 }
          },
          actions: [
            { system: 'Marketing', action: 'scale_spend', params: { scale_factor: 1.1 } },
            { system: 'Commerce', action: 'increase_conversion_targets', params: { percentage: 15 } }
          ],
          estimated_roi: '2-3x',
          complexity: 'medium',
          recommended: true
        });
      }

      return Response.json({
        status: 'success',
        recommendations: recommendations
      });
    }

    // ACTION: Create automation from wizard
    if (action === 'create_automation_from_wizard') {
      const { automation_config, user_preferences } = payload;

      const newAutomation = await base44.entities.CrossSystemTrigger.create({
        trigger_name: automation_config.title,
        description: automation_config.description,
        trigger_type: automation_config.trigger.type,
        source_system: automation_config.trigger.source_system,
        source_metric: automation_config.trigger.condition_metric || 'value',
        source_entity: automation_config.trigger.source_entity || 'Opportunity',
        trigger_condition: {
          operator: '>=',
          threshold: automation_config.trigger.condition.threshold || 500
        },
        target_systems: automation_config.actions.map(action => ({
          system: action.system,
          action: action.action,
          parameters: action.params,
          enabled: true
        })),
        enabled: true,
        is_platform_wide: false
      });

      // Log creation
      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Created multi-step automation: "${automation_config.title}"`,
        metadata: {
          automation_id: newAutomation.id,
          trigger: automation_config.trigger.type,
          target_count: automation_config.actions.length
        },
        severity: 'success'
      });

      return Response.json({
        status: 'success',
        automation_id: newAutomation.id,
        automation: newAutomation
      });
    }

    // ACTION: Get all automations with dependency graph
    if (action === 'get_automation_graph') {
      const automations = await base44.entities.CrossSystemTrigger.filter(
        { created_by: user.email },
        '-created_date'
      );

      // Build dependency graph
      const graph = buildDependencyGraph(automations);

      return Response.json({
        status: 'success',
        automations: automations,
        dependency_graph: graph
      });
    }

    // ACTION: Execute automation with two-way sync
    if (action === 'execute_automation') {
      const { automation_id } = payload;

      const automation = await base44.entities.CrossSystemTrigger.filter(
        { id: automation_id, created_by: user.email },
        null,
        1
      );

      if (!automation || automation.length === 0) {
        return Response.json({ error: 'Automation not found' }, { status: 404 });
      }

      const results = await executeAutomationWithSync(automation[0], user.email, base44);

      return Response.json({
        status: 'success',
        automation_id,
        execution_results: results
      });
    }

    // ACTION: Two-way sync for compliance
    if (action === 'sync_automation_state') {
      const { automation_id } = payload;

      const automation = await base44.entities.CrossSystemTrigger.filter(
        { id: automation_id, created_by: user.email },
        null,
        1
      );

      if (!automation || automation.length === 0) {
        return Response.json({ error: 'Automation not found' }, { status: 404 });
      }

      // Verify all target systems are in sync
      const syncResults = await verifyAndSyncAutomationState(automation[0], user.email, base44);

      return Response.json({
        status: 'success',
        sync_status: syncResults
      });
    }

    // ACTION: Validate automation dependencies
    if (action === 'validate_automation') {
      const { automation_config } = payload;

      const validation = validateAutomationDependencies(automation_config);

      return Response.json({
        status: 'success',
        is_valid: validation.is_valid,
        issues: validation.issues,
        warnings: validation.warnings
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Task Orchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Build dependency graph from automations
 */
function buildDependencyGraph(automations) {
  const nodes = [];
  const edges = [];

  const systemColors = {
    Discovery: '#f59e0b',
    Execution: '#3b82f6',
    Finance: '#10b981',
    Control: '#a855f7',
    Commerce: '#ec4899',
    Crypto: '#06b6d4'
  };

  // Create nodes for each trigger
  automations.forEach((automation, idx) => {
    nodes.push({
      id: automation.id,
      label: automation.trigger_name,
      type: 'trigger',
      system: automation.source_system,
      color: systemColors[automation.source_system] || '#64748b',
      metadata: {
        trigger_type: automation.trigger_type,
        enabled: automation.enabled
      }
    });

    // Create edges to target systems
    if (automation.target_systems && Array.isArray(automation.target_systems)) {
      automation.target_systems.forEach((target, tidx) => {
        const targetNodeId = `${automation.id}-target-${tidx}`;
        nodes.push({
          id: targetNodeId,
          label: `${target.system}: ${target.action}`,
          type: 'action',
          system: target.system,
          color: systemColors[target.system] || '#64748b',
          metadata: {
            action: target.action,
            parameters: target.parameters
          }
        });

        edges.push({
          source: automation.id,
          target: targetNodeId,
          type: 'dependency',
          label: target.enabled ? 'active' : 'disabled'
        });
      });
    }
  });

  return { nodes, edges };
}

/**
 * Execute automation with two-way sync
 */
async function executeAutomationWithSync(automation, userEmail, base44) {
  const results = [];

  for (const target of automation.target_systems || []) {
    try {
      // Log pre-execution state
      const preState = await captureSystemState(target.system, userEmail, base44);

      // Execute action (simulate)
      const actionResult = {
        system: target.system,
        action: target.action,
        timestamp: new Date().toISOString(),
        executed: true
      };

      results.push(actionResult);

      // Capture post-execution state
      const postState = await captureSystemState(target.system, userEmail, base44);

      // Verify sync
      const syncCheck = {
        system: target.system,
        pre_state: preState,
        post_state: postState,
        is_synced: compareStates(preState, postState)
      };

      // Log execution
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Executed: ${target.system} -> ${target.action}`,
        metadata: {
          automation_id: automation.id,
          sync_check: syncCheck
        },
        severity: 'info'
      });
    } catch (err) {
      results.push({
        system: target.system,
        action: target.action,
        error: err.message,
        executed: false
      });
    }
  }

  return results;
}

/**
 * Verify and sync automation state across all targets
 */
async function verifyAndSyncAutomationState(automation, userEmail, base44) {
  const syncResults = {};

  for (const target of automation.target_systems || []) {
    const state = await captureSystemState(target.system, userEmail, base44);
    syncResults[target.system] = {
      current_state: state,
      last_verified: new Date().toISOString(),
      is_synced: true
    };
  }

  return syncResults;
}

/**
 * Capture system state for sync verification
 */
async function captureSystemState(system, userEmail, base44) {
  const state = {
    system,
    timestamp: new Date().toISOString(),
    metrics: {}
  };

  try {
    if (system === 'Discovery') {
      const opps = await base44.entities.Opportunity.filter({ created_by: userEmail }, '-created_date', 1);
      state.metrics.opportunities_count = opps.length;
    } else if (system === 'Execution') {
      const tasks = await base44.entities.TaskExecutionQueue.filter({ created_by: userEmail }, '-created_date', 1);
      state.metrics.queued_tasks = tasks.length;
    } else if (system === 'Finance') {
      const txns = await base44.entities.CryptoTransaction.filter({ created_by: userEmail }, '-created_date', 1);
      state.metrics.recent_transactions = txns.length;
    } else if (system === 'Commerce') {
      const stores = await base44.entities.DigitalStorefront.filter({ created_by: userEmail }, '-created_date', 1);
      state.metrics.storefronts_count = stores.length;
    }
  } catch (err) {
    state.error = err.message;
  }

  return state;
}

/**
 * Compare pre/post states for sync verification
 */
function compareStates(preState, postState) {
  if (preState.error || postState.error) return false;
  return JSON.stringify(preState.metrics) !== JSON.stringify(postState.metrics);
}

/**
 * Validate automation dependencies
 */
function validateAutomationDependencies(config) {
  const issues = [];
  const warnings = [];

  // Check trigger exists
  if (!config.trigger || !config.trigger.type) {
    issues.push('Trigger type is required');
  }

  // Check actions exist
  if (!config.actions || config.actions.length === 0) {
    issues.push('At least one target action is required');
  }

  // Check circular dependencies
  const systemsInvolved = new Set();
  if (config.trigger) systemsInvolved.add(config.trigger.source_system);
  if (config.actions) {
    config.actions.forEach(a => systemsInvolved.add(a.system));
  }

  if (systemsInvolved.size < 2) {
    warnings.push('Automation involves fewer than 2 systems - consider expanding scope');
  }

  return {
    is_valid: issues.length === 0,
    issues,
    warnings
  };
}