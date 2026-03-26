/**
 * AI Command Console
 * Parses natural language instructions and routes to autonomous agents
 * Supports NED (crypto), Autopilot (execution), VIPZ (marketing)
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { action, instruction, agent_target } = await req.json();

    // ACTION: Parse natural language and route to agents
    if (action === 'execute_command') {
      const instructionLower = instruction.toLowerCase();

      // Extract intent and parameters
      const intent = parseIntent(instructionLower);
      const targetAgent = agent_target || intent.recommended_agent;

      // Build response with action plan
      const commandPlan = await buildCommandPlan(
        instruction,
        intent,
        targetAgent,
        user.email,
        base44
      );

      return Response.json({
        status: 'success',
        instruction: instruction,
        intent: intent.type,
        target_agent: targetAgent,
        action_plan: commandPlan.actions,
        estimated_impact: commandPlan.impact,
        confirmation_required: commandPlan.needs_confirmation,
        execution_ready: true
      });
    }

    // ACTION: Execute confirmed command
    if (action === 'execute_confirmed') {
      const { command_intent, target_agent, action_plan } = await req.json();

      const results = [];

      for (const actionItem of action_plan) {
        try {
          const result = await executeAction(
            actionItem,
            target_agent,
            user.email,
            base44
          );
          results.push({
            action: actionItem.action,
            status: 'success',
            result: result
          });
        } catch (err) {
          results.push({
            action: actionItem.action,
            status: 'failed',
            error: err.message
          });
        }
      }

      // Log command execution
      await base44.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `Executed command: "${command_intent}" via ${target_agent}`,
        metadata: {
          target_agent,
          action_count: action_plan.length,
          success_count: results.filter(r => r.status === 'success').length,
          timestamp: new Date().toISOString()
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        execution_results: results,
        total_actions: action_plan.length,
        successful_actions: results.filter(r => r.status === 'success').length
      });
    }

    // ACTION: Get agent status
    if (action === 'get_agent_status') {
      const agents = {
        ned: null,
        autopilot: null,
        vipz: null
      };

      // Check NED — Unified crypto + blockchain agent
      const nedIdentities = await base44.entities.AIIdentity.filter(
        { created_by: user.email, role_label: 'NED' },
        '-last_used_at',
        1
      );
      if (nedIdentities.length > 0) {
        agents.ned = {
          name: 'NED',
          status: nedIdentities[0].is_active ? 'active' : 'inactive',
          last_active: nedIdentities[0].last_used_at,
          capabilities: ['execute_trades', 'stake_tokens', 'claim_airdrops', 'deploy_mining', 'crypto_arbitrage', 'blockchain_execution']
        };
      }

      // Check Autopilot (Execution)
      const autopilotConfig = await base44.entities.UserGoals.filter(
        { created_by: user.email },
        '-created_date',
        1
      );
      if (autopilotConfig.length > 0) {
        agents.autopilot = {
          name: 'Autopilot',
          status: autopilotConfig[0].autopilot_enabled ? 'active' : 'inactive',
          daily_target: autopilotConfig[0].autopilot_enabled ? autopilotConfig[0].ai_daily_target : 0,
          wallet_balance: autopilotConfig[0].wallet_balance || 0,
          capabilities: ['auto_apply', 'scan_opportunities', 'execute_tasks', 'manage_identities']
        };
      }

      // Check VIPZ — Unified digital commerce + marketing agent
      const resellConfig = await base44.entities.ResellAutopilotConfig.filter(
        { created_by: user.email },
        '-created_date',
        1
      );
      if (resellConfig.length > 0) {
        agents.vipz = {
          name: 'VIPZ',
          status: resellConfig[0].autopilot_enabled ? 'active' : 'inactive',
          target_revenue: resellConfig[0].target_monthly_revenue,
          capabilities: ['generate_pages', 'send_emails', 'scale_campaigns', 'track_revenue', 'digital_reselling', 'landing_pages']
        };
      }

      // Linked accounts summary
      const accounts = await base44.entities.LinkedAccount.filter(
        { created_by: user.email },
        '-performance_score',
        50
      ).catch(() => []);
      agents.accounts = {
        name: 'Accounts',
        status: accounts.filter(a => a.health_status === 'healthy').length > 0 ? 'active' : 'inactive',
        healthy_count: accounts.filter(a => a.health_status === 'healthy').length,
        total_count: accounts.length,
        capabilities: ['auto_apply', 'account_health', 'platform_routing', 'credential_management']
      };

      return Response.json({
        status: 'success',
        agents: agents,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('AI Command Console error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Parse instruction to extract intent and recommended agent
 */
function parseIntent(instruction) {
  const keywords = {
    // NED (Crypto) keywords — unified NED agent
    crypto: ['crypto', 'stake', 'staking', 'airdrop', 'yield', 'mining', 'ethereum', 'bitcoin', 'token', 'defi', 'blockchain', 'nft', 'wallet', 'arbitrage'],
    // Autopilot (Execution) keywords
    execution: ['execute', 'apply', 'submit', 'complete', 'task', 'opportunity', 'scan', 'automate', 'queue'],
    // VIPZ (Commerce + Marketing) keywords — unified VIPZ agent
    commerce: ['marketing', 'storefront', 'page', 'email', 'campaign', 'commerce', 'sales', 'convert', 'resell', 'product', 'landing', 'digital', 'shop'],
    // General multi-agent keywords
    general: ['scale', 'adjust', 'optimize', 'increase', 'decrease', 'manage', 'orchestrate', 'all', 'platform']
  };

  let recommendedAgent = 'autopilot'; // default
  let type = 'general';

  for (const [domain, words] of Object.entries(keywords)) {
    for (const word of words) {
      if (instruction.includes(word)) {
        if (domain === 'crypto') { recommendedAgent = 'ned'; type = 'crypto'; }
        if (domain === 'execution') { recommendedAgent = 'autopilot'; type = 'execution'; }
        if (domain === 'commerce') { recommendedAgent = 'vipz'; type = 'commerce'; }
        break;
      }
    }
    if (type !== 'general') break;
  }

  return {
    type,
    recommended_agent: recommendedAgent,
    confidence: 0.85
  };
}

/**
 * Build action plan based on intent
 */
async function buildCommandPlan(instruction, intent, agent, userEmail, base44) {
  const actions = [];
  const instLower = instruction.toLowerCase();

  if (agent === 'ned') {
    if (instLower.includes('stake') || instLower.includes('staking')) {
      actions.push({
        action: 'analyze_staking_opportunities',
        parameters: { instruction }
      });
      actions.push({
        action: 'adjust_staking_positions',
        parameters: { auto_rebalance: true }
      });
    }
    if (instLower.includes('airdrop')) {
      actions.push({
        action: 'scan_airdrops',
        parameters: {}
      });
      actions.push({
        action: 'claim_eligible_airdrops',
        parameters: { auto_claim: true }
      });
    }
    if (instLower.includes('exposure')) {
      actions.push({
        action: 'rebalance_crypto_portfolio',
        parameters: { instruction }
      });
    }
  }

  if (agent === 'autopilot') {
    if (instLower.includes('execute') || instLower.includes('complete')) {
      actions.push({
        action: 'scan_opportunities',
        parameters: { max_results: 20 }
      });
      actions.push({
        action: 'queue_high_value_tasks',
        parameters: { min_value: 500 }
      });
      actions.push({
        action: 'execute_task_batch',
        parameters: { parallel_execution: true }
      });
    }
    if (instLower.includes('scan')) {
      actions.push({
        action: 'scan_opportunities',
        parameters: { max_results: 20 }
      });
    }
  }

  if (agent === 'vipz') {
    if (instLower.includes('scale') || instLower.includes('marketing') || instLower.includes('resell')) {
      actions.push({
        action: 'analyze_storefront_performance',
        parameters: {}
      });
      actions.push({
        action: 'scale_marketing_spend',
        parameters: { instruction }
      });
      actions.push({
        action: 'optimize_landing_pages',
        parameters: { auto_optimize: true }
      });
    }
    if (instLower.includes('email')) {
      actions.push({
        action: 'generate_email_campaigns',
        parameters: { instruction }
      });
      actions.push({
        action: 'schedule_email_sequences',
        parameters: {}
      });
    }
    if (instLower.includes('product') || instLower.includes('digital') || instLower.includes('storefront')) {
      actions.push({
        action: 'discover_digital_resell_opportunities',
        parameters: { instruction }
      });
      actions.push({
        action: 'generate_product_landing_page',
        parameters: { auto_publish: true }
      });
    }
  }

  // Multi-agent orchestration
  if (instLower.includes('scale') && (instLower.includes('all') || instLower.includes('platform'))) {
    actions.push({
      agent: 'vipz',
      action: 'increase_marketing_spend',
      parameters: { percentage_increase: 20 }
    });
    actions.push({
      agent: 'ned',
      action: 'increase_staking',
      parameters: { percentage_increase: 15 }
    });
    actions.push({
      agent: 'autopilot',
      action: 'increase_execution_targets',
      parameters: { percentage_increase: 25 }
    });
  }

  const impact = {
    department: agent,
    expected_change: calculateExpectedImpact(actions),
    risk_level: calculateRiskLevel(actions),
    reversible: true
  };

  return {
    actions,
    impact,
    needs_confirmation: actions.length > 1 || impact.risk_level === 'high'
  };
}

/**
 * Execute individual action
 */
async function executeAction(actionItem, agent, userEmail, base44) {
  const { action, parameters } = actionItem;

  // Log the action being executed
  await base44.entities.ActivityLog.create({
    action_type: 'system',
    message: `Executing: ${action} via ${agent}`,
    metadata: { action, agent, parameters },
    severity: 'info'
  });

  // Return mock execution result
  return {
    action,
    executed_at: new Date().toISOString(),
    impact: `Executed ${action} with parameters: ${JSON.stringify(parameters)}`
  };
}

/**
 * Calculate expected impact from actions
 */
function calculateExpectedImpact(actions) {
  if (actions.length === 0) return 'minimal';
  if (actions.length <= 2) return 'moderate';
  return 'significant';
}

/**
 * Calculate risk level
 */
function calculateRiskLevel(actions) {
  const riskActions = actions.filter(a => 
    a.action?.includes('execute') || 
    a.action?.includes('scale') ||
    a.action?.includes('stake')
  );
  if (riskActions.length === 0) return 'low';
  if (riskActions.length <= 2) return 'medium';
  return 'high';
}