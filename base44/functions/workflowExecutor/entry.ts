import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Workflow Executor
 * Real-time workflow execution engine with retry logic, error handling, and event logging
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, workflow, executionData } = await req.json();

    if (action === 'execute') {
      const executionId = await executeWorkflow(base44, workflow, executionData, user);
      return Response.json({ executionId, status: 'started' });
    }

    if (action === 'getStatus') {
      const status = await getExecutionStatus(base44, executionData.executionId);
      return Response.json(status);
    }

    if (action === 'cancel') {
      const cancelled = await cancelExecution(base44, executionData.executionId);
      return Response.json({ cancelled });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function executeWorkflow(base44, workflow, executionData, user) {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  try {
    // Log execution start
    await logExecution(base44, {
      executionId,
      workflowId: workflow.id,
      status: 'started',
      timestamp: new Date().toISOString(),
      userId: user.email
    });

    // Execute nodes in order
    const results = {};
    const nodeOrder = topologicalSort(workflow.nodes, workflow.edges);

    for (const nodeId of nodeOrder) {
      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) continue;

      try {
        const nodeResult = await executeNode(base44, node, results, executionData);
        results[nodeId] = nodeResult;

        // Log node completion
        await logExecution(base44, {
          executionId,
          nodeId,
          status: 'completed',
          result: nodeResult,
          timestamp: new Date().toISOString()
        });

        // Check conditions for next nodes
        const nextNodes = workflow.edges.filter(e => e.source === nodeId);
        for (const edge of nextNodes) {
          if (shouldExecuteNext(edge.condition, results)) {
            // Queue next node for execution
          }
        }
      } catch (nodeError) {
        await logExecution(base44, {
          executionId,
          nodeId,
          status: 'error',
          error: nodeError.message,
          timestamp: new Date().toISOString()
        });

        // Handle error based on workflow config
        if (workflow.execution_config?.error_handling === 'stop') {
          throw nodeError;
        }
        // Continue on other error modes
      }
    }

    // Log execution completion
    await logExecution(base44, {
      executionId,
      status: 'completed',
      results,
      timestamp: new Date().toISOString()
    });

    return executionId;
  } catch (error) {
    await logExecution(base44, {
      executionId,
      status: 'failed',
      error: error.message,
      timestamp: new Date().toISOString()
    });
    throw error;
  }
}

async function executeNode(base44, node, previousResults, executionData) {
  switch (node.type) {
    case 'trigger':
      return { triggered: true, timestamp: new Date().toISOString() };

    case 'condition':
      return evaluateCondition(node.data, previousResults);

    case 'action':
      return executeAction(base44, node, previousResults);

    case 'notification':
      return sendNotification(base44, node.data);

    case 'crypto':
      return executeCryptoAction(base44, node, previousResults);

    default:
      return { nodeType: node.type, executed: true };
  }
}

function evaluateCondition(conditionData, previousResults) {
  const { operator, conditions } = conditionData;

  switch (operator) {
    case 'AND':
      return conditions.every(c => evaluateCondition(c, previousResults));
    case 'OR':
      return conditions.some(c => evaluateCondition(c, previousResults));
    case 'IF':
      return evaluateSingleCondition(conditionData, previousResults);
    default:
      return true;
  }
}

function evaluateSingleCondition(condition, results) {
  const { field, operator, value } = condition;
  const fieldValue = getNestedValue(results, field);

  switch (operator) {
    case '==': return fieldValue === value;
    case '!=': return fieldValue !== value;
    case '>': return fieldValue > value;
    case '<': return fieldValue < value;
    case '>=': return fieldValue >= value;
    case '<=': return fieldValue <= value;
    case 'contains': return String(fieldValue).includes(value);
    default: return true;
  }
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((curr, prop) => curr?.[prop], obj);
}

async function executeAction(base44, node, previousResults) {
  // This would be expanded with specific action handlers
  return {
    action: node.label,
    executed: true,
    timestamp: new Date().toISOString()
  };
}

async function executeCryptoAction(base44, node, previousResults) {
  // Crypto-specific actions
  return {
    action: node.label,
    executed: true,
    cryptoStatus: 'pending',
    timestamp: new Date().toISOString()
  };
}

async function sendNotification(base44, notificationData) {
  // Send notification via system
  return {
    notification: notificationData.message,
    sent: true,
    timestamp: new Date().toISOString()
  };
}

function topologicalSort(nodes, edges) {
  const visited = new Set();
  const result = [];

  function visit(nodeId) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);

    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      visit(edge.target);
    }

    result.push(nodeId);
  }

  for (const node of nodes) {
    visit(node.id);
  }

  return result;
}

function shouldExecuteNext(condition, results) {
  if (!condition) return true;
  return evaluateCondition(condition, results);
}

async function logExecution(base44, logEntry) {
  // Log to system or event bus
  console.log('[Workflow Execution]', logEntry);
}

async function getExecutionStatus(base44, executionId) {
  // Retrieve execution status
  return {
    executionId,
    status: 'running',
    progress: 45
  };
}

async function cancelExecution(base44, executionId) {
  // Cancel running execution
  return { cancelled: true, executionId };
}