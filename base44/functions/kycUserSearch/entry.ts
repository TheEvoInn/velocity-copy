import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * KYC User Search & Consolidation
 * Find KYC records by user name and consolidate to primary account
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, search_name, search_email, user_id } = await req.json();

    if (action === 'search_kyc') {
      return await searchKYC(base44, user, search_name, search_email);
    }

    if (action === 'consolidate_user') {
      return await consolidateUserRecords(base44, user, user_id || search_email);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function searchKYC(base44, requestingUser, searchName, searchEmail) {
  const results = {
    search_query: { name: searchName, email: searchEmail },
    timestamp: new Date().toISOString(),
    kyc_records: [],
    identities: [],
    accounts: [],
    goals: [],
    total_records: 0
  };

  try {
    // Search KYCVerification records
    let kycRecords = [];
    
    if (searchEmail) {
      kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
        { user_email: searchEmail },
        '-created_date',
        10
      ).catch(() => []);
    } else if (searchName) {
      // Search by full_legal_name (fuzzy match)
      const allKYC = await base44.asServiceRole.entities.KYCVerification.list(null, 1000)
        .catch(() => []);
      kycRecords = allKYC.filter(kyc => {
        const name = (kyc.full_legal_name || '').toLowerCase();
        const query = searchName.toLowerCase();
        return name.includes(query) || query.includes(name.split(' ')[0]);
      });
    }

    results.kyc_records = kycRecords.map(k => ({
      id: k.id,
      user_email: k.user_email,
      full_name: k.full_legal_name,
      status: k.status,
      created_at: k.created_date,
      submitted_at: k.submitted_at,
      verified: k.status === 'verified' || k.status === 'approved'
    }));

    // If we have KYC records, search for related accounts
    if (kycRecords.length > 0) {
      const targetEmail = kycRecords[0].user_email;

      // Search AIIdentity records
      const identities = await base44.asServiceRole.entities.AIIdentity.filter(
        { user_email: targetEmail },
        null,
        100
      ).catch(() => []);

      results.identities = identities.map(i => ({
        id: i.id,
        name: i.name,
        role_label: i.role_label,
        is_active: i.is_active,
        onboarding_complete: i.onboarding_complete,
        kyc_synced: !!i.kyc_verified_data?.kyc_id
      }));

      // Search LinkedAccount records
      const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { created_by: targetEmail },
        null,
        100
      ).catch(() => []);

      results.accounts = accounts.map(a => ({
        id: a.id,
        platform: a.platform,
        username: a.username,
        health_status: a.health_status,
        ai_can_use: a.ai_can_use
      }));

      // Search UserGoals
      const goals = await base44.asServiceRole.entities.UserGoals.filter(
        { created_by: targetEmail },
        null,
        10
      ).catch(() => []);

      results.goals = goals.map(g => ({
        id: g.id,
        onboarded: g.onboarded,
        autopilot_enabled: g.autopilot_enabled,
        total_earned: g.total_earned
      }));

      results.total_records = 
        kycRecords.length + identities.length + accounts.length + goals.length;
    }

    return Response.json({ success: true, results });

  } catch (error) {
    results.error = error.message;
    return Response.json({ success: false, results }, { status: 500 });
  }
}

async function consolidateUserRecords(base44, requestingUser, targetEmail) {
  const report = {
    target_email: targetEmail,
    timestamp: new Date().toISOString(),
    consolidated_kyc: null,
    synced_identities: [],
    synced_accounts: [],
    errors: []
  };

  try {
    // Get KYC record(s) for target email
    const kycRecords = await base44.asServiceRole.entities.KYCVerification.filter(
      { user_email: targetEmail },
      '-created_date',
      10
    ).catch(() => []);

    if (kycRecords.length === 0) {
      report.errors.push('No KYC records found for this email');
      return Response.json({ success: false, report }, { status: 404 });
    }

    // Use most recent KYC as primary
    const primaryKYC = kycRecords[0];
    report.consolidated_kyc = {
      id: primaryKYC.id,
      status: primaryKYC.status,
      user_email: primaryKYC.user_email
    };

    // Merge any duplicate KYC records into primary
    if (kycRecords.length > 1) {
      for (let i = 1; i < kycRecords.length; i++) {
        const duplicate = kycRecords[i];
        
        // Merge data if primary is incomplete
        const mergedData = {};
        
        if (!primaryKYC.tax_id && duplicate.tax_id) {
          mergedData.tax_id = duplicate.tax_id;
        }
        if (!primaryKYC.id_document_front_url && duplicate.id_document_front_url) {
          mergedData.id_document_front_url = duplicate.id_document_front_url;
        }
        if (!primaryKYC.id_document_back_url && duplicate.id_document_back_url) {
          mergedData.id_document_back_url = duplicate.id_document_back_url;
        }
        if (!primaryKYC.selfie_url && duplicate.selfie_url) {
          mergedData.selfie_url = duplicate.selfie_url;
        }

        if (Object.keys(mergedData).length > 0) {
          await base44.asServiceRole.entities.KYCVerification.update(
            primaryKYC.id,
            mergedData
          ).catch(e => {
            report.errors.push(`Failed to merge duplicate KYC ${duplicate.id}: ${e.message}`);
          });
        }

        // Delete duplicate after merge
        await base44.asServiceRole.entities.KYCVerification.delete(duplicate.id)
          .catch(e => {
            report.errors.push(`Failed to delete duplicate KYC ${duplicate.id}: ${e.message}`);
          });
      }
    }

    // Sync AIIdentity records with primary KYC
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { user_email: targetEmail },
      null,
      100
    ).catch(() => []);

    for (const identity of identities) {
      const updateData = {
        kyc_verified_data: {
          ...identity.kyc_verified_data,
          kyc_id: primaryKYC.id,
          synced_at: new Date().toISOString(),
          kyc_status: primaryKYC.status,
          kyc_tier: primaryKYC.status === 'verified' || primaryKYC.status === 'approved' 
            ? 'enhanced' 
            : 'basic'
        }
      };

      await base44.asServiceRole.entities.AIIdentity.update(identity.id, updateData)
        .catch(e => {
          report.errors.push(`Failed to sync AIIdentity ${identity.id}: ${e.message}`);
        });

      report.synced_identities.push({
        id: identity.id,
        name: identity.name,
        kyc_synced: true
      });
    }

    // Sync LinkedAccount records
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { created_by: targetEmail },
      null,
      100
    ).catch(() => []);

    for (const account of accounts) {
      await base44.asServiceRole.entities.LinkedAccount.update(account.id, {
        kyc_verified: primaryKYC.status === 'verified' || primaryKYC.status === 'approved',
        kyc_record_id: primaryKYC.id
      }).catch(e => {
        report.errors.push(`Failed to sync LinkedAccount ${account.id}: ${e.message}`);
      });

      report.synced_accounts.push({
        id: account.id,
        platform: account.platform,
        kyc_synced: true
      });
    }

    // Update UserGoals with KYC status
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: targetEmail },
      null,
      1
    ).catch(() => []);

    if (goals.length > 0) {
      await base44.asServiceRole.entities.UserGoals.update(goals[0].id, {
        kyc_status: primaryKYC.status,
        kyc_verified: primaryKYC.status === 'verified' || primaryKYC.status === 'approved',
        kyc_record_id: primaryKYC.id
      }).catch(e => {
        report.errors.push(`Failed to update UserGoals: ${e.message}`);
      });
    }

    // Log consolidation
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔗 KYC consolidation: ${targetEmail} - Primary KYC: ${primaryKYC.id}, ${report.synced_identities.length} identities synced, ${report.synced_accounts.length} accounts synced`,
      severity: 'success',
      metadata: {
        event: 'kyc_user_consolidation',
        target_email: targetEmail,
        primary_kyc: primaryKYC.id,
        identities_synced: report.synced_identities.length,
        accounts_synced: report.synced_accounts.length
      }
    }).catch(() => null);

    return Response.json({ success: true, report });

  } catch (error) {
    report.errors.push(`Fatal consolidation error: ${error.message}`);
    return Response.json({ success: false, report }, { status: 500 });
  }
}