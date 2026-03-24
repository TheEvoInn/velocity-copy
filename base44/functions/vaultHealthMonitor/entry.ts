import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * VAULT HEALTH MONITOR
 * Tracks credential expiration, health status, and rotation schedules
 * Returns detailed vault health report for admin dashboard
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'vault_health_report') {
      return await generateVaultHealthReport(base44);
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[vaultHealthMonitor]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function generateVaultHealthReport(base44) {
  const now = new Date();
  const report = {
    timestamp: now.toISOString(),
    overall_health: 'healthy',
    total_credentials: 0,
    active_credentials: 0,
    expiring_soon: 0,
    expired: 0,
    never_rotated: 0,
    rotation_overdue: 0,
    archived_credentials: 0,
    by_platform: {},
    credentials_needing_renewal: [],
    health_score: 100,
    issues: [],
    recommendations: []
  };

  try {
    // Fetch all credentials
    const platformCreds = await base44.asServiceRole.entities.PlatformCredential.list('-created_date', 1000)
      .catch(() => []);
    const vaultCreds = await base44.asServiceRole.entities.CredentialVault.list('-created_date', 1000)
      .catch(() => []);

    const allCreds = [...platformCreds, ...vaultCreds];
    report.total_credentials = allCreds.length;

    // Analyze each credential
    for (const cred of allCreds) {
      const platform = cred.platform || cred.credential_type || 'unknown';

      if (!report.by_platform[platform]) {
        report.by_platform[platform] = {
          total: 0,
          active: 0,
          expiring_soon: 0,
          expired: 0,
          never_rotated: 0,
          overdue_rotation: 0
        };
      }

      report.by_platform[platform].total++;

      if (cred.is_active) {
        report.active_credentials++;
        report.by_platform[platform].active++;
      } else {
        report.archived_credentials++;
      }

      // Check expiration
      if (cred.expires_at) {
        const expiresAt = new Date(cred.expires_at);
        const daysUntilExpire = (expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000);

        if (daysUntilExpire < 0) {
          report.expired++;
          report.by_platform[platform].expired++;
          report.health_score -= 10;
          report.issues.push({
            severity: 'critical',
            type: 'credential_expired',
            platform,
            credential_id: cred.id,
            account_label: cred.account_label || 'Unknown',
            expires_at: cred.expires_at,
            days_ago: Math.abs(Math.floor(daysUntilExpire))
          });
        } else if (daysUntilExpire < 30) {
          report.expiring_soon++;
          report.by_platform[platform].expiring_soon++;
          report.health_score -= 5;
          report.issues.push({
            severity: 'warning',
            type: 'expiring_soon',
            platform,
            credential_id: cred.id,
            account_label: cred.account_label || 'Unknown',
            expires_at: cred.expires_at,
            days_until: Math.floor(daysUntilExpire)
          });
        }
      }

      // Check rotation history
      if (cred.is_active) {
        const lastRotated = cred.last_rotated_at ? new Date(cred.last_rotated_at) : null;
        const daysSinceRotation = lastRotated ? (now.getTime() - lastRotated.getTime()) / (24 * 60 * 60 * 1000) : Infinity;

        if (!lastRotated) {
          report.never_rotated++;
          report.by_platform[platform].never_rotated++;
          report.health_score -= 3;
          report.recommendations.push({
            type: 'establish_rotation',
            platform,
            message: `${platform} credential has never been rotated. Establish a rotation schedule.`
          });
        } else if (daysSinceRotation > 180) {
          report.rotation_overdue++;
          report.by_platform[platform].overdue_rotation++;
          report.health_score -= 5;
          report.issues.push({
            severity: 'warning',
            type: 'rotation_overdue',
            platform,
            credential_id: cred.id,
            last_rotated: cred.last_rotated_at,
            days_since: Math.floor(daysSinceRotation)
          });
        }
      }

      // Track credentials needing intervention
      if (cred.is_active && (
        (cred.expires_at && new Date(cred.expires_at) < new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)) ||
        (cred.next_rotation_due && new Date(cred.next_rotation_due) < now)
      )) {
        report.credentials_needing_renewal.push({
          credential_id: cred.id,
          platform,
          account_label: cred.account_label || 'Unknown',
          expires_at: cred.expires_at,
          next_rotation_due: cred.next_rotation_due,
          created_by: cred.created_by
        });
      }
    }

    // Determine overall health
    if (report.expired > 0) {
      report.overall_health = 'critical';
    } else if (report.expiring_soon > 0 || report.rotation_overdue > 0) {
      report.overall_health = 'warning';
    }

    // Cap health score at 0–100
    report.health_score = Math.max(0, Math.min(100, report.health_score));

    // Add general recommendations
    if (report.never_rotated > 0) {
      report.recommendations.push({
        type: 'implement_rotation_schedule',
        message: `${report.never_rotated} credentials have never been rotated. Implement an automated rotation schedule.`
      });
    }

    if (report.archived_credentials === 0) {
      report.recommendations.push({
        type: 'audit_trail',
        message: 'No archived credentials. Ensure old rotated keys are being saved for audit compliance.'
      });
    }

    console.log(`[vaultHealthMonitor] Report generated: health=${report.overall_health}, score=${report.health_score}`);
    return Response.json({ success: true, report });

  } catch (error) {
    console.error('[vaultHealthMonitor] Report generation failed:', error.message);
    throw error;
  }
}