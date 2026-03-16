import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Parse prize-related emails and extract claim information
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { email, identity_id, identity_name, identity_email } = body;

    // Use LLM to intelligently parse the email for prize-related content
    const parseResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this email for prize/reward/payout information:

FROM: ${email.from}
DATE: ${email.date}
SUBJECT: ${email.subject}
BODY:
${email.body}

Determine if this is a legitimate prize, grant, giveaway, or reward notification.

If it IS a prize-related email, extract:
1. Prize/opportunity title
2. Prize type (grant, sweepstakes, giveaway, contest, beta_reward, etc.)
3. Prize value (estimated if not explicit)
4. Value type (cash, credit, product, gift_card, etc.)
5. Required action (claim, verify, complete form, etc.)
6. Claim deadline (if mentioned)
7. Expected payout date (if mentioned)
8. Claim URL or button text
9. Verification code (if included)
10. Confirmation/tracking number
11. Sender legitimacy assessment (0-100)
12. Whether claim can be auto-executed via form submission
13. Required attachments or documents

If NOT a prize email, return: { "is_prize_email": false, "reason": "..." }

Return JSON:
{
  "is_prize_email": boolean,
  "prize_title": string,
  "prize_type": string,
  "estimated_value": number,
  "value_type": string,
  "required_action": string,
  "claim_deadline": string (ISO date),
  "expected_payout_date": string (ISO date),
  "claim_url": string,
  "verification_code": string,
  "confirmation_number": string,
  "legitimacy_score": number,
  "auto_claimable": boolean,
  "claim_complexity": "instant|simple|moderate|complex",
  "required_documents": [string],
  "sender_domain": string,
  "parsing_confidence": number,
  "next_steps": [string]
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_prize_email: { type: 'boolean' },
          prize_title: { type: 'string' },
          prize_type: { type: 'string' },
          estimated_value: { type: 'number' },
          value_type: { type: 'string' },
          required_action: { type: 'string' },
          claim_deadline: { type: 'string' },
          expected_payout_date: { type: 'string' },
          claim_url: { type: 'string' },
          verification_code: { type: 'string' },
          confirmation_number: { type: 'string' },
          legitimacy_score: { type: 'number' },
          auto_claimable: { type: 'boolean' },
          claim_complexity: { type: 'string' },
          required_documents: { type: 'array', items: { type: 'string' } },
          sender_domain: { type: 'string' },
          parsing_confidence: { type: 'number' },
          next_steps: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // If not a prize email, return early
    if (!parseResult?.is_prize_email) {
      return Response.json({
        success: true,
        found_opportunity: false,
        reason: parseResult?.reason || 'Not a prize-related email'
      });
    }

    // Filter out low-confidence or risky emails
    if ((parseResult?.legitimacy_score || 0) < 50 || (parseResult?.parsing_confidence || 0) < 60) {
      return Response.json({
        success: true,
        found_opportunity: false,
        reason: 'Low confidence or legitimacy score',
        details: parseResult
      });
    }

    // Check if this prize already exists
    const existing = await base44.asServiceRole.entities.PrizeOpportunity.filter({
      title: parseResult.prize_title,
      status: { $ne: 'dismissed' }
    });

    if (existing.length) {
      // Update existing record with new email data
      await base44.asServiceRole.entities.PrizeOpportunity.update(existing[0].id, {
        requires_user_action: parseResult.required_action ? true : false,
        user_action_description: parseResult.required_action,
        claim_instructions: parseResult.next_steps?.join('\n') || null,
        confirmation_code: parseResult.confirmation_number || existing[0].confirmation_code,
        verification_info: {
          code: parseResult.verification_code,
          email_from: email.from,
          email_date: email.date
        }
      });

      return Response.json({
        success: true,
        found_opportunity: true,
        is_duplicate: true,
        prize_id: existing[0].id,
        message: 'Prize already tracked, updated with new email data'
      });
    }

    // Create new prize opportunity record
    const prize = await base44.asServiceRole.entities.PrizeOpportunity.create({
      title: parseResult.prize_title,
      type: parseResult.prize_type || 'other',
      description: `Email from ${email.from}\n\n${email.body?.slice(0, 500) || ''}`,
      source_url: parseResult.claim_url || '',
      source_name: parseResult.sender_domain || email.from,
      estimated_value: parseResult.estimated_value || 0,
      value_type: parseResult.value_type || 'unknown',
      legitimacy_score: parseResult.legitimacy_score || 50,
      difficulty_score: parseResult.claim_complexity === 'complex' ? 80 : parseResult.claim_complexity === 'moderate' ? 50 : 20,
      risk_score: 100 - (parseResult.legitimacy_score || 50),
      status: 'discovered',
      deadline: parseResult.claim_deadline,
      time_to_payout: parseResult.expected_payout_date,
      application_complexity: parseResult.claim_complexity || 'simple',
      identity_id,
      identity_name,
      email_used: identity_email,
      confirmation_code: parseResult.confirmation_number || '',
      requires_user_action: !parseResult.auto_claimable,
      user_action_description: parseResult.required_action,
      claim_instructions: parseResult.next_steps?.join('\n') || '',
      tags: ['email_triggered', 'auto_discovered'],
      notes: `Legitimacy: ${parseResult.legitimacy_score}%, Auto-claimable: ${parseResult.auto_claimable ? 'Yes' : 'No'}`
    });

    // If auto-claimable, trigger claim attempt
    if (parseResult.auto_claimable && parseResult.claim_url) {
      const claimAttempt = await base44.asServiceRole.functions.invoke('prizeClaimExecutor', {
        opportunity_id: prize.id,
        claim_url: parseResult.claim_url,
        identity_id,
        auto_submit: true
      });

      // Log claim attempt
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'opportunity_found',
        message: `🎯 Auto-claim initiated for "${prize.title}"`,
        severity: 'success',
        metadata: {
          prize_id: prize.id,
          claim_url: parseResult.claim_url,
          attempt_result: claimAttempt?.data?.success
        }
      });
    } else if (parseResult.claim_url) {
      // Flag for user review with deep link
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'alert',
        message: `🚨 Manual claim required: "${prize.title}"`,
        severity: 'warning',
        metadata: {
          prize_id: prize.id,
          claim_url: parseResult.claim_url,
          reason: 'Requires user interaction'
        }
      });
    }

    return Response.json({
      success: true,
      found_opportunity: true,
      prize_id: prize.id,
      prize: prize,
      parsing_details: parseResult
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});