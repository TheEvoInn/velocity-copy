import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * SESSION MANAGER
 * Manages active/inactive sessions across multiple accounts for Autopilot
 * Handles session lifecycle: activate → execute → deactivate
 * Prevents rate-limiting and account suspension via smart switching
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { action, task_id, vault_id, identity_id, platform } = await req.json();

    // ── ACTION: initialize_session ──────────────────────────────────────
    if (action === 'initialize_session') {
      if (!vault_id || !task_id) {
        return Response.json({ error: 'vault_id and task_id required' }, { status: 400 });
      }

      const vault = await base44.asServiceRole.entities.CredentialVault
        .get(vault_id)
        .catch(() => null);

      if (!vault) {
        return Response.json({ error: 'Vault not found' }, { status: 404 });
      }

      // Create session record
      const session = await base44.asServiceRole.entities.ExternalTaskAnalysis.create({
        task_id,
        vault_id,
        platform: vault.platform,
        session_status: 'active',
        started_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        activity_count: 0,
        metadata: {
          credential_type: vault.credential_type,
          account_id: vault.linked_account_id,
          session_purpose: 'Autopilot task execution'
        }
      }).catch(() => null);

      return Response.json({
        success: !!session,
        session_id: session?.id,
        task_id,
        platform: vault.platform,
        session_status: 'active',
        message: `Session initialized for ${vault.platform}`
      });
    }

    // ── ACTION: log_activity ────────────────────────────────────────────
    if (action === 'log_activity') {
      const { session_id, activity_type, duration_ms } = body;
      if (!session_id) {
        return Response.json({ error: 'session_id required' }, { status: 400 });
      }

      const session = await base44.asServiceRole.entities.ExternalTaskAnalysis
        .get(session_id)
        .catch(() => null);

      if (!session) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      // Update session activity
      const metadata = session.metadata || {};
      const activities = metadata.activities || [];
      activities.push({
        timestamp: new Date().toISOString(),
        type: activity_type,
        duration_ms: duration_ms || 0
      });

      await base44.asServiceRole.entities.ExternalTaskAnalysis.update(session_id, {
        last_activity: new Date().toISOString(),
        activity_count: (session.activity_count || 0) + 1,
        metadata: {
          ...metadata,
          activities: activities.slice(-20)
        }
      }).catch(() => {});

      return Response.json({
        success: true,
        session_id,
        activity_logged: activity_type,
        total_activities: activities.length
      });
    }

    // ── ACTION: check_rate_limit_status ────────────────────────────────
    if (action === 'check_rate_limit_status') {
      const { vault_id } = body;
      if (!vault_id) {
        return Response.json({ error: 'vault_id required' }, { status: 400 });
      }

      const vault = await base44.asServiceRole.entities.CredentialVault
        .get(vault_id)
        .catch(() => null);

      if (!vault || !vault.linked_account_id) {
        return Response.json({ error: 'Vault or linked account not found' }, { status: 404 });
      }

      const account = await base44.asServiceRole.entities.LinkedAccount
        .get(vault.linked_account_id)
        .catch(() => null);

      if (!account) {
        return Response.json({ error: 'Linked account not found' }, { status: 404 });
      }

      // Check if account is in cooldown
      const now = new Date();
      const inCooldown = account.cooldown_until && new Date(account.cooldown_until) > now;
      const cooldownMinutesRemaining = inCooldown 
        ? Math.ceil((new Date(account.cooldown_until) - now) / 60000) 
        : 0;

      return Response.json({
        success: true,
        vault_id,
        platform: vault.platform,
        account_health: account.health_status,
        in_cooldown: inCooldown,
        cooldown_minutes_remaining: cooldownMinutesRemaining,
        daily_applications_used: account.applications_today || 0,
        daily_limit: account.daily_application_limit || 10,
        can_execute: !inCooldown && (account.applications_today || 0) < (account.daily_application_limit || 10)
      });
    }

    // ── ACTION: rotate_account ──────────────────────────────────────────
    if (action === 'rotate_account') {
      const { task_id, current_vault_id, platform } = body;
      if (!platform) {
        return Response.json({ error: 'platform required' }, { status: 400 });
      }

      // Get all healthy accounts for this platform
      const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
        { platform, health_status: 'healthy' },
        '-performance_score',
        10
      ).catch(() => []);

      if (!accounts.length) {
        return Response.json({
          success: false,
          error: `No healthy accounts available for ${platform}`,
          platform,
          need_intervention: true
        });
      }

      // Find account with lowest daily application count
      const bestAccount = accounts.reduce((a, b) =>
        (a.applications_today || 0) < (b.applications_today || 0) ? a : b
      );

      // Get or create credential for best account
      const vaults = await base44.asServiceRole.entities.CredentialVault.filter(
        { linked_account_id: bestAccount.id, is_active: true },
        null,
        1
      ).catch(() => []);

      if (!vaults.length) {
        return Response.json({
          success: false,
          error: `No active credentials for ${platform} account ${bestAccount.username}`,
          platform,
          need_intervention: true
        });
      }

      // Log rotation
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'account_action',
        message: `🔄 Account rotated: ${platform} → ${bestAccount.username} (daily apps: ${bestAccount.applications_today || 0}/${bestAccount.daily_application_limit})`,
        severity: 'info',
        metadata: { task_id, from_vault: current_vault_id, to_vault: vaults[0].id, platform }
      }).catch(() => {});

      return Response.json({
        success: true,
        task_id,
        platform,
        rotated_to_vault: vaults[0].id,
        account_username: bestAccount.username,
        daily_apps_available: (bestAccount.daily_application_limit || 10) - (bestAccount.applications_today || 0),
        health_status: bestAccount.health_status
      });
    }

    // ── ACTION: close_session ───────────────────────────────────────────
    if (action === 'close_session') {
      const { session_id, outcome } = body;
      if (!session_id) {
        return Response.json({ error: 'session_id required' }, { status: 400 });
      }

      const session = await base44.asServiceRole.entities.ExternalTaskAnalysis
        .get(session_id)
        .catch(() => null);

      if (!session) {
        return Response.json({ error: 'Session not found' }, { status: 404 });
      }

      await base44.asServiceRole.entities.ExternalTaskAnalysis.update(session_id, {
        session_status: 'closed',
        metadata: {
          ...session.metadata,
          closed_at: new Date().toISOString(),
          outcome: outcome || 'normal_close'
        }
      }).catch(() => {});

      return Response.json({
        success: true,
        session_id,
        session_status: 'closed',
        task_id: session.task_id,
        duration_seconds: Math.floor((new Date() - new Date(session.started_at)) / 1000)
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[SessionManager]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});