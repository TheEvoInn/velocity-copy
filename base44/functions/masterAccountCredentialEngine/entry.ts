/**
 * MASTER ACCOUNT CREDENTIAL ENGINE
 * Returns REAL verified user data for account creation
 * Uses AIIdentity KYC data or requests missing via intervention
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, identity_id } = body;

    // Get master credentials from identity
    if (action === 'get_master_credentials') {
      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        { id: identity_id, user_email: user.email },
        null,
        1
      ).catch(() => []);

      if (!identities.length) {
        return Response.json({
          success: false,
          error: 'Identity not found',
          need_intervention: true,
          intervention_type: 'missing_identity'
        }, { status: 404 });
      }

      const identity = identities[0];

      // Check KYC data completeness — with multi-source email extraction
      const kyc = identity.kyc_verified_data || {};
      
      // Terminology-aware email extraction (try multiple sources)
      const extractedEmail = kyc.email 
        || identity.email 
        || (identity.onboarding_config ? tryParseOnboardingEmail(identity.onboarding_config) : null)
        || user.email;
      
      const extractedName = kyc.full_legal_name 
        || identity.name;
      
      const hasRequiredData = extractedName && extractedEmail;

      if (!hasRequiredData) {
        // Create intervention request for missing data
        const intervention = await base44.asServiceRole.entities.UserIntervention.create({
          user_email: user.email,
          requirement_type: 'missing_data',
          required_data: 'Complete identity profile (name, email) to enable account creation',
          data_schema: {
            type: 'object',
            properties: {
              full_legal_name: { type: 'string', description: 'Your legal full name' },
              email: { type: 'string', description: 'Email for account creation' }
            },
            required: ['full_legal_name', 'email']
          },
          status: 'pending'
        }).catch(() => null);

        return Response.json({
          success: false,
          error: `Identity missing required data (name: ${!!extractedName}, email: ${!!extractedEmail})`,
          need_intervention: true,
          intervention_id: intervention?.id,
          intervention_type: 'complete_identity'
        }, { status: 400 });
      }

      // Return real credentials from extracted data
      return Response.json({
        success: true,
        credentials: {
          email: extractedEmail,
          full_name: extractedName,
          phone: kyc.phone_number || '',
          identity_name: identity.name,
          identity_id: identity.id
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[MasterAccountCredentialEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});