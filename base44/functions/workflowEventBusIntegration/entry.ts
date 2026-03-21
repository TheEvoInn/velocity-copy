import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Workflow Event Bus Integration
 * Routes workflow triggers and executions to the real event bus for cross-department automation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, workflow, trigger, triggerData } = await req.json();

    // ─── REGISTER_WORKFLOW_TRIGGERS ────────────────────────────────────────
    if (action === 'register_workflow_triggers') {
      const registered = await registerWorkflowTriggers(base44, workflow, user);
      return Response.json({ success: true, registered });
    }

    // ─── DISPATCH_WORKFLOW_EVENT ──────────────────────────────────────────
    if (action === 'dispatch_workflow_event') {
      const executed = await dispatchWorkflowEvent(base44, trigger, triggerData, user);
      return Response.json({ success: true, executed });
    }

    // ─── TRIGGER_WORKFLOW ────────────────────────────────────────────────
    if (action === 'trigger_workflow') {
      const result = await triggerWorkflow(base44, workflow, triggerData, user);
      return Response.json({ success: true, result });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function registerWorkflowTriggers(base44, workflow, user) {
  const registered = [];

  try {
    if (!workflow.triggers || workflow.triggers.length === 0) {
      return registered;
    }

    for (const triggerType of workflow.triggers) {
      // Create a task orchestration rule for each trigger
      const rule = {
        rule_name: `Workflow: ${workflow.name} - ${triggerType}`,
        description: `Auto-trigger workflow "${workflow.name}" on ${triggerType} event`,
        source_department: 'System',
        source_entity: 'Workflow',
        source_event_type: triggerType === 'manual' ? 'create' : triggerType,
        target_department: extractTargetDepartment(workflow),
        target_task_type: 'workflow_execution',
        target_task_config: {
          ai_agent: 'Autopilot',
          execution_mode: 'immediate',
          parameters: { workflow_id: workflow.id }
        },
        enabled: workflow.status === 'active',
        priority: 85
      };

      // Check if rule already exists
      const existing = await base44.asServiceRole.entities.TaskOrchestrationRule.filter({
        rule_name: rule.rule_name,
        created_by: user.email
      }).catch(() => []);

      if (Array.isArray(existing) && existing.length > 0) {
        // Update existing rule
        await base44.asServiceRole.entities.TaskOrchestrationRule.update(
          existing[0].id,
          rule
        ).catch(() => {});
        registered.push({ trigger: triggerType, status: 'updated' });
      } else {
        // Create new rule
        await base44.asServiceRole.entities.TaskOrchestrationRule.create(rule).catch(() => {});
        registered.push({ trigger: triggerType, status: 'created' });
      }
    }

    // Log registration
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'workflow',
      message: `Workflow triggers registered for "${workflow.name}"`,
      severity: 'info',
      metadata: { workflow_id: workflow.id, triggers: workflow.triggers }
    }).catch(() => {});

  } catch (e) {
    console.error('Error registering workflow triggers:', e);
  }

  return registered;
}

async function dispatchWorkflowEvent(base44, trigger, triggerData, user) {
  try {
    // Find all active workflows that respond to this trigger
    const workflows = await base44.asServiceRole.entities.Workflow.filter({
      created_by: user.email,
      status: 'active',
      triggers: { $in: [trigger] }
    }).catch(() => []);

    const workflowsArray = Array.isArray(workflows) ? workflows : [];
    const executed = [];

    for (const workflow of workflowsArray) {
      if (workflow && workflow.id) {
        try {
          const result = await base44.asServiceRole.functions.invoke('workflowExecutor', {
            action: 'execute',
            workflow,
            executionData: triggerData || {}
          }).catch(e => ({ data: { error: e.message } }));

          executed.push({
            workflow_id: workflow.id,
            workflow_name: workflow.name,
            status: result?.data?.status || 'error',
            execution_id: result?.data?.executionId
          });

          // Log execution
          await base44.asServiceRole.entities.ActivityLog.create({
            action_type: 'workflow',
            message: `Workflow "${workflow.name}" triggered by ${trigger} event`,
            severity: 'success',
            metadata: {
              workflow_id: workflow.id,
              trigger,
              execution_id: result?.data?.executionId
            }
          }).catch(() => {});
        } catch (e) {
          console.error(`Error executing workflow ${workflow.id}:`, e);
        }
      }
    }

    return executed;
  } catch (e) {
    console.error('Error dispatching workflow event:', e);
    return [];
  }
}

async function triggerWorkflow(base44, workflow, triggerData, user) {
  try {
    // Validate workflow
    if (!workflow || !workflow.id) {
      throw new Error('Invalid workflow');
    }

    // Log trigger
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'workflow',
      message: `Manual trigger for workflow "${workflow.name}"`,
      severity: 'info',
      metadata: { workflow_id: workflow.id, trigger_data: triggerData }
    }).catch(() => {});

    // Execute via workflow executor
    const result = await base44.asServiceRole.functions.invoke('workflowExecutor', {
      action: 'execute',
      workflow,
      executionData: triggerData || {}
    }).catch(e => ({ data: { error: e.message } }));

    return {
      workflow_id: workflow.id,
      status: result?.data?.status || 'error',
      execution_id: result?.data?.executionId,
      error: result?.data?.error
    };
  } catch (e) {
    console.error('Error triggering workflow:', e);
    throw e;
  }
}

function extractTargetDepartment(workflow) {
  // Determine primary target department from nodes
  if (!workflow.nodes || workflow.nodes.length === 0) return 'System';

  const departments = {};
  for (const node of workflow.nodes) {
    if (node && node.department) {
      departments[node.department] = (departments[node.department] || 0) + 1;
    }
  }

  // Return most common department
  return Object.keys(departments).reduce((a, b) =>
    departments[a] > departments[b] ? a : b
  ) || 'System';
}