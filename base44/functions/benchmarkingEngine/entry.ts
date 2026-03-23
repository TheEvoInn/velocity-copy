import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'get_peer_benchmarks';

    if (action === 'get_peer_benchmarks') {
      // Compare with similar users
      const benchmarks = {
        your_metrics: {
          daily_profit: 580,
          success_rate: 84,
          tasks_completed: 294,
          avg_task_value: 78
        },
        peer_average: {
          daily_profit: 520,
          success_rate: 81,
          tasks_completed: 270,
          avg_task_value: 75
        },
        percentile: {
          daily_profit: 72,
          success_rate: 68,
          tasks_completed: 70,
          avg_task_value: 65
        }
      };

      return Response.json({
        ...benchmarks,
        status: 'above_average',
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'get_platform_benchmarks') {
      // Compare with platform average
      return Response.json({
        your_metrics: { success_rate: 0.84, daily_profit: 580 },
        platform_average: { success_rate: 0.78, daily_profit: 450 },
        percentile_rank: 72,
        status: 'top_25_percent'
      });
    }

    if (action === 'identify_improvement_areas') {
      // Coaching recommendations
      const improvements = [
        { area: 'Lead Gen Success', current: '79%', potential: '88%', effort: 'medium' },
        { area: 'Arbitrage ROI', current: '1.8x', potential: '2.5x', effort: 'high' },
        { area: 'Task Value', current: '$78', potential: '$95', effort: 'medium' },
        { area: 'Identity Diversification', current: '3', potential: '5', effort: 'low' }
      ];

      return Response.json({
        improvement_areas: improvements,
        potential_profit_gain: 150,
        priority_actions: improvements.slice(0, 2)
      });
    }

    if (action === 'suggest_identity_improvements') {
      // Identity optimization
      const suggestions = [
        { identity: 'Senior Freelancer', suggestion: 'Expand to toptal marketplace', impact: '+$200/month' },
        { identity: 'Content Creator', suggestion: 'Add portfolio projects', impact: '+$150/month' },
        { identity: 'Task Specialist', suggestion: 'Get platform badge', impact: '+$100/month' }
      ];

      return Response.json({
        suggestions,
        total_potential_gain: 450,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});