import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * MASTER ACCOUNT CREDENTIAL ENGINE
 * Single source of truth for user identity data used in account creation
 * Validates user has provided required KYC data before returning credentials
 * Never fabricates — always asks user for missing data via intervention system
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, identity_id } = body;

    if (action === 'get_master_credentials') {
      return await getMasterCredentials(base44, user, identity_id);
    }

    if (action === 'update_credentials') {
      return await updateCredentials(base44, user, body);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[MasterAccountCredentialEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Get verified master credentials for identity
 * Sources: User entity + AIIdentity KYC data
 */
async function getMasterCredentials(base44, user, identity_id) {
  try {
    if (!identity_id) {
      return Response.json({
        success: false,
        error: 'identity_id required'
      });
    }

    // Fetch AIIdentity with KYC data
    const identity = await base44.entities.AIIdentity.get(identity_id).catch(() => null);
    if (!identity) {
      return Response.json({
        success: false,
        error: 'Identity not found'
      });
    }

    const kyc = identity.kyc_verified_data || {};

    // Validate minimum required fields
    const requiredFields = {
      email: identity.email || user.email,
      full_name: kyc.full_legal_name || user.full_name,
      phone: kyc.phone_number || null,
      identity_name: identity.name
    };

    // Check for missing critical fields
    if (!requiredFields.email) {
      // Trigger intervention for missing email
      await base44.asServiceRole.entities.UserIntervention.create({
        user_email: user.email,
        task_id: 'system_account_creation',
        requirement_type: 'missing_data',
        required_data: 'Email address required for account creation',
        data_schema: {
          type: 'object',
          properties: { email: { type: 'string', format: 'email' } }
        },
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }).catch(() => null);

      return Response.json({
        success: false,
        error: 'Email required. User intervention requested.',
        requires_intervention: true,
        missing_fields: ['email']
      });
    }

    if (!requiredFields.full_name) {
      // Trigger intervention for missing name
      await base44.asServiceRole.entities.UserIntervention.create({
        user_email: user.email,
        task_id: 'system_account_creation',
        requirement_type: 'missing_data',
        required_data: 'Full name required for account creation',
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      }).catch(() => null);

      return Response.json({
        success: false,
        error: 'Full name required. User intervention requested.',
        requires_intervention: true,
        missing_fields: ['full_name']
      });
    }

    // Generate consistent username from real data
    const username = (requiredFields.full_name || 'user')
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '')
      .substring(0, 20);

    return Response.json({
      success: true,
      credentials: {
        ...requiredFields,
        username,
        kyc_verified: kyc.kyc_id ? true : false,
        kyc_tier: kyc.kyc_tier || 'none'
      }
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    });
  }
}

/**
 * Update master credentials if user provides missing data
 */
async function updateCredentials(base44, user, body) {
  try {
    const { identity_id, updates } = body;

    if (!identity_id) {
      return Response.json({ success: false, error: 'identity_id required' });
    }

    // Update AIIdentity with new data
    const identity = await base44.entities.AIIdentity.get(identity_id);
    const currentKyc = identity.kyc_verified_data || {};

    const updated = await base44.asServiceRole.entities.AIIdentity.update(identity_id, {
      email: updates.email || identity.email,
      kyc_verified_data: {
        ...currentKyc,
        full_legal_name: updates.full_name || currentKyc.full_legal_name,
        phone_number: updates.phone || currentKyc.phone_number
      }
    });

    return Response.json({
      success: true,
      message: 'Credentials updated',
      identity_id: updated.id
    });
  } catch (error) {
    return Response.json({
      success: false,
      error: error.message
    });
  }
}