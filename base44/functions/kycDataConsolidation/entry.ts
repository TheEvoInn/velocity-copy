import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * KYC Data Consolidation Engine
 * Migrates scattered KYC data from various sources into unified KYCVerification records
 * Handles: old KYC records, AIIdentity blobs, onboarding remnants
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    if (action === 'consolidate_user_kyc') {
      return await consolidateUserKYC(base44, user);
    }

    if (action === 'migrate_all_users') {
      // Admin-only: migrate all users
      if (user.role !== 'admin') {
        return Response.json({ error: 'Admin access required' }, { status: 403 });
      }
      return await migrateAllUsers(base44, user);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function consolidateUserKYC(base44, user) {
  const report = {
    user_email: user.email,
    timestamp: new Date().toISOString(),
    sources_checked: [],
    records_found: 0,
    records_migrated: 0,
    records_updated: 0,
    related_syncs: [],
    errors: []
  };

  try {
    // 1. Check for existing KYCVerification record
    const existingKYC = await base44.entities.KYCVerification.filter(
      { user_email: user.email },
      '-created_date',
      1
    ).catch(() => []);

    report.sources_checked.push('KYCVerification');

    if (existingKYC.length > 0) {
      report.records_found++;
      report.kyc_record = {
        id: existingKYC[0].id,
        status: existingKYC[0].status,
        submitted_at: existingKYC[0].submitted_at,
        verified: existingKYC[0].status === 'verified' || existingKYC[0].status === 'approved'
      };
    }

    // 2. Check AIIdentity records for KYC data blobs
    const identities = await base44.entities.AIIdentity.filter(
      { user_email: user.email },
      null,
      100
    ).catch(() => []);

    report.sources_checked.push('AIIdentity');
    identities.forEach(identity => {
      if (identity.kyc_verified_data && Object.keys(identity.kyc_verified_data).length > 0) {
        report.records_found++;
      }
    });

    // Consolidate KYC data from AIIdentity into unified record
    if (identities.length > 0 && existingKYC.length === 0) {
      // Create unified record from identity KYC data
      const consolidatedKYC = await consolidateFromIdentities(base44, user, identities);
      if (consolidatedKYC.id) {
        report.records_migrated++;
        report.new_kyc_record_id = consolidatedKYC.id;
      }
    } else if (existingKYC.length > 0 && identities.length > 0) {
      // Update existing record with supplemental data from identities
      const updatedRecord = await enrichKYCFromIdentities(base44, user, existingKYC[0], identities);
      if (updatedRecord) {
        report.records_updated++;
      }
    }

    // 3. Sync AIIdentity records with KYC status
    const kycRecords = existingKYC.length > 0 
      ? existingKYC 
      : await base44.entities.KYCVerification.filter(
          { user_email: user.email },
          '-created_date',
          1
        ).catch(() => []);

    for (const identity of identities) {
      if (kycRecords.length > 0) {
        await base44.entities.AIIdentity.update(identity.id, {
          kyc_verified_data: {
            ...identity.kyc_verified_data,
            kyc_id: kycRecords[0].id,
            synced_at: new Date().toISOString(),
            kyc_status: kycRecords[0].status
          }
        }).catch(e => {
          report.errors.push(`Failed to sync AIIdentity ${identity.id}: ${e.message}`);
        });
        report.related_syncs.push(`AIIdentity ${identity.id}`);
      }
    }

    // 4. Sync UserGoals with KYC status
    const goals = await base44.entities.UserGoals.filter(
      { created_by: user.email },
      null,
      1
    ).catch(() => []);

    if (goals.length > 0 && kycRecords.length > 0) {
      await base44.entities.UserGoals.update(goals[0].id, {
        kyc_status: kycRecords[0].status,
        kyc_verified: kycRecords[0].status === 'verified' || kycRecords[0].status === 'approved'
      }).catch(e => {
        report.errors.push(`Failed to update UserGoals: ${e.message}`);
      });
      report.related_syncs.push('UserGoals');
    }

    // 5. Log consolidation event
    await base44.entities.ActivityLog.create({
      action_type: 'system',
      message: `📋 KYC data consolidation: ${report.records_migrated} migrated, ${report.records_updated} updated`,
      severity: 'info',
      metadata: {
        event: 'kyc_consolidation',
        records_found: report.records_found,
        migrated: report.records_migrated,
        updated: report.records_updated
      }
    }).catch(() => null);

    return Response.json({ success: true, report });

  } catch (error) {
    report.errors.push(`Fatal error: ${error.message}`);
    return Response.json({ success: false, report }, { status: 500 });
  }
}

async function consolidateFromIdentities(base44, user, identities) {
  // Find identity with most complete KYC data
  const sortedByKYCData = identities.sort((a, b) => {
    const aCount = a.kyc_verified_data ? Object.keys(a.kyc_verified_data).length : 0;
    const bCount = b.kyc_verified_data ? Object.keys(b.kyc_verified_data).length : 0;
    return bCount - aCount;
  });

  if (sortedByKYCData.length === 0 || !sortedByKYCData[0].kyc_verified_data) {
    return { id: null };
  }

  const sourceKYC = sortedByKYCData[0].kyc_verified_data;

  const consolidated = {
    user_email: user.email,
    full_legal_name: sourceKYC.full_legal_name || user.full_name,
    date_of_birth: sourceKYC.date_of_birth,
    residential_address: sourceKYC.residential_address || '',
    city: sourceKYC.city || '',
    state: sourceKYC.state || '',
    postal_code: sourceKYC.postal_code || '',
    country: sourceKYC.country || '',
    phone_number: sourceKYC.phone_number || '',
    government_id_type: sourceKYC.government_id_type,
    government_id_number: sourceKYC.government_id_number,
    government_id_expiry: sourceKYC.government_id_expiry,
    id_document_front_url: sourceKYC.id_document_front_url,
    id_document_back_url: sourceKYC.id_document_back_url,
    selfie_url: sourceKYC.selfie_url,
    tax_id: sourceKYC.tax_id,
    status: sourceKYC.kyc_tier && sourceKYC.kyc_tier !== 'none' ? 'verified' : 'submitted',
    submitted_at: new Date().toISOString()
  };

  try {
    const created = await base44.entities.KYCVerification.create(consolidated);
    return { id: created.id, success: true };
  } catch (error) {
    return { id: null, error: error.message };
  }
}

async function enrichKYCFromIdentities(base44, user, existingKYC, identities) {
  // Extract supplemental data from identities and merge into existing KYC
  const enrichmentData = {};

  for (const identity of identities) {
    if (identity.kyc_verified_data) {
      const kycData = identity.kyc_verified_data;
      
      // Fill in missing fields
      if (!existingKYC.date_of_birth && kycData.date_of_birth) {
        enrichmentData.date_of_birth = kycData.date_of_birth;
      }
      if (!existingKYC.tax_id && kycData.tax_id) {
        enrichmentData.tax_id = kycData.tax_id;
      }
      if (!existingKYC.id_document_front_url && kycData.id_document_front_url) {
        enrichmentData.id_document_front_url = kycData.id_document_front_url;
      }
      if (!existingKYC.id_document_back_url && kycData.id_document_back_url) {
        enrichmentData.id_document_back_url = kycData.id_document_back_url;
      }
      if (!existingKYC.selfie_url && kycData.selfie_url) {
        enrichmentData.selfie_url = kycData.selfie_url;
      }
    }
  }

  if (Object.keys(enrichmentData).length === 0) {
    return null;
  }

  try {
    await base44.entities.KYCVerification.update(existingKYC.id, enrichmentData);
    return { updated: true };
  } catch (error) {
    return { updated: false, error: error.message };
  }
}

async function migrateAllUsers(base44, adminUser) {
  const results = {
    timestamp: new Date().toISOString(),
    total_users_processed: 0,
    total_migrated: 0,
    total_updated: 0,
    errors: []
  };

  try {
    // Get all users
    const users = await base44.asServiceRole.entities.User.list(null, 1000);
    results.total_users_processed = users.length;

    for (const user of users) {
      try {
        // Call consolidation for each user
        const response = await base44.asServiceRole.functions.invoke('kycDataConsolidation', {
          action: 'consolidate_user_kyc'
        });

        if (response.data.report) {
          results.total_migrated += response.data.report.records_migrated || 0;
          results.total_updated += response.data.report.records_updated || 0;
        }
      } catch (error) {
        results.errors.push(`User ${user.email}: ${error.message}`);
      }
    }

    // Log admin action
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔄 Admin KYC consolidation: ${results.total_users_processed} users, ${results.total_migrated} migrated, ${results.total_updated} updated`,
      severity: 'info',
      metadata: results
    }).catch(() => null);

    return Response.json({ success: true, results });

  } catch (error) {
    results.errors.push(`Migration failed: ${error.message}`);
    return Response.json({ success: false, results }, { status: 500 });
  }
}