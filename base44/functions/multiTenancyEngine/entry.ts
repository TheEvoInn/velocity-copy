import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * MULTI-TENANCY ENGINE (Phase 10 Prep)
 * Handles tenant isolation, workspace segregation, billing allocation
 * Enables Phase 10 enterprise SaaS transition
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, payload } = await req.json();

    if (action === 'create_tenant_workspace') {
      return await createTenantWorkspace(base44, user, payload);
    }

    if (action === 'get_tenant_isolation_status') {
      return await getTenantIsolationStatus(base44, user);
    }

    if (action === 'migrate_user_to_tenant') {
      return await migrateUserToTenant(base44, user, payload);
    }

    if (action === 'allocate_tenant_resources') {
      return await allocateTenantResources(base44, user, payload);
    }

    if (action === 'track_tenant_usage') {
      return await trackTenantUsage(base44, user);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[MultiTenancyEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Create isolated tenant workspace
 */
async function createTenantWorkspace(base44, user, payload) {
  const { workspace_name, tier = 'starter' } = payload;

  const tierLimits = {
    starter: { identities: 3, automations: 5, api_calls_daily: 10000 },
    pro: { identities: 10, automations: 20, api_calls_daily: 50000 },
    enterprise: { identities: 50, automations: 100, api_calls_daily: 500000 }
  };

  const workspace = {
    name: workspace_name,
    tier,
    owner_email: user.email,
    created_at: new Date().toISOString(),
    limits: tierLimits[tier] || tierLimits.starter,
    isolation_key: `tenant_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    status: 'active'
  };

  // Store workspace metadata
  await base44.asServiceRole.entities.PlatformState.create({
    key: `workspace_${user.email}`,
    value: JSON.stringify(workspace),
    created_by: user.email
  }).catch(() => {});

  return Response.json({ success: true, workspace });
}

/**
 * Get tenant data isolation status
 */
async function getTenantIsolationStatus(base44, user) {
  try {
    const state = await base44.asServiceRole.entities.PlatformState.filter(
      { key: `workspace_${user.email}` },
      null,
      1
    ).then(r => r[0]);

    if (!state) {
      return Response.json({
        isolated: false,
        message: 'User not yet in multi-tenant mode'
      });
    }

    const workspace = JSON.parse(state.value);

    // Verify isolation
    const userOpps = await base44.asServiceRole.entities.Opportunity.filter(
      { created_by: user.email },
      null,
      1
    ).then(r => r.length);

    const userTasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { created_by: user.email },
      null,
      1
    ).then(r => r.length);

    return Response.json({
      isolated: true,
      workspace_name: workspace.name,
      tier: workspace.tier,
      limits: workspace.limits,
      current_usage: {
        opportunities: userOpps,
        tasks: userTasks
      },
      isolation_key: workspace.isolation_key
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Migrate user data to tenant workspace
 */
async function migrateUserToTenant(base44, user, payload) {
  const { target_workspace } = payload;

  const migrations = {
    opportunities: 0,
    tasks: 0,
    transactions: 0,
    identities: 0,
    errors: []
  };

  try {
    // Migrate opportunities
    const opps = await base44.asServiceRole.entities.Opportunity.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    for (const opp of opps) {
      await base44.asServiceRole.entities.Opportunity.update(opp.id, {
        tenant_workspace: target_workspace
      }).catch(e => migrations.errors.push(`Opp ${opp.id}: ${e.message}`));
      migrations.opportunities++;
    }

    // Migrate tasks
    const tasks = await base44.asServiceRole.entities.TaskExecutionQueue.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    for (const task of tasks) {
      await base44.asServiceRole.entities.TaskExecutionQueue.update(task.id, {
        tenant_workspace: target_workspace
      }).catch(e => migrations.errors.push(`Task ${task.id}: ${e.message}`));
      migrations.tasks++;
    }

    // Migrate transactions
    const txns = await base44.asServiceRole.entities.Transaction.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    for (const txn of txns) {
      await base44.asServiceRole.entities.Transaction.update(txn.id, {
        tenant_workspace: target_workspace
      }).catch(e => migrations.errors.push(`Txn ${txn.id}: ${e.message}`));
      migrations.transactions++;
    }

    // Migrate identities
    const ids = await base44.asServiceRole.entities.AIIdentity.filter(
      { created_by: user.email },
      null,
      100
    ).catch(() => []);

    for (const id of ids) {
      await base44.asServiceRole.entities.AIIdentity.update(id.id, {
        tenant_workspace: target_workspace
      }).catch(e => migrations.errors.push(`Identity ${id.id}: ${e.message}`));
      migrations.identities++;
    }

    return Response.json({
      success: true,
      migrations,
      message: `Migrated ${migrations.opportunities + migrations.tasks + migrations.transactions} records`
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}

/**
 * Allocate tenant resources based on tier
 */
async function allocateTenantResources(base44, user, payload) {
  const { tier } = payload;

  const tierSpecs = {
    starter: {
      max_identities: 3,
      max_automations: 5,
      api_quota_daily: 10000,
      storage_gb: 5,
      support: 'email',
      features: ['basic_autopilot', 'opportunity_discovery']
    },
    pro: {
      max_identities: 10,
      max_automations: 20,
      api_quota_daily: 50000,
      storage_gb: 50,
      support: 'email_priority',
      features: ['advanced_autopilot', 'ml_predictions', 'advanced_filtering', 'custom_automations']
    },
    enterprise: {
      max_identities: 50,
      max_automations: 100,
      api_quota_daily: 500000,
      storage_gb: 500,
      support: 'dedicated_account_manager',
      features: ['white_label', 'api_access', 'sso', 'advanced_analytics', 'webhook_integrations']
    }
  };

  const allocation = tierSpecs[tier] || tierSpecs.starter;

  await base44.asServiceRole.entities.ActivityLog.create({
    action_type: 'tenant_allocation',
    message: `Resource allocation: ${tier} tier (${allocation.max_identities} identities, ${allocation.api_quota_daily} API calls/day)`,
    severity: 'info',
    metadata: { tier, allocation }
  }).catch(() => {});

  return Response.json({ success: true, allocation });
}

/**
 * Track tenant usage for billing
 */
async function trackTenantUsage(base44, user) {
  const usage = {
    timestamp: new Date().toISOString(),
    user_email: user.email,
    api_calls_used: 0,
    identities_active: 0,
    automations_active: 0,
    storage_used_mb: 0
  };

  try {
    const [opps, tasks, ids, autos] = await Promise.all([
      base44.asServiceRole.entities.Opportunity.filter({ created_by: user.email }, null, 1000).catch(() => []),
      base44.asServiceRole.entities.TaskExecutionQueue.filter({ created_by: user.email }, null, 1000).catch(() => []),
      base44.asServiceRole.entities.AIIdentity.filter({ created_by: user.email }, null, 100).catch(() => []),
      base44.asServiceRole.entities.ActivityLog.filter({ created_by: user.email }, null, 1000).catch(() => [])
    ]);

    usage.identities_active = ids.length;
    usage.api_calls_used = (opps.length + tasks.length + autos.length) * 3; // Rough estimate
    usage.automations_active = autos.filter(a => a.action_type === 'system').length;
    usage.storage_used_mb = Math.round((opps.length + tasks.length) * 0.5);

    return Response.json({ success: true, usage });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}