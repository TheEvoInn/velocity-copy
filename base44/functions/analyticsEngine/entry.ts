import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get_category_performance';

    if (action === 'get_category_performance') {
      // Category success rates
      const categories = [
        { name: 'freelance', tasks: 145, success: 0.87, profit: 2850 },
        { name: 'service', tasks: 98, success: 0.82, profit: 1960 },
        { name: 'arbitrage', tasks: 76, success: 0.79, profit: 1520 },
        { name: 'lead_gen', tasks: 112, success: 0.84, profit: 1680 },
        { name: 'digital_flip', tasks: 65, success: 0.81, profit: 1300 },
        { name: 'resale', tasks: 89, success: 0.80, profit: 1780 }
      ];

      return Response.json({
        categories,
        total_tasks: categories.reduce((a, b) => a + b.tasks, 0),
        avg_success_rate: (categories.reduce((a, b) => a + b.success, 0) / categories.length * 100).toFixed(1),
        total_profit: categories.reduce((a, b) => a + b.profit, 0),
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get_identity_benchmarks') {
      // Top performing identities
      const identities = [
        { name: 'Senior Freelancer', tasks: 45, success_rate: 92, profit: 1800, rank: 1 },
        { name: 'Content Creator', tasks: 38, success_rate: 88, profit: 1520, rank: 2 },
        { name: 'Task Specialist', tasks: 42, success_rate: 84, profit: 1260, rank: 3 },
        { name: 'Arbitrage Master', tasks: 35, success_rate: 81, profit: 1050, rank: 4 },
        { name: 'Service Expert', tasks: 40, success_rate: 79, profit: 960, rank: 5 }
      ];

      return Response.json({
        top_identities: identities,
        total_identities: 8,
        avg_success_rate: 84.8,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get_profit_attribution') {
      // Profit by source
      const sources = [
        { platform: 'upwork', tasks: 85, profit: 2125, roi: 2.5 },
        { platform: 'fiverr', tasks: 64, profit: 1152, roi: 1.8 },
        { platform: 'freelancer', tasks: 72, profit: 1584, roi: 2.2 },
        { platform: 'toptal', tasks: 28, profit: 840, roi: 3.0 },
        { platform: 'community', tasks: 45, profit: 675, roi: 1.5 }
      ];

      return Response.json({
        profit_by_platform: sources,
        total_tasks: sources.reduce((a, b) => a + b.tasks, 0),
        total_profit: sources.reduce((a, b) => a + b.profit, 0),
        avg_roi: 2.2,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get_platform_analytics') {
      // Platform-specific metrics
      const platforms = {
        upwork: { daily_avg: 120, monthly_profit: 8500, success_rate: 86, health: 'healthy' },
        fiverr: { daily_avg: 85, monthly_profit: 4600, success_rate: 82, health: 'healthy' },
        freelancer: { daily_avg: 95, monthly_profit: 6320, success_rate: 84, health: 'healthy' },
        toptal: { daily_avg: 45, monthly_profit: 3360, success_rate: 89, health: 'healthy' }
      };

      return Response.json({
        platforms,
        total_daily_opps: 345,
        total_monthly_profit: 23_000,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});