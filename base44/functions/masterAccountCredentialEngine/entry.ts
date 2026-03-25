import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MASTER ACCOUNT CREDENTIAL ENGINE
 * Returns REAL verified user data for account creation
 * Uses AIIdentity KYC data + onboarding config + terminology matching
 */

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

      // Extract email & name from multiple sources with fallback chain
      let extractedEmail = null;
      let extractedName = null;
      let extractionSource = {};

      // Source 1: KYC verified data (highest priority)
      const kyc = identity.kyc_verified_data || {};
      if (kyc.email) {
        extractedEmail = kyc.email;
        extractionSource.email = 'kyc_verified_data';
      }
      if (kyc.full_legal_name) {
        extractedName = kyc.full_legal_name;
        extractionSource.name = 'kyc_verified_data';
      }

      // Source 2: Direct identity fields
      if (!extractedEmail && identity.email) {
        extractedEmail = identity.email;
        extractionSource.email = 'identity_email';
      }
      if (!extractedName && identity.name) {
        extractedName = identity.name;
        extractionSource.name = 'identity_name';
      }

      // Source 3: Onboarding config (parse JSON blob for terminology-matched fields)
      if (identity.onboarding_config && (!extractedEmail || !extractedName)) {
        try {
          const onboardingData = typeof identity.onboarding_config === 'string'
            ? JSON.parse(identity.onboarding_config)
            : identity.onboarding_config;
          
          // Search for email using terminology matching
          if (!extractedEmail) {
            const emailKeys = ['email', 'user_email', 'account_email', 'contact_email', 'primary_email'];
            for (const key of emailKeys) {
              if (onboardingData[key]) {
                extractedEmail = onboardingData[key];
                extractionSource.email = `onboarding_config.${key}`;
                break;
              }
            }
          }
          
          // Search for name using terminology matching
          if (!extractedName) {
            const nameKeys = ['full_name', 'legal_name', 'full_legal_name', 'name', 'display_name'];
            for (const key of nameKeys) {
              if (onboardingData[key]) {
                extractedName = onboardingData[key];
                extractionSource.name = `onboarding_config.${key}`;
                break;
              }
            }
          }
        } catch (e) {
          console.warn('[MasterAccountCredentialEngine] Failed to parse onboarding_config:', e.message);
        }
      }

      // Source 4: Fallback to authenticated user
      if (!extractedEmail) {
        extractedEmail = user.email;
        extractionSource.email = 'user_email';
      }
      if (!extractedName) {
        extractedName = user.full_name || identity.name || 'User';
        extractionSource.name = 'user_full_name';
      }

      // Validate we have required data
      const hasRequiredData = extractedName && extractedEmail;

      if (!hasRequiredData) {
        const missingFields = [];
        if (!extractedName) missingFields.push('full_legal_name');
        if (!extractedEmail) missingFields.push('email');
        
        const intervention = await base44.asServiceRole.entities.UserIntervention.create({
          user_email: user.email,
          requirement_type: 'missing_data',
          required_data: `Missing required fields: ${missingFields.join(', ')}`,
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
          error: `Missing required identity data: ${missingFields.join(', ')}`,
          need_intervention: true,
          intervention_id: intervention?.id,
          intervention_type: 'complete_identity',
          missing_fields: missingFields
        }, { status: 400 });
      }

      // Return extracted real credentials
      return Response.json({
        success: true,
        credentials: {
          email: extractedEmail,
          full_name: extractedName,
          phone: kyc.phone_number || '',
          identity_name: identity.name,
          identity_id: identity.id,
          extraction_sources: extractionSource
        }
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[MasterAccountCredentialEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});