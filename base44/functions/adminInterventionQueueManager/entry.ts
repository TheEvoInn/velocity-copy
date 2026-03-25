import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * ADMIN INTERVENTION QUEUE MANAGER
 * Manages pending user interventions in batch:
 * - Fetch pending interventions across all users
 * - Bulk approval/rejection with comments
 * - Escalation to manual review
 * - Priority sorting and filtering
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Verify admin role
    const adminUser = await base44.asServiceRole.entities.User.filter(
      { email: user.email, role: 'admin' },
      null,
      1
    ).then(r => r[0]).catch(() => null);

    if (!adminUser) {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, filter, page = 1, limit = 20, interventions_data } = body;

    // ── Fetch pending interventions ────────────────────────────────────────
    if (action === 'fetch_pending') {
      const query = { status: 'pending' };
      
      if (filter?.requirement_type) query.requirement_type = filter.requirement_type;
      if (filter?.priority) query.priority = filter.priority;
      
      const offset = (page - 1) * limit;
      const interventions = await base44.asServiceRole.entities.UserIntervention.filter(
        query,
        '-created_date',
        limit
      ).catch(() => []);

      const total = interventions.length;
      
      return Response.json({
        success: true,
        interventions: interventions.slice(0, limit),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      });
    }

    // ── Bulk approve interventions ──────────────────────────────────────────
    if (action === 'bulk_approve') {
      if (!Array.isArray(interventions_data) || !interventions_data.length) {
        return Response.json({ error: 'interventions_data array required' }, { status: 400 });
      }

      const results = [];
      for (const item of interventions_data) {
        try {
          // Update intervention
          await base44.asServiceRole.entities.UserIntervention.update(item.intervention_id, {
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            admin_comment: item.comment || ''
          });

          // Resume associated task
          const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(item.task_id).catch(() => null);
          if (task) {
            await base44.asServiceRole.entities.TaskExecutionQueue.update(item.task_id, {
              status: 'queued',
              notes: `${task.notes || ''} [Admin approved intervention]`
            });
          }

          // Notify user
          const intervention = await base44.asServiceRole.entities.UserIntervention.get(item.intervention_id).catch(() => null);
          if (intervention) {
            await base44.asServiceRole.entities.Notification.create({
              type: 'success',
              severity: 'info',
              title: '✅ Intervention Approved',
              message: `Your intervention request has been approved. Task is resuming.`,
              user_email: intervention.user_email,
              action_type: 'intervention_approved',
              is_read: false
            }).catch(() => null);
          }

          results.push({ intervention_id: item.intervention_id, status: 'approved' });
        } catch (e) {
          results.push({ intervention_id: item.intervention_id, status: 'failed', error: e.message });
        }
      }

      // Log activity
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `✅ Admin bulk approved ${results.filter(r => r.status === 'approved').length}/${results.length} interventions`,
        severity: 'success',
        metadata: { admin_email: user.email, approved_count: results.filter(r => r.status === 'approved').length }
      }).catch(() => null);

      return Response.json({ success: true, results });
    }

    // ── Bulk reject interventions ──────────────────────────────────────────
    if (action === 'bulk_reject') {
      if (!Array.isArray(interventions_data) || !interventions_data.length) {
        return Response.json({ error: 'interventions_data array required' }, { status: 400 });
      }

      const results = [];
      for (const item of interventions_data) {
        try {
          // Update intervention
          await base44.asServiceRole.entities.UserIntervention.update(item.intervention_id, {
            status: 'rejected',
            resolved_at: new Date().toISOString(),
            admin_comment: item.comment || ''
          });

          // Fail associated task
          const task = await base44.asServiceRole.entities.TaskExecutionQueue.get(item.task_id).catch(() => null);
          if (task) {
            await base44.asServiceRole.entities.TaskExecutionQueue.update(item.task_id, {
              status: 'failed',
              notes: `${task.notes || ''} [Admin rejected intervention]`,
              error_message: item.comment || 'Intervention rejected by admin'
            });
          }

          // Notify user
          const intervention = await base44.asServiceRole.entities.UserIntervention.get(item.intervention_id).catch(() => null);
          if (intervention) {
            await base44.asServiceRole.entities.Notification.create({
              type: 'error',
              severity: 'warning',
              title: '❌ Intervention Rejected',
              message: `Your intervention request was rejected. Task has been marked as failed. ${item.comment ? `Admin note: ${item.comment}` : ''}`,
              user_email: intervention.user_email,
              action_type: 'intervention_rejected',
              is_read: false
            }).catch(() => null);
          }

          results.push({ intervention_id: item.intervention_id, status: 'rejected' });
        } catch (e) {
          results.push({ intervention_id: item.intervention_id, status: 'failed', error: e.message });
        }
      }

      // Log activity
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `❌ Admin bulk rejected ${results.filter(r => r.status === 'rejected').length}/${results.length} interventions`,
        severity: 'warning',
        metadata: { admin_email: user.email, rejected_count: results.filter(r => r.status === 'rejected').length }
      }).catch(() => null);

      return Response.json({ success: true, results });
    }

    // ── Escalate intervention ──────────────────────────────────────────────
    if (action === 'escalate') {
      if (!interventions_data?.intervention_id) {
        return Response.json({ error: 'intervention_id required' }, { status: 400 });
      }

      const intervention = await base44.asServiceRole.entities.UserIntervention.get(interventions_data.intervention_id).catch(() => null);
      if (!intervention) {
        return Response.json({ error: 'Intervention not found' }, { status: 404 });
      }

      // Mark for escalation
      await base44.asServiceRole.entities.UserIntervention.update(interventions_data.intervention_id, {
        status: 'escalated',
        admin_comment: interventions_data.comment || 'Escalated for manual review'
      });

      // Create escalation notification for other admins
      const admins = await base44.asServiceRole.entities.User.filter(
        { role: 'admin' },
        null,
        100
      ).catch(() => []);

      for (const admin of admins) {
        if (admin.email !== user.email) {
          await base44.asServiceRole.entities.Notification.create({
            type: 'warning',
            severity: 'high',
            title: '🚨 Intervention Escalated',
            message: `Intervention from ${intervention.user_email} (${intervention.requirement_type}) escalated by admin for review.`,
            user_email: admin.email,
            action_type: 'intervention_escalated',
            is_read: false
          }).catch(() => null);
        }
      }

      // Log activity
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `🚨 Admin escalated intervention ${interventions_data.intervention_id} for manual review`,
        severity: 'warning',
        metadata: { admin_email: user.email, intervention_id: interventions_data.intervention_id }
      }).catch(() => null);

      return Response.json({ success: true, escalated: true });
    }

    // ── Get intervention statistics ────────────────────────────────────────
    if (action === 'get_stats') {
      const all = await base44.asServiceRole.entities.UserIntervention.list('-created_date', 1000).catch(() => []);
      
      const stats = {
        total: all.length,
        pending: all.filter(i => i.status === 'pending').length,
        resolved: all.filter(i => i.status === 'resolved').length,
        rejected: all.filter(i => i.status === 'rejected').length,
        escalated: all.filter(i => i.status === 'escalated').length,
        by_type: {}
      };

      all.forEach(i => {
        if (!stats.by_type[i.requirement_type]) stats.by_type[i.requirement_type] = 0;
        stats.by_type[i.requirement_type]++;
      });

      return Response.json({ success: true, stats });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('[AdminInterventionQueueManager]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});