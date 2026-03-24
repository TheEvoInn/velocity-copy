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

    if (action === 'list_users') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 200);
      return Response.json({ users });
    }

    if (action === 'list_kycs') {
      // Get real KYC records
      const realKycs = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 200);

      // Get all AIIdentity records with onboarding data
      const identities = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 500);

      const virtualKycs = [];
      for (const identity of identities) {
        if (!identity.onboarding_config && !identity.kyc_verified_data) continue;

        let config = {};
        try { config = identity.onboarding_config ? JSON.parse(identity.onboarding_config) : {}; } catch {}

        const kvd = identity.kyc_verified_data || {};
        const ownerEmail = identity.user_email || identity.created_by;

        // Skip if no personal data
        const hasData = kvd.full_legal_name || config.full_legal_name || config.personal_info?.full_legal_name;
        if (!hasData) continue;

        // Skip if already has a real KYC record
        const alreadyReal = realKycs.find(k => k.identity_id === identity.id);
        if (alreadyReal) continue;

        const personal = config.personal_info || config || {};

        virtualKycs.push({
          id: `identity_${identity.id}`,
          source: 'identity_onboarding',
          identity_id: identity.id,
          user_email: ownerEmail,
          full_legal_name: kvd.full_legal_name || personal.full_legal_name || '',
          date_of_birth: kvd.date_of_birth || personal.date_of_birth || '',
          residential_address: kvd.residential_address || personal.residential_address || '',
          city: kvd.city || personal.city || '',
          state: kvd.state || personal.state || '',
          postal_code: kvd.postal_code || personal.postal_code || '',
          country: kvd.country || personal.country || '',
          phone_number: kvd.phone_number || personal.phone_number || '',
          government_id_type: kvd.government_id_type || personal.government_id_type || '',
          id_document_front_url: kvd.id_document_front_url || '',
          id_document_back_url: kvd.id_document_back_url || '',
          selfie_url: kvd.selfie_url || '',
          status: 'submitted',
          admin_status: null,
          submitted_at: identity.updated_date || identity.created_date,
          onboarding_complete: identity.onboarding_complete || false,
        });
      }

      const allKycs = [
        ...realKycs.map(k => ({ ...k, source: 'kyc_entity' })),
        ...virtualKycs
      ];

      return Response.json({ kycs: allKycs });
    }

    if (action === 'approve_kyc') {
      const { kyc_id } = body;

      if (kyc_id.startsWith('identity_')) {
        const identityId = kyc_id.replace('identity_', '');
        const identity = await base44.asServiceRole.entities.AIIdentity.get(identityId);
        if (identity) {
          const kvd = identity.kyc_verified_data || {};
          let config = {};
          try { config = identity.onboarding_config ? JSON.parse(identity.onboarding_config) : {}; } catch {}
          const ownerEmail = identity.user_email || identity.created_by;
          const personal = config.personal_info || config || {};

          const created = await base44.asServiceRole.entities.KYCVerification.create({
            user_email: ownerEmail,
            identity_id: identityId,
            full_legal_name: kvd.full_legal_name || personal.full_legal_name || '',
            date_of_birth: kvd.date_of_birth || personal.date_of_birth || '',
            residential_address: kvd.residential_address || personal.residential_address || '',
            city: kvd.city || personal.city || '',
            state: kvd.state || personal.state || '',
            postal_code: kvd.postal_code || personal.postal_code || '',
            country: kvd.country || personal.country || '',
            phone_number: kvd.phone_number || personal.phone_number || '',
            government_id_type: kvd.government_id_type || personal.government_id_type || '',
            id_document_front_url: kvd.id_document_front_url || '',
            id_document_back_url: kvd.id_document_back_url || '',
            selfie_url: kvd.selfie_url || '',
            status: 'approved',
            verified_at: new Date().toISOString(),
          });

          await base44.asServiceRole.entities.AIIdentity.update(identityId, {
            kyc_verified_data: { ...kvd, kyc_tier: 'standard', synced_at: new Date().toISOString() }
          });

          return Response.json({ success: true, created_id: created.id });
        }
      } else {
        await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
          status: 'approved',
          verified_at: new Date().toISOString(),
        });
        return Response.json({ success: true });
      }
    }

    if (action === 'deny_kyc') {
      const { kyc_id, reason } = body;

      if (kyc_id.startsWith('identity_')) {
        const identityId = kyc_id.replace('identity_', '');
        const identity = await base44.asServiceRole.entities.AIIdentity.get(identityId);
        if (identity) {
          const kvd = identity.kyc_verified_data || {};
          let config = {};
          try { config = identity.onboarding_config ? JSON.parse(identity.onboarding_config) : {}; } catch {}
          const ownerEmail = identity.user_email || identity.created_by;
          const personal = config.personal_info || config || {};

          await base44.asServiceRole.entities.KYCVerification.create({
            user_email: ownerEmail,
            identity_id: identityId,
            full_legal_name: kvd.full_legal_name || personal.full_legal_name || '',
            status: 'rejected',
            rejection_reason: reason || 'Denied by admin',
            verified_at: new Date().toISOString(),
          });
        }
      } else {
        await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
          status: 'rejected',
          rejection_reason: reason || 'Denied by admin',
        });
      }
      return Response.json({ success: true });
    }

    if (action === 'update_user_role') {
      const { user_id, role } = body;
      await base44.asServiceRole.entities.User.update(user_id, { role });
      return Response.json({ success: true });
    }

    if (action === 'get_stats') {
      const [users, opportunities, transactions, identities, kycs, activityLogs] = await Promise.all([
        base44.asServiceRole.entities.User.list('-created_date', 500),
        base44.asServiceRole.entities.Opportunity.list('-created_date', 500),
        base44.asServiceRole.entities.Transaction.list('-created_date', 500),
        base44.asServiceRole.entities.AIIdentity.list('-created_date', 500),
        base44.asServiceRole.entities.KYCVerification.list('-created_date', 200),
        base44.asServiceRole.entities.ActivityLog.list('-created_date', 100),
      ]);

      const totalRevenue = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);

      const activeOpps = opportunities.filter(o => ['new','reviewing','queued','executing'].includes(o.status)).length;
      const completedOpps = opportunities.filter(o => o.status === 'completed').length;

      return Response.json({
        stats: {
          total_users: users.length,
          total_opportunities: opportunities.length,
          active_opportunities: activeOpps,
          completed_opportunities: completedOpps,
          total_revenue: totalRevenue,
          total_identities: identities.length,
          kyc_pending: kycs.filter(k => k.status === 'submitted' || k.status === 'pending').length,
          kyc_approved: kycs.filter(k => k.status === 'approved').length,
          recent_activity: activityLogs.slice(0, 20),
          users,
        }
      });
    }

    if (action === 'list_opportunities') {
      const opps = await base44.asServiceRole.entities.Opportunity.list('-created_date', 200);
      return Response.json({ opportunities: opps });
    }

    if (action === 'list_transactions') {
      const txns = await base44.asServiceRole.entities.Transaction.list('-created_date', 200);
      return Response.json({ transactions: txns });
    }

    if (action === 'list_activity') {
      const logs = await base44.asServiceRole.entities.ActivityLog.list('-created_date', 200);
      return Response.json({ logs });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});