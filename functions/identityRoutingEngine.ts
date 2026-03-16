import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { opportunity_id, task_type, platform, category, estimated_value, action } = body;

    // Action: detect - determine which identity should be used
    if (action === 'detect') {
      const opportunity = opportunity_id ? await base44.entities.Opportunity.get(opportunity_id) : null;
      const kyc = await base44.entities.KYCVerification.filter({ status: 'approved' }, '', 1);
      const routingPolicies = await base44.entities.IdentityRoutingPolicy.filter({ enabled: true }, '-priority', 100);

      let requiresKYC = false;
      let routingReason = '';
      let selectedPolicy = null;

      // Check routing policies
      for (const policy of routingPolicies) {
        let matches = false;

        // Category match
        if (policy.category === 'general' || policy.category === category) {
          // Platform match (if specified)
          if (!policy.platform || policy.platform === platform) {
            matches = true;
          }
        }

        // Check keywords in opportunity
        if (opportunity && policy.keywords && policy.keywords.length > 0) {
          const titleDesc = `${opportunity.title} ${opportunity.description}`.toLowerCase();
          const keywordMatch = policy.keywords.some(kw => titleDesc.includes(kw.toLowerCase()));
          if (keywordMatch) matches = true;
        }

        // Check minimum payout
        if (policy.minimum_payout && estimated_value && estimated_value >= policy.minimum_payout) {
          matches = true;
        }

        if (matches) {
          selectedPolicy = policy;
          requiresKYC = policy.requires_kyc;
          routingReason = `Policy: ${policy.rule_name} (${policy.kyc_reason || 'persona identity'})`;
          break;
        }
      }

      // Fallback: check task type and platform for common KYC requirements
      if (!selectedPolicy) {
        const kycPlatforms = ['stripe', 'paypal', 'bank', 'irs', 'grant.gov', 'sec.gov', 'tax'];
        const kycTaskTypes = ['financial_onboarding', 'payment_payout', 'prize_claiming', 'grant_application', 'tax_filing', 'high_value_transaction'];

        if (kycTaskTypes.includes(task_type) || kycPlatforms.some(p => platform?.toLowerCase().includes(p))) {
          requiresKYC = true;
          routingReason = `Auto-detected: ${task_type || platform} requires identity verification`;
        }
      }

      // Determine identity to use
      const identityToUse = requiresKYC && kyc.length > 0 ? 'legal' : 'persona';
      const kycApproved = kyc.length > 0 && kyc[0].user_approved_for_autopilot;
      const kycStatus = kyc.length > 0 ? kyc[0].status : 'none';

      // Log the routing decision
      if (opportunity_id) {
        await base44.entities.IdentityRoutingLog.create({
          opportunity_id,
          task_id: body.task_id || `auto_${Date.now()}`,
          identity_used: identityToUse,
          identity_name: identityToUse === 'legal' && kyc.length > 0 ? 'Legal Identity' : 'Active Persona',
          routing_reason: routingReason,
          required_kyc: requiresKYC,
          kyc_verified: kycApproved && kycStatus === 'approved',
          auto_detected: true,
          platform,
          opportunity_category: category,
          status: 'pending'
        });
      }

      return Response.json({
        identity_type: identityToUse,
        requires_kyc: requiresKYC,
        kyc_available: kyc.length > 0,
        kyc_approved: kycApproved,
        kyc_status: kycStatus,
        routing_reason: routingReason,
        selected_policy: selectedPolicy ? { name: selectedPolicy.rule_name, reason: selectedPolicy.kyc_reason } : null,
        can_proceed: !requiresKYC || (requiresKYC && kycApproved && kycStatus === 'approved')
      });
    }

    // Action: switch - switch identity for a task
    if (action === 'switch') {
      const { task_id, new_identity } = body;
      const kyc = await base44.entities.KYCVerification.filter({ status: 'approved' }, '', 1);

      if (new_identity === 'legal' && (!kyc.length || !kyc[0].user_approved_for_autopilot)) {
        return Response.json({ error: 'Legal identity not approved for use' }, { status: 403 });
      }

      // Log the identity switch
      if (task_id) {
        await base44.entities.IdentityRoutingLog.create({
          task_id,
          identity_used: new_identity,
          identity_name: new_identity === 'legal' ? 'Legal Identity' : 'Active Persona',
          routing_reason: 'Manual switch',
          required_kyc: new_identity === 'legal',
          kyc_verified: new_identity === 'legal' && kyc.length > 0 && kyc[0].status === 'approved',
          auto_detected: false,
          status: 'pending'
        });
      }

      return Response.json({
        success: true,
        identity_switched_to: new_identity,
        message: `Identity switched to ${new_identity === 'legal' ? 'Legal Identity' : 'Active Persona'}`
      });
    }

    // Action: log_access - log when KYC data is accessed
    if (action === 'log_access') {
      const { module, task_id, purpose } = body;
      const kyc = await base44.entities.KYCVerification.filter({ status: 'approved' }, '', 1);

      if (kyc.length > 0) {
        const currentLog = kyc[0].access_log || [];
        currentLog.push({
          accessed_at: new Date().toISOString(),
          accessed_by: user.email,
          purpose,
          module,
          task_id
        });

        // Keep last 1000 access logs
        if (currentLog.length > 1000) {
          currentLog.shift();
        }

        await base44.entities.KYCVerification.update(kyc[0].id, {
          access_log: currentLog
        });
      }

      return Response.json({ success: true, message: 'Access logged' });
    }

    // Action: get_kyc_status
    if (action === 'get_kyc_status') {
      const kyc = await base44.entities.KYCVerification.filter({}, '-created_date', 1);

      if (kyc.length === 0) {
        return Response.json({
          kyc_status: 'not_started',
          verified: false,
          approved: false,
          message: 'No KYC data on file'
        });
      }

      const kycRecord = kyc[0];
      return Response.json({
        kyc_status: kycRecord.status,
        verified: kycRecord.status === 'verified' || kycRecord.status === 'approved',
        approved: kycRecord.status === 'approved',
        user_approved_for_autopilot: kycRecord.user_approved_for_autopilot,
        verification_type: kycRecord.verification_type,
        verified_at: kycRecord.verified_at,
        approved_at: kycRecord.approved_at,
        expires_at: kycRecord.expires_at,
        allowed_modules: kycRecord.allowed_modules || [],
        rejection_reason: kycRecord.rejection_reason
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Identity routing error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});