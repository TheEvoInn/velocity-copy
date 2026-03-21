/**
 * Task Reader Automation Bridge
 * Integrates Task Reader output with Autopilot, Agent Worker, and existing automation systems
 * Ensures no framework duplication - extends existing systems
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

    // ACTION: Submit actions to Autopilot for execution
    if (action === 'submit_to_autopilot') {
      const { workflow_id, actions, priority = 80 } = payload;

      // Create task execution that Autopilot will process
      const taskExecution = await base44.entities.TaskExecutionQueue.create({
        opportunity_id: workflow_id,
        url: payload.url,
        opportunity_type: 'application',
        platform: 'task_reader',
        identity_id: payload.identity_id || 'default',
        status: 'queued',
        priority,
        form_fields_detected: actions.filter(a => a.type === 'type'),
        execution_log: [{
          timestamp: new Date().toISOString(),
          step: 'submitted_by_task_reader',
          status: 'pending',
          details: 'Awaiting Autopilot execution'
        }]
      });

      return Response.json({
        status: 'success',
        queued_for_execution: true,
        task_execution_id: taskExecution.id
      });
    }

    // ACTION: Submit actions to Agent Worker for complex handling
    if (action === 'submit_to_agent_worker') {
      const { workflow_id, actions, agent_type = 'default' } = payload;

      // Create workflow execution that Agent Worker understands
      const aiTask = await base44.entities.AITask.create({
        name: payload.task_name || `Task Reader: ${payload.url}`,
        description: `Execute task on ${payload.url}`,
        task_type: 'external_automation',
        status: 'pending',
        agent_type,
        priority: payload.priority || 8,
        execution_steps: actions,
        required_identity: payload.identity_id || 'default',
        dependencies: [],
        timeout_minutes: Math.ceil(actions.length * 2),
        retry_config: {
          max_retries: 3,
          backoff_strategy: 'exponential'
        }
      });

      return Response.json({
        status: 'success',
        submitted_to_agent: true,
        ai_task_id: aiTask.id
      });
    }

    // ACTION: Check automation framework compatibility
    if (action === 'check_framework_compatibility') {
      const { actions, workflow_id } = payload;

      const compatibility = {
        autopilot_compatible: true,
        agent_worker_compatible: true,
        workflow_architect_compatible: true,
        required_capabilities: [],
        recommendations: []
      };

      // Check if actions are supported by existing frameworks
      const actionTypes = new Set(actions.map(a => a.type));

      const supportedByAutopilot = [
        'navigate', 'type', 'click', 'select', 'submit', 'wait', 'validate'
      ];

      const unsupportedActions = [...actionTypes].filter(t => !supportedByAutopilot.includes(t));

      if (unsupportedActions.length > 0) {
        compatibility.autopilot_compatible = false;
        compatibility.recommendations.push(
          `Autopilot may not support: ${unsupportedActions.join(', ')}`
        );
      }

      return Response.json({
        status: 'success',
        compatibility,
        ready_for_framework_integration: compatibility.autopilot_compatible || compatibility.agent_worker_compatible
      });
    }

    // ACTION: Register new task pattern with system
    if (action === 'register_task_pattern') {
      const { page_type, actions, metadata } = payload;

      // Create a reusable task pattern for future task reader discoveries
      const pattern = await base44.entities.Workflow.create({
        name: `Task Pattern: ${page_type}`,
        description: `Reusable pattern for ${page_type} automation`,
        status: 'active',
        nodes: actions.map((action, idx) => ({
          id: action.id,
          type: action.type,
          label: action.type,
          position: { x: idx * 100, y: 0 },
          data: action
        })),
        edges: actions.slice(0, -1).map((action, idx) => ({
          id: `edge_${idx}`,
          source: action.id,
          target: actions[idx + 1].id
        })),
        triggers: ['task_reader_discovery'],
        metadata: {
          page_type,
          pattern_category: metadata?.category || 'generic',
          confidence: metadata?.confidence || 0.8,
          auto_generated: true
        }
      });

      return Response.json({
        status: 'success',
        pattern_registered: true,
        pattern_id: pattern.id
      });
    }

    // ACTION: Trigger cross-system event
    if (action === 'trigger_cross_system_event') {
      const { event_type, data } = payload;

      // Log the event for all systems to consume
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Task Reader Event: ${event_type}`,
        metadata: {
          event_type,
          data,
          broadcast_to: ['autopilot', 'vipz', 'ned', 'workflow_architect']
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        event_broadcast: true,
        event_type
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Task Reader Bridge error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});