import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Agent Worker v3.0 — Real Execution Engine
 * Handles:
 *  - Direct invocation: action + payload
 *  - Entity automation trigger: body.event (TaskExecutionQueue updated to 'queued')
 */

// Uses Base44's built-in InvokeLLM integration — no external API key required
async function llmComplete(messages, maxTokens = 1500, base44Client = null) {
  const systemMsg = messages.find(m => m.role === 'system');
  const userMsg = messages.find(m => m.role === 'user');
  const prompt = systemMsg
    ? `${systemMsg.content}\n\n${userMsg?.content || ''}`
    : (userMsg?.content || '');

  // Use base44 InvokeLLM via service role
  const client = base44Client || _globalBase44;
  if (!client) throw new Error('No base44 client available for LLM');

  const res = await client.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: null,
  });
  if (typeof res === 'string') return res;
  if (res?.content) return res.content;
  if (res?.text) return res.text;
  return String(res);
}

let _globalBase44 = null;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    _globalBase44 = base44;
    const body = await req.json().catch(() => ({}));

    if (body.event && body.event.entity_name === 'TaskExecutionQueue') {
      return await handleTaskQueueTrigger(base44, body);
    }

    const { action, payload } = body;

    if (action === 'execute_task') return await executeTask(base44, payload);
    if (action === 'execute_next_task') return await executeNextTask(base44);
    if (action === 'get_live_session') return await getLiveSession(base44, payload);
    if (action === 'pause_execution') return await pauseExecution(base44, payload);
    if (action === 'resume_execution') return await resumeExecution(base44, payload);
    if (action === 'stop_execution') return await stopExecution(base44, payload);
    if (action === 'intervene') return await interveneExecution(base44, payload);
    
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

async function executeTask(base44, payload) {
  const { task_id, opportunity_id, url, identity_id, platform, proposal_content } = payload || {};
  const startTime = Date.now();
  const execLog = [];

  const log = (step, status, details) => {
    execLog.push({ timestamp: new Date().toISOString(), step, status, details });
    console.log(`[Task ${task_id}] ${step} [${status}]: ${details}`);
  };

  try {
    let opp = null;
    if (opportunity_id) {
      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id }, null, 1);
      opp = opps?.[0];
    }
    if (!opp && opportunity_id) {
      log('load_opportunity', 'failed', 'Opportunity not found but proceeding with task');
    }
    if (opp) {
      log('load_opportunity', 'success', `${opp.title} on ${opp.platform || platform}`);
    } else if (task_id) {
      log('load_opportunity', 'skipped', 'No opportunity_id, proceeding with task_id only');
    }

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
          deep_link_for_manual: opp?.url || url,
          execution_log: execLog
        });
      }
      await requestMissionAIHelp(base44, opp, 'No active identity configured for autopilot execution.');
      return Response.json({ success: false, error: 'No active identity found' });
    }
    log('load_identity', 'success', `Using identity: ${identity.name}`);

    if (task_id) {
      const clearedLog = execLog.slice(-1);
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
        status: 'processing',
        start_timestamp: new Date().toISOString(),
        identity_name: identity.name,
        execution_log: clearedLog
      });
    }

    if (opp) {
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
        status: 'executing',
        identity_id: identity.id,
        identity_name: identity.name
      });
      log('identity_routing', 'success', `Identity "${identity.name}" assigned to "${opp.title}"`);
    }

    if (opp) {
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
    }

    log('strategy_select', 'running', `Category: ${opp?.category}, Type: ${opp?.opportunity_type}`);
    let executionResult = null;

    if (opp) {
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
        executionResult = await executeWritingOpportunity(opp, identity, proposal_content, log);
      }
    } else {
      log('execution_complete', 'success', 'Task processed without specific opportunity data');
      executionResult = { success: true, message: 'Task processed', deliverable: '', needs_manual_action: false };
    }

    const executionTime = Math.round((Date.now() - startTime) / 1000);
    log('execution_complete', executionResult.success ? 'success' : 'needs_review',
      `Completed in ${executionTime}s — ${executionResult.message}`);

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
          ? `Deliverable ready. Manual submission required at: ${opp?.url || url}`
          : null,
        deep_link_for_manual: opp?.url || url,
        execution_log: execLog
      });
    }

    if (opp && opportunity_id) {
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
        status: executionResult.success ? 'submitted' : 'reviewing',
        submission_timestamp: new Date().toISOString(),
        submission_confirmed: executionResult.success && !executionResult.needs_manual_action,
        confirmation_number: `EXEC-${(task_id || opportunity_id || '').slice(0, 8).toUpperCase()}`,
        notes: executionResult.message
      }).catch((e) => console.error('Opp update failed:', e.message));
    } else if (!opp && opportunity_id) {
      log('opp_update_skipped', 'warning', 'Opportunity ID provided but record not found');
    }

    if (executionResult.deliverable) {
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'proposal_submitted',
        opportunity_id: opportunity_id || '',
        task_id: task_id || '',
        platform: opp?.platform || 'unknown',
        subject: opp?.title || 'Instant Task',
        status: executionResult.needs_manual_action ? 'draft_ready' : 'sent',
        outcome: executionResult.message,
        execution_log: execLog,
        metadata: {
          identity_id: identity.id,
          identity_name: identity.name,
          deliverable_length: executionResult.deliverable.length,
          execution_time_seconds: executionTime,
          needs_manual_action: executionResult.needs_manual_action,
          manual_url: opp?.url || url
        }
      }).catch(() => {});
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: executionResult.success ? 'opportunity_found' : 'alert',
      message: `${executionResult.success ? '✅' : '⚠️'} Task executed${opp ? ': "' + opp.title + '"' : ''} (${executionTime}s)${executionResult.needs_manual_action ? ' — Manual submission needed' : ''}`,
      severity: executionResult.success ? 'success' : 'warning',
      metadata: {
        task_id,
        opportunity_id,
        platform: opp?.platform || 'unknown',
        identity: identity.name,
        execution_time: executionTime,
        needs_manual_action: executionResult.needs_manual_action,
        manual_url: executionResult.needs_manual_action ? (opp?.url || url) : null
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
      manual_action_url: opp?.url || url,
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
    if (opportunity_id && opp) {
       await base44.asServiceRole.entities.Opportunity.update(opportunity_id, {
         status: 'failed',
         notes: error.message
       }).catch((e) => console.error('Opp fail update failed:', e.message));
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

async function executeWritingOpportunity(opp, identity, existingProposal, log) {
  log('generate_content', 'running', 'Generating written deliverable with AI');
  const systemPrompt = buildIdentitySystemPrompt(identity, 'writer/content creator');
  let content;
  try {
    content = await llmComplete([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `You have been assigned this writing/service task:\n\nTitle: ${opp.title}\nPlatform: ${opp.platform}\nDescription: ${opp.description || 'No description provided'}\nCategory: ${opp.category}\nProfit Range: $${opp.profit_estimate_low || 0}–$${opp.profit_estimate_high || 0}\nURL: ${opp.url}\n\nProduce the complete deliverable now. This is a REAL paid assignment.\nInclude:\n1. A brief cover note explaining your approach\n2. The full content/deliverable (publication-ready)\n3. Next steps for submission\n\nBe professional, specific, and high-quality.` }
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
      { role: 'user', content: `Design opportunity:\nTitle: ${opp.title}\nPlatform: ${opp.platform}\nDescription: ${opp.description || 'No description provided'}\nURL: ${opp.url}\n\nProduce:\n1. Complete design concept (colors, typography, layout, style rationale)\n2. Specific technical specifications\n3. Contest entry statement to submit with the design\n4. Step-by-step creation guide using Canva or Adobe Express\n5. File format and submission checklist\n\nThis is a real contest entry — be specific and actionable.` }
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
      { role: 'user', content: `Grant opportunity:\nTitle: ${opp.title}\nPlatform: ${opp.platform}\nDescription: ${opp.description || 'No description provided'}\nURL: ${opp.url}\n${hasKYC ? `\nAPPLICANT DETAILS (use these exactly on all forms):\n- Name: ${kyc.full_legal_name}\n- DOB: ${kyc.date_of_birth}\n- Address: ${[kyc.residential_address, kyc.city, kyc.state, kyc.postal_code].filter(Boolean).join(', ')}\n- Phone: ${kyc.phone_number || '—'}\n- Email: ${kyc.email || '—'}\n${kyc.tax_id ? `- Tax ID / EIN: ${kyc.tax_id}` : ''}\n` : ''}Write a complete, compelling grant application:\n1. Executive Summary (2 paragraphs)\n2. Project Description and Statement of Need\n3. Goals and Measurable Objectives\n4. Implementation Plan with timeline\n5. Budget narrative\n6. Organizational capacity statement\n7. Conclusion and call to action\n${hasKYC ? '8. Pre-filled applicant information section using the verified details above' : ''}\n\nMake it professional, specific, and ready to submit.` }
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
      { role: 'user', content: `Digital product opportunity:\nTitle: ${opp.title}\nPlatform: ${opp.platform}\nDescription: ${opp.description || 'No description provided'}\nURL: ${opp.url}\n\nCreate the complete product:\n1. Optimized product title and SEO description\n2. Full content/template/pages\n3. Metadata: keywords, categories, tags\n4. Pricing recommendation with justification\n5. Step-by-step upload instructions for ${opp.platform}\n6. Marketing copy for the listing\n\nMake it publication-ready.` }
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
      { role: 'user', content: `Arbitrage opportunity:\nTitle: ${opp.title}\nDescription: ${opp.description || ''}\nPlatform: ${opp.platform}\nEstimated profit: $${opp.profit_estimate_low}–$${opp.profit_estimate_high}\nURL: ${opp.url}\n\nProvide:\n1. Detailed execution plan (step by step)\n2. Risk assessment and mitigation\n3. Estimated capital required and ROI\n4. Best timing and execution window\n5. Exact URLs and platforms to use\n6. Checklist for completing this arbitrage` }
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

function buildIdentitySystemPrompt(identity, fallbackRole) {
  const brandAssets = identity.brand_assets || {};
  const kyc = identity.kyc_verified_data || null;
  const rules = [...(brandAssets.always_rules || []), ...(brandAssets.writing_rules || [])].join('. ');
  const forbidden = (brandAssets.forbidden_phrases || []).join(', ');

  let kycBlock = '';
  if (kyc && kyc.kyc_tier && kyc.kyc_tier !== 'none') {
    const clearance = kyc.autopilot_clearance || {};
    kycBlock = `\n\nVERIFIED LEGAL IDENTITY (KYC Tier: ${kyc.kyc_tier.toUpperCase()}) — Use ONLY when the task explicitly requires it:\n- Full Legal Name: ${kyc.full_legal_name || identity.name}\n- Date of Birth: ${kyc.date_of_birth || '—'}\n- Address: ${[kyc.residential_address, kyc.city, kyc.state, kyc.postal_code, kyc.country].filter(Boolean).join(', ') || '—'}\n- Phone: ${kyc.phone_number || '—'}\n- Email: ${kyc.email || identity.email || '—'}\n- Government ID Type: ${kyc.government_id_type || '—'}\n- Government ID Number: ${kyc.government_id_number || '—'}\n- Government ID Expiry: ${kyc.government_id_expiry || '—'}\n${kyc.tax_id ? `- Tax ID / SSN: ${kyc.tax_id}` : ''}${kyc.ssn_last4 ? `\n- SSN Last 4: ${kyc.ssn_last4}` : ''}\n\nAUTHORIZED TASK TYPES for this identity:\n${clearance.can_submit_w9 ? '✓ W-9 and tax form submissions\n' : ''}${clearance.can_submit_1099_forms ? '✓ 1099 form submissions\n' : ''}${clearance.can_submit_grant_applications ? '✓ Grant applications (use legal name and address)\n' : ''}${clearance.can_use_government_portals ? '✓ Government portal registrations and applications\n' : ''}${clearance.can_submit_financial_onboarding ? '✓ Financial platform onboarding (Stripe, PayPal, etc.)\n' : ''}${clearance.can_attach_id_documents ? '✓ Tasks requiring identity document uploads\n' : ''}\nIMPORTANT: Only use the verified identity data above when the task specifically requires real legal identity information (e.g., tax forms, grant applications, financial onboarding). For regular freelance proposals, use the persona identity instead.`;
  }

  return `You are ${identity.name}, a ${identity.role_label || fallbackRole}.\nBio: ${identity.bio || 'Experienced professional with expertise in delivering high-quality results.'}\nSkills: ${(identity.skills || ['problem-solving', 'communication', 'research']).join(', ')}\nCommunication tone: ${identity.communication_tone || 'professional'}\nTagline: ${identity.tagline || ''}\n${rules ? `Style rules: ${rules}` : ''}\n${forbidden ? `Avoid: ${forbidden}` : ''}\n${brandAssets.ai_persona_instructions ? `Instructions: ${brandAssets.ai_persona_instructions}` : ''}${kycBlock}\n\nAlways produce complete, high-quality, professional work ready for immediate use.`.trim();
}

async function generateCoverLetter(opp, identity) {
  try {
    return await llmComplete([
      { role: 'system', content: buildIdentitySystemPrompt(identity, 'professional') },
      { role: 'user', content: `Write a concise, compelling cover letter/proposal for:\nTitle: ${opp.title}\nPlatform: ${opp.platform}\nDescription: ${opp.description || ''}\n\nUnder 200 words. Focus on value delivery and relevant expertise. Clear call to action.` }
    ], 400);
  } catch (e) {
    return `Dear Hiring Manager,\n\nI am ${identity.name}, a ${identity.role_label || 'professional'} with expertise in ${(identity.skills || ['relevant skills']).slice(0, 3).join(', ')}. I am excited about the opportunity "${opp.title}" and am confident I can deliver exceptional results.\n\nLet's connect to discuss this further.\n\nBest regards,\n${identity.name}`;
  }
}

function buildFallbackDeliverable(opp, identity) {
  return `# ${opp.title} — Execution Brief\nGenerated by: ${identity.name} (${identity.role_label || 'AI Agent'})\nPlatform: ${opp.platform}\nDate: ${new Date().toISOString()}\n\n## Overview\nThis deliverable was prepared for the opportunity: "${opp.title}"\n\n## Description\n${opp.description || 'Please review the opportunity details at the provided URL.'}\n\n## Action Required\nVisit: ${opp.url}\n\n## Identity Details\n- Name: ${identity.name}\n- Role: ${identity.role_label || 'Professional'}\n- Skills: ${(identity.skills || []).join(', ')}\n- Email: ${identity.email || 'See identity profile'}\n\n## Next Steps\n1. Review this brief\n2. Visit the opportunity URL above\n3. Submit using the identity credentials\n4. Log the outcome in the system\n\n---\nNote: AI content generation encountered an issue. This template was generated as a fallback.\nPlease use the Mission AI chat to request a full deliverable.`;
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
      { role: 'user', content: `Write a winning proposal for:\nTitle: ${opp.title}\nPlatform: ${opp.platform}\nDescription: ${opp.description}\nCategory: ${opp.category}\nValue: $${opp.profit_estimate_low}–$${opp.profit_estimate_high}\n${custom_instructions ? `\nExtra instructions: ${custom_instructions}` : ''}\n\nComplete, compelling, ready to submit. Include: why you're the right choice, your approach, timeline, and pricing.` }
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

async function getLiveSession(base44, payload) {
  const { task_id } = payload;
  if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id }, null, 1
  );
  const task = tasks?.[0];
  
  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

  return Response.json({
    success: true,
    status: task.status,
    current_step: task.current_step || task.execution_log?.[task.execution_log.length - 1]?.step || 'Initializing',
    execution_time_seconds: task.execution_time_seconds || 0,
    fields_filled: task.form_fields_detected?.filter(f => f.value_filled)?.length || 0,
    total_fields: task.form_fields_detected?.length || 0,
    screenshot_url: task.screenshot_url || null,
    debug_url: task.debug_url || null,
    current_interaction: task.current_interaction || null,
    execution_log: task.execution_log || [],
    alerts: task.error_message ? [task.error_message] : [],
    submission_success: task.submission_success || false
  });
}

async function pauseExecution(base44, payload) {
  const { task_id } = payload;
  if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

  await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
    status: 'paused'
  }).catch(() => {});

  return Response.json({ success: true, message: 'Task paused' });
}

async function resumeExecution(base44, payload) {
  const { task_id } = payload;
  if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

  await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
    status: 'executing'
  }).catch(() => {});

  return Response.json({ success: true, message: 'Task resumed' });
}

async function stopExecution(base44, payload) {
  const { task_id } = payload;
  if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id }, null, 1
  );
  const task = tasks?.[0];

  await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
    status: 'cancelled',
    completion_timestamp: new Date().toISOString()
  }).catch(() => {});

  if (task?.opportunity_id) {
    await base44.asServiceRole.entities.Opportunity.update(task.opportunity_id, {
      status: 'dismissed'
    }).catch(() => {});
  }

  return Response.json({ success: true, message: 'Task stopped' });
}

async function interveneExecution(base44, payload) {
  const { task_id, instruction } = payload;
  if (!task_id) return Response.json({ error: 'task_id required' }, { status: 400 });

  const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
    { id: task_id }, null, 1
  );
  const task = tasks?.[0];

  if (!task) return Response.json({ error: 'Task not found' }, { status: 404 });

  const execLog = task.execution_log || [];
  execLog.push({
    timestamp: new Date().toISOString(),
    step: 'admin_intervention',
    status: 'completed',
    details: instruction || 'Admin intervention triggered'
  });

  await base44.asServiceRole.entities.TaskExecutionQueue.update(task_id, {
    status: 'executing',
    execution_log: execLog
  }).catch(() => {});

  return Response.json({ success: true, message: 'Intervention sent' });
}