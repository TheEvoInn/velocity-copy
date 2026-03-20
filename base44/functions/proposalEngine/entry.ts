import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Proposal Engine - AI-powered, identity-aware, platform-specific proposal generation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    if (action === 'generate_proposal') {
      return await generateProposal(base44, user, payload);
    }

    if (action === 'inject_proposal') {
      return await injectProposal(base44, user, payload);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Proposal Engine Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Generate platform-specific proposal
 */
async function generateProposal(base44, user, payload) {
  const {
    opportunity_id,
    opportunity_title,
    opportunity_description,
    platform,
    identity_id,
    required_skills
  } = payload;

  try {
    // Fetch the opportunity
    const opp = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      null,
      1
    );

    if (!opp || opp.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    // Fetch identity
    const identity = identity_id ?
      (await base44.entities.AIIdentity.filter({ id: identity_id }, null, 1))?.[0] :
      (await base44.entities.AIIdentity.filter({ is_active: true }, null, 1))?.[0];

    // Call Gemini directly for high-quality proposal generation
    const proposal = await generateWithGemini(buildProposalPrompt(opp[0], identity, platform));

    return Response.json({
      success: true,
      proposal: proposal,
      opportunity_id,
      identity_id: identity?.id,
      platform,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Inject proposal into form
 */
async function injectProposal(base44, user, payload) {
  const {
    opportunity_id,
    proposal_content,
    form_field_name
  } = payload;

  try {
    // Log the injection
    await base44.entities.AIWorkLog.create({
      log_type: 'proposal_submitted',
      opportunity_id,
      content_preview: proposal_content.substring(0, 200),
      full_content: proposal_content,
      status: 'drafted',
      created_by: user.email
    });

    return Response.json({
      success: true,
      injected_field: form_field_name || 'proposal',
      content_length: proposal_content.length,
      message: 'Proposal ready for injection'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

/**
 * Build brand context string from identity brand_assets
 */
function buildBrandContext(identity) {
  if (!identity) return '';
  const b = identity.brand_assets || {};
  const lines = [`=== IDENTITY BRAND PROFILE: ${identity.name} ===`];
  if (identity.role_label) lines.push(`Role: ${identity.role_label}`);
  if (identity.tagline) lines.push(`Tagline: "${identity.tagline}"`);
  if (identity.bio) lines.push(`Bio: ${identity.bio}`);
  if (identity.communication_tone) lines.push(`Tone: ${identity.communication_tone}`);
  if (identity.skills?.length) lines.push(`Skills: ${identity.skills.join(', ')}`);
  if (b.ai_persona_instructions) { lines.push('\nPERSONA INSTRUCTIONS:'); lines.push(b.ai_persona_instructions); }
  if (b.formality_level) lines.push(`Formality: ${b.formality_level.replace(/_/g, ' ')}`);
  if (b.vocabulary_style?.length) lines.push(`Vocabulary: ${b.vocabulary_style.join(', ')}`);
  if (b.industry_alignment?.length) lines.push(`Industry: ${b.industry_alignment.join(', ')}`);
  if (b.industry_language?.length) lines.push(`Use these terms: ${b.industry_language.join(', ')}`);
  if (b.signature_phrases?.length) lines.push(`Signature phrases: "${b.signature_phrases.join('" | "')}"`);
  if (b.always_rules?.length) lines.push(`ALWAYS: ${b.always_rules.join('. ')}`);
  if (b.never_rules?.length) lines.push(`NEVER: ${b.never_rules.join('. ')}`);
  if (b.forbidden_phrases?.length) lines.push(`FORBIDDEN: ${b.forbidden_phrases.join(', ')}`);
  if (b.strengths?.length) lines.push(`Strengths: ${b.strengths.join(', ')}`);
  if (b.differentiators?.length) lines.push(`Differentiators: ${b.differentiators.join(', ')}`);
  if (b.certifications?.length) lines.push(`Credentials: ${b.certifications.join(', ')}`);
  if (b.work_history_summary) lines.push(`Experience: ${b.work_history_summary}`);
  if (identity.proposal_style) { lines.push('\nPROPOSAL STYLE:'); lines.push(identity.proposal_style); }
  lines.push('=== END IDENTITY CONTEXT ===');
  return lines.join('\n');
}

/**
 * Build contextual prompt for proposal generation
 */
function buildProposalPrompt(opportunity, identity, platform) {
  let prompt = `You are an AI assistant helping to generate a professional proposal or application for a freelance/earning opportunity.\n\n`;

  // Inject full brand context if available
  if (identity) {
    prompt += buildBrandContext(identity) + '\n\n';
  }

  prompt += `OPPORTUNITY DETAILS:
Title: ${opportunity.title}
Description: ${opportunity.description}
Platform: ${platform || opportunity.platform}
Category: ${opportunity.category}
Expected Profit: $${opportunity.profit_estimate_low}-$${opportunity.profit_estimate_high}

`;

  if (identity) {
    prompt += `Past Success: ${identity.tasks_executed || 0} tasks completed, $${identity.total_earned || 0} earned\n\n`;
  }

  // Platform-specific instructions
  const platformInstructions = getPlatformInstructions(platform);
  prompt += platformInstructions;

  prompt += `
REQUIREMENTS:
1. Generate a compelling, personalized proposal or application text
2. Adapt tone and style to match the ${platform} platform
3. Highlight relevant skills and experience
4. Be concise but persuasive
5. Include a clear call-to-action or next steps
6. Make it ready to copy-paste into the application form

Generate ONLY the proposal/application text. No preamble or explanation.`;

  return prompt;
}

/**
 * Get platform-specific proposal format guidelines
 */
function getPlatformInstructions(platform) {
  const instructions = {
    upwork: `
UPWORK-SPECIFIC GUIDELINES:
- Keep under 500 words
- Start with a brief cover statement (1-2 sentences)
- Highlight relevant portfolio items
- Include timeline and availability
- Mention similar past projects
- End with a clear rate or fixed-price proposal`,

    fiverr: `
FIVERR-SPECIFIC GUIDELINES:
- Write as a gig description (100-200 words)
- Lead with what you'll deliver
- Be specific about deliverables
- Include timeline (days)
- Mention communication style
- End with why you're the best fit`,

    freelancer: `
FREELANCER-SPECIFIC GUIDELINES:
- Create a professional cover letter (200-300 words)
- Address the client by their need
- Show understanding of the project
- Propose specific approach
- Include timeline and milestones
- Mention relevant certifications`,

    grant: `
GRANT APPLICATION GUIDELINES:
- Write formal, research-focused prose
- Lead with problem statement
- Show understanding of funding priorities
- Include specific, measurable goals
- Outline implementation methodology
- Emphasize impact and outcomes`,

    contest: `
CONTEST ENTRY GUIDELINES:
- Creativity and originality first
- Show unique perspective
- Keep within contest requirements
- Highlight creative process
- Include strong visuals/portfolio links
- End with enthusiasm`,

    prize: `
PRIZE ELIGIBILITY STATEMENT:
- Confirm meeting all requirements
- Address specific selection criteria
- Show why you're a strong candidate
- Include relevant qualifications
- Be authentic and personal`,

    default: `
GENERAL APPLICATION GUIDELINES:
- Professional and personable tone
- Clear value proposition
- Relevant experience/skills
- Specific to the opportunity
- Concise but compelling
- Call-to-action included`
  };

  return instructions[platform?.toLowerCase()] || instructions.default;
}