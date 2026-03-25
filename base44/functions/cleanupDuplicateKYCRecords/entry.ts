import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * CLEANUP DUPLICATE PENDING KYC RECORDS
 * 
 * Admin-only function to:
 * 1. Find all users with multiple KYC records
 * 2. For each user, keep only the LATEST pending/submitted KYC
 * 3. Delete duplicate older records
 * 4. Return cleanup report
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    console.log('[KYC Cleanup] Starting duplicate KYC removal...');

    const report = {
      timestamp: new Date().toISOString(),
      total_kyc_records: 0,
      users_with_duplicates: 0,
      duplicates_deleted: 0,
      details: [],
      errors: [],
    };

    // Fetch ALL KYC records
    const allKYCs = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 10000);
    report.total_kyc_records = allKYCs.length;
    console.log(`[KYC Cleanup] Found ${allKYCs.length} total KYC records`);

    // Group by user_email
    const kycsPerUser = {};
    for (const kyc of allKYCs) {
      const email = kyc.user_email || kyc.created_by || 'UNKNOWN';
      if (!kycsPerUser[email]) {
        kycsPerUser[email] = [];
      }
      kycsPerUser[email].push(kyc);
    }

    // Process each user
    for (const [email, userKYCs] of Object.entries(kycsPerUser)) {
      // Sort by created_date descending (latest first)
      userKYCs.sort((a, b) => new Date(b.created_date) - new Date(a.created_date));

      // Find duplicates (same status, keep only latest)
      const statusGroups = {};
      for (const kyc of userKYCs) {
        const status = kyc.status || 'pending';
        if (!statusGroups[status]) {
          statusGroups[status] = [];
        }
        statusGroups[status].push(kyc);
      }

      // Delete duplicates: keep first (latest), delete rest
      for (const [status, kycsWithStatus] of Object.entries(statusGroups)) {
        if (kycsWithStatus.length > 1 && (status === 'pending' || status === 'submitted')) {
          // Keep the latest, delete the rest
          const toDelete = kycsWithStatus.slice(1);
          
          report.users_with_duplicates++;
          
          for (const kyc of toDelete) {
            try {
              await base44.asServiceRole.entities.KYCVerification.delete(kyc.id);
              report.duplicates_deleted++;
              report.details.push({
                user_email: email,
                deleted_kyc_id: kyc.id,
                status,
                created_date: kyc.created_date,
                reason: `Duplicate ${status} KYC (kept newer)`,
              });
              console.log(`[KYC Cleanup] ✓ Deleted duplicate KYC ${kyc.id} for ${email}`);
            } catch (e) {
              report.errors.push(`Failed to delete KYC ${kyc.id}: ${e.message}`);
              console.error(`[KYC Cleanup] ✗ Delete failed for ${kyc.id}:`, e.message);
            }
          }
        }
      }
    }

    // Log to activity
    try {
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🧹 KYC cleanup: Removed ${report.duplicates_deleted} duplicate pending KYC records from ${report.users_with_duplicates} users`,
        severity: 'success',
        metadata: {
          total_duplicates_deleted: report.duplicates_deleted,
          users_affected: report.users_with_duplicates,
        },
      });
    } catch (e) {
      console.warn('[KYC Cleanup] Could not create activity log:', e.message);
    }

    console.log(`[KYC Cleanup] ✅ Complete: Deleted ${report.duplicates_deleted} duplicates from ${report.users_with_duplicates} users`);
    return Response.json(report, { status: 200 });
  } catch (error) {
    console.error('[KYC Cleanup] FATAL ERROR:', error);
    return Response.json(
      {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
});