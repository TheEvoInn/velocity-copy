import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * COMPREHENSIVE USER DATA INTEGRITY AUDIT
 * 
 * This function:
 * 1. Scans ALL user entities (AIIdentity, UserGoals, Transaction, Opportunity, etc.)
 * 2. Identifies lost, unsynced, miscategorized, or corrupted records
 * 3. Cross-validates relationships (AIIdentity → UserGoals → Transactions flow)
 * 4. Detects orphaned records (no owner, wrong user_email, corrupted fields)
 * 5. Generates detailed audit report with recovery actions
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log(`[Audit] Starting comprehensive data integrity audit for ${user.email}`);

    const auditReport = {
      timestamp: new Date().toISOString(),
      user_email: user.email,
      sections: {
        identity_audit: {},
        goals_audit: {},
        transaction_audit: {},
        opportunity_audit: {},
        withdrawal_audit: {},
        kyc_audit: {},
        cross_entity_validation: {},
        orphaned_records: {},
        corrupted_fields: {},
        recovery_actions: [],
      },
      summary: {
        total_issues: 0,
        critical_issues: 0,
        warnings: 0,
        orphaned_count: 0,
        corrupted_count: 0,
      },
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 1. AIIDENTITY AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    const identities = await base44.entities.AIIdentity.filter(
      { user_email: user.email },
      '-created_date'
    );
    auditReport.sections.identity_audit = {
      total_identities: identities.length,
      identities: identities.map(i => ({
        id: i.id,
        name: i.name || '[MISSING NAME]',
        is_active: i.is_active,
        onboarding_complete: i.onboarding_complete,
        created_date: i.created_date,
        issue: !i.name ? 'CORRUPTED: Missing name field' : null,
      })),
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 2. USERGOALS AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    const goals = await base44.entities.UserGoals.filter(
      { created_by: user.email },
      '-created_date'
    );
    auditReport.sections.goals_audit = {
      total_goals: goals.length,
      goals: goals.map(g => ({
        id: g.id,
        daily_target: g.daily_target,
        autopilot_enabled: g.autopilot_enabled,
        onboarded: g.onboarded,
        total_earned: g.total_earned || 0,
        created_date: g.created_date,
        issues: [],
      })),
    };

    if (goals.length === 0) {
      auditReport.sections.goals_audit.issues = ['WARNING: No UserGoals found — onboarding incomplete or not synced'];
      auditReport.summary.warnings++;
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 3. TRANSACTION AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    const transactions = await base44.entities.Transaction.filter(
      { created_by: user.email },
      '-created_date'
    );
    const transactionIssues = [];
    const transactionsByCategory = {};

    transactions.forEach(t => {
      const issues = [];

      // Check for corrupted fields
      if (!t.type) issues.push('Missing type');
      if (!t.amount || t.amount <= 0) issues.push('Invalid amount');
      if (!t.platform && t.type === 'income') issues.push('Missing platform source');

      // Categorize
      transactionsByCategory[t.category || 'uncategorized'] = (transactionsByCategory[t.category] || 0) + 1;

      if (issues.length > 0) {
        transactionIssues.push({ tx_id: t.id, issues });
        auditReport.summary.corrupted_count++;
      }
    });

    auditReport.sections.transaction_audit = {
      total_transactions: transactions.length,
      total_income: transactions.filter(t => t.type === 'income').length,
      total_expense: transactions.filter(t => t.type === 'expense').length,
      by_category: transactionsByCategory,
      corrupted_transactions: transactionIssues,
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 4. OPPORTUNITY AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    const opportunities = await base44.entities.Opportunity.filter(
      { created_by: user.email },
      '-created_date'
    );
    const oppIssues = [];
    const oppByStatus = {};

    opportunities.forEach(o => {
      const issues = [];

      if (!o.title) issues.push('CORRUPTED: Missing title');
      if (!o.category) issues.push('CORRUPTED: Missing category');
      if (!o.url && o.status !== 'dismissed') issues.push('WARNING: Missing URL');

      oppByStatus[o.status] = (oppByStatus[o.status] || 0) + 1;

      if (issues.length > 0) {
        oppIssues.push({ opp_id: o.id, issues });
        auditReport.summary.corrupted_count++;
      }
    });

    auditReport.sections.opportunity_audit = {
      total_opportunities: opportunities.length,
      by_status: oppByStatus,
      corrupted_opportunities: oppIssues,
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 5. WITHDRAWAL POLICY AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    const policies = await base44.entities.WithdrawalPolicy.filter(
      { created_by: user.email },
      '-created_date'
    );
    auditReport.sections.withdrawal_audit = {
      total_policies: policies.length,
      policies: policies.map(p => ({
        id: p.id,
        label: p.label,
        engine_enabled: p.engine_enabled,
        min_threshold: p.min_withdrawal_threshold,
        frequency: p.auto_transfer_frequency,
      })),
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 6. KYC AUDIT
    // ═══════════════════════════════════════════════════════════════════════════════
    const kycRecords = await base44.entities.KYCVerification.filter(
      { user_email: user.email },
      '-created_date'
    );
    auditReport.sections.kyc_audit = {
      total_kyc_records: kycRecords.length,
      kyc_records: kycRecords.map(k => ({
        id: k.id,
        status: k.status,
        full_name: k.full_legal_name ? '[PRESENT]' : '[MISSING]',
        verified_at: k.verified_at || null,
      })),
    };

    // ═══════════════════════════════════════════════════════════════════════════════
    // 7. CROSS-ENTITY VALIDATION (Detect unsynced relationships)
    // ═══════════════════════════════════════════════════════════════════════════════
    const crossValidation = {
      issues: [],
    };

    // Check: If AIIdentity exists, UserGoals should exist
    if (identities.length > 0 && goals.length === 0) {
      crossValidation.issues.push({
        severity: 'CRITICAL',
        issue: 'AIIdentity exists but UserGoals missing — onboarding not fully synced',
        action: 'Recreate UserGoals from Identity data',
      });
      auditReport.summary.critical_issues++;
    }

    // Check: If transactions exist, they should map to valid opportunities
    if (transactions.length > 0) {
      const transactionOppIds = new Set(transactions.map(t => t.opportunity_id).filter(Boolean));
      const opportunityIds = new Set(opportunities.map(o => o.id));
      
      const orphanedTxOppLinks = Array.from(transactionOppIds).filter(id => !opportunityIds.has(id));
      if (orphanedTxOppLinks.length > 0) {
        crossValidation.issues.push({
          severity: 'WARNING',
          issue: `${orphanedTxOppLinks.length} transactions reference deleted/missing opportunities`,
          action: 'Audit transaction origin and reclassify as needed',
        });
        auditReport.summary.warnings++;
      }
    }

    // Check: Earnings consistency (sum of transactions vs reported total_earned)
    if (goals.length > 0 && transactions.length > 0) {
      const incomeSum = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + (t.amount || 0), 0);
      const reportedEarnings = goals[0].total_earned || 0;

      if (Math.abs(incomeSum - reportedEarnings) > 1) { // Allow $1 rounding error
        crossValidation.issues.push({
          severity: 'WARNING',
          issue: `Earnings mismatch: transactions total $${incomeSum.toFixed(2)} but UserGoals reports $${reportedEarnings.toFixed(2)}`,
          action: 'Verify transaction records and sync to UserGoals',
        });
        auditReport.summary.warnings++;
      }
    }

    auditReport.sections.cross_entity_validation = crossValidation;

    // ═══════════════════════════════════════════════════════════════════════════════
    // 8. ORPHANED RECORDS (Records with no owner or wrong user_email)
    // ═══════════════════════════════════════════════════════════════════════════════
    const orphanedCheck = {
      orphaned_transactions: 0,
      orphaned_opportunities: 0,
      orphaned_goals: goals.length === 0 ? 1 : 0,
    };

    // Count orphaned based on missing created_by or user_email
    orphanedCheck.orphaned_transactions = transactions.filter(t => !t.created_by).length;
    orphanedCheck.orphaned_opportunities = opportunities.filter(o => !o.created_by).length;

    auditReport.sections.orphaned_records = orphanedCheck;
    auditReport.summary.orphaned_count = Object.values(orphanedCheck).reduce((a, b) => a + b, 0);

    // ═══════════════════════════════════════════════════════════════════════════════
    // 9. RECOVERY ACTIONS
    // ═══════════════════════════════════════════════════════════════════════════════
    if (goals.length === 0 && identities.length > 0) {
      auditReport.sections.recovery_actions.push({
        priority: 'CRITICAL',
        action: 'Recreate missing UserGoals',
        command: 'Invoke: recreateUserGoalsFromIdentity',
        params: { identity_id: identities[0].id, user_email: user.email },
      });
    }

    if (transactionIssues.length > 0) {
      auditReport.sections.recovery_actions.push({
        priority: 'HIGH',
        action: 'Review and fix corrupted transactions',
        count: transactionIssues.length,
        details: transactionIssues,
      });
    }

    if (oppIssues.length > 0) {
      auditReport.sections.recovery_actions.push({
        priority: 'HIGH',
        action: 'Review and fix corrupted opportunities',
        count: oppIssues.length,
        details: oppIssues,
      });
    }

    if (crossValidation.issues.length > 0) {
      auditReport.sections.recovery_actions.push({
        priority: 'CRITICAL',
        action: 'Sync all entities to resolve cross-entity mismatches',
        details: crossValidation.issues,
      });
    }

    // ═══════════════════════════════════════════════════════════════════════════════
    // 10. SUMMARY
    // ═══════════════════════════════════════════════════════════════════════════════
    auditReport.summary.total_issues = 
      auditReport.summary.critical_issues + 
      auditReport.summary.warnings + 
      auditReport.summary.orphaned_count + 
      auditReport.summary.corrupted_count;

    // Create audit log record
    try {
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Data integrity audit completed: ${auditReport.summary.total_issues} issues found (${auditReport.summary.critical_issues} critical)`,
        severity: auditReport.summary.critical_issues > 0 ? 'warning' : 'info',
        metadata: auditReport.summary,
      });
    } catch (e) {
      console.warn('[Audit] Could not create activity log:', e.message);
    }

    console.log(`[Audit] ✅ Audit complete. Issues found: ${auditReport.summary.total_issues}`);
    return Response.json(auditReport, { status: 200 });
  } catch (error) {
    console.error('[Audit] FATAL ERROR:', error);
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