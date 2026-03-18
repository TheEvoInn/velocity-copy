import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Comprehensive System Audit
 * Identifies missing functions, broken pipelines, static data, disconnected modules
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'full_audit') {
      return await performFullAudit(base44, user);
    }

    if (action === 'audit_backend_functions') {
      return await auditBackendFunctions(base44, user);
    }

    if (action === 'audit_data_pipelines') {
      return await auditDataPipelines(base44, user);
    }

    if (action === 'audit_wallet_deposits') {
      return await auditWalletDeposits(base44, user);
    }

    if (action === 'audit_placeholder_data') {
      return await auditPlaceholderData(base44, user);
    }

    if (action === 'audit_module_connections') {
      return await auditModuleConnections(base44, user);
    }

    if (action === 'generate_repair_plan') {
      return await generateRepairPlan(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('System Audit Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Perform complete system audit
 */
async function performFullAudit(base44, user) {
  const results = {
    timestamp: new Date().toISOString(),
    backend_functions: await auditBackendFunctions(base44, user),
    data_pipelines: await auditDataPipelines(base44, user),
    wallet_deposits: await auditWalletDeposits(base44, user),
    placeholder_data: await auditPlaceholderData(base44, user),
    module_connections: await auditModuleConnections(base44, user),
    overall_health: 'CRITICAL'
  };

  // Calculate overall health
  const issues = [
    results.backend_functions.critical_issues.length,
    results.data_pipelines.critical_issues.length,
    results.wallet_deposits.critical_issues.length,
    results.placeholder_data.instances.length,
    results.module_connections.disconnected.length
  ].reduce((a, b) => a + b, 0);

  if (issues === 0) {
    results.overall_health = 'HEALTHY';
  } else if (issues < 5) {
    results.overall_health = 'DEGRADED';
  } else {
    results.overall_health = 'CRITICAL';
  }

  return Response.json(results);
}

/**
 * Audit backend functions
 */
async function auditBackendFunctions(base44, user) {
  const requiredFunctions = [
    // Account Creation
    { name: 'accountCreationEngine', category: 'Account Creation', critical: true },
    { name: 'identityManager', category: 'Identity', critical: true },
    
    // Agent Worker
    { name: 'agentWorker', category: 'Execution', critical: true },
    { name: 'taskReviewEngine', category: 'Execution', critical: true },
    
    // Autopilot
    { name: 'unifiedAutopilot', category: 'Orchestration', critical: true },
    { name: 'autopilotScheduler', category: 'Orchestration', critical: true },
    
    // Wallet & Earnings
    { name: 'walletManager', category: 'Wallet', critical: true },
    { name: 'depositProcessor', category: 'Wallet', critical: true },
    { name: 'transactionLogger', category: 'Wallet', critical: true },
    
    // Opportunities
    { name: 'opportunityIngestion', category: 'Opportunities', critical: true },
    { name: 'opportunityScorer', category: 'Opportunities', critical: true },
    
    // Proposals & Negotiation
    { name: 'proposalEngine', category: 'Proposal', critical: true },
    { name: 'negotiationEngine', category: 'Proposal', critical: true },
    
    // Prize Module
    { name: 'prizeEngine', category: 'Prizes', critical: true },
    { name: 'prizeClaimExecutor', category: 'Prizes', critical: true },
    
    // Credentials
    { name: 'secretManager', category: 'Security', critical: true },
    { name: 'credentialInterceptor', category: 'Security', critical: true },
    { name: 'moduleCredentialAdapter', category: 'Security', critical: true },
  ];

  const missing = [];
  const broken = [];
  const working = [];

  for (const func of requiredFunctions) {
    try {
      // Try to invoke each function with test payload
      const result = await base44.functions.invoke(func.name, {
        action: 'health_check',
        payload: {}
      }).catch(e => ({ error: e.message }));

      if (result.error || !result.data) {
        broken.push({
          name: func.name,
          category: func.category,
          error: result.error || 'No response'
        });
      } else {
        working.push(func.name);
      }
    } catch (error) {
      missing.push({
        name: func.name,
        category: func.category,
        critical: func.critical
      });
    }
  }

  return Response.json({
    total: requiredFunctions.length,
    working: working.length,
    broken: broken.length,
    missing: missing.length,
    critical_issues: [...missing.filter(m => m.critical), ...broken],
    missing_functions: missing,
    broken_functions: broken,
    working_functions: working
  });
}

/**
 * Audit data pipelines
 */
async function auditDataPipelines(base44, user) {
  const pipelines = [
    { name: 'opportunity_ingestion', source: 'Job Scrapers', destination: 'Opportunity Entity', critical: true },
    { name: 'wallet_deposits', source: 'Platform Payouts', destination: 'Transaction Entity', critical: true },
    { name: 'identity_sync', source: 'Identity Manager', destination: 'AIIdentity Entity', critical: true },
    { name: 'account_creation', source: 'Account Engine', destination: 'LinkedAccount Entity', critical: true },
    { name: 'task_execution', source: 'Agent Worker', destination: 'TaskExecutionQueue Entity', critical: true },
    { name: 'prize_claiming', source: 'Prize Module', destination: 'PrizeOpportunity Entity', critical: true },
    { name: 'proposal_generation', source: 'Proposal Engine', destination: 'AIWorkLog Entity', critical: true },
  ];

  const issues = [];

  // Check if each pipeline's destination entity exists and has data
  for (const pipeline of pipelines) {
    try {
      const entityName = pipeline.destination.replace(' Entity', '');
      const data = await base44.entities[entityName]?.list('-created_date', 1);
      
      if (!data || data.length === 0) {
        issues.push({
          pipeline: pipeline.name,
          issue: 'No data flowing',
          source: pipeline.source,
          destination: pipeline.destination,
          critical: pipeline.critical
        });
      }
    } catch (error) {
      issues.push({
        pipeline: pipeline.name,
        issue: 'Entity unreachable',
        error: error.message,
        critical: pipeline.critical
      });
    }
  }

  return Response.json({
    total_pipelines: pipelines.length,
    healthy_pipelines: pipelines.length - issues.length,
    critical_issues: issues.filter(i => i.critical),
    all_issues: issues
  });
}

/**
 * Audit wallet deposits
 */
async function auditWalletDeposits(base44, user) {
  const issues = [];

  try {
    const userGoals = await base44.entities.UserGoals.filter({ created_by: user.email }, null, 1);
    
    if (!userGoals || userGoals.length === 0) {
      issues.push({
        issue: 'No UserGoals record found',
        severity: 'critical',
        action: 'Create UserGoals entry'
      });
    }

    const transactions = await base44.entities.Transaction.filter({}, '-created_date', 10);
    
    if (!transactions || transactions.length === 0) {
      issues.push({
        issue: 'No transaction history',
        severity: 'warning',
        action: 'Wallet has never received deposits'
      });
    }

    const withdrawals = await base44.entities.EngineAuditLog.filter(
      { action_type: 'withdrawal_triggered' },
      '-created_date',
      5
    );

    if (withdrawals && withdrawals.length === 0) {
      issues.push({
        issue: 'No withdrawal mechanism active',
        severity: 'warning',
        action: 'Enable WithdrawalPolicy'
      });
    }
  } catch (error) {
    issues.push({
      issue: 'Wallet system unreachable',
      severity: 'critical',
      error: error.message
    });
  }

  return Response.json({
    wallet_health: issues.length === 0 ? 'HEALTHY' : 'DEGRADED',
    critical_issues: issues.filter(i => i.severity === 'critical'),
    all_issues: issues
  });
}

/**
 * Audit placeholder and static data
 */
async function auditPlaceholderData(base44, user) {
  const instances = [];

  // Check for zero/placeholder values in key entities
  try {
    const userGoals = await base44.entities.UserGoals.filter({}, null, 100);
    
    userGoals?.forEach(goal => {
      if (goal.total_earned === 0 && goal.daily_target === 1000) {
        instances.push({
          entity: 'UserGoals',
          id: goal.id,
          issue: 'Placeholder daily_target: $1000',
          type: 'static_value'
        });
      }
      if (goal.wallet_balance === 0 && goal.ai_total_earned === 0) {
        instances.push({
          entity: 'UserGoals',
          id: goal.id,
          issue: 'Zero wallet balance and zero earnings (placeholder)',
          type: 'placeholder'
        });
      }
    });

    const opportunities = await base44.entities.Opportunity.filter({}, null, 100);
    
    opportunities?.forEach(opp => {
      if (opp.profit_estimate_low === 0 && opp.profit_estimate_high === 0) {
        instances.push({
          entity: 'Opportunity',
          id: opp.id,
          issue: 'No profit estimates (placeholder)',
          type: 'incomplete'
        });
      }
      if (!opp.url || opp.url === '') {
        instances.push({
          entity: 'Opportunity',
          id: opp.id,
          issue: 'Missing URL for execution',
          type: 'broken'
        });
      }
    });

    const tasks = await base44.entities.TaskExecutionQueue.filter({}, null, 100);
    
    tasks?.forEach(task => {
      if (task.status === 'queued' && new Date(task.queue_timestamp) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
        instances.push({
          entity: 'TaskExecutionQueue',
          id: task.id,
          issue: 'Stale queued task (>7 days)',
          type: 'stale'
        });
      }
    });
  } catch (error) {
    instances.push({
      issue: 'Could not scan entities',
      error: error.message
    });
  }

  return Response.json({
    total_instances: instances.length,
    by_type: instances.reduce((acc, inst) => {
      acc[inst.type] = (acc[inst.type] || 0) + 1;
      return acc;
    }, {}),
    instances
  });
}

/**
 * Audit module connections
 */
async function auditModuleConnections(base44, user) {
  const connections = {
    'Autopilot → Agent Worker': { status: 'unknown', issues: [] },
    'Agent Worker → Proposal Engine': { status: 'unknown', issues: [] },
    'Identity Manager → Account Creator': { status: 'unknown', issues: [] },
    'Opportunity Ingestion → Task Queue': { status: 'unknown', issues: [] },
    'Task Execution → Wallet': { status: 'unknown', issues: [] },
    'Prize Module → Wallet': { status: 'unknown', issues: [] },
    'Credentials → Module Adapter': { status: 'unknown', issues: [] }
  };

  // Test each connection by checking if data flows through
  try {
    // Check Autopilot → Agent Worker
    const aiTasks = await base44.entities.AITask.list('-created_date', 5);
    const taskQueues = await base44.entities.TaskExecutionQueue.list('-created_date', 5);
    
    if (aiTasks?.length > 0 && taskQueues?.length === 0) {
      connections['Autopilot → Agent Worker'].issues.push('AI Tasks created but no TaskExecutionQueue entries');
      connections['Autopilot → Agent Worker'].status = 'disconnected';
    }

    // Check Agent Worker → Proposal Engine
    const workLogs = await base44.entities.AIWorkLog.filter({ log_type: 'proposal_submitted' }, null, 5);
    if (taskQueues?.length > 0 && !workLogs?.length) {
      connections['Agent Worker → Proposal Engine'].issues.push('Tasks executed but no proposals generated');
      connections['Agent Worker → Proposal Engine'].status = 'disconnected';
    }

    // Check Task Execution → Wallet
    const completedTasks = await base44.entities.TaskExecutionQueue.filter({ status: 'completed' }, null, 5);
    const transactions = await base44.entities.Transaction.list('-created_date', 5);
    
    if (completedTasks?.length > 0 && transactions?.length === 0) {
      connections['Task Execution → Wallet'].issues.push('Tasks completed but no deposits recorded');
      connections['Task Execution → Wallet'].status = 'disconnected';
    }

    // Update status if no issues found
    Object.keys(connections).forEach(key => {
      if (connections[key].issues.length === 0) {
        connections[key].status = 'connected';
      }
    });
  } catch (error) {
    Object.keys(connections).forEach(key => {
      connections[key].issues.push(error.message);
      connections[key].status = 'error';
    });
  }

  const disconnected = Object.entries(connections)
    .filter(([_, info]) => info.status === 'disconnected')
    .map(([name, info]) => ({ connection: name, ...info }));

  return Response.json({
    total_connections: Object.keys(connections).length,
    healthy_connections: Object.values(connections).filter(c => c.status === 'connected').length,
    disconnected: disconnected,
    all_connections: connections
  });
}

/**
 * Generate comprehensive repair plan
 */
async function generateRepairPlan(base44, user) {
  const fullAudit = await performFullAudit(base44, user);

  const repairPlan = {
    priority_1_critical: [
      ...(fullAudit.backend_functions.critical_issues?.map(f => ({
        type: 'missing_function',
        item: f.name,
        action: 'Implement backend function',
        difficulty: 'high'
      })) || []),
      ...(fullAudit.wallet_deposits.critical_issues?.map(w => ({
        type: 'wallet_issue',
        item: w.issue,
        action: w.action,
        difficulty: 'high'
      })) || []),
      ...(fullAudit.module_connections.disconnected?.map(m => ({
        type: 'disconnected_module',
        item: m.connection,
        action: 'Rebuild pipeline connection',
        difficulty: 'medium'
      })) || [])
    ],
    priority_2_degraded: fullAudit.data_pipelines.critical_issues || [],
    priority_3_cleanup: fullAudit.placeholder_data.instances || [],
    estimated_time: {
      priority_1: '4-6 hours',
      priority_2: '2-4 hours',
      priority_3: '2-3 hours',
      total: '8-13 hours'
    }
  };

  return Response.json({
    audit_timestamp: fullAudit.timestamp,
    overall_status: fullAudit.overall_health,
    repair_plan: repairPlan,
    full_audit: fullAudit
  });
}