import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Opportunity Executor - Direct execution handler for opportunities
 * Integrates with Agent Worker to navigate, fill, and submit opportunities
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'execute_opportunity') {
      return await executeOpportunity(base44, user, payload);
    }

    if (action === 'queue_for_autopilot') {
      return await queueForAutopilot(base44, user, payload);
    }

    if (action === 'update_execution_status') {
      return await updateExecutionStatus(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Opportunity Executor Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Execute opportunity directly
 */
async function executeOpportunity(base44, user, payload) {
  const {
    opportunity_id,
    identity_id,
    proposal_content
  } = payload;

  const executionLog = [];

  try {
    // Fetch opportunity
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps || opps.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];
    executionLog.push({
      timestamp: new Date().toISOString(),
      action: 'Opportunity loaded',
      status: 'success',
      details: `${opp.title} (${opp.platform})`
    });

    // Fetch identity
    const identities = await base44.entities.AIIdentity.filter(
      { id: identity_id || opp.identity_id },
      null,
      1
    );

    const identity = identities?.[0];
    if (!identity) {
      return Response.json({ error: 'Identity not found' }, { status: 404 });
    }

    executionLog.push({
      timestamp: new Date().toISOString(),
      action: 'Identity selected',
      status: 'success',
      details: identity.name
    });

    // Create execution task
    const task = await base44.entities.TaskExecutionQueue.create({
      opportunity_id,
      url: opp.url,
      opportunity_type: opp.opportunity_type,
      platform: opp.platform,
      identity_id: identity.id,
      identity_name: identity.name,
      status: 'processing',
      priority: 90,
      estimated_value: opp.profit_estimate_high,
      deadline: opp.deadline,
      execution_log: executionLog,
      created_by: user.email
    });

    executionLog.push({
      timestamp: new Date().toISOString(),
      action: 'Task created',
      status: 'success',
      details: task.id
    });

    // Trigger Agent Worker
    const agentRes = await base44.functions.invoke('agentWorker', {
      action: 'execute_task',
      payload: {
        task_id: task.id,
        opportunity_id,
        url: opp.url,
        identity_id: identity.id,
        proposal_content,
        platform: opp.platform,
        form_instructions: generateFormInstructions(opp)
      }
    });

    if (agentRes.data?.success) {
      executionLog.push(...(agentRes.data.execution_log || []));

      // Update opportunity status
      await base44.entities.Opportunity.update(opportunity_id, {
        status: 'submitted',
        task_execution_id: task.id,
        submission_timestamp: new Date().toISOString(),
        submission_confirmed: true,
        confirmation_number: agentRes.data.confirmation_code || `EXEC-${task.id.slice(0, 8)}`,
        notes: agentRes.data.confirmation_message
      });

      // Log execution
      await base44.entities.AIWorkLog.create({
        log_type: 'proposal_submitted',
        opportunity_id,
        task_id: task.id,
        linked_account_id: identity.id,
        platform: opp.platform,
        subject: opp.title,
        status: 'sent',
        outcome: agentRes.data.confirmation_message,
        execution_log: executionLog,
        created_by: user.email
      });

      return Response.json({
        success: true,
        task_id: task.id,
        opportunity_id,
        identity_id: identity.id,
        confirmation_code: agentRes.data.confirmation_code,
        execution_log: executionLog,
        message: 'Opportunity executed successfully'
      });
    } else {
      executionLog.push({
        timestamp: new Date().toISOString(),
        action: 'Agent Worker execution failed',
        status: 'failed',
        details: agentRes.data?.error || 'Unknown error'
      });

      // Update task with failure
      await base44.entities.TaskExecutionQueue.update(task.id, {
        status: 'failed',
        error_message: agentRes.data?.error,
        execution_log: executionLog
      });

      return Response.json({
        success: false,
        task_id: task.id,
        error: agentRes.data?.error || 'Execution failed',
        execution_log: executionLog
      });
    }
  } catch (error) {
    executionLog.push({
      timestamp: new Date().toISOString(),
      action: 'Execution error',
      status: 'failed',
      details: error.message
    });

    return Response.json({
      success: false,
      error: error.message,
      execution_log: executionLog
    }, { status: 500 });
  }
}

/**
 * Queue opportunity for Autopilot
 */
async function queueForAutopilot(base44, user, payload) {
  const {
    opportunity_id,
    identity_id,
    priority
  } = payload;

  try {
    // Fetch opportunity
    const opps = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opps || opps.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opp = opps[0];

    // Create task in queue
    const task = await base44.entities.TaskExecutionQueue.create({
      opportunity_id,
      url: opp.url,
      opportunity_type: opp.opportunity_type,
      platform: opp.platform,
      identity_id: identity_id || opp.identity_id,
      status: 'queued',
      priority: priority || 75,
      estimated_value: opp.profit_estimate_high,
      deadline: opp.deadline,
      queue_timestamp: new Date().toISOString(),
      created_by: user.email
    });

    // Update opportunity
    await base44.entities.Opportunity.update(opportunity_id, {
      status: 'queued',
      task_execution_id: task.id
    });

    // Log action
    await base44.entities.ActivityLog.create({
      action_type: 'opportunity_found',
      message: `Opportunity queued for Autopilot: ${opp.title}`,
      metadata: {
        opportunity_id,
        task_id: task.id,
        priority
      },
      severity: 'info',
      created_by: user.email
    });

    return Response.json({
      success: true,
      task_id: task.id,
      opportunity_id,
      status: 'queued',
      message: `Opportunity queued for Autopilot (Priority: ${priority || 75})`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Update execution status
 */
async function updateExecutionStatus(base44, user, payload) {
  const {
    opportunity_id,
    status,
    task_id,
    confirmation_data
  } = payload;

  try {
    await base44.entities.Opportunity.update(opportunity_id, {
      status,
      task_execution_id: task_id,
      submission_timestamp: confirmation_data?.timestamp || new Date().toISOString(),
      submission_confirmed: confirmation_data?.confirmed || false,
      confirmation_number: confirmation_data?.confirmation_number,
      notes: confirmation_data?.notes
    });

    return Response.json({
      success: true,
      opportunity_id,
      status,
      message: `Opportunity status updated to ${status}`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Generate platform-specific form instructions
 */
function generateFormInstructions(opportunity) {
  const baseInstructions = `
Fill out and submit the application form for: ${opportunity.title}

Opportunity Details:
- Platform: ${opportunity.platform}
- Category: ${opportunity.category}
- Profit Estimate: $${opportunity.profit_estimate_low}-$${opportunity.profit_estimate_high}
- URL: ${opportunity.url}
`;

  if (opportunity.platform === 'upwork') {
    return baseInstructions + `
UPWORK-SPECIFIC INSTRUCTIONS:
1. Navigate to the job posting
2. Click "Send Job Proposal" button
3. Fill in "Cover Letter" field with the provided proposal
4. Set your proposed rate/bid
5. Add estimated delivery time
6. Submit proposal
7. Capture confirmation message`;
  }

  if (opportunity.platform === 'fiverr') {
    return baseInstructions + `
FIVERR-SPECIFIC INSTRUCTIONS:
1. Navigate to gig creation page
2. Fill in gig title, description, category
3. Add required images
4. Set pricing tiers
5. Publish gig
6. Capture confirmation`;
  }

  if (opportunity.platform === 'freelancer') {
    return baseInstructions + `
FREELANCER-SPECIFIC INSTRUCTIONS:
1. Navigate to job posting
2. Click "Place Bid"
3. Fill in bid amount
4. Add cover letter with provided proposal
5. Add estimated duration
6. Submit bid
7. Capture confirmation`;
  }

  return baseInstructions + `
GENERIC FORM INSTRUCTIONS:
1. Navigate to the URL
2. Identify form fields
3. Fill in all required fields
4. Insert proposal content where appropriate
5. Submit form
6. Capture confirmation page`;
}