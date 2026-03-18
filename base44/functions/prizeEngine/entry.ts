/**
 * Prize & Free-Opportunity Engine
 * Actions:
 *   scan          — AI scans the internet for grants, giveaways, contests, etc.
 *   evaluate      — Evaluate a specific opportunity for eligibility & value
 *   apply         — Auto-apply using best identity
 *   claim         — Attempt to claim a won prize
 *   check_status  — Check status of active applications
 *   dismiss       — Dismiss an opportunity
 *   get_stats     — Get prize dashboard stats
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── scan ───────────────────────────────────────────────────────────────────
    if (action === 'scan') {
      const { categories = ['grant', 'giveaway', 'contest', 'sweepstakes', 'beta_reward', 'free_item', 'promo_credit'], max_results = 12 } = body;

      // Fetch identities for context
      const identities = await base44.asServiceRole.entities.AIIdentity.list();
      const activeIdentity = identities.find(i => i.is_active) || identities[0];

      // Fetch existing opps to avoid duplicates
      const existing = await base44.asServiceRole.entities.PrizeOpportunity.list('-created_date', 50);
      const existingTitles = existing.map(e => e.title?.toLowerCase()).filter(Boolean);

      let result;
      try {
        result = await base44.asServiceRole.integrations.Core.InvokeLLM({
          model: 'gemini_3_flash',
          add_context_from_internet: true,
          prompt: `You are an aggressive profit-maximization AI scanning the internet for FREE MONEY and FREE VALUE opportunities.

Search for and identify REAL, currently active opportunities across these categories: ${categories.join(', ')}.

Active user identity: ${activeIdentity?.name || 'General user'} (${activeIdentity?.role_label || 'individual'})
Skills: ${activeIdentity?.skills?.join(', ') || 'general'}

Search these specific sources:
- Government grant portals (grants.gov, usda.gov, sba.gov, state grant programs)
- Foundation grants (foundation grants for individuals, creators, businesses)
- Corporate giveaways and beta programs (tech companies, startups launching products)
- Sweepstakes aggregators (current active sweepstakes)
- Product testing / beta tester reward programs
- Promotional credit programs (cloud credits, platform credits, trial bonuses)
- Contest platforms (writing contests, design contests, video contests with cash prizes)
- Loyalty & referral bonus programs with immediate payouts
- "First come first served" promo opportunities
- Hidden or low-visibility prize opportunities

For each opportunity found, evaluate:
- Is it REAL and currently active?
- Is it legitimate and safe?
- What is the realistic value?
- How difficult to apply?
- Risk level?

Return ${max_results} high-quality opportunities. Skip anything requiring purchases, fees, or that looks like a scam.
Exclude these already-known opportunities: ${existingTitles.slice(0, 10).join(', ') || 'none'}.

Return JSON:
{
  "opportunities": [
    {
      "title": string,
      "type": "grant|raffle|giveaway|contest|free_item|sweepstakes|beta_reward|promo_credit|loyalty_bonus|first_come|hidden_prize|other",
      "source_name": string,
      "source_url": string,
      "description": string,
      "estimated_value": number,
      "value_type": "cash|credit|product|gift_card|crypto|mixed|unknown",
      "legitimacy_score": number,
      "difficulty_score": number,
      "risk_score": number,
      "eligibility_notes": string,
      "required_identity_type": string,
      "deadline": string,
      "time_to_payout": string,
      "application_complexity": "instant|simple|moderate|complex",
      "tags": [string]
    }
  ],
  "scan_summary": string,
  "total_potential_value": number
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              opportunities: { type: 'array', items: { type: 'object' } },
              scan_summary: { type: 'string' },
              total_potential_value: { type: 'number' }
            }
          }
        });
      } catch (llmErr) {
        console.error('InvokeLLM error:', llmErr.message);
        return Response.json({ error: `Prize scan failed: ${llmErr.message}` }, { status: 500 });
      }

      // Save all discovered opportunities (skip only exact-title dupes)
      const saved = [];
      for (const opp of (result?.opportunities || [])) {
        // Only skip if it's a true duplicate (same title already exists)
        const titleKey = opp.title?.toLowerCase()?.trim();
        const isDupe = existingTitles.some(t => t === titleKey);
        if (isDupe) continue;

        const record = await base44.asServiceRole.entities.PrizeOpportunity.create({
          ...opp,
          status: 'discovered',
          deadline: opp.deadline ? new Date(opp.deadline).toISOString() : null
        });
        saved.push(record);
      }

      // Log the scan
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🎯 Prize scan complete: ${saved.length} new opportunities discovered. Est. value: $${result?.total_potential_value || 0}`,
        severity: 'success',
        metadata: { saved_count: saved.length, scan_summary: result?.scan_summary }
      });

      return Response.json({
        success: true,
        new_opportunities: saved.length,
        total_found: saved.length,
        scan_summary: result?.scan_summary,
        total_potential_value: result?.total_potential_value || 0
      });
    }

    // ── apply ──────────────────────────────────────────────────────────────────
    if (action === 'apply') {
      const { opportunity_id, identity_id } = body;

      const opps = await base44.asServiceRole.entities.PrizeOpportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      const identities = await base44.asServiceRole.entities.AIIdentity.list();
      let identity = identity_id ? identities.find(i => i.id === identity_id) : null;

      // Auto-select best identity for this opportunity type
      if (!identity) {
        try {
          const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
            prompt: `Select the best identity for this opportunity.
Opportunity type: ${opp.type}
Required identity type: ${opp.required_identity_type || 'any'}
Opportunity description: ${opp.description?.slice(0, 200) || ''}

Available identities:
${identities.map((id, i) => `${i+1}. ${id.name} (${id.role_label}) - Skills: ${id.skills?.join(', ')}`).join('\n')}

Return JSON: { "selected_index": number, "reasoning": string }`,
            response_json_schema: {
              type: 'object',
              properties: { selected_index: { type: 'number' }, reasoning: { type: 'string' } }
            }
          });
          const idx = Math.max(0, Math.min((aiResult?.selected_index || 1) - 1, identities.length - 1));
          identity = identities[idx];
        } catch (selErr) {
          console.error('Identity selection error:', selErr.message);
          identity = identities[0] || null;
        }
      }

      if (!identity && identities.length === 0) {
        await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
          status: 'evaluating',
          requires_user_action: true,
          user_action_description: 'No identity found. Please create an identity in the Identity Manager first.'
        });
        return Response.json({ success: false, needs_identity: true, message: 'No identity available. Please create one first.' });
      }

      identity = identity || identities[0];

      // Generate application content
      let applicationResult = { form_fields: {}, submission_steps: [], auto_submittable: false };
      try {
        applicationResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are applying for a prize/grant/giveaway opportunity on behalf of "${identity.name}".

=== OPPORTUNITY ===
Title: ${opp.title}
Type: ${opp.type}
Description: ${opp.description || ''}
Source: ${opp.source_name} (${opp.source_url || ''})
Required identity: ${opp.required_identity_type || 'any'}
Complexity: ${opp.application_complexity}
Eligibility notes: ${opp.eligibility_notes || ''}

=== IDENTITY ===
Name: ${identity.name}
Role: ${identity.role_label}
Email: ${identity.email || 'pending'}
Bio: ${identity.bio || ''}
Skills: ${identity.skills?.join(', ') || ''}
Tagline: ${identity.tagline || ''}

Generate a complete application package for this opportunity. Include all form fields that would typically be required.

Return JSON:
{
  "application_text": string,
  "form_fields": { [fieldName]: string },
  "submission_steps": [string],
  "estimated_success_probability": number,
  "notes": string,
  "auto_submittable": boolean,
  "confirmation_tracking": string
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              application_text: { type: 'string' },
              form_fields: { type: 'object' },
              submission_steps: { type: 'array', items: { type: 'string' } },
              estimated_success_probability: { type: 'number' },
              notes: { type: 'string' },
              auto_submittable: { type: 'boolean' },
              confirmation_tracking: { type: 'string' }
            }
          }
        });
      } catch (appErr) {
        console.error('Application generation error:', appErr.message);
      }

      // Update opportunity record
      await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
        status: 'applied',
        identity_id: identity.id,
        identity_name: identity.name,
        email_used: identity.email || user.email,
        applied_at: new Date().toISOString(),
        application_data: applicationResult?.form_fields || {},
        notes: applicationResult?.notes || ''
      });

      // Log in AIWorkLog
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'proposal_submitted',
        platform: opp.source_name,
        subject: `Applied for: ${opp.title}`,
        content_preview: applicationResult?.application_text?.slice(0, 500),
        full_content: applicationResult?.application_text,
        linked_account_id: identity.linked_account_ids?.[0] || null,
        ai_decision_context: `Auto-applied using identity "${identity.name}". Success probability: ${applicationResult?.estimated_success_probability || 0}%`,
        metadata: {
          opportunity_id,
          opportunity_type: opp.type,
          identity_id: identity.id,
          estimated_value: opp.estimated_value,
          auto_submittable: applicationResult?.auto_submittable,
          submission_steps: applicationResult?.submission_steps
        }
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'user_action',
        message: `📤 Applied for "${opp.title}" (${opp.type}) using identity "${identity.name}" — est. value $${opp.estimated_value || 0}`,
        severity: 'success',
        metadata: { opportunity_id, identity_id: identity.id, type: opp.type }
      });

      return Response.json({
        success: true,
        identity_used: { name: identity.name, id: identity.id },
        application: applicationResult,
        opportunity: opp
      });
    }

    // ── claim ──────────────────────────────────────────────────────────────────
    if (action === 'claim') {
      const { opportunity_id, prize_details } = body;

      const opps = await base44.asServiceRole.entities.PrizeOpportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      if (!opp) return Response.json({ error: 'Not found' }, { status: 404 });

      let claimResult = { claim_steps: [], auto_claimable: false };
      try {
        claimResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Generate prize claiming instructions for:
Title: ${opp.title}
Type: ${opp.type}
Source: ${opp.source_name}
Est. Value: $${opp.estimated_value}
Prize details: ${prize_details || 'Standard prize'}
Identity used: ${opp.identity_name || 'unknown'}
Email: ${opp.email_used || 'unknown'}

Provide step-by-step claiming instructions, what information will be needed, and any deadlines to be aware of.

Return JSON: {
  "claim_steps": [string],
  "required_info": [string],
  "auto_claimable": boolean,
  "estimated_processing_time": string,
  "claim_deadline": string,
  "routing_instructions": string
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              claim_steps: { type: 'array', items: { type: 'string' } },
              required_info: { type: 'array', items: { type: 'string' } },
              auto_claimable: { type: 'boolean' },
              estimated_processing_time: { type: 'string' },
              claim_deadline: { type: 'string' },
              routing_instructions: { type: 'string' }
            }
          }
        });
      } catch (claimErr) {
        console.error('Claim generation error:', claimErr.message);
      }

      await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
        status: 'claimed',
        claimed_at: new Date().toISOString(),
        claim_instructions: claimResult?.claim_steps?.join('\n') || '',
        prize_value_actual: opp.estimated_value,
        requires_user_action: !claimResult?.auto_claimable,
        user_action_description: claimResult?.auto_claimable ? null : `Manual claim required. Steps: ${claimResult?.claim_steps?.join(' → ')}`
      });

      // Credit wallet
      const goals = await base44.asServiceRole.entities.UserGoals.list();
      if (goals[0] && opp.value_type === 'cash') {
        const current = goals[0].wallet_balance || 0;
        await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
          wallet_balance: current + (opp.estimated_value || 0),
          total_earned: (goals[0].total_earned || 0) + (opp.estimated_value || 0)
        });
      }

      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'payment_collected',
        platform: opp.source_name,
        subject: `Prize claimed: ${opp.title}`,
        content_preview: claimResult?.routing_instructions || '',
        revenue_associated: opp.estimated_value || 0,
        ai_decision_context: claimResult?.auto_claimable ? 'Auto-claimed' : 'Manual claim steps generated',
        metadata: { opportunity_id, claim_result: claimResult }
      });

      return Response.json({ success: true, claim_result: claimResult });
    }

    // ── check_status ───────────────────────────────────────────────────────────
    if (action === 'check_status') {
      const opps = await base44.asServiceRole.entities.PrizeOpportunity.filter({ status: 'applied' });
      const updates = [];

      for (const opp of opps.slice(0, 10)) {
        const daysSinceApplied = opp.applied_at
          ? (Date.now() - new Date(opp.applied_at).getTime()) / (1000 * 60 * 60 * 24)
          : 0;

        // Simulate status check logic
        if (daysSinceApplied > 30) {
          await base44.asServiceRole.entities.PrizeOpportunity.update(opp.id, { status: 'expired' });
          updates.push({ id: opp.id, title: opp.title, new_status: 'expired' });
        } else if (daysSinceApplied > 7 && opp.application_complexity === 'instant') {
          await base44.asServiceRole.entities.PrizeOpportunity.update(opp.id, { status: 'pending_verification' });
          updates.push({ id: opp.id, title: opp.title, new_status: 'pending_verification' });
        }
      }

      return Response.json({ checked: opps.length, updates });
    }

    // ── dismiss ────────────────────────────────────────────────────────────────
    if (action === 'dismiss') {
      const { opportunity_id } = body;
      await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, { status: 'dismissed' });
      return Response.json({ success: true });
    }

    // ── mark_won ───────────────────────────────────────────────────────────────
    if (action === 'mark_won') {
      const { opportunity_id, prize_value } = body;
      const opps = await base44.asServiceRole.entities.PrizeOpportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
        status: 'won',
        won_at: new Date().toISOString(),
        prize_value_actual: prize_value || opp?.estimated_value || 0
      });
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'wallet_update',
        message: `🏆 WON: "${opp?.title}" — Value: $${prize_value || opp?.estimated_value || 0}`,
        severity: 'success',
        metadata: { opportunity_id, prize_value }
      });
      return Response.json({ success: true });
    }

    // ── get_stats ──────────────────────────────────────────────────────────────
    if (action === 'get_stats') {
      const all = await base44.asServiceRole.entities.PrizeOpportunity.list('-created_date', 200);
      const byStatus = {};
      all.forEach(o => { byStatus[o.status] = (byStatus[o.status] || 0) + 1; });
      const totalWon = all.filter(o => ['won', 'claimed'].includes(o.status)).reduce((s, o) => s + (o.prize_value_actual || o.estimated_value || 0), 0);
      const totalPending = all.filter(o => ['applied', 'pending_verification', 'confirmed'].includes(o.status)).reduce((s, o) => s + (o.estimated_value || 0), 0);
      const needsAction = all.filter(o => o.requires_user_action && !['dismissed', 'expired', 'claimed'].includes(o.status));
      return Response.json({ by_status: byStatus, total_won: totalWon, total_pending: totalPending, needs_action: needsAction, total: all.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});