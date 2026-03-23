import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // ── LIST USERS ────────────────────────────────────────────────────────────
    if (action === 'list_users') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      return Response.json({ users: Array.isArray(users) ? users : [] });
    }

    // ── LIST KYC — merges KYCVerification records + AIIdentity onboarding data ─
    if (action === 'list_kycs') {
      // Fetch both sources in parallel
      const [kycRecords, identities] = await Promise.all([
        base44.asServiceRole.entities.KYCVerification.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000).catch(() => []),
      ]);

      // Build a map of existing KYC records by user_email
      const kycByEmail = {};
      for (const k of (kycRecords || [])) {
        if (k.user_email) kycByEmail[k.user_email] = k;
      }

      // For identities that completed onboarding but have no KYCVerification record,
      // synthesize one from AIIdentity.kyc_verified_data or onboarding_config
      for (const identity of (identities || [])) {
        // Use user_email or fall back to created_by (the actual user email)
        const ownerEmail = identity.user_email || identity.created_by;
        if (!ownerEmail) continue;
        if (kycByEmail[ownerEmail]) continue; // already have a real record

        const kvd = identity.kyc_verified_data;
        let config = {};
        try { config = identity.onboarding_config ? JSON.parse(identity.onboarding_config) : {}; } catch {}

        const hasKYCData = kvd?.full_legal_name || config?.first_name || config?.government_id_type;
        if (!hasKYCData) continue;

        // Synthesize a virtual KYC record so admin can see it
        kycByEmail[ownerEmail] = {
          id: `identity_${identity.id}`, // virtual ID — signals it came from AIIdentity
          source: 'identity_onboarding',
          identity_id: identity.id,
          user_email: ownerEmail,
          full_legal_name: kvd?.full_legal_name || `${config.first_name || ''} ${config.last_name || ''}`.trim(),
          date_of_birth: kvd?.date_of_birth || config.date_of_birth,
          residential_address: kvd?.residential_address || config.address,
          city: kvd?.city || config.city,
          state: kvd?.state || config.state,
          postal_code: kvd?.postal_code || config.postal_code,
          country: kvd?.country || config.country,
          phone_number: kvd?.phone_number || config.phone,
          government_id_type: kvd?.government_id_type || config.government_id_type,
          id_document_front_url: kvd?.id_document_front_url || config.id_document_front,
          id_document_back_url: kvd?.id_document_back_url || config.id_document_back,
          selfie_url: kvd?.selfie_url || config.selfie,
          status: identity.onboarding_status === 'complete' ? 'submitted' : 'pending',
          admin_status: null,
          submitted_at: identity.updated_date,
          onboarding_complete: identity.onboarding_complete,
        };
      }

      return Response.json({ kycs: Object.values(kycByEmail) });
    }

    // ── LIST IDENTITIES ────────────────────────────────────────────────────────
    if (action === 'list_identities') {
      const identities = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000);
      return Response.json({ identities: Array.isArray(identities) ? identities : [] });
    }

    // ── APPROVE KYC ────────────────────────────────────────────────────────────
    if (action === 'approve_kyc') {
      const { kyc_id, user_email } = body;

      if (kyc_id && kyc_id.startsWith('identity_')) {
        // It's a virtual record from AIIdentity — need to create a real KYCVerification first
        const identity_id = kyc_id.replace('identity_', '');
        const identity = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000)
          .then(list => list.find(i => i.id === identity_id));

        if (identity) {
          const kvd = identity.kyc_verified_data || {};
          let config = {};
          try { config = identity.onboarding_config ? JSON.parse(identity.onboarding_config) : {}; } catch {}
          const ownerEmail = identity.user_email || identity.created_by;

          // Create the real KYCVerification record now
          const created = await base44.asServiceRole.entities.KYCVerification.create({
            user_email: ownerEmail,
            full_legal_name: kvd.full_legal_name || `${config.first_name || ''} ${config.last_name || ''}`.trim(),
            date_of_birth: kvd.date_of_birth || config.date_of_birth || '2000-01-01',
            residential_address: kvd.residential_address || config.address || 'N/A',
            status: 'approved',
            admin_status: 'approved',
            verified_at: new Date().toISOString(),
            approved_at: new Date().toISOString(),
            reviewed_by: user.email,
            submitted_at: identity.updated_date,
            government_id_type: kvd.government_id_type || config.government_id_type,
            user_approved_for_autopilot: true,
          });

          // Mark autopilot clearance on identity
          await base44.asServiceRole.entities.AIIdentity.update(identity_id, {
            'kyc_verified_data.kyc_tier': 'standard',
            'kyc_verified_data.autopilot_clearance': {
              can_submit_w9: true,
              can_submit_grant_applications: true,
              can_submit_financial_onboarding: true,
            },
          });
        }
      } else if (kyc_id) {
        // Real KYCVerification record
        await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
          status: 'approved',
          admin_status: 'approved',
          verified_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
          reviewed_by: user.email,
          user_approved_for_autopilot: true,
        });
      }

      return Response.json({ success: true });
    }

    // ── DENY KYC ───────────────────────────────────────────────────────────────
    if (action === 'deny_kyc') {
      const { kyc_id, reason } = body;

      if (kyc_id && kyc_id.startsWith('identity_')) {
        const identity_id = kyc_id.replace('identity_', '');
        const identity = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000)
          .then(list => list.find(i => i.id === identity_id));

        if (identity) {
          const kvd = identity.kyc_verified_data || {};
          let config = {};
          try { config = identity.onboarding_config ? JSON.parse(identity.onboarding_config) : {}; } catch {}
          const ownerEmail = identity.user_email || identity.created_by;

          await base44.asServiceRole.entities.KYCVerification.create({
            user_email: ownerEmail,
            full_legal_name: kvd.full_legal_name || `${config.first_name || ''} ${config.last_name || ''}`.trim(),
            date_of_birth: kvd.date_of_birth || config.date_of_birth || '2000-01-01',
            residential_address: kvd.residential_address || config.address || 'N/A',
            status: 'rejected',
            admin_status: 'rejected',
            reviewed_by: user.email,
            rejection_reason: reason || 'Rejected by administrator',
            submitted_at: identity.updated_date,
          });
        }
      } else if (kyc_id) {
        await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
          status: 'rejected',
          admin_status: 'rejected',
          reviewed_by: user.email,
          rejection_reason: reason || 'Rejected by administrator',
        });
      }

      return Response.json({ success: true });
    }

    // ── UPDATE USER ROLE ───────────────────────────────────────────────────────
    if (action === 'update_user_role') {
      const { user_id, role } = body;
      await base44.asServiceRole.entities.User.update(user_id, { role });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[adminService]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});