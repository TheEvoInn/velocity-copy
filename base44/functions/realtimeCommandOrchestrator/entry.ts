/**
 * REAL-TIME COMMAND ORCHESTRATOR v2
 * Two-way sync with all engines for unified autopilot control
 * - Sync with Autopilot Engine
 * - Sync with Discovery Engine
 * - Sync with Task Reader
 * - Sync with Identity Engine
 * - Sync with Wallet Engine
 * - Emergency stop cascade
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, data } = body;

    // ─────────────────────────────────────────────────────────────────────────
    // EMERGENCY STOP CASCADE
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'emergency_stop') {
      const stop = {
        timestamp: new Date().toISOString(),
        user_email: user.email,
        status: 'initiated',
        cascade: [],
      };

      try {
        // 1. Halt Autopilot Engine
        try {
          await base44.functions.invoke('autopilotOrchestrator', {
            action: 'stop_all_tasks'
          });
          stop.cascade.push('✓ Autopilot Engine halted');
        } catch (e) { stop.cascade.push(`✗ Autopilot: ${e.message}`); }

        // 2. Pause all Identities
        try {
          const identities = await base44.asServiceRole.entities.AIIdentity.filter({}, null, 100);
          for (const id of (Array.isArray(identities) ? identities : [])) {
            await base44.asServiceRole.entities.AIIdentity.update(id.id, { is_active: false });
          }
          stop.cascade.push(`✓ ${identities?.length || 0} identities paused`);
        } catch (e) { stop.cascade.push(`✗ Identities: ${e.message}`); }

        // 3. Cancel all active tasks
        try {
          const activeTasks = await base44.asServiceRole.entities.AITask.filter(
            { status: ['running', 'analyzing', 'executing'] }, null, 100
          );
          for (const task of (Array.isArray(activeTasks) ? activeTasks : [])) {
            await base44.asServiceRole.entities.AITask.update(task.id, { status: 'cancelled' });
          }
          stop.cascade.push(`✓ ${activeTasks?.length || 0} active tasks cancelled`);
        } catch (e) { stop.cascade.push(`✗ Tasks: ${e.message}`); }

        // 4. Log emergency event
        await base44.asServiceRole.entities.EngineAuditLog.create({
          action_type: 'emergency_stop',
          status: 'success',
          ai_reasoning: 'User triggered EMERGENCY STOP',
          metadata: { cascade_steps: stop.cascade }
        }).catch(() => null);

        // 5. Send notification
        await base44.functions.invoke('notificationCenter', {
          action: 'create_notification',
          data: {
            title: '🛑 EMERGENCY STOP',
            message: 'All Autopilot operations have been halted',
            severity: 'critical',
            source_module: 'Command Hub'
          }
        }).catch(() => null);

        stop.status = 'complete';
        return Response.json({ success: true, stop });
      } catch (error) {
        stop.status = 'failed';
        stop.error = error.message;
        return Response.json({ success: false, stop }, { status: 500 });
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TWO-WAY SYNC WITH ALL ENGINES
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'sync_all_engines') {
      const sync = {
        timestamp: new Date().toISOString(),
        user_email: user.email,
        engines: {}
      };

      // 1. Sync Autopilot Engine
      try {
        const autopilot = await base44.functions.invoke('autopilotOrchestrator', {
          action: 'full_autopilot_cycle'
        });
        sync.engines.autopilot = {
          status: 'synced',
          tasks_executed: autopilot?.data?.cycle?.tasks_executed || 0,
          earnings: autopilot?.data?.cycle?.earnings_generated || 0
        };
      } catch (e) {
        sync.engines.autopilot = { status: 'failed', error: e.message };
      }

      // 2. Sync Identity Engine
      try {
        const identities = await base44.asServiceRole.entities.AIIdentity.filter({}, null, 100);
        sync.engines.identity = {
          status: 'synced',
          count: (Array.isArray(identities) ? identities : []).length,
          active: (Array.isArray(identities) ? identities : []).filter(i => i.is_active).length
        };
      } catch (e) {
        sync.engines.identity = { status: 'failed', error: e.message };
      }

      // 3. Sync Wallet Engine
      try {
        const today = new Date().toDateString();
        const txs = await base44.asServiceRole.entities.WalletTransaction.filter({}, '-created_date', 50);
        const todayTxs = (Array.isArray(txs) ? txs : []).filter(
          t => t.type === 'earning' && new Date(t.created_date).toDateString() === today
        );
        sync.engines.wallet = {
          status: 'synced',
          today_earnings: todayTxs.reduce((s, t) => s + (t.amount || 0), 0),
          transactions_today: todayTxs.length
        };
      } catch (e) {
        sync.engines.wallet = { status: 'failed', error: e.message };
      }

      // 4. Sync Task Engine
      try {
        const tasks = await base44.asServiceRole.entities.AITask.filter({}, '-created_at', 50);
        const running = (Array.isArray(tasks) ? tasks : []).filter(t => ['running', 'analyzing', 'executing'].includes(t.status));
        const completed = (Array.isArray(tasks) ? tasks : []).filter(t => t.status === 'completed');
        sync.engines.tasks = {
          status: 'synced',
          total: tasks?.length || 0,
          active: running.length,
          completed: completed.length
        };
      } catch (e) {
        sync.engines.tasks = { status: 'failed', error: e.message };
      }

      // 5. Sync Discovery Engine
      try {
        const opportunities = await base44.asServiceRole.entities.WorkOpportunity.filter({}, '-score', 20);
        sync.engines.discovery = {
          status: 'synced',
          opportunities_available: opportunities?.length || 0,
          queued: (Array.isArray(opportunities) ? opportunities : []).filter(o => o.autopilot_queued).length
        };
      } catch (e) {
        sync.engines.discovery = { status: 'failed', error: e.message };
      }

      return Response.json({ success: true, sync });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // REAL-TIME TASK STATUS
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'get_realtime_status') {
      const status = {
        timestamp: new Date().toISOString(),
        user_email: user.email,
        active_tasks: 0,
        pending_tasks: 0,
        completed_tasks: 0,
        failed_tasks: 0,
        today_earnings: 0,
        identities: [],
        system_health: 'operational'
      };

      try {
        // Fetch all real-time data
        const [identities, tasks, txs] = await Promise.all([
          base44.asServiceRole.entities.AIIdentity.filter({}, null, 100),
          base44.asServiceRole.entities.AITask.filter({}, '-created_at', 100),
          base44.asServiceRole.entities.WalletTransaction.list('-created_date', 100)
        ]);

        // Count task statuses
        const taskList = Array.isArray(tasks) ? tasks : [];
        status.active_tasks = taskList.filter(t => ['running', 'analyzing', 'executing'].includes(t.status)).length;
        status.pending_tasks = taskList.filter(t => t.status === 'queued').length;
        status.completed_tasks = taskList.filter(t => t.status === 'completed').length;
        status.failed_tasks = taskList.filter(t => t.status === 'failed').length;

        // Calculate today's earnings
        const today = new Date().toDateString();
        const todayTxs = (Array.isArray(txs) ? txs : []).filter(
          t => t.type === 'earning' && new Date(t.created_date).toDateString() === today
        );
        status.today_earnings = todayTxs.reduce((s, t) => s + (t.amount || 0), 0);

        // Identity status
        const identityList = Array.isArray(identities) ? identities : [];
        status.identities = identityList.map(id => ({
          id: id.id,
          name: id.name,
          is_active: id.is_active,
          tasks_executed: id.tasks_executed,
          total_earned: id.total_earned,
          kyc_status: id.kyc_verified_data?.kyc_tier || 'none'
        }));

        // System health check
        const failureRate = status.completed_tasks + status.failed_tasks > 0
          ? status.failed_tasks / (status.completed_tasks + status.failed_tasks)
          : 0;
        
        if (failureRate > 0.3) status.system_health = 'warning';
        if (failureRate > 0.5) status.system_health = 'critical';

        return Response.json({ success: true, status });
      } catch (error) {
        console.error('[RealtimeCommandOrchestrator]', error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[RealtimeCommandOrchestrator] Critical error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});