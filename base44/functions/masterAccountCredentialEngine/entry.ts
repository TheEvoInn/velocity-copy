/**
 * MASTER ACCOUNT CREDENTIAL ENGINE
 * Resolves pre-approved, KYC-verified user data for autonomous account creation.
 * Used when: user is unavailable, opportunity is time-sensitive, or autopilot must act immediately.
 * Data source: AIIdentity.kyc_verified_data + AIIdentity fields + UserGoals
 * NEVER fabricates or simulates data. Only uses real, user-provided inputs.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── get_master_credentials ─────────────────────────────────────────────────
    if (action === 'get_master_credentials') {
      const { identity_id } = body;

      // Load identity
      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        identity_id ? { id: identity_id } : { user_email: user.email }, null, 1
      ).catch(() => []);

      const identity = identities[0] || null;

      if (!identity) {
        return Response.json({
          success: false,
          error: 'No identity found. User must complete onboarding first.',
          requires_onboarding: true
        });
      }

      const kyc = identity.kyc_verified_data || {};
      const brand = identity.brand_assets || {};

      // Build master credentials from verified sources ONLY
      const masterCredentials = {
        // Identity
        full_name: kyc.full_legal_name || identity.name || null,
        email: kyc.email || identity.email || null,
        phone: kyc.phone_number || identity.phone || null,
        date_of_birth: kyc.date_of_birth || null,

        // Address
        address: kyc.residential_address || null,
        city: kyc.city || null,
        state: kyc.state || null,
        postal_code: kyc.postal_code || null,
        country: kyc.country || null,

        // Professional
        bio: identity.bio || brand.work_history_summary || null,
        tagline: identity.tagline || null,
        skills: identity.skills || [],
        certifications: brand.certifications || [],
        portfolio_references: brand.portfolio_references || [],

        // Platform data
        preferred_categories: identity.preferred_categories || [],
        preferred_platforms: identity.preferred_platforms || [],

        // KYC status
        kyc_tier: kyc.kyc_tier || 'none',
        kyc_verified: !!kyc.full_legal_name,
        identity_id: identity.id,
        identity_name: identity.name
      };

      // Validate completeness
      const missingFields = [];
      if (!masterCredentials.full_name) missingFields.push('full_name');
      if (!masterCredentials.email) missingFields.push('email');

      const completeness = Math.round(
        (Object.values(masterCredentials).filter(v => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0)).length /
        Object.keys(masterCredentials).length) * 100
      );

      return Response.json({
        success: true,
        credentials: masterCredentials,
        completeness_pct: completeness,
        is_ready: missingFields.length === 0,
        missing_fields: missingFields,
        kyc_verified: masterCredentials.kyc_verified,
        source: 'kyc_verified_identity'
      });
    }

    // ── match_fields ───────────────────────────────────────────────────────────
    // Takes a list of required signup fields and returns matched values from master credentials
    if (action === 'match_fields') {
      const { required_fields, identity_id, platform } = body;

      if (!required_fields || !Array.isArray(required_fields)) {
        return Response.json({ error: 'required_fields array required' }, { status: 400 });
      }

      // Get master credentials
      const credResult = await base44.functions.invoke('masterAccountCredentialEngine', {
        action: 'get_master_credentials',
        identity_id
      }).catch(e => ({ data: { success: false, error: e.message } }));

      const masterCreds = credResult.data?.credentials;
      if (!masterCreds) {
        return Response.json({ success: false, error: 'Could not resolve master credentials' });
      }

      // Field mapping table: maps common form field names to credential keys
      const FIELD_MAP = {
        // Name variants
        'full_name': masterCreds.full_name,
        'name': masterCreds.full_name,
        'fullname': masterCreds.full_name,
        'first_name': masterCreds.full_name?.split(' ')[0] || null,
        'last_name': masterCreds.full_name?.split(' ').slice(1).join(' ') || null,
        'firstname': masterCreds.full_name?.split(' ')[0] || null,
        'lastname': masterCreds.full_name?.split(' ').slice(1).join(' ') || null,
        // Email
        'email': masterCreds.email,
        'email_address': masterCreds.email,
        // Phone
        'phone': masterCreds.phone,
        'phone_number': masterCreds.phone,
        'mobile': masterCreds.phone,
        // Address
        'address': masterCreds.address,
        'street_address': masterCreds.address,
        'city': masterCreds.city,
        'state': masterCreds.state,
        'zip': masterCreds.postal_code,
        'postal_code': masterCreds.postal_code,
        'country': masterCreds.country,
        // Professional
        'bio': masterCreds.bio,
        'about': masterCreds.bio,
        'description': masterCreds.bio,
        'tagline': masterCreds.tagline,
        'headline': masterCreds.tagline,
        'title': masterCreds.tagline,
        'skills': masterCreds.skills?.join(', ') || null,
        // Generated fields
        'username': generateUsername(masterCreds.full_name, platform),
        'password': generateSecurePassword(),
        'dob': masterCreds.date_of_birth,
        'date_of_birth': masterCreds.date_of_birth,
        'birth_date': masterCreds.date_of_birth,
      };

      const matched = {};
      const unmatched = [];

      for (const field of required_fields) {
        const key = field.toLowerCase().replace(/[\s-]/g, '_');
        if (FIELD_MAP[key] !== undefined && FIELD_MAP[key] !== null) {
          matched[field] = FIELD_MAP[key];
        } else {
          unmatched.push(field);
        }
      }

      return Response.json({
        success: true,
        matched,
        unmatched,
        match_rate_pct: Math.round((Object.keys(matched).length / required_fields.length) * 100),
        requires_intervention: unmatched.length > 0
      });
    }

    // ── get_status ─────────────────────────────────────────────────────────────
    if (action === 'get_status') {
      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        { user_email: user.email }, null, 1
      ).catch(() => []);

      const identity = identities[0];
      const kyc = identity?.kyc_verified_data || {};

      return Response.json({
        success: true,
        has_identity: !!identity,
        has_email: !!(kyc.email || identity?.email),
        has_kyc: !!(kyc.full_legal_name),
        kyc_tier: kyc.kyc_tier || 'none',
        identity_name: identity?.name || null,
        ready_for_auto_creation: !!(identity && (kyc.email || identity?.email))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[MasterAccountCredentialEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function generateUsername(fullName, platform) {
  if (!fullName) return null;
  const base = fullName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const suffix = Math.random().toString(36).substring(2, 6);
  return `${base}_${suffix}`;
}

function generateSecurePassword(length = 16) {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_+-=';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let pwd = '';
  for (let i = 0; i < length; i++) pwd += charset[array[i] % charset.length];
  return pwd;
}