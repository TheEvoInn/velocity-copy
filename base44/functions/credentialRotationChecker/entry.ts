import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Credential Rotation Checker — runs daily
 * Scans all PlatformCredentials, flags overdue rotations,
 * and notifies users + logs to ActivityLog.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const now = new Date();
    const allCreds = await base44.asServiceRole.entities.PlatformCredential.list('-created_date', 500);

    const overdue = allCreds.filter(c =>
      c.is_active && c.next_rotation_due && new Date(c.next_rotation_due) < now
    );

    const neverRotated = allCreds.filter(c =>
      c.is_active && !c.last_rotated_at && !c.next_rotation_due
    );

    // Group by owner (created_by)
    const byUser = {};
    [...overdue, ...neverRotated].forEach(c => {
      const owner = c.created_by;
      if (!byUser[owner]) byUser[owner] = { overdue: [], neverRotated: [] };
      if (overdue.includes(c)) byUser[owner].overdue.push(c);
      else byUser[owner].neverRotated.push(c);
    });

    let notified = 0;
    for (const [email, { overdue: od, neverRotated: nr }] of Object.entries(byUser)) {
      const total = od.length + nr.length;
      if (total === 0) continue;

      await base44.asServiceRole.entities.Notification.create({
        user_email: email,
        type: 'system_alert',
        severity: od.length > 0 ? 'urgent' : 'warning',
        title: `🔐 ${od.length > 0 ? `${od.length} Credential(s) Overdue for Rotation` : `${nr.length} Credential(s) Never Rotated`}`,
        message: od.length > 0
          ? `${od.map(c => `${c.platform} — ${c.account_label}`).join(', ')} need immediate rotation to maintain Autopilot security.`
          : `${nr.map(c => `${c.platform} — ${c.account_label}`).join(', ')} have never been rotated. Set a rotation schedule.`,
        action_type: 'review_required',
        related_entity_type: 'PlatformCredential',
      });
      notified++;
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `🔒 Rotation check: ${overdue.length} overdue, ${neverRotated.length} never rotated. ${notified} users notified.`,
      severity: overdue.length > 0 ? 'warning' : 'info',
      metadata: { overdue_count: overdue.length, never_rotated: neverRotated.length },
    });

    return Response.json({ success: true, overdue: overdue.length, neverRotated: neverRotated.length, notified });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});