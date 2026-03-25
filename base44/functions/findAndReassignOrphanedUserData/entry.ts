import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * FIND & REASSIGN ORPHANED USER DATA GLOBALLY
 * 
 * Scans ALL records across ALL users for:
 * 1. Records with NO owner (created_by missing)
 * 2. Records with mismatched user_email vs created_by
 * 3. Records that reference deleted identities
 * 4. Transactions/Opportunities belonging to this user but under wrong account
 * 
 * Reassigns them to the current user WITHOUT duplicating.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Orphan Finder] Scanning for orphaned data belonging to ${user.email}`);

    const report = {
      timestamp: new Date().toISOString(),
      user_email: user.email,
      orphaned_found: {
        transactions: [],
        opportunities: [],
        identities: [],
        goals: [],
        kyc_records: [],
      },
      reassigned: {
        transactions: 0,
        opportunities: 0,
        identities: 0,
        goals: 0,
        kyc_records: 0,
      },
      errors: [],
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 1. SCAN TRANSACTIONS GLOBALLY FOR ORPHANED RECORDS
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      const allTransactions = await base44.entities.Transaction.list('-created_date', 1000);
      
      for (const tx of allTransactions) {
        // Check if this TX belongs to current user but is marked under different account
        if (!tx.created_by) {
          // Completely orphaned
          report.orphaned_found.transactions.push({
            id: tx.id,
            reason: 'NO OWNER',
            amount: tx.amount,
            platform: tx.platform,
          });
        } else if (tx.created_by !== user.email && tx.platform && tx.amount > 0) {
          // Could belong to current user if metadata/platform matches
          report.orphaned_found.transactions.push({
            id: tx.id,
            reason: 'WRONG ACCOUNT',
            current_owner: tx.created_by,
            amount: tx.amount,
            platform: tx.platform,
          });
        }
      }

      // Reassign completely orphaned transactions
      for (const tx of report.orphaned_found.transactions.filter(t => t.reason === 'NO OWNER')) {
        try {
          await base44.entities.Transaction.update(tx.id, {
            created_by: user.email,
          });
          report.reassigned.transactions++;
          console.log(`[Orphan Finder] ✓ Reassigned TX ${tx.id} to ${user.email}`);
        } catch (e) {
          report.errors.push(`Failed to reassign TX ${tx.id}: ${e.message}`);
        }
      }
    } catch (e) {
      report.errors.push(`Transaction scan failed: ${e.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. SCAN OPPORTUNITIES GLOBALLY
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      const allOpportunities = await base44.entities.Opportunity.list('-created_date', 1000);
      
      for (const opp of allOpportunities) {
        if (!opp.created_by) {
          report.orphaned_found.opportunities.push({
            id: opp.id,
            reason: 'NO OWNER',
            title: opp.title,
            category: opp.category,
          });
        } else if (opp.created_by !== user.email && opp.title && opp.status !== 'dismissed') {
          report.orphaned_found.opportunities.push({
            id: opp.id,
            reason: 'WRONG ACCOUNT',
            current_owner: opp.created_by,
            title: opp.title,
          });
        }
      }

      // Reassign orphaned opportunities
      for (const opp of report.orphaned_found.opportunities.filter(o => o.reason === 'NO OWNER')) {
        try {
          await base44.entities.Opportunity.update(opp.id, {
            created_by: user.email,
          });
          report.reassigned.opportunities++;
          console.log(`[Orphan Finder] ✓ Reassigned OPP ${opp.id} to ${user.email}`);
        } catch (e) {
          report.errors.push(`Failed to reassign OPP ${opp.id}: ${e.message}`);
        }
      }
    } catch (e) {
      report.errors.push(`Opportunity scan failed: ${e.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 3. SCAN AIIDENTITIES FOR ORPHANED OR MISMATCHED
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      const allIdentities = await base44.entities.AIIdentity.list('-created_date', 500);
      
      for (const identity of allIdentities) {
        if (!identity.user_email && identity.name) {
          report.orphaned_found.identities.push({
            id: identity.id,
            reason: 'NO USER EMAIL',
            name: identity.name,
          });
        } else if (identity.user_email !== user.email && identity.created_by === user.email) {
          // Created by current user but user_email field is different
          report.orphaned_found.identities.push({
            id: identity.id,
            reason: 'MISMATCHED USER_EMAIL',
            name: identity.name,
            stored_email: identity.user_email,
          });
        }
      }

      // Fix orphaned identities
      for (const identity of report.orphaned_found.identities.filter(i => i.reason === 'NO USER EMAIL')) {
        try {
          await base44.entities.AIIdentity.update(identity.id, {
            user_email: user.email,
          });
          report.reassigned.identities++;
          console.log(`[Orphan Finder] ✓ Fixed AIIdentity ${identity.id} user_email`);
        } catch (e) {
          report.errors.push(`Failed to fix AIIdentity ${identity.id}: ${e.message}`);
        }
      }
    } catch (e) {
      report.errors.push(`AIIdentity scan failed: ${e.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 4. SCAN KYC RECORDS FOR WRONG USER_EMAIL
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      const allKYC = await base44.entities.KYCVerification.list('-created_date', 500);
      
      for (const kyc of allKYC) {
        if (!kyc.user_email && kyc.full_legal_name) {
          report.orphaned_found.kyc_records.push({
            id: kyc.id,
            reason: 'NO USER EMAIL',
            name: kyc.full_legal_name,
          });
        }
      }

      // Reassign orphaned KYC
      for (const kyc of report.orphaned_found.kyc_records.filter(k => k.reason === 'NO USER EMAIL')) {
        try {
          await base44.entities.KYCVerification.update(kyc.id, {
            user_email: user.email,
          });
          report.reassigned.kyc_records++;
          console.log(`[Orphan Finder] ✓ Reassigned KYC ${kyc.id} to ${user.email}`);
        } catch (e) {
          report.errors.push(`Failed to reassign KYC ${kyc.id}: ${e.message}`);
        }
      }
    } catch (e) {
      report.errors.push(`KYC scan failed: ${e.message}`);
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 5. VERIFY USER GOALS EXISTS (if data found, ensure goals synced)
    // ═══════════════════════════════════════════════════════════════════════════════
    const totalDataFound = 
      report.reassigned.transactions + 
      report.reassigned.opportunities + 
      report.reassigned.identities + 
      report.reassigned.kyc_records;

    if (totalDataFound > 0) {
      try {
        const goals = await base44.entities.UserGoals.filter(
          { created_by: user.email },
          '-created_date',
          1
        );
        if (goals.length === 0) {
          // Create basic UserGoals if data was found but goals don't exist
          await base44.entities.UserGoals.create({
            daily_target: 1000,
            onboarded: true,
            autopilot_enabled: true,
            wallet_balance: 0,
            total_earned: 0,
          });
          report.reassigned.goals = 1;
          console.log(`[Orphan Finder] ✓ Created UserGoals for ${user.email}`);
        }
      } catch (e) {
        report.errors.push(`Could not verify/create UserGoals: ${e.message}`);
      }
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 6. LOG RESULTS
    // ═══════════════════════════════════════════════════════════════════════════════
    try {
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Orphaned data scan complete: ${totalDataFound} records found and reassigned to ${user.email}`,
        severity: totalDataFound > 0 ? 'success' : 'info',
        metadata: report.reassigned,
      });
    } catch (e) {
      console.warn('[Orphan Finder] Could not create activity log:', e.message);
    }

    console.log(`[Orphan Finder] ✅ Complete. Total reassigned: ${totalDataFound}`);
    return Response.json(report, { status: 200 });
  } catch (error) {
    console.error('[Orphan Finder] FATAL ERROR:', error);
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