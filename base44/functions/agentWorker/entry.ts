/**
 * Agent Worker — Real execution engine (NO simulation)
 *
 * What this does:
 * - queue_task: adds a task to the execution queue
 * - execute_next_task: picks highest-priority queued task and processes it
 * - execute_task: given a task_id, runs it — generates real proposal content,
 *   records it in AIWorkLog, marks opportunity as "submitted" with real data
 * - get_execution_stats: returns queue analytics
 *
 * What this does NOT do:
 * - It does NOT simulate form submissions
 * - It does NOT generate fake confirmation numbers
 * - For platforms with real APIs (Upwork), it calls those APIs directly
 * - For platforms without APIs, it generates the full proposal + opens the URL
 *   so the user can review and submit, then marks it "needs_review"
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    if (action === 'queue_task') {
      return await queueTask(base44, body);
    }
    if (action === 'execute_next_task') {
      return await executeNextTask(base44);
    }
    if (action === 'execute_task' || action === 'execute_task_by_id') {
      const task_id = body.task_id || body.payload?.task_id;
      if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });
      return await executeTaskById(base44, task_id);
    }
    if (action === 'get_execution_stats') {
      return await getStats(base44);
    }
    if (action === 'batch_queue_tasks') {
      return await batchQueueTasks(base44, body.opportunities || []);
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    console.error('[agentWorker] Fatal:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function queueTask(base44, body) {
  const { url, opportunity_id, opportunity_type, platform, identity_id, priority, estimated_value, deadline } = body;
  const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
    url: url || '',
    opportunity_id: opportunity_id || '',
    opportunity_type: opportunity_type || 'other',
    platform: platform || 'unknown',
    identity_id: identity_id || '',
    status: 'queued',
    priority: priority || 50,
    estimated_value: estimated_value || 0,
    deadline,
    queue_timestamp: new Date().toISOString(),
    max_retries: 2,
    execution_log: [{ timestamp: new Date().toISOString(), step: 'queued', status: 'pending', details: `Queued: ${url}` }],
  });
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `📋 Task queued: ${opportunity_type} on ${platform}`,
    severity: 'info',
    metadata: { task_id: task.id, url, priority },
  });
  return Response.json({ success: true, task });
}

async function executeNextTask(base44) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' });
  if (!tasks.length) return Response.json({ success: true, message: 'No tasks in queue' });
  tasks.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.queue_timestamp) - new Date(b.queue_timestamp);
  });
  return await executeTaskById(base44, tasks[0].id);
}

async function executeTaskById(base44, taskId) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ id: taskId });
  if (!tasks.length) return Response.json({ error: 'Task not found' }, { status: 404 });
  const task = tasks[0];

  const startTime = Date.now();
  const log = (step, status, details) => ({
    timestamp: new Date().toISOString(), step, status, details,
  });
  const execLog = [log('start', 'started', `Processing task for ${task.platform}`)];

  try {
    await base44.asServiceRole.entities.TaskExecutionQueue.update(taskId, {
      status: 'processing',
      start_timestamp: new Date().toISOString(),
    });

    // ── Get identity ─────────────────────────────────────────────────────────
    let identity = null;
    if (task.identity_id) {
      const ids = await base44.asServiceRole.entities.AIIdentity.filter({ id: task.identity_id });
      identity = ids[0] || null;
    }
    if (!identity) {
      const ids = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true });
      identity = ids[0] || null;
    }
    if (!identity) {
      throw new Error('No active identity configured. Please create an AI Identity in the Control Center first.');
    }
    execLog.push(log('identity', 'success', `Using identity: ${identity.name}`));

    // ── Get opportunity details ───────────────────────────────────────────────
    let opp = null;
    if (task.opportunity_id) {
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: task.opportunity_id });
      opp = opps[0] || null;
    }

    // ── Route by platform ────────────────────────────────────────────────────
    const platform = (task.platform || '').toLowerCase();

    // Upwork: use real API if token available (check via env)
    const upworkToken = Deno.env.get('UPWORK_ACCESS_TOKEN');
    if (platform === 'upwork' && upworkToken && opp) {
      execLog.push(log('platform_route', 'info', 'Routing to Upwork API'));
      return await executeUpworkJob(base44, task, opp, identity, execLog, startTime);
    }

    // All other platforms: generate real proposal content + mark for review
    return await executeWithProposalGeneration(base44, task, opp, identity, execLog, startTime);

  } catch (error) {
    execLog.push(log('error', 'failed', error.message));
    await base44.asServiceRole.entities.TaskExecutionQueue.update(taskId, {
      status: 'needs_review',
      needs_manual_review: true,
      manual_review_reason: error.message,
      error_message: error.message,
      completion_timestamp: new Date().toISOString(),
      execution_time_seconds: Math.round((Date.now() - startTime) / 1000),
      deep_link_for_manual: task.url,
      execution_log: execLog,
    });
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'alert',
      message: `⚠️ Task failed (${task.platform}): ${error.message}`,
      severity: 'warning',
      metadata: { task_id: taskId, error: error.message },
    });
    return Response.json({ success: false, error: error.message, execution_log: execLog });
  }
}

// deno-lint-ignore no-unused-vars
async function executeUpworkJob(base44, task, opp, identity, execLog, startTime) {
  const log = (step, status, details) => ({ timestamp: new Date().toISOString(), step, status, details });

  // Generate real proposal via LLM
  const proposal = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Write a professional, tailored Upwork cover letter for this job:

Job: ${opp.title}
Description: ${opp.description}

Identity applying:
Name: ${identity.name}
Role: ${identity.role_label || 'Freelancer'}
Skills: ${identity.skills?.join(', ') || 'General'}
Bio: ${identity.bio || ''}
Tone: ${identity.communication_tone || 'professional'}

Write a compelling 3-4 paragraph cover letter. Be specific, address the job requirements directly, include a clear value proposition and call to action. Do not use placeholder text.`,
  });

  execLog.push(log('proposal_generated', 'success', 'Real cover letter generated'));

  // Submit via Upwork API
  try {
    const upworkRes = await base44.asServiceRole.functions.invoke('upworkAPI', {
      action: 'submit_proposal',
      payload: {
        job_id: opp.url?.split('/').pop(),
        cover_letter: proposal,
        bid_amount: opp.profit_estimate_high || 100,
      },
    });
    execLog.push(log('api_submit', 'success', 'Proposal submitted via Upwork API'));

    await finalizeTask(base44, task, opp, execLog, startTime, true, 'Upwork proposal submitted via API');
    return Response.json({ success: true, message: 'Upwork proposal submitted', proposal, execution_log: execLog });
  } catch (apiError) {
    // API submit failed — save proposal for manual submission
    execLog.push(log('api_submit', 'warning', `API submit failed: ${apiError.message}. Proposal ready for manual submit.`));
    await base44.asServiceRole.entities.AIWorkLog.create({
      log_type: 'proposal_submitted',
      task_id: task.id,
      opportunity_id: task.opportunity_id,
      platform: 'upwork',
      subject: opp.title,
      full_content: proposal,
      status: 'drafted',
      outcome: 'Ready for manual submission — API returned error',
    });
    await finalizeTask(base44, task, opp, execLog, startTime, false, 'Proposal ready, API error — needs manual submit');
    return Response.json({ success: false, needs_manual: true, proposal, url: task.url, execution_log: execLog });
  }
}

async function executeWithProposalGeneration(base44, task, opp, identity, execLog, startTime) {
  const log = (step, status, details) => ({ timestamp: new Date().toISOString(), step, status, details });

  const oppTitle = opp?.title || task.url;
  const oppDesc = opp?.description || '';
  const platform = task.platform;
  const oppType = task.opportunity_type;

  // Generate real, tailored content for the opportunity
  const content = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Generate a complete, professional application for this real opportunity:

Platform: ${platform}
Type: ${oppType}
Title: ${oppTitle}
Description: ${oppDesc}
URL: ${task.url}

Applying identity:
Name: ${identity.name}
Role: ${identity.role_label || ''}
Skills: ${identity.skills?.join(', ') || ''}
Email: ${identity.email || ''}
Bio: ${identity.bio || ''}
Tone: ${identity.communication_tone || 'professional'}
${identity.proposal_style ? `Proposal style: ${identity.proposal_style}` : ''}

Generate a complete, ready-to-submit application including:
1. Cover letter / application text (tailored to this specific opportunity)
2. Key selling points to highlight
3. Any specific details from the identity that match this opportunity
4. Suggested bid/rate if applicable
5. Step-by-step instructions for submitting at the URL above

This is a real opportunity. Be specific and professional. No placeholders.`,
  });

  execLog.push(log('content_generated', 'success', `Application content generated for ${platform}`));

  // Save to AIWorkLog with full content
  await base44.asServiceRole.entities.AIWorkLog.create({
    log_type: 'proposal_submitted',
    task_id: task.id,
    opportunity_id: task.opportunity_id || '',
    platform,
    subject: oppTitle,
    full_content: content,
    content_preview: content.slice(0, 300),
    status: 'drafted',
    outcome: 'Ready for review and submission',
    ai_decision_context: `Generated using identity: ${identity.name}`,
  });

  execLog.push(log('work_log_saved', 'success', 'Application saved to Work Log'));

  // Mark as needs_review with deep link for manual submission
  await finalizeTask(base44, task, opp, execLog, startTime, false, 'Application prepared — ready for manual submission');

  if (opp) {
    await base44.asServiceRole.entities.Opportunity.update(opp.id, {
      status: 'reviewing',
      notes: `Application content ready. Review in Work Log and submit at: ${task.url}`,
    });
  }

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'task_execution',
    message: `📝 Application prepared for "${oppTitle}" on ${platform} — ready for submission`,
    severity: 'info',
    metadata: { task_id: task.id, platform, url: task.url },
  });

  return Response.json({
    success: true,
    status: 'needs_review',
    message: 'Application content generated. Review in Work Log and submit manually.',
    url: task.url,
    content_preview: content.slice(0, 500),
    execution_log: execLog,
  });
}

async function finalizeTask(base44, task, opp, execLog, startTime, submitted, message) {
  const executionTime = Math.round((Date.now() - startTime) / 1000);
  await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
    status: submitted ? 'completed' : 'needs_review',
    needs_manual_review: !submitted,
    manual_review_reason: submitted ? null : message,
    completion_timestamp: new Date().toISOString(),
    execution_time_seconds: executionTime,
    submission_success: submitted,
    deep_link_for_manual: submitted ? null : task.url,
    execution_log: execLog,
  });
}

async function getStats(base44) {
  const allTasks = await base44.asServiceRole.entities.TaskExecutionQueue.list('-completion_timestamp', 200);
  const stats = { total: allTasks.length, by_status: {}, by_platform: {}, success_rate: 0 };
  let successCount = 0;
  allTasks.forEach(t => {
    stats.by_status[t.status] = (stats.by_status[t.status] || 0) + 1;
    stats.by_platform[t.platform] = (stats.by_platform[t.platform] || 0) + 1;
    if (t.status === 'completed' && t.submission_success) successCount++;
  });
  stats.success_rate = allTasks.length > 0 ? Math.round((successCount / allTasks.length) * 100) : 0;
  return Response.json({ success: true, stats });
}

async function batchQueueTasks(base44, opportunities) {
  const queued = [];
  for (const opp of opportunities) {
    const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
      url: opp.url || opp.source_url,
      opportunity_id: opp.id,
      opportunity_type: opp.opportunity_type || opp.type,
      platform: opp.platform,
      identity_id: opp.identity_id || '',
      priority: opp.priority || 50,
      estimated_value: opp.profit_estimate_high || 0,
      deadline: opp.deadline,
      status: 'queued',
      queue_timestamp: new Date().toISOString(),
    });
    queued.push(task);
  }
  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `📋 Batch queued: ${queued.length} tasks`,
    severity: 'info',
    metadata: { task_count: queued.length },
  });
  return Response.json({ success: true, queued: queued.length, tasks: queued });
}