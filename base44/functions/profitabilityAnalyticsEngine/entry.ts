import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { period = 'today', include_modules = ['autopilot', 'discovery', 'vipz', 'ned'] } = await req.json();

    // Calculate date range
    const now = new Date();
    let startDate = new Date();
    
    switch(period) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'month':
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
    }

    const results = {
      period,
      start_date: startDate.toISOString(),
      end_date: now.toISOString(),
      modules: {},
      totals: {
        gross_revenue: 0,
        net_revenue: 0,
        expenses: 0,
        completed_tasks: 0,
        execution_rate: 0,
        average_task_value: 0
      },
      breakdown_by_category: {},
      top_opportunities: [],
      performance_metrics: {}
    };

    // Fetch transactions for revenue
    const transactions = await base44.entities.Transaction.filter({
      type: 'income',
      created_date: { $gte: startDate.toISOString() }
    });

    // Aggregate by module/category
    for (const tx of transactions) {
      const category = tx.category || 'other';
      const amount = tx.amount || 0;
      const netAmount = tx.net_amount || amount;
      const fee = tx.platform_fee || 0;

      results.totals.gross_revenue += amount;
      results.totals.net_revenue += netAmount;
      results.totals.expenses += fee;

      results.breakdown_by_category[category] = (results.breakdown_by_category[category] || 0) + netAmount;
    }

    // Fetch task execution metrics
    const tasks = await base44.entities.TaskExecutionQueue.filter({
      status: 'completed',
      created_date: { $gte: startDate.toISOString() }
    });

    results.totals.completed_tasks = tasks.length;
    results.totals.average_task_value = tasks.length > 0 
      ? results.totals.net_revenue / tasks.length 
      : 0;

    // Fetch opportunities
    const opportunities = await base44.entities.Opportunity.filter({
      status: 'completed',
      created_date: { $gte: startDate.toISOString() }
    }, '-created_date', 10);

    results.top_opportunities = opportunities.map(opp => ({
      id: opp.id,
      title: opp.title,
      category: opp.category,
      estimated_value: opp.profit_estimate_high || 0,
      status: opp.status
    }));

    // Module-specific metrics
    if (include_modules.includes('autopilot')) {
      const autopilotTasks = tasks.filter(t => t.identity_name);
      results.modules.autopilot = {
        completed_tasks: autopilotTasks.length,
        revenue: autopilotTasks.reduce((sum, t) => {
          const tx = transactions.find(tr => tr.opportunity_id === t.opportunity_id);
          return sum + (tx?.net_amount || 0);
        }, 0),
        execution_rate: tasks.length > 0 ? (autopilotTasks.length / tasks.length * 100).toFixed(2) : 0
      };
    }

    if (include_modules.includes('discovery')) {
      const discoveredOpps = opportunities.length;
      results.modules.discovery = {
        opportunities_found: discoveredOpps,
        total_potential: opportunities.reduce((sum, opp) => sum + (opp.profit_estimate_high || 0), 0),
        conversion_rate: tasks.length > 0 ? ((tasks.length / discoveredOpps) * 100).toFixed(2) : 0
      };
    }

    // Performance score
    const roi = results.totals.expenses > 0 
      ? ((results.totals.gross_revenue - results.totals.expenses) / results.totals.expenses * 100).toFixed(2)
      : 0;

    results.performance_metrics = {
      roi_percentage: roi,
      tasks_per_day: (results.totals.completed_tasks / Math.max(Math.ceil((now - startDate) / (1000 * 60 * 60 * 24)), 1)).toFixed(2),
      revenue_per_task: results.totals.average_task_value.toFixed(2),
      expense_ratio: (results.totals.expenses / results.totals.gross_revenue * 100).toFixed(2)
    };

    return Response.json({ success: true, analytics: results });
  } catch (error) {
    console.error('Analytics engine error:', error);
    return Response.json(
      { error: error.message || 'Analytics failed' },
      { status: 500 }
    );
  }
});