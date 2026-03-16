/**
 * Proposal Generation Engine
 * Actions:
 *   generate   — AI generates a platform-specific, identity-tuned proposal
 *   refine     — Refines an existing draft with specific instructions
 *   submit     — Marks a proposal as submitted and logs it
 *   get_history — Returns past proposals with win/loss outcomes
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── generate ───────────────────────────────────────────────────────────────
    if (action === 'generate') {
      const { opportunity_id, identity_id } = body;

      // 1. Fetch opportunity
      const opps = await base44.entities.Opportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      // 2. Fetch active identity
      const identities = await base44.asServiceRole.entities.AIIdentity.list();
      const identity = identity_id
        ? identities.find(i => i.id === identity_id)
        : identities.find(i => i.is_active) || identities[0];

      // 3. Pull past winning proposals for this identity
      const workLogs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', 200);
      const pastProposals = workLogs.filter(l =>
        l.log_type === 'proposal_submitted' &&
        (l.outcome?.toLowerCase().includes('win') || l.outcome?.toLowerCase().includes('hired') || l.outcome?.toLowerCase().includes('accepted'))
      ).slice(0, 8);

      const pastMessages = workLogs.filter(l =>
        l.log_type === 'message_sent' && l.revenue_associated > 0
      ).slice(0, 5);

      const completedJobs = workLogs.filter(l =>
        l.log_type === 'job_completed' || l.log_type === 'payment_collected'
      ).slice(0, 5);

      // 4. Platform-specific rules
      const platformRules = {
        upwork: 'Start with the client\'s specific problem. Keep under 500 words. Reference the job post keywords. Include a direct, measurable timeline. End with a clear CTA.',
        fiverr: 'Be concise and high energy. Under 300 words. Bullet deliverables. Mention turnaround time. Use keywords from the gig category.',
        freelancer: 'Address the brief directly in the first line. Show relevant experience early. Include a milestone breakdown. Keep under 400 words.',
        default: 'Be direct and client-focused. Address their exact need. Show relevant experience. Include timeline and next steps.'
      };
      const rules = platformRules[opp.source?.toLowerCase()] || platformRules.default;

      // 5. Generate with LLM
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are an expert freelance proposal writer. Generate a highly tailored, high-conversion proposal.

=== ACTIVE IDENTITY ===
Name: ${identity?.name || 'Freelancer'}
Role: ${identity?.role_label || 'Professional'}
Tone: ${identity?.communication_tone || 'professional'}
Bio: ${identity?.bio || ''}
Tagline: ${identity?.tagline || ''}
Skills: ${identity?.skills?.join(', ') || ''}
Email Signature: ${identity?.email_signature || ''}
Proposal Instructions: ${identity?.proposal_style || ''}

=== TARGET OPPORTUNITY ===
Title: ${opp.title}
Description: ${opp.description || ''}
Category: ${opp.category}
Platform: ${opp.source || 'unknown'}
Budget: $${opp.profit_estimate_low || 0}–$${opp.profit_estimate_high || 0}
Time Sensitivity: ${opp.time_sensitivity}
Tags: ${opp.tags?.join(', ') || ''}

=== PLATFORM RULES ===
${rules}

=== PAST WINNING PROPOSALS (for pattern learning) ===
${pastProposals.map((p, i) => `[${i+1}] Subject: ${p.subject || 'N/A'}\nContent: ${p.content_preview || ''}\nOutcome: ${p.outcome || ''}`).join('\n\n') || 'None yet — generate a strong first proposal'}

=== PAST HIGH-VALUE MESSAGES ===
${pastMessages.map(m => `Platform: ${m.platform} | Revenue: $${m.revenue_associated} | Preview: ${m.content_preview || ''}`).join('\n') || 'N/A'}

=== COMPLETED WORK PORTFOLIO ===
${completedJobs.map(j => `Subject: ${j.subject || ''} | Platform: ${j.platform || ''} | Revenue: $${j.revenue_associated || 0}`).join('\n') || 'N/A'}

Generate the proposal now. Make it feel personal, specific to this exact job, and demonstrate deep understanding of the client\'s problem. Do NOT use generic templates.

Return JSON:
{
  "subject_line": string,
  "proposal_body": string,
  "cover_letter": string,
  "estimated_bid": number,
  "estimated_timeline": string,
  "key_selling_points": [string],
  "platform_tips": [string],
  "confidence_score": number,
  "strategy_notes": string,
  "follow_up_message": string
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            subject_line: { type: 'string' },
            proposal_body: { type: 'string' },
            cover_letter: { type: 'string' },
            estimated_bid: { type: 'number' },
            estimated_timeline: { type: 'string' },
            key_selling_points: { type: 'array', items: { type: 'string' } },
            platform_tips: { type: 'array', items: { type: 'string' } },
            confidence_score: { type: 'number' },
            strategy_notes: { type: 'string' },
            follow_up_message: { type: 'string' }
          }
        }
      });

      return Response.json({
        proposal: result,
        identity_used: identity ? { id: identity.id, name: identity.name, tone: identity.communication_tone } : null,
        opportunity_id,
        platform: opp.source
      });
    }

    // ── refine ─────────────────────────────────────────────────────────────────
    if (action === 'refine') {
      const { current_proposal, refinement_instruction, identity_id } = body;

      const identities = await base44.asServiceRole.entities.AIIdentity.list();
      const identity = identity_id
        ? identities.find(i => i.id === identity_id)
        : identities.find(i => i.is_active) || identities[0];

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are refining a freelance proposal. Apply the requested changes while maintaining the identity's voice.

Identity: ${identity?.name || 'Freelancer'} | Tone: ${identity?.communication_tone || 'professional'}
Proposal Instructions: ${identity?.proposal_style || ''}

Current Proposal:
${current_proposal}

Refinement Instruction: ${refinement_instruction}

Return the improved proposal_body only as a JSON: { "proposal_body": string, "change_summary": string }`,
        response_json_schema: {
          type: 'object',
          properties: {
            proposal_body: { type: 'string' },
            change_summary: { type: 'string' }
          }
        }
      });

      return Response.json({ refined: result });
    }

    // ── submit ─────────────────────────────────────────────────────────────────
    if (action === 'submit') {
      const { opportunity_id, proposal_body, subject_line, platform, bid_amount, identity_id } = body;

      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'proposal_submitted',
        opportunity_id,
        platform,
        subject: subject_line,
        content_preview: proposal_body?.slice(0, 500),
        full_content: proposal_body,
        status: 'sent',
        ai_decision_context: `Proposal submitted for opportunity ${opportunity_id} using identity ${identity_id}`,
        metadata: { bid_amount, identity_id, opportunity_id }
      });

      // Update opportunity status
      if (opportunity_id) {
        await base44.asServiceRole.entities.Opportunity.update(opportunity_id, { status: 'executing' });
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `📤 Proposal submitted: "${subject_line}" on ${platform || 'unknown'}`,
        severity: 'success',
        metadata: { opportunity_id, platform, bid_amount }
      });

      return Response.json({ success: true });
    }

    // ── get_history ────────────────────────────────────────────────────────────
    if (action === 'get_history') {
      const { identity_id, limit = 30 } = body;
      const logs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', limit);
      const proposals = logs.filter(l => l.log_type === 'proposal_submitted');
      const filtered = identity_id
        ? proposals.filter(l => l.metadata?.identity_id === identity_id)
        : proposals;
      return Response.json({ proposals: filtered });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});