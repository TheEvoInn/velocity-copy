import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MASTER ACCOUNT CREDENTIAL ENGINE
 * ROOT CAUSE FIX: asServiceRole applies RLS as service account (no records match)
 * Use user-scoped base44.entities for reading user's own AIIdentity
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    console.log('[MasterCredentialEngine] user.email:', user.email);

    const body = await req.json();
    const { action, identity_id } = body;

    if (action === 'get_master_credentials') {
      if (!identity_id) {
        return Response.json({ success: false, error: 'identity_id is required' }, { status: 400 });
      }

      console.log('[MasterCredentialEngine] Looking up identity_id:', identity_id);

      // CRITICAL FIX: Use USER-SCOPED .get() (not asServiceRole)
      // asServiceRole applies RLS as the service account, which owns ZERO user records
      // User-scoped .get() applies RLS as the authenticated user — matches their own records
      let identity = await base44.entities.AIIdentity.get(identity_id).catch((e) => {
        console.warn('[MasterCredentialEngine] user-scoped .get() failed:', e.message);
        return null;
      });

      // Fallback: list the user's own identities and find by id
      if (!identity) {
        console.log('[MasterCredentialEngine] Fallback: listing user identities...');
        const userIdentities = await base44.entities.AIIdentity.list('-created_date', 100).catch(() => []);
        console.log('[MasterCredentialEngine] User identities found:', userIdentities.length);
        identity = userIdentities.find(i => i.id === identity_id) || null;
        if (identity) {
          console.log('[MasterCredentialEngine] Found via list fallback:', identity.name);
        }
      }

      if (!identity) {
        console.error('[MasterCredentialEngine] Identity not found. id:', identity_id, 'user:', user.email);
        return Response.json({
          success: false,
          error: 'Identity not found',
          need_intervention: true,
          intervention_type: 'missing_identity',
          debug_identity_id: identity_id,
          debug_user_email: user.email
        }, { status: 404 });
      }

      console.log('[MasterCredentialEngine] Identity found:', identity.name, '| created_by:', identity.created_by);

      // Extract email & name — 4-source fallback chain
      let extractedEmail = null;
      let extractedName = null;
      const extractionSource = {};

      // Source 1: KYC verified data (highest priority)
      const kyc = identity.kyc_verified_data || {};
      if (kyc.email) { extractedEmail = kyc.email; extractionSource.email = 'kyc_verified_data'; }
      if (kyc.full_legal_name) { extractedName = kyc.full_legal_name; extractionSource.name = 'kyc_verified_data'; }

      // Source 2: Direct identity fields
      if (!extractedEmail && identity.email) { extractedEmail = identity.email; extractionSource.email = 'identity_email'; }
      if (!extractedName && identity.name) { extractedName = identity.name; extractionSource.name = 'identity_name'; }

      // Source 3: Onboarding config JSON blob
      if (identity.onboarding_config && (!extractedEmail || !extractedName)) {
        try {
          const od = typeof identity.onboarding_config === 'string'
            ? JSON.parse(identity.onboarding_config)
            : identity.onboarding_config;

          if (!extractedEmail) {
            for (const key of ['email', 'user_email', 'account_email', 'contact_email', 'primary_email']) {
              if (od[key]) { extractedEmail = od[key]; extractionSource.email = `onboarding_config.${key}`; break; }
            }
          }
          if (!extractedName) {
            for (const key of ['full_name', 'legal_name', 'full_legal_name', 'name', 'display_name']) {
              if (od[key]) { extractedName = od[key]; extractionSource.name = `onboarding_config.${key}`; break; }
            }
          }
        } catch (e) {
          console.warn('[MasterCredentialEngine] Failed to parse onboarding_config:', e.message);
        }
      }

      // Source 4: Fallback to authenticated user's own data
      if (!extractedEmail) { extractedEmail = user.email; extractionSource.email = 'user_auth_email'; }
      if (!extractedName) { extractedName = user.full_name || identity.name || 'User'; extractionSource.name = 'user_full_name'; }

      console.log('[MasterCredentialEngine] Resolved — email:', extractedEmail, '| name:', extractedName);

      // Validate
      if (!extractedName || !extractedEmail) {
        const missingFields = [];
        if (!extractedName) missingFields.push('full_legal_name');
        if (!extractedEmail) missingFields.push('email');

        await base44.asServiceRole.entities.UserIntervention.create({
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
          intervention_type: 'complete_identity',
          missing_fields: missingFields
        }, { status: 400 });
      }

      return Response.json({
        success: true,
        credentials: {
          email: extractedEmail,
          full_name: extractedName,
          phone: kyc.phone_number || identity.phone || '',
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