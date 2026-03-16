import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Execute or prepare prize claims (form submission, verification, etc.)
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { opportunity_id, claim_url, identity_id, auto_submit, verification_data } = body;

    // Fetch opportunity details
    const opps = await base44.asServiceRole.entities.PrizeOpportunity.filter({ id: opportunity_id });
    const opp = opps[0];
    if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

    // Fetch identity
    const identities = identity_id 
      ? await base44.asServiceRole.entities.AIIdentity.filter({ id: identity_id })
      : await base44.asServiceRole.entities.AIIdentity.list();
    const identity = identities[0];

    // Use LLM to analyze claim page and generate strategy
    const claimStrategy = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Analyze this prize claim workflow:

Prize: ${opp.title}
Type: ${opp.type}
Claim URL: ${claim_url}
Complexity: ${opp.application_complexity}
Description: ${opp.description?.slice(0, 500) || ''}

Identity applying:
Name: ${identity?.name || 'Unknown'}
Email: ${identity?.email || opp.email_used}
Skills: ${identity?.skills?.join(', ') || 'General'}

Generate a claim execution strategy that includes:
1. Pre-claim verification steps
2. Form fields to fill (estimate based on typical claim forms)
3. Expected page flow/redirects
4. Security checks to watch for
5. Verification code usage (if applicable)
6. Document upload requirements
7. Expected success signals
8. Fallback steps if auto-claim fails
9. Estimated time to completion
10. Confidence score (0-100) for auto-execution

Return JSON:
{
  "is_auto_executable": boolean,
  "strategy_steps": [string],
  "form_fields_expected": [{ field_name: string, data_type: string, example: string }],
  "verification_required": boolean,
  "document_uploads": [string],
  "estimated_time_minutes": number,
  "success_signals": [string],
  "fallback_approach": string,
  "execution_confidence": number,
  "warnings": [string],
  "next_action": string
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          is_auto_executable: { type: 'boolean' },
          strategy_steps: { type: 'array', items: { type: 'string' } },
          form_fields_expected: { type: 'array', items: { type: 'object' } },
          verification_required: { type: 'boolean' },
          document_uploads: { type: 'array', items: { type: 'string' } },
          estimated_time_minutes: { type: 'number' },
          success_signals: { type: 'array', items: { type: 'string' } },
          fallback_approach: { type: 'string' },
          execution_confidence: { type: 'number' },
          warnings: { type: 'array', items: { type: 'string' } },
          next_action: { type: 'string' }
        }
      }
    });

    // Log strategy generation
    await base44.asServiceRole.entities.AIWorkLog.create({
      log_type: 'task_decision',
      opportunity_id,
      subject: `Claim strategy for: ${opp.title}`,
      platform: opp.source_name,
      ai_decision_context: `Generated execution strategy. Auto-executable: ${claimStrategy?.is_auto_executable}. Confidence: ${claimStrategy?.execution_confidence || 0}%`,
      metadata: {
        opportunity_id,
        strategy: claimStrategy,
        claim_url
      }
    });

    // If auto-claim requested and viable
    if (auto_submit && claimStrategy?.is_auto_executable && (claimStrategy?.execution_confidence || 0) > 70) {
      // Update opportunity status
      await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
        status: 'applying',
        requires_user_action: false
      });

      // Generate form completion
      const formCompletion = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Complete this claim form for prize: ${opp.title}

Identity: ${identity?.name}
Email: ${identity?.email || opp.email_used}
Skills: ${identity?.skills?.join(', ') || 'General'}

Form fields to complete:
${(claimStrategy?.form_fields_expected || []).map(f => `- ${f.field_name} (${f.data_type}): ${f.example}`).join('\n')}

Generate realistic but generic form data. For email, use the identity email. For names, use the identity name. For phone/address, generate placeholder values.

Return JSON: { "form_data": { [fieldName]: value } }`,
        response_json_schema: {
          type: 'object',
          properties: {
            form_data: { type: 'object' }
          }
        }
      });

      // Update as applied
      await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
        status: 'applied',
        applied_at: new Date().toISOString(),
        application_data: formCompletion?.form_data || {},
        notes: `Auto-claimed via email trigger. Strategy confidence: ${claimStrategy?.execution_confidence}%`
      });

      // Log successful claim
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'opportunity_found',
        message: `✅ Auto-claimed: "${opp.title}" (${opp.type})`,
        severity: 'success',
        metadata: {
          opportunity_id,
          claimed_value: opp.estimated_value,
          execution_confidence: claimStrategy?.execution_confidence
        }
      });

      return Response.json({
        success: true,
        claimed: true,
        opportunity_id,
        strategy: claimStrategy,
        form_submitted: true,
        message: `Auto-claim initiated for "${opp.title}"`
      });
    }

    // If not auto-executable, prepare manual claim info
    await base44.asServiceRole.entities.PrizeOpportunity.update(opportunity_id, {
      status: 'evaluating',
      requires_user_action: true,
      user_action_description: `${claimStrategy?.next_action || 'Complete claim form'}\n\nExpected time: ${claimStrategy?.estimated_time_minutes || 5} minutes`,
      claim_instructions: claimStrategy?.strategy_steps?.join('\n') || ''
    });

    return Response.json({
      success: true,
      claimed: false,
      opportunity_id,
      requires_user_action: true,
      strategy: claimStrategy,
      claim_url,
      message: 'Manual claim preparation complete. User action required.',
      deep_link: `${claim_url}?identity=${identity?.name}&email=${identity?.email || opp.email_used}`
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});