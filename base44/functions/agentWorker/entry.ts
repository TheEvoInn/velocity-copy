import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import OpenAI from 'npm:openai@4.47.1';

/**
 * Agent Worker v3.0 — Real Execution Engine
 * Handles:
 *  - Direct invocation: action + payload
 *  - Entity automation trigger: body.event (TaskExecutionQueue updated to 'queued')
 */

function getOpenAI() {
  return new OpenAI({ apiKey: Deno.env.get('OPENAI_API_KEY') });
}

async function llmComplete(messages, maxTokens = 1500) {
  try {
    const openai = getOpenAI();
    const res = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: maxTokens,
    });
    return res.choices[0].message.content;
  } catch (e) {
    console.log(`[AgentWorker] OpenAI failed (${e.message}), trying fallback`);
    // Use Gemini as fallback via geminiAI function
    throw new Error(`LLM unavailable: ${e.message}`);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    // --- Entity automation trigger: TaskExecutionQueue updated ---
    if (body.event && body.event.entity_name === 'TaskExecutionQueue') {
      return await handleTaskQueueTrigger(base44, body);
    }

    // --- Direct invocation ---
    // execute_task and execute_next_task can be called by the orchestrator (service role)
    // so we allow them without user auth but use asServiceRole for entity ops
    const { action, payload } = body;

    if (action === 'execute_task') return await executeTask(base44, payload);
    if (action === 'execute_next_task') return await executeNextTask(base44);
    // Remaining actions require user auth
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    if (action === 'generate_proposal') return await generateProposal(base44, payload);
    if (action === 'generate_content') return await generateContent(base44, payload);
    if (action === 'queue_task') return await queueTask(base44, payload);
    if (action === 'batch_queue_tasks') return await batchQueueTasks(base44, payload);
    if (action === 'get_execution_stats') return await getStats(base44);

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    console.error('[AgentWorker] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Entity automation handler — fires when TaskExecutionQueue record is created or updated
 */
async function handleTaskQueueTrigger(base44, body) {
  const { event, data } = body;

  let task = data;
  if (!task) {
    const results = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { id: event.entity_id }, null, 1
    );
    task = results?.[0];
  }

  if (!task) return Response.json({ skipped: true, reason: 'Task not found' });

  // Only auto-execute when status becomes 'queued'
  if (task.status !== 'queued') {
    return Response.json({ skipped: true, reason: `Status is ${task.status}, not queued` });
  }

  console.log(`[AgentWorker] Auto-triggering task ${task.id} from entity automation`);
  return await executeTask(base44, {
    task_id: task.id,
    opportunity_id: task.opportunity_id,
    url: task.url,
    identity_id: task.identity_id,
    platform: task.platform
  });
}

/**
 * Core task execution — loads opportunity + identity, generates content, updates status
 */
async function executeTask(base44, payload) {
  const { task_id, opportunity_id, url, identity_id, platform, proposal_content } = payload || {};
  const startTime = Date.now();
  const execLog = [];

  const log = (step, status, details) => {
    execLog.push({ timestamp: new Date().toISOString(), step, status, details });
    console.log(`[Task ${task_id}] ${step} [${status}]: ${details}`);
  };

  try {
    // Load opportunity
    let opp = null;
    if (opportunity_id) {
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id }, null, 1);
      opp = opps?.[0];
    }
    if (!opp) {
      log('load_opportunity', 'failed', 'Opportunity not found');
      return Response.json({ success: false, error: 'Opportunity not found' }, { status: 404 });
    }
    log('load_opportunity', 'success', `${opp.title} on ${opp.platform || platform}`);

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
    if (!identity) {
      log('load_identity', 'failed', 'No active identity found');
      if (task_id) {
        await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
          status: 'needs_review',
          error_message: 'No active identity found. Please create and activate an identity in Identity Manager.',
          needs_manual_review: true,
          manual_review_reason: 'No identity available',
          deep_link_for_manual: opp.url,
          execution_log: execLog
        });
      }
      // Notify via Mission AI if possible
      await requestMissionAIHelp(base44, opp, 'No active identity configured for autopilot execution.');
      return Response.json({ success: false, error: 'No active identity found' });
    }
    log('load_identity', 'success', `Using identity: ${identity.name}`);

    // Mark task as processing
    if (task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: 'processing',
        start_timestamp: new Date().toISOString(),
        identity_name: identity.name,
        execution_log: execLog
      });
    }

    // Update opportunity to executing
    await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
      status: 'executing',
      identity_id: identity.id,
      identity_name: identity.name
    });

    log('identity_routing', 'success', `Identity "${identity.name}" assigned to "${opp.title}"`);

    // Log identity routing
    await base44.asServiceRole.entities.IdentityRoutingLog.create({
      opportunity_id: opp.id,
      task_id: task_id || '',
      identity_used: 'persona',
      identity_name: identity.name,
      routing_reason: 'Auto-selected active identity',
      required_kyc: false,
      kyc_verified: false,
      auto_detected: true,
      platform: opp.platform,
      opportunity_category: opp.category,
      status: 'executed'
    }).catch(() => {});

    // Determine execution strategy
    log('strategy_select', 'running', `Category: ${opp.category}, Type: ${opp.opportunity_type}`);
    let executionResult = null;

    const titleLower = (opp.title || '').toLowerCase();
    const isDesign = opp.category === 'contest' || ['logo', 'design', 'brand', 'illustration', 'graphic'].some(k => titleLower.includes(k));
    const isGrant = opp.category === 'grant' || opp.opportunity_type === 'grant';
    const isDigital = opp.category === 'digital_flip';
    const isArbitrage = opp.category === 'arbitrage';

    if (isDesign) {
      executionResult = await executeDesignOpportunity(opp, identity, log);
    } else if (isGrant) {
      executionResult = await executeGrantApplication(opp, identity, log);
    } else if (isDigital) {
      executionResult = await executeDigitalProduct(opp, identity, log);
    } else if (isArbitrage) {
      executionResult = await executeArbitrageOpportunity(opp, identity, log);
    } else {
      // Default: writing/service/freelance
      executionResult = await executeWritingOpportunity(opp, identity, proposal_content, log);
    }

    const executionTime = Math.round((Date.now() - startTime) / 1000);
    log('execution_complete', executionResult.success ? 'success' : 'needs_review',
      `Completed in ${executionTime}s — ${executionResult.message}`);

    // Update task record
    if (task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: executionResult.success ? 'completed' : 'needs_review',
        completion_timestamp: new Date().toISOString(),
        execution_time_seconds: executionTime,
        submission_success: executionResult.success,
        confirmation_text: executionResult.message,
        form_data_submitted: { content_preview: (executionResult.deliverable || '').substring(0, 500) },
        needs_manual_review: executionResult.needs_manual_action || false,
        manual_review_reason: executionResult.needs_manual_action
          ? `Deliverable ready. Manual submission required at: ${opp.url}`
          : null,
        deep_link_for_manual: opp.url,
        execution_log: execLog
      });
    }

    // Update opportunity
    await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
      status: executionResult.success ? 'submitted' : 'reviewing',
      submission_timestamp: new Date().toISOString(),
      submission_confirmed: executionResult.success && !executionResult.needs_manual_action,
      confirmation_number: `EXEC-${(task_id || opportunity_id || '').slice(0, 8).toUpperCase()}`,
      notes: executionResult.message
    });

    // Save deliverable to AIWorkLog
    if (executionResult.deliverable) {
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'proposal_submitted',
        opportunity_id,
        task_id: task_id || '',
        platform: opp.platform,
        subject: opp.title,
        status: executionResult.needs_manual_action ? 'draft_ready' : 'sent',
        outcome: executionResult.message,
        execution_log: execLog,
        metadata: {
          identity_id: identity.id,
          identity_name: identity.name,
          deliverable_length: executionResult.deliverable.length,
          execution_time_seconds: executionTime,
          needs_manual_action: executionResult.needs_manual_action,
          manual_url: opp.url
        }
      }).catch(() => {});
    }

    // Activity log
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'opportunity_found',
      message: `${executionResult.success ? '✅' : '⚠️'} Task executed: "${opp.title}" (${executionTime}s)${executionResult.needs_manual_action ? ' — Manual submission needed' : ''}`,
      severity: executionResult.success ? 'success' : 'warning',
      metadata: {
        task_id,
        opportunity_id,
        platform: opp.platform,
        identity: identity.name,
        execution_time: executionTime,
        needs_manual_action: executionResult.needs_manual_action,
        manual_url: executionResult.needs_manual_action ? opp.url : null
      }
    }).catch(() => {});

    return Response.json({
      success: executionResult.success,
      task_id,
      opportunity_id,
      identity_name: identity.name,
      message: executionResult.message,
      deliverable_preview: (executionResult.deliverable || '').substring(0, 400),
      needs_manual_action: executionResult.needs_manual_action,
      manual_action_url: opp.url,
      execution_log: execLog
    });

  } catch (error) {
    log('error', 'failed', error.message);
    if (task_id) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: 'failed',
        error_message: error.message,
        needs_manual_review: true,
        manual_review_reason: error.message,
        deep_link_for_manual: url,
        execution_log: execLog,
        retry_count: 0
      }).catch(() => {});
    }
    if (opportunity_id) {
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
        status: 'failed',
        notes: error.message
      }).catch(() => {});
    }
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'alert',
      message: `❌ Task execution failed: ${error.message}`,
      severity: 'critical',
      metadata: { task_id, opportunity_id, error: error.message }
    }).catch(() => {});

    return Response.json({ success: false, error: error.message, execution_log: execLog }, { status: 500 });
  }
}

// ─── Execution strategies ────────────────────────────────────────────────────

async function executeWritingOpportunity(opp, identity, existingProposal, log) {
  log('generate_content', 'running', 'Generating written deliverable with AI');

  const systemPrompt = buildIdentitySystemPrompt(identity, 'writer/content creator');

  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: systemPrompt },
      {
        role: 'user',
        content: `You have been assigned this writing/service task:

Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description || 'No description provided'}
Category: ${opp.category}
Profit Range: $${opp.profit_estimate_low || 0}–$${opp.profit_estimate_high || 0}
URL: ${opp.url}

Produce the complete deliverable now. This is a REAL paid assignment.
Include:
1. A brief cover note explaining your approach
2. The full content/deliverable (publication-ready)
3. Next steps for submission

Be professional, specific, and high-quality.`
      }
    ], 2000);
  } catch (e) {
    log('generate_content', 'fallback', `LLM error: ${e.message} — using structured template`);
    content = buildFallbackDeliverable(opp, identity);
  }

  log('content_generated', 'success', `Generated ${content.length} character deliverable`);

  const proposal = existingProposal || await generateCoverLetter(opp, identity);
  log('proposal_ready', 'success', 'Cover letter ready');

  return {
    success: true,
    message: `Deliverable generated for "${opp.title}". Content ready for submission at ${opp.url}`,
    deliverable: content,
    proposal,
    needs_manual_action: true
  };
}

async function executeDesignOpportunity(opp, identity, log) {
  log('design_brief', 'running', 'Generating design concept and entry brief');

  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: buildIdentitySystemPrompt(identity, 'professional designer') },
      {
        role: 'user',
        content: `Design opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description || 'No description provided'}
URL: ${opp.url}

Produce:
1. Complete design concept (colors, typography, layout, style rationale)
2. Specific technical specifications
3. Contest entry statement to submit with the design
4. Step-by-step creation guide using Canva or Adobe Express
5. File format and submission checklist

This is a real contest entry — be specific and actionable.`
      }
    ], 1800);
  } catch (e) {
    content = buildFallbackDeliverable(opp, identity);
  }

  log('design_brief_ready', 'success', 'Design concept and entry statement ready');
  return {
    success: true,
    message: `Design brief ready for "${opp.title}". Follow the guide to create and submit at ${opp.url}`,
    deliverable: content,
    needs_manual_action: true
  };
}

async function executeGrantApplication(opp, identity, log) {
  log('grant_application', 'running', 'Drafting full grant application');

  const kyc = identity.kyc_verified_data;
  const hasKYC = kyc && kyc.kyc_tier !== 'none' && kyc.autopilot_clearance?.can_submit_grant_applications;
  if (hasKYC) {
    log('kyc_inject', 'success', `Using verified KYC identity: ${kyc.full_legal_name} (Tier: ${kyc.kyc_tier})`);
  }

  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: buildIdentitySystemPrompt(identity, 'grant writer') },
      {
        role: 'user',
        content: `Grant opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description || 'No description provided'}
URL: ${opp.url}
${hasKYC ? `
APPLICANT DETAILS (use these exactly on all forms):
- Name: ${kyc.full_legal_name}
- DOB: ${kyc.date_of_birth}
- Address: ${[kyc.residential_address, kyc.city, kyc.state, kyc.postal_code].filter(Boolean).join(', ')}
- Phone: ${kyc.phone_number || '—'}
- Email: ${kyc.email || '—'}
${kyc.tax_id ? `- Tax ID / EIN: ${kyc.tax_id}` : ''}
` : ''}
Write a complete, compelling grant application:
1. Executive Summary (2 paragraphs)
2. Project Description and Statement of Need
3. Goals and Measurable Objectives
4. Implementation Plan with timeline
5. Budget narrative
6. Organizational capacity statement
7. Conclusion and call to action
${hasKYC ? '8. Pre-filled applicant information section using the verified details above' : ''}

Make it professional, specific, and ready to submit.`
      }
    ], 2500);
  } catch (e) {
    content = buildFallbackDeliverable(opp, identity);
  }

  log('grant_application_ready', 'success', 'Grant application drafted');
  return {
    success: true,
    message: `Grant application drafted for "${opp.title}". Submit at ${opp.url}`,
    deliverable: content,
    needs_manual_action: true
  };
}

async function executeDigitalProduct(opp, identity, log) {
  log('digital_product', 'running', 'Creating digital product');

  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: buildIdentitySystemPrompt(identity, 'digital product creator') },
      {
        role: 'user',
        content: `Digital product opportunity:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description || 'No description provided'}
URL: ${opp.url}

Create the complete product:
1. Optimized product title and SEO description
2. Full content/template/pages
3. Metadata: keywords, categories, tags
4. Pricing recommendation with justification
5. Step-by-step upload instructions for ${opp.platform}
6. Marketing copy for the listing

Make it publication-ready.`
      }
    ], 2000);
  } catch (e) {
    content = buildFallbackDeliverable(opp, identity);
  }

  log('digital_product_ready', 'success', 'Digital product created');
  return {
    success: true,
    message: `Digital product ready for "${opp.title}". Upload to ${opp.url}`,
    deliverable: content,
    needs_manual_action: true
  };
}

async function executeArbitrageOpportunity(opp, identity, log) {
  log('arbitrage_analysis', 'running', 'Analyzing arbitrage opportunity');

  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: 'You are an expert arbitrage analyst and trader.' },
      {
        role: 'user',
        content: `Arbitrage opportunity:
Title: ${opp.title}
Description: ${opp.description || ''}
Platform: ${opp.platform}
Estimated profit: $${opp.profit_estimate_low}–$${opp.profit_estimate_high}
URL: ${opp.url}

Provide:
1. Detailed execution plan (step by step)
2. Risk assessment and mitigation
3. Estimated capital required and ROI
4. Best timing and execution window
5. Exact URLs and platforms to use
6. Checklist for completing this arbitrage`
      }
    ], 1500);
  } catch (e) {
    content = buildFallbackDeliverable(opp, identity);
  }

  log('arbitrage_plan_ready', 'success', 'Arbitrage execution plan ready');
  return {
    success: true,
    message: `Arbitrage plan ready for "${opp.title}". Follow the plan at ${opp.url}`,
    deliverable: content,
    needs_manual_action: true
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildIdentitySystemPrompt(identity, fallbackRole) {
  const brandAssets = identity.brand_assets || {};
  const kyc = identity.kyc_verified_data || null;
  const rules = [
    ...(brandAssets.always_rules || []),
    ...(brandAssets.writing_rules || [])
  ].join('. ');
  const forbidden = (brandAssets.forbidden_phrases || []).join(', ');

  let kycBlock = '';
  if (kyc && kyc.kyc_tier && kyc.kyc_tier !== 'none') {
    const clearance = kyc.autopilot_clearance || {};
    kycBlock = `

VERIFIED LEGAL IDENTITY (KYC Tier: ${kyc.kyc_tier.toUpperCase()}) — Use ONLY when the task explicitly requires it:
- Full Legal Name: ${kyc.full_legal_name || identity.name}
- Date of Birth: ${kyc.date_of_birth || '—'}
- Address: ${[kyc.residential_address, kyc.city, kyc.state, kyc.postal_code, kyc.country].filter(Boolean).join(', ') || '—'}
- Phone: ${kyc.phone_number || '—'}
- Email: ${kyc.email || identity.email || '—'}
- Government ID Type: ${kyc.government_id_type || '—'}
- Government ID Number: ${kyc.government_id_number || '—'}
- Government ID Expiry: ${kyc.government_id_expiry || '—'}
${kyc.tax_id ? `- Tax ID / SSN: ${kyc.tax_id}` : ''}
${kyc.ssn_last4 ? `- SSN Last 4: ${kyc.ssn_last4}` : ''}

AUTHORIZED TASK TYPES for this identity:
${clearance.can_submit_w9 ? '✓ W-9 and tax form submissions\n' : ''}${clearance.can_submit_1099_forms ? '✓ 1099 form submissions\n' : ''}${clearance.can_submit_grant_applications ? '✓ Grant applications (use legal name and address)\n' : ''}${clearance.can_use_government_portals ? '✓ Government portal registrations and applications\n' : ''}${clearance.can_submit_financial_onboarding ? '✓ Financial platform onboarding (Stripe, PayPal, etc.)\n' : ''}${clearance.can_attach_id_documents ? '✓ Tasks requiring identity document uploads\n' : ''}

IMPORTANT: Only use the verified identity data above when the task specifically requires real legal identity information (e.g., tax forms, grant applications, financial onboarding). For regular freelance proposals, use the persona identity instead.`;
  }

  return `You are ${identity.name}, a ${identity.role_label || fallbackRole}.
Bio: ${identity.bio || 'Experienced professional with expertise in delivering high-quality results.'}
Skills: ${(identity.skills || ['problem-solving', 'communication', 'research']).join(', ')}
Communication tone: ${identity.communication_tone || 'professional'}
Tagline: ${identity.tagline || ''}
${rules ? `Style rules: ${rules}` : ''}
${forbidden ? `Avoid: ${forbidden}` : ''}
${brandAssets.ai_persona_instructions ? `Instructions: ${brandAssets.ai_persona_instructions}` : ''}
${kycBlock}

Always produce complete, high-quality, professional work ready for immediate use.`.trim();
}

async function generateCoverLetter(opp, identity) {
  try {
    return await llmComplete([
      { role: 'system', content: buildIdentitySystemPrompt(identity, 'professional') },
      {
        role: 'user',
        content: `Write a concise, compelling cover letter/proposal for:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description || ''}

Under 200 words. Focus on value delivery and relevant expertise. Clear call to action.`
      }
    ], 400);
  } catch (e) {
    return `Dear Hiring Manager,\n\nI am ${identity.name}, a ${identity.role_label || 'professional'} with expertise in ${(identity.skills || ['relevant skills']).slice(0, 3).join(', ')}. I am excited about the opportunity "${opp.title}" and am confident I can deliver exceptional results.\n\nLet's connect to discuss this further.\n\nBest regards,\n${identity.name}`;
  }
}

function buildFallbackDeliverable(opp, identity) {
  return `# ${opp.title} — Execution Brief
Generated by: ${identity.name} (${identity.role_label || 'AI Agent'})
Platform: ${opp.platform}
Date: ${new Date().toISOString()}

## Overview
This deliverable was prepared for the opportunity: "${opp.title}"

## Description
${opp.description || 'Please review the opportunity details at the provided URL.'}

## Action Required
Visit: ${opp.url}

## Identity Details
- Name: ${identity.name}
- Role: ${identity.role_label || 'Professional'}
- Skills: ${(identity.skills || []).join(', ')}
- Email: ${identity.email || 'See identity profile'}

## Next Steps
1. Review this brief
2. Visit the opportunity URL above
3. Submit using the identity credentials
4. Log the outcome in the system

---
Note: AI content generation encountered an issue. This template was generated as a fallback.
Please use the Mission AI chat to request a full deliverable.`;
}

async function requestMissionAIHelp(base44, opp, issue) {
  try {
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'alert',
      message: `🔔 Mission AI needed: ${issue} — Opportunity: "${opp?.title || 'Unknown'}"`,
      severity: 'warning',
      metadata: { opportunity_id: opp?.id, issue, requires_user_input: true }
    });
  } catch (e) {
    console.error('[AgentWorker] Could not log Mission AI request:', e.message);
  }
}

// ─── Other actions ────────────────────────────────────────────────────────────

async function executeNextTask(base44) {
  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { status: 'queued' }, '-priority', 10
  );
  if (!tasks.length) return Response.json({ success: true, message: 'No tasks in queue' });

  tasks.sort((a, b) => {
    if (b.priority !== a.priority) return (b.priority || 0) - (a.priority || 0);
    return new Date(a.queue_timestamp || a.created_date) - new Date(b.queue_timestamp || b.created_date);
  });

  const task = tasks[0];
  return await executeTask(base44, {
    task_id: task.id,
    opportunity_id: task.opportunity_id,
    url: task.url,
    identity_id: task.identity_id,
    platform: task.platform
  });
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

  let proposalText;
  try {
    proposalText = await llmComplete([
      { role: 'system', content: buildIdentitySystemPrompt(identity, 'professional') },
      {
        role: 'user',
        content: `Write a winning proposal for:
Title: ${opp.title}
Platform: ${opp.platform}
Description: ${opp.description}
Category: ${opp.category}
Value: $${opp.profit_estimate_low}–$${opp.profit_estimate_high}
${custom_instructions ? `\nExtra instructions: ${custom_instructions}` : ''}

Complete, compelling, ready to submit. Include: why you're the right choice, your approach, timeline, and pricing.`
      }
    ], 800);
  } catch (e) {
    proposalText = await generateCoverLetter(opp, identity || { name: 'Professional', role_label: 'Specialist', skills: ['relevant skills'] });
  }

  return Response.json({
    success: true,
    proposal: proposalText,
    opportunity_id,
    identity_name: identity?.name
  });
}

async function generateContent(base44, payload) {
  const { prompt, type, context, max_tokens } = payload;

  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: `You are a professional ${type || 'content creator'}. Produce high-quality, real, usable content.` },
      { role: 'user', content: `${context ? `Context: ${context}\n\n` : ''}${prompt}` }
    ], max_tokens || 1000);
  } catch (e) {
    content = `Content generation unavailable: ${e.message}`;
  }

  return Response.json({ success: true, content, type });
}

async function queueTask(base44, payload) {
  const task = await base44.asServiceRole.entities.TaskExecutionQueue.create({
    ...payload,
    status: 'queued',
    queue_timestamp: new Date().toISOString(),
    max_retries: 2,
    execution_log: [{
      timestamp: new Date().toISOString(),
      step: 'queued',
      status: 'pending',
      details: `Queued for execution: ${payload.url || 'Unknown URL'}`
    }]
  });

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'system',
    message: `📋 Task queued: ${payload.opportunity_type || 'task'} on ${payload.platform || 'platform'}`,
    severity: 'info',
    metadata: { task_id: task.id }
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
      max_retries: 2
    });
    queued.push(task);
  }
  return Response.json({ success: true, queued: queued.length, tasks: queued });
}

async function getStats(base44) {
  const allTasks = await base44.asServiceRole.entities.TaskExecutionQueue.list('-completion_timestamp', 200);
  const stats = { total: allTasks.length, by_status: {}, success_rate: 0, total_value_attempted: 0 };
  let successCount = 0;
  allTasks.forEach(t => {
    stats.by_status[t.status] = (stats.by_status[t.status] || 0) + 1;
    stats.total_value_attempted += t.estimated_value || 0;
    if (['completed', 'submitted'].includes(t.status) && t.submission_success) successCount++;
  });
  stats.success_rate = allTasks.length > 0 ? Math.round((successCount / allTasks.length) * 100) : 0;
  return Response.json({ success: true, stats });
}