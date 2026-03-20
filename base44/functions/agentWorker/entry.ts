import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.47.1';

/**
 * Agent Worker — Real Execution Engine
 * Uses OpenAI to generate real deliverables and submissions.
 * NO fake simulations. All content is real and usable.
 */

const openai = new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, payload } = body;

    if (action === 'execute_task') return await executeTask(base44, payload);
    if (action === 'generate_content') return await generateContent(base44, payload);
    if (action === 'generate_proposal') return await generateProposal(base44, payload);
    if (action === 'execute_next_task') return await executeNextTask(base44);
    if (action === 'get_execution_stats') return await getStats(base44);
    if (action === 'queue_task') return await queueTask(base44, payload);
    if (action === 'batch_queue_tasks') return await batchQueueTasks(base44, payload);

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[AgentWorker] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function executeTask(base44, payload) {
  const { task_id, opportunity_id, url, identity_id, platform, proposal_content } = payload;
  const startTime = Date.now();
  const execLog = [];

  const log = (step, status, details) => {
    execLog.push({ timestamp: new Date().toISOString(), step, status, details });
    console.log(`[Task ${task_id}] ${step}: ${details}`);
  };

  try {
    // Load opportunity
    const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id }, null, 1);
    const opp = opps?.[0];
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

    log('load_opportunity', 'success', `${opp.title} on ${opp.platform}`);

    // Load identity
    let identity = null;
    if (identity_id) {
      const ids = await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id }, null, 1);
      identity = ids?.[0];
    }
    if (!identity) {
      const ids = await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }, null, 1);
      identity = ids?.[0];
    }
    if (!identity) return Response.json({ error: 'No active identity found' }, { status: 404 });

    log('load_identity', 'success', identity.name);

    // Update task to processing
    if (task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: 'processing',
        start_timestamp: new Date().toISOString(),
        identity_name: identity.name,
        execution_log: execLog,
      });
    }

    // Determine execution strategy based on opportunity type
    let executionResult = null;

    if (['contest', 'design'].includes(opp.category) || ['logo', 'design', 'brand'].some(k => opp.title?.toLowerCase().includes(k))) {
      executionResult = await executeDesignOpportunity(opp, identity, log);
    } else if (opp.category === 'grant' || opp.opportunity_type === 'grant') {
      executionResult = await executeGrantApplication(opp, identity, log);
    } else if (opp.category === 'digital_flip') {
      executionResult = await executeDigitalProduct(opp, identity, log);
    } else {
      // Default: writing/content service
      executionResult = await executeWritingOpportunity(opp, identity, proposal_content, log);
    }

    const executionTime = Math.round((Date.now() - startTime) / 1000);
    log('execution_complete', executionResult.success ? 'success' : 'failed', executionResult.message);

    // Update task record
    if (task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: executionResult.success ? 'completed' : 'needs_review',
        completion_timestamp: new Date().toISOString(),
        execution_time_seconds: executionTime,
        submission_success: executionResult.success,
        confirmation_text: executionResult.message,
        form_data_submitted: executionResult.deliverable ? { content: executionResult.deliverable.substring(0, 500) } : {},
        needs_manual_review: !executionResult.success,
        manual_review_reason: executionResult.success ? null : executionResult.reason,
        deep_link_for_manual: opp.url,
        execution_log: execLog,
      });
    }

    // Update opportunity
    await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
      status: executionResult.success ? 'submitted' : 'reviewing',
      submission_timestamp: new Date().toISOString(),
      submission_confirmed: executionResult.success,
      notes: executionResult.message,
    });

    // Log to activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'opportunity_found',
      message: `${executionResult.success ? '✅' : '⚠️'} Task executed: ${opp.title} (${executionTime}s)`,
      severity: executionResult.success ? 'success' : 'warning',
      metadata: { task_id, opportunity_id, platform: opp.platform, execution_time: executionTime },
    });

    return Response.json({
      success: executionResult.success,
      task_id,
      opportunity_id,
      message: executionResult.message,
      deliverable_preview: executionResult.deliverable?.substring(0, 300),
      execution_log: execLog,
      needs_manual_action: executionResult.needs_manual_action,
      manual_action_url: opp.url,
    });

  } catch (error) {
    log('error', 'failed', error.message);
    if (task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: 'needs_review',
        needs_manual_review: true,
        manual_review_reason: error.message,
        error_message: error.message,
        deep_link_for_manual: url,
        execution_log: execLog,
      });
    }
    return Response.json({ success: false, error: error.message, execution_log: execLog }, { status: 500 });
  }
}

async function executeWritingOpportunity(opp, identity, existingProposal, log) {
  log('generate_content', 'running', 'Generating real written deliverable with OpenAI');

  const systemPrompt = `You are ${identity.name}, a professional ${identity.role_label || 'writer'}. 
Your bio: ${identity.bio || 'Experienced professional writer with expertise in multiple content types.'}
Your skills: ${(identity.skills || []).join(', ') || 'writing, editing, research, SEO'}
Communication tone: ${identity.communication_tone || 'professional'}`;

  const deliverable = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `You have been assigned this writing task:

Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}
Requirements: ${opp.notes || 'Standard quality, professional tone'}
URL: ${opp.url}

Write the complete deliverable for this assignment now. This is a REAL paid assignment. 
Produce publication-ready work that meets professional standards.
Include a cover note at the top explaining your approach, then the full content.`
      }
    ],
    max_tokens: 2000,
  });

  const content = deliverable.choices[0].message.content;
  log('content_generated', 'success', `Generated ${content.length} character deliverable`);

  // Generate submission cover letter/proposal if needed
  const proposal = existingProposal || await generateCoverLetter(opp, identity);
  log('proposal_ready', 'success', 'Cover letter/proposal ready for submission');

  return {
    success: true,
    message: `Real deliverable generated for "${opp.title}". Content ready for submission to ${opp.platform}. Manual submission to ${opp.url} required to upload and submit.`,
    deliverable: content,
    proposal,
    needs_manual_action: true, // User must actually upload to the platform
    reason: null,
  };
}

async function executeDesignOpportunity(opp, identity, log) {
  log('design_brief', 'running', 'Analyzing design contest brief with OpenAI');

  const brief = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are ${identity.name}, a professional designer. Skills: ${(identity.skills || ['logo design', 'branding', 'graphic design']).join(', ')}` },
      {
        role: 'user',
        content: `Design contest opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}
URL: ${opp.url}

Produce:
1. A detailed design concept description (colors, fonts, shapes, style, rationale)
2. Specific design direction and deliverable specs
3. A contest entry statement to submit with your design
4. Step-by-step instructions to create this design in Canva or Adobe Express

Be specific and actionable. This is a real contest entry.`
      }
    ],
    max_tokens: 1500,
  });

  const content = brief.choices[0].message.content;
  log('design_brief_ready', 'success', 'Design concept and entry statement generated');

  return {
    success: true,
    message: `Design concept ready for "${opp.title}". Full design brief and entry statement generated. Go to ${opp.url} to create and submit your design using the provided specifications.`,
    deliverable: content,
    needs_manual_action: true,
    reason: null,
  };
}

async function executeGrantApplication(opp, identity, log) {
  log('grant_research', 'running', 'Researching grant requirements and drafting application');

  const application = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are ${identity.name}. Bio: ${identity.bio || 'Professional seeking funding opportunities.'}` },
      {
        role: 'user',
        content: `Grant opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}
URL: ${opp.url}

Write a complete grant application including:
1. Executive Summary (2 paragraphs)
2. Project Description / Statement of Need
3. Goals and Objectives
4. Implementation Plan
5. Budget narrative
6. Organizational capacity statement
7. Conclusion

Make it compelling, professional, and ready to submit.`
      }
    ],
    max_tokens: 2500,
  });

  const content = application.choices[0].message.content;
  log('grant_application_ready', 'success', 'Full grant application drafted');

  return {
    success: true,
    message: `Complete grant application drafted for "${opp.title}". Submit at ${opp.url}`,
    deliverable: content,
    needs_manual_action: true,
    reason: null,
  };
}

async function executeDigitalProduct(opp, identity, log) {
  log('digital_product', 'running', 'Creating digital product outline and content');

  const product = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are ${identity.name}, a professional content creator and digital product developer.` },
      {
        role: 'user',
        content: `Digital product opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}
URL: ${opp.url}

Create the complete digital product:
1. Product title and description optimized for the platform
2. Complete content/template/pages (whichever applies)
3. Metadata: keywords, categories, tags
4. Pricing recommendation
5. Step-by-step upload instructions for ${opp.platform}

Make it publication-ready.`
      }
    ],
    max_tokens: 2000,
  });

  const content = product.choices[0].message.content;
  log('digital_product_ready', 'success', 'Digital product content created');

  return {
    success: true,
    message: `Digital product created for "${opp.title}". Upload to ${opp.url} using the provided content and instructions.`,
    deliverable: content,
    needs_manual_action: true,
    reason: null,
  };
}

async function generateCoverLetter(opp, identity) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You are ${identity.name}, ${identity.role_label || 'professional'}. Tone: ${identity.communication_tone || 'professional'}` },
      {
        role: 'user',
        content: `Write a concise, professional cover letter/proposal for this opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}

Keep it under 200 words. Focus on value delivery and relevant experience. End with a clear call to action.`
      }
    ],
    max_tokens: 400,
  });
  return res.choices[0].message.content;
}

async function generateProposal(base44, payload) {
  const { opportunity_id, identity_id, custom_instructions } = payload;

  const opps = await base44.entities.Opportunity.filter({ id: opportunity_id }, null, 1);
  const opp = opps?.[0];
  if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

  let identity = null;
  if (identity_id) {
    const ids = await base44.entities.AIIdentity.filter({ id: identity_id }, null, 1);
    identity = ids?.[0];
  }
  if (!identity) {
    const ids = await base44.entities.AIIdentity.filter({ is_active: true }, null, 1);
    identity = ids?.[0];
  }

  const proposal = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are ${identity?.name || 'a professional'}. 
Skills: ${(identity?.skills || []).join(', ')}
Bio: ${identity?.bio || ''}
Tone: ${identity?.communication_tone || 'professional'}`
      },
      {
        role: 'user',
        content: `Write a winning proposal/application for:

Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}
Category: ${opp.category}
Value: $${opp.profit_estimate_low}-$${opp.profit_estimate_high}
${custom_instructions ? `\nExtra instructions: ${custom_instructions}` : ''}

Write a complete, compelling proposal ready to submit. Include why you're the right choice, your approach, timeline, and pricing.`
      }
    ],
    max_tokens: 800,
  });

  return Response.json({
    success: true,
    proposal: proposal.choices[0].message.content,
    opportunity_id,
    identity_name: identity?.name,
  });
}

async function generateContent(base44, payload) {
  const { prompt, type, context, max_tokens } = payload;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `You are a professional ${type || 'content creator'}. Produce high-quality, real, usable content.` },
      { role: 'user', content: `${context ? `Context: ${context}\n\n` : ''}${prompt}` }
    ],
    max_tokens: max_tokens || 1000,
  });

  return Response.json({
    success: true,
    content: completion.choices[0].message.content,
    type,
  });
}

async function executeNextTask(base44) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter({ status: 'queued' }, '-priority', 10);
  if (!tasks.length) return Response.json({ success: true, message: 'No tasks in queue' });

  tasks.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return new Date(a.queue_timestamp) - new Date(b.queue_timestamp);
  });

  const task = tasks[0];
  return await executeTask(base44, {
    task_id: task.id,
    opportunity_id: task.opportunity_id,
    url: task.url,
    identity_id: task.identity_id,
    platform: task.platform,
  });
}

async function queueTask(base44, payload) {
  const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
    ...payload,
    status: 'queued',
    queue_timestamp: new Date().toISOString(),
    max_retries: 2,
    execution_log: [{ timestamp: new Date().toISOString(), step: 'queued', status: 'pending', details: `Queued for: ${payload.url}` }]
  });

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `📋 Task queued: ${payload.opportunity_type} (${payload.platform})`,
    severity: 'info',
    metadata: { task_id: task.id },
  });

  return Response.json({ success: true, task });
}

async function batchQueueTasks(base44, payload) {
  const { opportunities } = payload;
  const queued = [];
  for (const opp of (opportunities || [])) {
    const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
      url: opp.url,
      opportunity_id: opp.id,
      opportunity_type: opp.opportunity_type || 'other',
      platform: opp.platform,
      identity_id: opp.identity_id || '',
      priority: opp.overall_score || 50,
      estimated_value: opp.profit_estimate_high || 0,
      deadline: opp.deadline,
      status: 'queued',
      queue_timestamp: new Date().toISOString(),
    });
    queued.push(task);
  }
  return Response.json({ success: true, queued: queued.length, tasks: queued });
}

async function getStats(base44) {
  const allTasks = await base44.asServiceRole.entities.TaskExecutionQueue.list('-completion_timestamp', 200);
  const stats = {
    total: allTasks.length,
    by_status: {},
    success_rate: 0,
    total_value_attempted: 0,
  };
  let successCount = 0;
  allTasks.forEach(t => {
    stats.by_status[t.status] = (stats.by_status[t.status] || 0) + 1;
    stats.total_value_attempted += t.estimated_value || 0;
    if (t.status === 'completed' && t.submission_success) successCount++;
  });
  stats.success_rate = allTasks.length > 0 ? Math.round((successCount / allTasks.length) * 100) : 0;
  return Response.json({ success: true, stats });
}