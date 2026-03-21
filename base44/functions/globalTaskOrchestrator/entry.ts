import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Global Task Orchestrator
 * Monitors source entities for conditions and automatically triggers dependent tasks
 * Enables cross-department workflow automation
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { source_record_id, source_entity, action } = payload;

    // Get all active orchestration rules for this user
    const rules = await base44.entities.TaskOrchestrationRule.filter(
      {
        enabled: true,
        source_entity: source_entity,
        created_by: user.email
      },
      '-priority'
    );

    if (rules.length === 0) {
      return Response.json({
        success: true,
        message: 'No orchestration rules configured for this entity',
        rules_checked: 0,
        tasks_triggered: 0
      });
    }

    let tasksTriggered = 0;
    const executionLog = [];

    // Get the source record
    let sourceRecord;
    try {
      const entityClass = base44.entities[source_entity];
      if (!entityClass) {
        throw new Error(`Entity ${source_entity} not found`);
      }
      const records = await entityClass.filter({ id: source_record_id });
      sourceRecord = records[0];
    } catch (e) {
      return Response.json({
        error: `Failed to fetch source record: ${e.message}`,
        status: 'error'
      }, { status: 400 });
    }

    if (!sourceRecord) {
      return Response.json({
        error: `Source record ${source_record_id} not found`,
        status: 'error'
      }, { status: 404 });
    }

    // Evaluate each rule
    for (const rule of rules) {
      try {
        const conditionMet = evaluateCondition(
          sourceRecord[rule.condition_field],
          rule.condition_operator,
          rule.condition_value
        );

        if (conditionMet) {
          // Trigger dependent task
          const taskId = await triggerDependentTask(
            base44,
            rule,
            sourceRecord,
            user
          );

          tasksTriggered++;
          executionLog.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            condition_met: true,
            task_id: taskId,
            status: 'success',
            timestamp: new Date().toISOString()
          });

          // Update rule stats
          await base44.entities.TaskOrchestrationRule.update(rule.id, {
            total_triggers: (rule.total_triggers || 0) + 1,
            total_successful: (rule.total_successful || 0) + 1,
            last_triggered_at: new Date().toISOString(),
            execution_history: [
              ...(rule.execution_history || []),
              {
                triggered_at: new Date().toISOString(),
                source_record_id,
                condition_met: true,
                target_task_id: taskId,
                execution_status: 'success'
              }
            ]
          });

          // Check for cascading rules
          if (rule.cascading_rules && rule.cascading_rules.length > 0) {
            for (const cascadeRuleId of rule.cascading_rules) {
              await triggerCascadingRule(base44, cascadeRuleId, sourceRecord, user);
            }
          }
        } else {
          executionLog.push({
            rule_id: rule.id,
            rule_name: rule.rule_name,
            condition_met: false,
            status: 'skipped',
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        executionLog.push({
          rule_id: rule.id,
          rule_name: rule.rule_name,
          condition_met: false,
          status: 'error',
          error_message: error.message,
          timestamp: new Date().toISOString()
        });

        // Update rule status to error
        await base44.entities.TaskOrchestrationRule.update(rule.id, {
          status: 'error',
          notes: `Last error: ${error.message}`
        });
      }
    }

    // Log orchestration event
    await base44.asServiceRole.entities.EngineAuditLog.create({
      event_type: 'global_task_orchestration',
      module: 'globalTaskOrchestrator',
      status: tasksTriggered > 0 ? 'success' : 'no_action',
      details: {
        source_entity,
        source_record_id,
        rules_evaluated: rules.length,
        tasks_triggered: tasksTriggered,
        execution_log: executionLog
      },
      actor: user.email,
      user_id: user.id
    });

    return Response.json({
      success: true,
      rules_evaluated: rules.length,
      tasks_triggered: tasksTriggered,
      execution_log: executionLog
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Evaluate if condition is met
 */
function evaluateCondition(fieldValue, operator, threshold) {
  if (fieldValue === null || fieldValue === undefined) return false;

  const val = Number(fieldValue);
  const thresh = Number(threshold);

  switch (operator) {
    case '>': return val > thresh;
    case '>=': return val >= thresh;
    case '<': return val < thresh;
    case '<=': return val <= thresh;
    case '==': return val === thresh;
    case '!=': return val !== thresh;
    default: return false;
  }
}

/**
 * Trigger a dependent task based on rule config
 */
async function triggerDependentTask(base44, rule, sourceRecord, user) {
  const config = rule.target_task_config || {};

  // Create task execution record based on target type
  if (rule.target_task_type === 'crypto_arbitrage') {
    return await createCryptoArbitrageTask(base44, rule, sourceRecord, config, user);
  } else if (rule.target_task_type === 'stake_profits') {
    return await createStakingTask(base44, rule, sourceRecord, config, user);
  } else if (rule.target_task_type === 'claim_airdrop') {
    return await createAirdropTask(base44, rule, sourceRecord, config, user);
  } else if (rule.target_task_type === 'buy_mining_power') {
    return await createMiningTask(base44, rule, sourceRecord, config, user);
  } else {
    throw new Error(`Unknown target task type: ${rule.target_task_type}`);
  }
}

/**
 * Create crypto arbitrage task
 */
async function createCryptoArbitrageTask(base44, rule, sourceRecord, config, user) {
  const allocation = config.max_allocation || 500;

  const opportunity = await base44.entities.CryptoOpportunity.create({
    opportunity_type: 'arbitrage',
    title: `Auto Arbitrage (${rule.rule_name})`,
    platform: 'automated',
    estimated_value_usd: allocation * 0.1, // 10% profit expectation
    profit_potential: 10,
    automation_config: {
      auto_execute: true,
      requires_approval: false,
      retry_on_failure: true
    },
    source: 'global_orchestrator',
    priority_score: rule.priority
  });

  // Create execution task
  const task = await base44.entities.TaskExecutionQueue.create({
    opportunity_id: opportunity.id,
    opportunity_type: 'arbitrage',
    platform: 'automated',
    status: config.execution_mode === 'immediate' ? 'queued' : 'pending',
    identity_id: 'auto_selected',
    estimated_value: allocation * 0.1,
    execution_log: [{
      step: 'initialization',
      details: `Triggered by ${rule.rule_name} rule. Source: ${sourceRecord.id}`,
      timestamp: new Date().toISOString(),
      status: 'completed'
    }]
  });

  return task.id;
}

/**
 * Create staking task
 */
async function createStakingTask(base44, rule, sourceRecord, config, user) {
  const stakingConfig = config.parameters || {};

  const position = await base44.entities.StakingPosition.create({
    token_symbol: stakingConfig.token_symbol || 'ETH',
    platform: stakingConfig.platform || 'lido',
    amount_staked: config.max_allocation || 1000,
    apy_percentage: stakingConfig.apy || 4.5,
    status: 'pending_activation',
    started_at: new Date().toISOString(),
    compounding_enabled: true,
    automation_config: {
      monitor_enabled: true,
      auto_claim_rewards: true
    }
  });

  return position.id;
}

/**
 * Create airdrop task
 */
async function createAirdropTask(base44, rule, sourceRecord, config, user) {
  const opportunity = await base44.entities.CryptoOpportunity.create({
    opportunity_type: 'airdrop',
    title: `Auto Airdrop Claim (${rule.rule_name})`,
    platform: 'automated',
    estimated_value_usd: config.max_allocation || 500,
    profit_potential: 100,
    automation_config: {
      auto_execute: true,
      requires_approval: false
    },
    source: 'global_orchestrator'
  });

  return opportunity.id;
}

/**
 * Create mining task
 */
async function createMiningTask(base44, rule, sourceRecord, config, user) {
  const miningConfig = config.parameters || {};

  const operation = await base44.entities.MiningOperation.create({
    mining_type: 'pool_mining',
    platform: miningConfig.platform || 'mining_pool',
    coin_symbol: miningConfig.coin || 'BTC',
    daily_revenue_usd: miningConfig.daily_revenue || 100,
    status: 'pending_activation',
    payout_address: miningConfig.payout_address || 'auto',
    auto_payout_enabled: true,
    started_at: new Date().toISOString()
  });

  return operation.id;
}

/**
 * Trigger cascading rules
 */
async function triggerCascadingRule(base44, ruleId, sourceRecord, user) {
  try {
    const cascadeRules = await base44.entities.TaskOrchestrationRule.filter({
      id: ruleId,
      created_by: user.email
    });

    if (cascadeRules.length === 0) return;

    const rule = cascadeRules[0];

    // Evaluate and execute
    if (rule.enabled && rule.target_task_type) {
      const config = rule.target_task_config || {};
      await triggerDependentTask(base44, rule, sourceRecord, user);
    }
  } catch (e) {
    console.error('Cascading rule error:', e.message);
  }
}