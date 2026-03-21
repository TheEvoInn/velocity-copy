import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * User Data Connection Audit & Repair
 * Verifies and fixes data integrity for a specific user across all entities
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_email } = await req.json();

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    const audit = {
      user_email,
      timestamp: new Date().toISOString(),
      connections: {},
      issues_found: 0,
      repairs_made: 0,
      status: 'audit_complete'
    };

    // ━━━━ CHECK: User entity exists ━━━━
    const users = await base44.asServiceRole.entities.User.filter({ email: user_email }, null, 1);
    const user = users[0];

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

    // ━━━━ CHECK: KYC Verification ━━━━
    const kycs = await base44.asServiceRole.entities.KYCVerification.filter(
      { created_by: user_email },
      '-created_date',
      1
    );
    const kyc = kycs[0];

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

    // ━━━━ CHECK: User Goals ━━━━
    const goals = await base44.asServiceRole.entities.UserGoals.filter(
      { created_by: user_email },
      null,
      1
    );
    const userGoal = goals[0];

    audit.connections.user_goals = {
      exists: !!userGoal,
      goal_id: userGoal?.id || null,
      autopilot_enabled: userGoal?.autopilot_enabled || false,
      onboarded: userGoal?.onboarded || false
    };

    if (!userGoal) {
      audit.issues_found++;
      audit.connections.user_goals.issue = 'No UserGoals record found';

      // Repair: Create default UserGoals
      try {
        const newGoal = await base44.asServiceRole.entities.UserGoals.create({
          daily_target: 1000,
          available_capital: 0,
          risk_tolerance: 'moderate',
          hours_per_day: 8,
          wallet_balance: 0,
          total_earned: 0,
          onboarded: false,
          autopilot_enabled: false
        });

        audit.connections.user_goals = {
          exists: true,
          goal_id: newGoal.id,
          autopilot_enabled: false,
          onboarded: false,
          repair: 'created'
        };
        audit.repairs_made++;
      } catch (e) {
        audit.connections.user_goals.repair_error = e.message;
      }
    }

    // ━━━━ CHECK: AI Identities ━━━━
    const identities = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user_email },
      null,
      10
    );

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

        // Repair: Activate first identity
        try {
          await base44.asServiceRole.entities.AIIdentity.update(identities[0].id, {
            is_active: true
          });

          audit.connections.identities.repair = `activated: ${identities[0].name}`;
          audit.repairs_made++;
        } catch (e) {
          audit.connections.identities.repair_error = e.message;
        }
      }
    }

    // ━━━━ CHECK: User Data Store (preferences) ━━━━
    const dataStores = await base44.asServiceRole.entities.UserDataStore.filter(
      { user_email },
      null,
      1
    );
    const dataStore = dataStores[0];

    audit.connections.user_data_store = {
      exists: !!dataStore,
      data_store_id: dataStore?.id || null
    };

    if (!dataStore) {
      audit.issues_found++;
      audit.connections.user_data_store.issue = 'No UserDataStore record found';

      // Repair: Create default data store
      try {
        const newStore = await base44.asServiceRole.entities.UserDataStore.create({
          user_email,
          ui_preferences: {
            theme: 'dark',
            sidebar_collapsed: false,
            default_view: 'dashboard'
          },
          autopilot_preferences: {
            enabled: false,
            mode: 'continuous',
            execution_mode: 'review_required'
          }
        });

        audit.connections.user_data_store = {
          exists: true,
          data_store_id: newStore.id,
          repair: 'created'
        };
        audit.repairs_made++;
      } catch (e) {
        audit.connections.user_data_store.repair_error = e.message;
      }
    }

    // ━━━━ CHECK: Task Execution Queue ━━━━
    const taskQueues = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { created_by: user_email },
      null,
      1
    );

    audit.connections.task_queue = {
      records_count: taskQueues.length,
      queued: taskQueues.filter(t => t.status === 'queued').length,
      executing: taskQueues.filter(t => t.status === 'processing' || t.status === 'executing').length,
      completed: taskQueues.filter(t => t.status === 'completed').length
    };

    // ━━━━ CHECK: Opportunities ━━━━
    const opps = await base44.asServiceRole.entities.Opportunity.filter(
      { created_by: user_email },
      null,
      1
    );

    audit.connections.opportunities = {
      total_count: opps.length,
      new: opps.filter(o => o.status === 'new').length,
      queued: opps.filter(o => o.status === 'queued').length,
      executing: opps.filter(o => o.status === 'executing').length,
      completed: opps.filter(o => o.status === 'completed').length
    };

    // ━━━━ CHECK: Transactions ━━━━
    const transactions = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: user_email },
      '-created_date',
      1
    );

    audit.connections.transactions = {
      total_count: transactions.length,
      last_transaction: transactions[0]?.created_date || null
    };

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
    await base44.asServiceRole.entities.EngineAuditLog.create({
      event_type: 'user_data_connection_audit',
      module: 'userDataConnectionAudit',
      status: audit.status,
      details: { user_email, issues_found: audit.issues_found, repairs_made: audit.repairs_made },
      actor: 'admin',
      user_id: user?.id || null
    });

    return Response.json({
      success: true,
      audit
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});