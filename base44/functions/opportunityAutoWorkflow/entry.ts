import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, thresholds = {}, dryRun = false } = body;

    // Get user preferences
    const userGoals = await base44.entities.UserGoals.filter({ created_by: user.email });
    const userPrefs = userGoals[0] || {};

    const defaultThresholds = {
      min_value: thresholds.min_value ?? userPrefs.daily_target ?? 50,
      max_signup_time: thresholds.max_signup_time ?? 5, // minutes
      max_captcha_likelihood: thresholds.max_captcha_likelihood ?? 0.3, // 30%
      required_difficulty: thresholds.required_difficulty ?? 'easy',
      instant_claim_only: thresholds.instant_claim_only ?? false,
    };

    if (action === 'evaluate_and_auto_execute') {
      const opportunities = await base44.entities.Opportunity.filter({ 
        status: 'new',
        source: 'global_discovery'
      });

      const results = [];

      for (const opp of opportunities) {
        // Skip if doesn't meet thresholds
        if ((opp.profit_estimate_low || 0) < defaultThresholds.min_value) {
          continue;
        }

        if (defaultThresholds.instant_claim_only && !opp.instant_claim) {
          continue;
        }

        const difficulty_match = !defaultThresholds.required_difficulty || 
          (opp.difficulty === defaultThresholds.required_difficulty);

        if (!difficulty_match) continue;

        // Use LLM to analyze if this can be auto-completed
        const analysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this opportunity for automated completion:

Title: ${opp.title}
Description: ${opp.description}
URL: ${opp.url}
Category: ${opp.category}

Can this be auto-completed? Consider:
1. Does it require simple form filling only (name, email, phone)?
2. Are there any CAPTCHAs or complex verification?
3. Is it a legitimate, safe opportunity?
4. Estimated time to complete in minutes
5. Steps required to complete

Return JSON with:
{
  "can_auto_complete": boolean,
  "confidence_score": number (0-100),
  "estimated_time_minutes": number,
  "required_fields": ["field1", "field2"],
  "risks": ["risk1", "risk2"],
  "completion_strategy": "brief strategy",
  "reason": "explanation"
}`,
          response_json_schema: {
            type: 'object',
            properties: {
              can_auto_complete: { type: 'boolean' },
              confidence_score: { type: 'number' },
              estimated_time_minutes: { type: 'number' },
              required_fields: { type: 'array', items: { type: 'string' } },
              risks: { type: 'array', items: { type: 'string' } },
              completion_strategy: { type: 'string' },
              reason: { type: 'string' },
            },
          },
        });

        if (!analysis.data?.can_auto_complete || analysis.data.confidence_score < 70) {
          results.push({
            opportunity_id: opp.id,
            status: 'skipped',
            reason: analysis.data?.reason || 'Failed confidence check',
          });
          continue;
        }

        if (analysis.data.estimated_time_minutes > defaultThresholds.max_signup_time) {
          results.push({
            opportunity_id: opp.id,
            status: 'skipped',
            reason: `Exceeds max signup time (${analysis.data.estimated_time_minutes}min > ${defaultThresholds.max_signup_time}min)`,
          });
          continue;
        }

        if (!dryRun) {
          // Generate form completion data using LLM
          const formData = await base44.integrations.Core.InvokeLLM({
            prompt: `Generate realistic form data for ${opp.title}.

Required fields: ${(analysis.data.required_fields || []).join(', ')}
User: ${user.full_name} (${user.email})

For these fields, generate appropriate values:
${(analysis.data.required_fields || []).map(f => `- ${f}`).join('\n')}

Return ONLY valid JSON object with field names as keys and values.
Be realistic and professional.`,
            response_json_schema: {
              type: 'object',
              properties: {},
              additionalProperties: true,
            },
          });

          // Create execution task
          const task = await base44.entities.TaskExecutionQueue.create({
            opportunity_id: opp.id,
            url: opp.url,
            opportunity_type: 'survey',
            platform: opp.platform || 'direct',
            identity_id: user.id,
            identity_name: user.full_name,
            status: 'queued',
            priority: Math.min(100, ((opp.profit_estimate_high || 50) / 500) * 100),
            estimated_value: opp.profit_estimate_high || 50,
            form_data_submitted: formData.data || {},
            execution_log: [{
              timestamp: new Date().toISOString(),
              step: 'auto_workflow_created',
              status: 'pending',
              details: `Auto-created via opportunity workflow - confidence: ${analysis.data.confidence_score}%`,
            }],
          });

          await base44.entities.Opportunity.update(opp.id, { 
            status: 'queued',
            task_execution_id: task.id,
          });

          results.push({
            opportunity_id: opp.id,
            task_id: task.id,
            status: 'auto_queued',
            estimated_value: opp.profit_estimate_high,
            confidence: analysis.data.confidence_score,
          });
        } else {
          results.push({
            opportunity_id: opp.id,
            status: 'would_queue',
            estimated_value: opp.profit_estimate_high,
            confidence: analysis.data.confidence_score,
          });
        }
      }

      return Response.json({
        processed: opportunities.length,
        results,
        thresholds: defaultThresholds,
        mode: dryRun ? 'dry_run' : 'live',
        timestamp: new Date().toISOString(),
      });
    }

    if (action === 'get_workflow_status') {
      const recentTasks = await base44.entities.TaskExecutionQueue.filter({
        created_by: user.email,
      }, '-created_date', 20);

      const autoTasks = recentTasks.filter(t => t.execution_log?.some(l => l.step === 'auto_workflow_created'));

      const stats = {
        total_auto_tasks: autoTasks.length,
        completed: autoTasks.filter(t => t.status === 'completed').length,
        failed: autoTasks.filter(t => t.status === 'failed').length,
        pending: autoTasks.filter(t => ['queued', 'processing'].includes(t.status)).length,
        total_value: autoTasks.reduce((sum, t) => sum + (t.estimated_value || 0), 0),
      };

      return Response.json({
        stats,
        recent_tasks: autoTasks.slice(0, 10),
      });
    }

    if (action === 'update_thresholds') {
      const updates = {
        ai_instructions: `Workflow thresholds: min_value=${thresholds.min_value}, max_signup_time=${thresholds.max_signup_time}min, difficulty=${thresholds.required_difficulty}`,
        ...thresholds,
      };

      const existingPrefs = await base44.entities.UserDataStore.filter({ user_email: user.email });
      if (existingPrefs[0]) {
        await base44.entities.UserDataStore.update(existingPrefs[0].id, {
          execution_rules: {
            ...existingPrefs[0].execution_rules,
            ...thresholds,
          },
        });
      }

      return Response.json({ success: true, message: 'Thresholds updated' });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Workflow error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});