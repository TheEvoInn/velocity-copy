import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * CREDENTIAL AUTO-ROTATION ENGINE
 * Automatically rotates API keys, OAuth tokens, and platform credentials
 * Manages expiration, archives old keys, triggers user interventions
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action, credential_id, user_email } = body;

    if (action === 'check_and_rotate_all') {
      return await checkAndRotateAll(base44);
    }

    if (action === 'rotate_single' && credential_id) {
      return await rotateSingleCredential(base44, credential_id, user_email);
    }

    if (action === 'archive_expired') {
      return await archiveExpiredCredentials(base44);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[credentialAutoRotationEngine]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function checkAndRotateAll(base44) {
  const results = {
    timestamp: new Date().toISOString(),
    checked: 0,
    rotated: 0,
    archived: 0,
    errors: []
  };

  try {
    // Get all active credentials from PlatformCredential & CredentialVault
    const platformCreds = await base44.asServiceRole.entities.PlatformCredential.list('-created_date', 1000)
      .catch(() => []);
    const vaultCreds = await base44.asServiceRole.entities.CredentialVault.list('-created_date', 1000)
      .catch(() => []);

    const allCreds = [...platformCreds, ...vaultCreds];
    const now = new Date();

    for (const cred of allCreds) {
      if (!cred.is_active) continue;
      results.checked++;

      // Determine if rotation needed
      const expiresAt = cred.expires_at ? new Date(cred.expires_at) : null;
      const lastRotated = cred.last_rotated_at ? new Date(cred.last_rotated_at) : null;
      const nextDue = cred.next_rotation_due ? new Date(cred.next_rotation_due) : null;

      // Trigger rotation if: expiring in <30 days OR past due OR never rotated for >6 months
      const rotationNeeded = 
        (expiresAt && expiresAt.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) ||
        (nextDue && nextDue < now) ||
        (lastRotated && now.getTime() - lastRotated.getTime() > 180 * 24 * 60 * 60 * 1000);

      if (rotationNeeded) {
        const rotateResult = await rotateSingleCredential(base44, cred.id, cred.created_by);
        if (rotateResult.success) {
          results.rotated++;
        } else {
          results.errors.push(`Rotation failed for ${cred.id}: ${rotateResult.error}`);
        }
      }
    }

    // Archive old credentials
    const archiveResult = await archiveExpiredCredentials(base44);
    results.archived = archiveResult.archived || 0;

    // Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔑 Credential auto-rotation: Checked ${results.checked}, rotated ${results.rotated}, archived ${results.archived}`,
      severity: results.errors.length > 0 ? 'warning' : 'info',
      metadata: results
    }).catch(() => null);

    console.log(`[credentialAutoRotationEngine] Rotation complete: ${results.rotated} rotated, ${results.archived} archived`);
    return Response.json({ success: true, ...results });

  } catch (error) {
    console.error('[credentialAutoRotationEngine] check_and_rotate_all failed:', error.message);
    throw error;
  }
}

async function rotateSingleCredential(base44, credentialId, createdBy) {
  try {
    // Fetch the credential to rotate
    let cred = null;
    let isPlatformCred = false;

    try {
      cred = await base44.asServiceRole.entities.PlatformCredential.filter(
        { id: credentialId },
        null,
        1
      ).then(r => r[0]);
      isPlatformCred = true;
    } catch(_) {}

    if (!cred) {
      try {
        cred = await base44.asServiceRole.entities.CredentialVault.filter(
          { id: credentialId },
          null,
          1
        ).then(r => r[0]);
      } catch(_) {}
    }

    if (!cred) {
      return { success: false, error: 'Credential not found' };
    }

    const now = new Date();
    const Entity = isPlatformCred ? 'PlatformCredential' : 'CredentialVault';

    // Archive old credential (rename & mark inactive)
    const archivedName = `${cred.account_label || cred.platform}-archived-${now.getTime()}`;
    
    const archiveUpdate = {
      is_active: false,
      archived_at: now.toISOString(),
      archived_reason: 'auto_rotation_triggered'
    };

    if (isPlatformCred) {
      await base44.asServiceRole.entities.PlatformCredential.update(credentialId, archiveUpdate);
    } else {
      await base44.asServiceRole.entities.CredentialVault.update(credentialId, archiveUpdate);
    }

    console.log(`[credentialAutoRotationEngine] Archived credential ${credentialId}`);

    // Create user intervention request for new credential generation
    const intervention = await base44.asServiceRole.entities.UserIntervention.create({
      user_email: createdBy || cred.created_by,
      intervention_type: 'credential_renewal_required',
      status: 'pending',
      priority: 'high',
      title: `🔑 Credential Renewal Required: ${cred.platform}`,
      description: `Your ${cred.platform} credential (${cred.account_label || 'Unknown'}) has been rotated. Please provide a fresh API key or token to continue secure access.`,
      required_fields: ['credential_value', 'credential_type'],
      metadata: {
        old_credential_id: credentialId,
        platform: cred.platform,
        credential_type: cred.credential_type,
        account_label: cred.account_label
      },
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 days to respond
    }).catch(err => {
      console.warn(`[credentialAutoRotationEngine] UserIntervention creation failed: ${err.message}`);
      return null;
    });

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_email: createdBy || cred.created_by,
      type: 'action_required',
      title: `🔐 ${cred.platform} Credential Rotation`,
      message: `Your ${cred.platform} API key/token needs renewal. Please update your credentials within 7 days to maintain Autopilot access.`,
      action_type: 'credential_renewal',
      related_entity_type: 'UserIntervention',
      related_entity_id: intervention?.id,
      priority: 'high'
    }).catch(err => console.warn(`[credentialAutoRotationEngine] Notification failed: ${err.message}`));

    // Log access
    const logEntry = {
      timestamp: now.toISOString(),
      task_id: 'credential_auto_rotation',
      action: 'rotate',
      purpose: 'auto_rotation_expired_or_overdue'
    };

    const Entity_ = isPlatformCred ? base44.asServiceRole.entities.PlatformCredential : base44.asServiceRole.entities.CredentialVault;
    const updated = await Entity_.update(credentialId, {
      access_log: [...(cred.access_log || []), logEntry]
    }).catch(() => null);

    return { 
      success: true, 
      credential_id: credentialId, 
      intervention_id: intervention?.id,
      archived_at: now.toISOString()
    };

  } catch (error) {
    console.error(`[credentialAutoRotationEngine] rotateSingleCredential failed: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function archiveExpiredCredentials(base44) {
  const results = {
    archived: 0,
    errors: []
  };

  try {
    const now = new Date();
    
    // Find all expired credentials that aren't already archived
    const platformExpired = await base44.asServiceRole.entities.PlatformCredential.filter(
      { is_active: true },
      '-created_date',
      500
    ).then(creds => 
      creds.filter(c => c.expires_at && new Date(c.expires_at) < now)
    ).catch(() => []);

    const vaultExpired = await base44.asServiceRole.entities.CredentialVault.filter(
      { is_active: true },
      '-created_date',
      500
    ).then(creds => 
      creds.filter(c => c.expires_at && new Date(c.expires_at) < now)
    ).catch(() => []);

    // Archive each expired credential
    for (const cred of [...platformExpired, ...vaultExpired]) {
      try {
        const isVault = !cred.platform || !cred.account_label; // Heuristic
        const Entity = isVault ? base44.asServiceRole.entities.CredentialVault : base44.asServiceRole.entities.PlatformCredential;
        
        await Entity.update(cred.id, {
          is_active: false,
          archived_at: now.toISOString(),
          archived_reason: 'auto_archive_expired'
        });
        
        results.archived++;
      } catch (err) {
        results.errors.push(`Failed to archive ${cred.id}: ${err.message}`);
      }
    }

    console.log(`[credentialAutoRotationEngine] Archived ${results.archived} expired credentials`);
    return results;

  } catch (error) {
    console.error(`[credentialAutoRotationEngine] archiveExpiredCredentials failed: ${error.message}`);
    throw error;
  }
}