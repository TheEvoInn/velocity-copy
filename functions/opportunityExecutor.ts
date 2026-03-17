import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Opportunity Executor - Direct execution handler for opportunities
 * Integrates with Agent Worker to navigate, fill, and submit opportunities
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();

    // --- Entity automation trigger (from "Auto-Execute on New Opportunity" automation) ---
    // Payload shape: { event: { type, entity_name, entity_id }, data: {...}, old_data: {...} }
    if (body.event && body.event.entity_name === 'Opportunity') {
      return await handleAutomationTrigger(base44, body);
    }

    // --- Scheduled automation trigger (from "Complete Failed Tasks Retry" automation) ---
    // Payload shape: { automation: { id, name, type }, args: {...} }
    if (body.automation) {
      return await handleScheduledRetry(base44);
    }

    // --- Direct invocation (from frontend / other functions) ---
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = body;

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
 * Handle entity automation trigger — auto-execute high-scoring opportunities
 */
async function handleAutomationTrigger(base44, body) {
  const { event, data } = body;

  // Only act on create events (new opportunities)
  if (event.type !== 'create') {
    return Response.json({ skipped: true, reason: 'Not a create event' });
  }

  let opp = data;

  // If payload was too large and data is null, fetch the opportunity
  if (!opp) {
    const results = await base44.asServiceRole.entities.Opportunity.filter({ id: event.entity_id }, null, 1);
    opp = results?.[0];
  }

  if (!opp) {
    return Response.json({ skipped: true, reason: 'Opportunity not found' });
  }

  // Only auto-execute if score > 75 and auto_execute is true
  if (!opp.auto_execute || (opp.overall_score ?? 0) <= 75) {
    return Response.json({
      skipped: true,
      reason: `Skipped: auto_execute=${opp.auto_execute}, score=${opp.overall_score}`
    });
  }

  // Already in progress — don't double-queue
  if (['queued', 'executing', 'submitted', 'completed'].includes(opp.status)) {
    return Response.json({ skipped: true, reason: `Already in status: ${opp.status}` });
  }

  console.log(`Auto-executing opportunity: ${opp.title} (score: ${opp.overall_score})`);

  // Determine identity to use
  let identityId = opp.identity_id;
  if (!identityId) {
    const identities = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1);
    identityId = identities?.[0]?.id;
  }

  if (!identityId) {
    console.warn('No identity available for auto-execution');
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'alert',
      message: `Auto-execute skipped for "${opp.title}" — no active identity found`,
      severity: 'warning',
    });
    return Response.json({ skipped: true, reason: 'No active identity found' });
  }

  // Queue the opportunity for autopilot execution
  const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
    opportunity_id: opp.id,
    url: opp.url,
    opportunity_type: opp.opportunity_type || 'other',
    platform: opp.platform,
    identity_id: identityId,
    identity_name: opp.identity_name,
    status: 'queued',
    priority: Math.min(99, Math.round(opp.overall_score || 80)),
    estimated_value: opp.profit_estimate_high,
    deadline: opp.deadline,
    queue_timestamp: new Date().toISOString(),
  });

  // Update opportunity status to queued
  await base44.asServiceRole.entities.Opportunity.update(opp.id, {
    status: 'queued',
    task_execution_id: task.id,
  });

  // Log the auto-execution
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'opportunity_found',
    message: `Auto-queued high-score opportunity: "${opp.title}" (score: ${opp.overall_score})`,
    metadata: { opportunity_id: opp.id, task_id: task.id, score: opp.overall_score },
    severity: 'success',
  });

  console.log(`Successfully queued task ${task.id} for opportunity ${opp.id}`);

  return Response.json({
    success: true,
    task_id: task.id,
    opportunity_id: opp.id,
    message: `Auto-queued: "${opp.title}" (score: ${opp.overall_score})`
  });
}

/**
 * Handle scheduled retry — find failed tasks and re-queue with exponential backoff
 */
async function handleScheduledRetry(base44) {
  const now = new Date();
  console.log(`[ScheduledRetry] Running at ${now.toISOString()}`);

  // Find failed tasks eligible for retry (retry_count < max_retries)
  const failedTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { status: 'failed' },
    '-updated_date',
    50
  );

  const eligible = failedTasks.filter(t => (t.retry_count || 0) < (t.max_retries ?? 2));

  if (eligible.length === 0) {
    console.log('[ScheduledRetry] No eligible failed tasks to retry');
    return Response.json({ success: true, retried: 0, message: 'No eligible tasks to retry' });
  }

  let retried = 0;
  const results = [];

  for (const task of eligible) {
    const retryCount = task.retry_count || 0;
    // Exponential backoff: 1h * 2^retryCount — check if enough time has passed
    const backoffMs = Math.pow(2, retryCount) * 60 * 60 * 1000;
    const lastAttempt = task.last_retry_at ? new Date(task.last_retry_at) : new Date(task.updated_date);
    const nextRetryAt = new Date(lastAttempt.getTime() + backoffMs);

    if (now < nextRetryAt) {
      results.push({ task_id: task.id, skipped: true, reason: `Backoff: next retry at ${nextRetryAt.toISOString()}` });
      continue;
    }

    // Re-queue the task
    await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
      status: 'queued',
      retry_count: retryCount + 1,
      last_retry_at: now.toISOString(),
      error_message: null,
    });

    retried++;
    results.push({ task_id: task.id, retried: true, retry_count: retryCount + 1 });
    console.log(`[ScheduledRetry] Re-queued task ${task.id} (attempt ${retryCount + 1})`);
  }

  // Log summary
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `Scheduled retry: re-queued ${retried} failed task(s) (${eligible.length} eligible, ${failedTasks.length} total failed)`,
    metadata: { retried, eligible: eligible.length, total_failed: failedTasks.length },
    severity: retried > 0 ? 'info' : 'success',
  });

  return Response.json({ success: true, retried, total_failed: failedTasks.length, results });
}

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