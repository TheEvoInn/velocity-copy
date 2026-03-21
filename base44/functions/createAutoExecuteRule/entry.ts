import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const ruleData = payload.rule;

    if (!ruleData) {
      return Response.json({ error: 'Missing rule data' }, { status: 400 });
    }

    // Create the TaskOrchestrationRule record
    const createdRule = await base44.entities.TaskOrchestrationRule.create({
      rule_name: ruleData.rule_name,
      description: ruleData.description,
      source_department: ruleData.source_department || 'Discovery',
      source_entity: ruleData.source_entity || 'Opportunity',
      source_event_type: ruleData.source_event_type || 'create',
      condition_type: ruleData.condition_type,
      condition_field: ruleData.condition_field,
      condition_operator: ruleData.condition_operator,
      condition_value: ruleData.condition_value,
      target_department: ruleData.target_department || 'Execution',
      target_task_type: ruleData.target_task_type,
      target_task_config: ruleData.target_task_config || {},
      cascading_rules: ruleData.cascading_rules || [],
      enabled: ruleData.enabled !== false,
      priority: ruleData.priority || 50,
      execution_history: [],
      total_triggers: 0,
      total_successful: 0,
      status: 'active',
      notes: ruleData.notes || ''
    });

    return Response.json({
      success: true,
      rule: createdRule,
      message: 'Auto-execute rule created from template'
    });
  } catch (error) {
    console.error('Error creating auto-execute rule:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});