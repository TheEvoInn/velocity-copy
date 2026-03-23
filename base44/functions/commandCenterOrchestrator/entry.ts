import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, engine, command, force } = await req.json();

    // Get current user goals to determine which engines are active
    const userGoals = await base44.entities.UserGoals.filter({ created_by: user.email }).then(r => r[0]) || {};
    
    const commandState = {
      timestamp: new Date().toISOString(),
      user_email: user.email,
      action,
      engine,
      command,
      engines: {
        autopilot: { enabled: userGoals.autopilot_enabled !== false, status: 'unknown' },
        discovery: { enabled: true, status: 'unknown' },
        vipz: { enabled: true, status: 'unknown' },
        ned: { enabled: true, status: 'unknown' }
      },
      kpis: {
        total_tasks_queued: 0,
        active_executions: 0,
        completion_rate: 0,
        revenue_today: 0,
        interventions_pending: 0
      }
    };

    // Handle different commands
    if (action === 'get_status') {
      // Fetch real-time KPIs
      const tasks = await base44.entities.TaskExecutionQueue.filter({
        status: 'queued'
      });
      commandState.kpis.total_tasks_queued = tasks.length;

      const active = await base44.entities.TaskExecutionQueue.filter({
        status: 'processing'
      });
      commandState.kpis.active_executions = active.length;

      const completed = await base44.entities.TaskExecutionQueue.filter({
        status: 'completed'
      });
      commandState.kpis.completion_rate = completed.length > 0 ? ((completed.length / (completed.length + tasks.length + active.length)) * 100).toFixed(2) : 0;

      // Get today's revenue
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const todayTx = await base44.entities.Transaction.filter({
        type: 'income',
        created_date: { $gte: now.toISOString() }
      });
      commandState.kpis.revenue_today = todayTx.reduce((sum, tx) => sum + (tx.net_amount || 0), 0);

      // Get pending interventions
      const interventions = await base44.entities.UserIntervention.filter({
        status: 'pending'
      });
      commandState.kpis.interventions_pending = interventions.length;

      return Response.json({ success: true, state: commandState });
    }

    if (action === 'toggle_engine') {
      if (!engine) {
        return Response.json({ error: 'Engine name required' }, { status: 400 });
      }

      if (engine === 'autopilot') {
        await base44.auth.updateMe({ autopilot_enabled: command === 'enable' });
      }

      commandState.engines[engine].enabled = command === 'enable';
      commandState.engines[engine].status = 'toggled';

      return Response.json({ 
        success: true, 
        message: `${engine} ${command === 'enable' ? 'enabled' : 'disabled'}`,
        state: commandState 
      });
    }

    if (action === 'emergency_stop') {
      // Disable all engines
      await base44.auth.updateMe({ autopilot_enabled: false });
      
      for (const eng of Object.keys(commandState.engines)) {
        commandState.engines[eng].enabled = false;
        commandState.engines[eng].status = 'stopped';
      }

      return Response.json({
        success: true,
        message: 'EMERGENCY STOP activated - all engines disabled',
        state: commandState
      });
    }

    if (action === 'resume_all') {
      await base44.auth.updateMe({ autopilot_enabled: true });
      
      for (const eng of Object.keys(commandState.engines)) {
        commandState.engines[eng].enabled = true;
        commandState.engines[eng].status = 'running';
      }

      return Response.json({
        success: true,
        message: 'All engines resumed',
        state: commandState
      });
    }

    if (action === 'clear_queue') {
      // Cancel pending tasks
      const tasks = await base44.entities.TaskExecutionQueue.filter({
        status: 'queued'
      });

      for (const task of tasks) {
        await base44.entities.TaskExecutionQueue.update(task.id, { status: 'cancelled' });
      }

      return Response.json({
        success: true,
        message: `Cleared ${tasks.length} queued tasks`,
        state: commandState
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Command orchestrator error:', error);
    return Response.json(
      { error: error.message || 'Command failed' },
      { status: 500 }
    );
  }
});