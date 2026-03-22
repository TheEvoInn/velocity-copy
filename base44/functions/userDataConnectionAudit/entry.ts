import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * User Data Connection Audit & Repair
 * Verifies and fixes data integrity for a specific user across all entities
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const authenticatedUser = await base44.auth.me();
    
    if (!authenticatedUser || authenticatedUser.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    let body = {};
    try {
      body = await req.json();
    } catch (e) {
      // Empty body is ok
    }

    const { action, user_email } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // BULK FETCH ACTIONS FOR ADMIN DASHBOARD
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'get_all_identities') {
      const identities = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 500);
      return Response.json({ success: true, identities: identities || [] });
    }

    if (action === 'get_all_goals') {
      const goals = await base44.asServiceRole.entities.UserGoals.list('-created_date', 500);
      return Response.json({ success: true, goals: goals || [] });
    }

    if (action === 'get_all_connections') {
      const connections = await base44.asServiceRole.entities.PlatformConnection.list('-created_date', 500);
      return Response.json({ success: true, connections: connections || [] });
    }

    if (action === 'get_all_kycs') {
      const kycs = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
      return Response.json({ success: true, kycs: kycs || [] });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SINGLE USER AUDIT & REPAIR
    // ─────────────────────────────────────────────────────────────────────────
    if (!user_email) {
      return Response.json({ error: 'user_email required in payload' }, { status: 400 });
    }

    const audit = {
      user_email,
      timestamp: new Date().toISOString(),
      connections: {},
      issues_found: 0,
      repairs_made: 0,
      status: 'audit_complete'
    };

    // ━━━━ PARALLEL FETCH: User + KYC (non-blocking) ━━━━
    const [userResults, kycResults] = await Promise.all([
      base44.asServiceRole.entities.User.filter({ email: user_email }, null, 1).catch(() => []),
      base44.asServiceRole.entities.KYCVerification.filter(
        { $or: [{ created_by: user_email }, { user_email }] },
        '-created_date',
        1
      ).catch(() => [])
    ]);

    const user = userResults[0];
    const kyc = kycResults[0];

    audit.connections.user = {
      exists: !!user,
      user_id: user?.id || null,
      full_name: user?.full_name || null,
      role: user?.role || null
    };

    if (!user) {
      audit.issues_found++;
      audit.connections.user.issue = 'User record not found';
    }

    audit.connections.kyc = {
      exists: !!kyc,
      kyc_id: kyc?.id || null,
      status: kyc?.status || null,
      verified: kyc?.status === 'verified' || kyc?.status === 'approved'
    };

    if (!kyc) {
      audit.issues_found++;
      audit.connections.kyc.issue = 'No KYC record found';
    } else if (!audit.connections.kyc.verified) {
      audit.issues_found++;
      audit.connections.kyc.issue = `KYC status: ${kyc.status} (not verified)`;
    }

    // ━━━━ PARALLEL FETCH: Goals + Identities + DataStore ━━━━
    const [goalResults, identityResults, dataStoreResults] = await Promise.all([
      base44.asServiceRole.entities.UserGoals.filter(
        { $or: [{ created_by: user_email }, { user_email }] },
        null,
        1
      ).catch(() => []),
      base44.asServiceRole.entities.AIIdentity.filter(
        { $or: [{ created_by: user_email }, { user_email }] },
        null,
        5  // Reduced limit for performance
      ).catch(() => []),
      base44.asServiceRole.entities.UserDataStore.filter(
        { user_email },
        null,
        1
      ).catch(() => [])
    ]);

    const userGoal = goalResults[0];
    const identities = identityResults;
    const dataStore = dataStoreResults[0];

    audit.connections.user_goals = {
      exists: !!userGoal,
      goal_id: userGoal?.id || null,
      autopilot_enabled: userGoal?.autopilot_enabled || false,
      onboarded: userGoal?.onboarded || false
    };

    if (!userGoal) {
      audit.issues_found++;
      audit.connections.user_goals.issue = 'No UserGoals record found';
      // Repair deferred - create after main checks to save time
    }

    audit.connections.identities = {
      count: identities.length,
      identities: identities.map(id => ({
        id: id.id,
        name: id.name,
        is_active: id.is_active,
        email: id.email
      }))
    };

    if (identities.length === 0) {
      audit.issues_found++;
      audit.connections.identities.issue = 'No identities created';
    } else {
      const activeIdentity = identities.find(i => i.is_active);
      if (!activeIdentity) {
        audit.issues_found++;
        audit.connections.identities.issue = 'No identity marked as active';
        // Repair deferred
      }
    }

    audit.connections.user_data_store = {
      exists: !!dataStore,
      data_store_id: dataStore?.id || null
    };

    if (!dataStore) {
      audit.issues_found++;
      audit.connections.user_data_store.issue = 'No UserDataStore record found';
      // Repair deferred
    }

    // ━━━━ CHECK: Platform Connections ━━━━
    const platformConns = await base44.asServiceRole.entities.PlatformConnection.filter(
      { $or: [{ created_by: user_email }, { user_email }] },
      null,
      5
    ).catch(() => []);

    audit.connections.platform_connections = {
      count: platformConns.length,
      platforms: platformConns.map(c => ({ platform: c.platform, status: c.status }))
    };

    if (platformConns.length === 0) {
      audit.issues_found++;
      audit.connections.platform_connections.issue = 'No platform connections recorded';
    }

    // ━━━━ PARALLEL FETCH: Queue + Opportunities + Transactions ━━━━
    const [queueResults, oppResults, txResults] = await Promise.all([
      base44.asServiceRole.entities.TaskExecutionQueue.filter(
        { $or: [{ created_by: user_email }, { user_email }] },
        null,
        1
      ).catch(() => []),
      base44.asServiceRole.entities.Opportunity.filter(
        { $or: [{ created_by: user_email }, { user_email }] },
        null,
        1
      ).catch(() => []),
      base44.asServiceRole.entities.Transaction.filter(
        { $or: [{ created_by: user_email }, { user_email }] },
        '-created_date',
        1
      ).catch(() => [])
    ]);

    audit.connections.task_queue = {
      records_count: queueResults.length,
      queued: queueResults.filter(t => t.status === 'queued').length,
      executing: queueResults.filter(t => t.status === 'processing' || t.status === 'executing').length,
      completed: queueResults.filter(t => t.status === 'completed').length
    };

    audit.connections.opportunities = {
      total_count: oppResults.length,
      new: oppResults.filter(o => o.status === 'new').length,
      queued: oppResults.filter(o => o.status === 'queued').length,
      executing: oppResults.filter(o => o.status === 'executing').length,
      completed: oppResults.filter(o => o.status === 'completed').length
    };

    audit.connections.transactions = {
      total_count: txResults.length,
      last_transaction: txResults[0]?.created_date || null
    };

    // ━━━━ DEFERRED REPAIRS (run in parallel if needed) ━━━━
    const repairs = [];

    if (!userGoal) {
      repairs.push(
        base44.asServiceRole.entities.UserGoals.create({
          user_email: user_email,
          daily_target: 1000,
          available_capital: 0,
          risk_tolerance: 'moderate',
          hours_per_day: 8,
          wallet_balance: 0,
          total_earned: 0,
          onboarded: false,
          autopilot_enabled: false
        }).then(() => {
          audit.connections.user_goals.repair = 'created';
          audit.repairs_made++;
        }).catch(e => {
          audit.connections.user_goals.repair_error = e.message;
        })
      );
    }

    if (identities.length > 0) {
      const activeIdentity = identities.find(i => i.is_active);
      if (!activeIdentity) {
        repairs.push(
          base44.asServiceRole.entities.AIIdentity.update(identities[0].id, { is_active: true })
            .then(() => {
              audit.connections.identities.repair = `activated: ${identities[0].name}`;
              audit.repairs_made++;
            })
            .catch(e => {
              audit.connections.identities.repair_error = e.message;
            })
        );
      }
    }

    if (!dataStore) {
      repairs.push(
        base44.asServiceRole.entities.UserDataStore.create({
          user_email: user_email,
          ui_preferences: { theme: 'dark', sidebar_collapsed: false, default_view: 'dashboard' },
          autopilot_preferences: { enabled: false, mode: 'continuous', execution_mode: 'review_required' }
        }).then(() => {
          audit.connections.user_data_store.repair = 'created';
          audit.repairs_made++;
        }).catch(e => {
          audit.connections.user_data_store.repair_error = e.message;
        })
      );
    }

    // Execute all repairs in parallel
    await Promise.allSettled(repairs);

    // ━━━━ FINAL STATUS ━━━━
    if (audit.issues_found > 0) {
      if (audit.repairs_made === audit.issues_found) {
        audit.status = 'all_issues_repaired';
      } else {
        audit.status = 'issues_found_partial_repair';
      }
    } else {
      audit.status = 'fully_connected';
    }

    // Log the audit
    try {
      await base44.asServiceRole.entities.EngineAuditLog.create({
        action_type: 'user_data_connection_audit',
        event_type: 'user_data_connection_audit',
        module: 'userDataConnectionAudit',
        status: audit.status,
        details: { user_email, issues_found: audit.issues_found, repairs_made: audit.repairs_made },
        actor: 'admin',
        user_id: user?.id || null
      });
    } catch (e) {
      // If audit log fails, continue anyway
    }

    return Response.json({
      success: true,
      audit
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});