import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * System Metrics Audit
 * Real-time metrics collection across all departments for Deep Space monitoring
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, department } = await req.json();

    // ─── GET_DEPARTMENT_METRICS ────────────────────────────────────────────
    if (action === 'get_department_metrics') {
      const metrics = await getDepartmentMetrics(base44, department, user);
      return Response.json({ success: true, metrics });
    }

    // ─── GET_GLOBAL_HEALTH ────────────────────────────────────────────────
    if (action === 'get_global_health') {
      const health = await getGlobalHealth(base44, user);
      return Response.json({ success: true, health });
    }

    // ─── GET_REAL_TIME_DASHBOARD ──────────────────────────────────────────
    if (action === 'get_realtime_dashboard') {
      const dashboard = await getRealtimeDashboard(base44, user);
      return Response.json({ success: true, dashboard });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function getDepartmentMetrics(base44, department, user) {
  const metrics = {
    requests_per_min: 0,
    avg_response_ms: 0,
    error_rate: 0,
    active_tasks: 0,
    total_transactions: 0,
    health_status: 'unknown'
  };

  try {
    // Get recent logs for this department
    const logs = await base44.entities.ActivityLog.filter(
      { created_by: user.email, severity: { $in: ['success', 'error', 'warning'] } },
      '-created_date',
      100
    ).catch(() => []);

    const logsArray = Array.isArray(logs) ? logs : [];

    // Calculate request metrics
    const recentLogs = logsArray.filter(l => {
      const created = new Date(l.created_date);
      const now = new Date();
      return (now - created) / 1000 < 60; // Last 60 seconds
    });

    metrics.requests_per_min = recentLogs.length;

    // Calculate response time (from metadata if available)
    const responseTimes = logsArray
      .slice(0, 50)
      .map(l => l.metadata?.response_time_ms || 0)
      .filter(t => t > 0);

    if (responseTimes.length > 0) {
      metrics.avg_response_ms = Math.round(
        responseTimes.reduce((a, b) => a + b) / responseTimes.length
      );
    }

    // Calculate error rate
    const errors = logsArray.filter(l => l.severity === 'error').length;
    metrics.error_rate = logsArray.length > 0 ? ((errors / logsArray.length) * 100).toFixed(2) : 0;

    // Get active tasks
    if (department === 'Autopilot') {
      const tasks = await base44.entities.TaskExecutionQueue.filter(
        { created_by: user.email, status: { $in: ['queued', 'processing'] } }
      ).catch(() => []);
      metrics.active_tasks = Array.isArray(tasks) ? tasks.length : 0;
    }

    if (department === 'NED') {
      const operations = await base44.entities.CryptoTransaction.filter(
        { created_by: user.email, status: 'pending' }
      ).catch(() => []);
      metrics.active_tasks = Array.isArray(operations) ? operations.length : 0;
    }

    if (department === 'VIPZ') {
      const pages = await base44.entities.DigitalStorefront.filter(
        { created_by: user.email, status: 'published' }
      ).catch(() => []);
      metrics.active_tasks = Array.isArray(pages) ? pages.length : 0;
    }

    if (department === 'Discovery') {
      const opportunities = await base44.entities.Opportunity.filter(
        { created_by: user.email, status: { $in: ['new', 'reviewing'] } }
      ).catch(() => []);
      metrics.active_tasks = Array.isArray(opportunities) ? opportunities.length : 0;
    }

    // Get transaction count (last 24h)
    const transactions = await base44.entities.Transaction.filter(
      { created_by: user.email }
    ).catch(() => []);
    metrics.total_transactions = Array.isArray(transactions) ? transactions.length : 0;

    // Determine health status
    metrics.health_status = 
      metrics.error_rate < 5 ? 'healthy' :
      metrics.error_rate < 15 ? 'warning' :
      'critical';

  } catch (e) {
    console.error('Error getting department metrics:', e);
  }

  return metrics;
}

async function getGlobalHealth(base44, user) {
  const health = {
    autopilot: { status: 'unknown', tasks: 0, success_rate: 0 },
    ned: { status: 'unknown', transactions: 0, success_rate: 0 },
    vipz: { status: 'unknown', pages: 0, conversion_rate: 0 },
    discovery: { status: 'unknown', opportunities: 0, scan_health: 'unknown' },
    overall: 'unknown',
    last_sync: new Date().toISOString()
  };

  try {
    // Autopilot health
    const tasks = await base44.entities.TaskExecutionQueue.filter(
      { created_by: user.email }
    ).catch(() => []);
    const tasksArray = Array.isArray(tasks) ? tasks : [];
    health.autopilot.tasks = tasksArray.length;
    const completedTasks = tasksArray.filter(t => t.status === 'completed').length;
    const successRate = tasksArray.length > 0 ? ((completedTasks / tasksArray.length) * 100) : 0;
    health.autopilot.success_rate = parseFloat(successRate.toFixed(1));
    // If we have tasks queued, assume processing (mark as warning), if completed tasks exist mark as healthy
    health.autopilot.status = 
      tasksArray.length === 0 ? 'critical' : 
      completedTasks > 0 && health.autopilot.success_rate > 50 ? 'healthy' :
      tasksArray.length > 0 ? 'warning' : 'critical';

    // NED health - No crypto yet, mark as initializing
    const crypto = await base44.entities.CryptoTransaction.filter(
      { created_by: user.email }
    ).catch(() => []);
    const cryptoArray = Array.isArray(crypto) ? crypto : [];
    health.ned.transactions = cryptoArray.length;
    const successTx = cryptoArray.filter(t => t.status === 'completed').length;
    const nedSuccessRate = cryptoArray.length > 0 ? ((successTx / cryptoArray.length) * 100) : 0;
    health.ned.success_rate = parseFloat(nedSuccessRate.toFixed(1));
    health.ned.status = cryptoArray.length === 0 ? 'initializing' : health.ned.success_rate > 50 ? 'healthy' : 'warning';

    // VIPZ health
    const pages = await base44.entities.DigitalStorefront.filter(
      { created_by: user.email }
    ).catch(() => []);
    const pagesArray = Array.isArray(pages) ? pages : [];
    health.vipz.pages = pagesArray.length;
    const totalRevenue = pagesArray.reduce((sum, p) => sum + (p.total_revenue || 0), 0);
    health.vipz.conversion_rate = pagesArray.length > 0 
      ? ((pagesArray.filter(p => p.customer_count > 0).length / pagesArray.length) * 100).toFixed(1)
      : 0;
    health.vipz.status = health.vipz.conversion_rate > 20 ? 'healthy' : health.vipz.conversion_rate > 5 ? 'warning' : 'critical';

    // Discovery health
    const opportunities = await base44.entities.Opportunity.filter(
      { created_by: user.email }
    ).catch(() => []);
    const oppsArray = Array.isArray(opportunities) ? opportunities : [];
    health.discovery.opportunities = oppsArray.length;
    health.discovery.scan_health = oppsArray.length > 0 ? 'healthy' : 'idle';
    health.discovery.status = health.discovery.scan_health === 'healthy' ? 'healthy' : 'unknown';

    // Overall status
    const statuses = [health.autopilot.status, health.ned.status, health.vipz.status, health.discovery.status];
    if (statuses.includes('critical')) health.overall = 'critical';
    else if (statuses.includes('warning')) health.overall = 'warning';
    else if (statuses.includes('healthy')) health.overall = 'healthy';
    else health.overall = 'initializing';

  } catch (e) {
    console.error('Error getting global health:', e);
  }

  return health;
}

async function getRealtimeDashboard(base44, user) {
  const dashboard = {
    timestamp: new Date().toISOString(),
    user: user.email,
    metrics: {
      total_tasks: 0,
      total_earnings: 0,
      active_workflows: 0,
      pending_opportunities: 0,
      error_count: 0
    },
    departments: {}
  };

  try {
    // Global metrics
    const allLogs = await base44.entities.ActivityLog.filter(
      { created_by: user.email }
    ).catch(() => []);
    const logsArray = Array.isArray(allLogs) ? allLogs : [];
    dashboard.metrics.error_count = logsArray.filter(l => l.severity === 'error').length;

    const tasks = await base44.entities.TaskExecutionQueue.filter(
      { created_by: user.email }
    ).catch(() => []);
    dashboard.metrics.total_tasks = Array.isArray(tasks) ? tasks.length : 0;

    const workflows = await base44.entities.Workflow.filter(
      { created_by: user.email, status: 'active' }
    ).catch(() => []);
    dashboard.metrics.active_workflows = Array.isArray(workflows) ? workflows.length : 0;

    const opportunities = await base44.entities.Opportunity.filter(
      { created_by: user.email, status: 'new' }
    ).catch(() => []);
    dashboard.metrics.pending_opportunities = Array.isArray(opportunities) ? opportunities.length : 0;

    const goals = await base44.entities.UserGoals.filter(
      { created_by: user.email }
    ).catch(() => []);
    const goalsArray = Array.isArray(goals) ? goals : [];
    dashboard.metrics.total_earnings = goalsArray.length > 0 ? goalsArray[0].total_earned || 0 : 0;

    // Department summaries
    for (const dept of ['Autopilot', 'NED', 'VIPZ', 'Discovery']) {
      dashboard.departments[dept] = await getDepartmentMetrics(base44, dept, user);
    }

  } catch (e) {
    console.error('Error getting realtime dashboard:', e);
  }

  return dashboard;
}