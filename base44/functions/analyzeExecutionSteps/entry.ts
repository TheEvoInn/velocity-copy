import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { opportunity_id, execution_queue } = await req.json();

    if (!opportunity_id) {
      return Response.json({ error: 'Missing opportunity_id' }, { status: 400 });
    }

    // Fetch current opportunity with full data
    const opportunities = await base44.entities.Opportunity.filter(
      { id: opportunity_id },
      '-updated_date',
      1
    );

    if (!opportunities || opportunities.length === 0) {
      return Response.json({ error: 'Opportunity not found' }, { status: 404 });
    }

    const opportunity = opportunities[0];

    // Analyze execution steps
    const executionSteps = opportunity.execution_steps || [];
    const completedSteps = executionSteps.filter(s => s.completed).length;
    const totalSteps = executionSteps.length;

    // Determine next action
    let nextAction = null;
    let issues = [];
    let successProbability = 0;

    if (totalSteps === 0) {
      issues.push('No execution steps defined for this opportunity');
    } else if (completedSteps === totalSteps) {
      nextAction = 'All steps completed. Ready for submission or claiming.';
      successProbability = 100;
    } else {
      const nextIncompleteStep = executionSteps.find(s => !s.completed);
      if (nextIncompleteStep) {
        nextAction = `Execute: ${nextIncompleteStep.action}`;
        
        // Validate step prerequisites
        const stepIndex = executionSteps.indexOf(nextIncompleteStep);
        const allPriorStepsComplete = executionSteps
          .slice(0, stepIndex)
          .every(s => s.completed);

        if (!allPriorStepsComplete) {
          issues.push('Previous steps not yet completed');
        }
      }
    }

    // Calculate success probability based on:
    // 1. Progress (completion %)
    // 2. Opportunity risk score
    // 3. Platform execution health
    const progressScore = (completedSteps / Math.max(totalSteps, 1)) * 100;
    const riskAdjustment = opportunity.risk_score ? Math.max(0, 100 - opportunity.risk_score) : 100;
    const velocityScore = opportunity.velocity_score || 50;
    
    successProbability = Math.round(
      (progressScore * 0.4) + 
      (riskAdjustment * 0.3) + 
      (velocityScore * 0.3)
    );

    // Analyze execution queue for issues
    if (execution_queue && execution_queue.length > 0) {
      const failedTasks = execution_queue.filter(t => t.status === 'failed');
      if (failedTasks.length > 0) {
        issues.push(`${failedTasks.length} execution(s) failed - review errors`);
      }

      const stuckTasks = execution_queue.filter(
        t => t.status === 'processing' && 
             new Date(t.start_timestamp) < new Date(Date.now() - 5 * 60000) // > 5 min
      );
      if (stuckTasks.length > 0) {
        issues.push('Long-running executions detected - may need retry');
      }
    }

    // Fetch related task execution data for context
    const recentTasks = await base44.entities.TaskExecutionQueue.filter(
      { opportunity_id },
      '-created_date',
      5
    );

    // Build response with actionable data
    const analysis = {
      opportunity_id,
      completed_steps: completedSteps,
      total_steps: totalSteps,
      completion_percentage: totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0,
      next_action: nextAction,
      issues,
      success_probability: Math.min(100, Math.max(0, successProbability)),
      current_status: opportunity.status,
      execution_queue_count: execution_queue?.length || 0,
      recent_tasks_count: recentTasks?.length || 0,
      recommendation: determineRecommendation(opportunity, completedSteps, totalSteps, issues),
      timestamp: new Date().toISOString(),
    };

    return Response.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// Helper to determine action recommendation
function determineRecommendation(opportunity, completed, total, issues) {
  if (issues.length > 0) {
    return 'Review issues before proceeding';
  }
  
  if (completed === total && total > 0) {
    return 'All steps complete - ready for final submission';
  }
  
  if (completed === 0) {
    return 'Start execution from step 1';
  }
  
  return 'Continue with next step';
}