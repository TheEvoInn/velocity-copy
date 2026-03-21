import { base44 } from '@/api/base44Client';

/**
 * Smart recommendation engine that analyzes user data and suggests optimal workflow configurations
 */

export async function generateWorkflowRecommendations() {
  try {
    const [userGoals, opportunities, tasks, transactions] = await Promise.all([
      base44.entities.UserGoals.list().then(r => r[0] || {}),
      base44.entities.Opportunity.list('-created_date', 50),
      base44.entities.TaskExecutionQueue.list('-created_date', 50),
      base44.entities.Transaction.list('-created_date', 50),
    ]);

    const recommendations = [];

    // 1. Analyze success patterns by platform
    const platformStats = analyzePlatformPerformance(opportunities, tasks);
    if (platformStats.topPlatforms.length > 0) {
      recommendations.push({
        id: 'platform_focus',
        title: 'Focus on Your Best Platforms',
        description: `You've had ${platformStats.topPlatforms[0].successRate}% success rate on ${platformStats.topPlatforms[0].platform}. Consider prioritizing these platforms in your workflow.`,
        platforms: platformStats.topPlatforms.map(p => p.platform),
        priority: 'high',
        actions: [
          { type: 'filter', config: { platforms: platformStats.topPlatforms.map(p => p.platform) } },
          { type: 'escalate_priority', config: { platforms: platformStats.topPlatforms.map(p => p.platform) } },
        ],
      });
    }

    // 2. Analyze opportunity value preferences
    const avgValue = opportunities.reduce((sum, o) => sum + ((o.profit_estimate_high || 0) / 2), 0) / opportunities.length;
    const highValueOpps = opportunities.filter(o => ((o.profit_estimate_high || 0) / 2) > avgValue * 1.5);
    
    if (highValueOpps.length > 0) {
      recommendations.push({
        id: 'high_value_focus',
        title: 'Capitalize on High-Value Opportunities',
        description: `${highValueOpps.length} high-value opportunities found. Consider setting a profit threshold to prioritize these.`,
        suggestedThreshold: Math.round(avgValue * 1.5),
        priority: 'high',
        actions: [
          { type: 'condition', config: { type: 'profit_threshold', operator: '>', value: Math.round(avgValue * 1.5) } },
          { type: 'action', config: { action: 'send_alert', severity: 'urgent' } },
        ],
      });
    }

    // 3. Category performance analysis
    const categoryStats = analyzeByCategory(opportunities);
    if (categoryStats.bestCategory) {
      recommendations.push({
        id: 'category_optimization',
        title: `Optimize for ${categoryStats.bestCategory.name}`,
        description: `${categoryStats.bestCategory.count} ${categoryStats.bestCategory.name} opportunities found with ${categoryStats.bestCategory.avgValue} avg value.`,
        suggestedCategory: categoryStats.bestCategory.name,
        priority: 'medium',
        actions: [
          { type: 'filter', config: { categories: [categoryStats.bestCategory.name] } },
        ],
      });
    }

    // 4. Task failure analysis
    const failureAnalysis = analyzeFailurePatterns(tasks);
    if (failureAnalysis.commonErrors.length > 0) {
      recommendations.push({
        id: 'error_mitigation',
        title: 'Mitigate Common Failures',
        description: `${failureAnalysis.commonErrors[0].type} is your most common failure. Consider adding a filter to skip these.`,
        priority: 'high',
        actions: [
          { type: 'condition', config: { type: 'skip_on_error', value: failureAnalysis.commonErrors[0].type } },
        ],
      });
    }

    // 5. Goal alignment
    const dailyTarget = userGoals.daily_target || 1000;
    const recentEarnings = transactions
      .filter(t => t.type === 'income' && new Date(t.created_date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      .reduce((sum, t) => sum + (t.amount || 0), 0);
    
    if (recentEarnings < (dailyTarget * 7) / 2) {
      recommendations.push({
        id: 'increase_activity',
        title: 'Increase Workflow Intensity',
        description: `Recent earnings ($${recentEarnings.toFixed(0)}) are below your weekly target. Consider increasing task concurrency.`,
        priority: 'high',
        actions: [
          { type: 'config', config: { max_concurrent_tasks: 5, execution_mode: 'full_auto' } },
        ],
      });
    }

    // 6. Time-based optimization
    const timingAnalysis = analyzeOptimalTiming(tasks);
    if (timingAnalysis.bestHour) {
      recommendations.push({
        id: 'schedule_optimization',
        title: 'Optimize Execution Timing',
        description: `${timingAnalysis.bestHour}:00 is your most productive hour. Schedule intensive workflows then.`,
        priority: 'low',
        actions: [
          { type: 'trigger', config: { type: 'schedule', hour: timingAnalysis.bestHour } },
        ],
      });
    }

    return recommendations.sort((a, b) => {
      const priorityMap = { high: 3, medium: 2, low: 1 };
      return priorityMap[b.priority] - priorityMap[a.priority];
    });
  } catch (error) {
    console.error('Recommendation engine error:', error);
    return [];
  }
}

function analyzePlatformPerformance(opportunities, tasks) {
  const platformMap = {};

  opportunities.forEach(opp => {
    if (!platformMap[opp.platform]) {
      platformMap[opp.platform] = { total: 0, completed: 0 };
    }
    platformMap[opp.platform].total++;
    if (opp.status === 'completed') platformMap[opp.platform].completed++;
  });

  const topPlatforms = Object.entries(platformMap)
    .map(([platform, stats]) => ({
      platform,
      total: stats.total,
      successRate: Math.round((stats.completed / stats.total) * 100),
    }))
    .filter(p => p.total >= 3)
    .sort((a, b) => b.successRate - a.successRate)
    .slice(0, 3);

  return { topPlatforms };
}

function analyzeByCategory(opportunities) {
  const categoryMap = {};

  opportunities.forEach(opp => {
    if (!categoryMap[opp.category]) {
      categoryMap[opp.category] = { count: 0, totalValue: 0 };
    }
    categoryMap[opp.category].count++;
    categoryMap[opp.category].totalValue += (opp.profit_estimate_high || 0) / 2;
  });

  const sorted = Object.entries(categoryMap)
    .map(([name, stats]) => ({
      name,
      count: stats.count,
      avgValue: Math.round(stats.totalValue / stats.count),
    }))
    .sort((a, b) => b.avgValue - a.avgValue);

  return { bestCategory: sorted[0] || null };
}

function analyzeFailurePatterns(tasks) {
  const errorMap = {};
  const failedTasks = tasks.filter(t => t.status === 'failed');

  failedTasks.forEach(task => {
    const errorType = task.error_type || 'unknown';
    errorMap[errorType] = (errorMap[errorType] || 0) + 1;
  });

  const commonErrors = Object.entries(errorMap)
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  return { commonErrors };
}

function analyzeOptimalTiming(tasks) {
  const hourMap = {};
  const completedTasks = tasks.filter(t => t.status === 'completed');

  completedTasks.forEach(task => {
    const hour = new Date(task.completion_timestamp || task.updated_date).getHours();
    hourMap[hour] = (hourMap[hour] || 0) + 1;
  });

  const bestHour = Object.entries(hourMap)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

  return { bestHour };
}