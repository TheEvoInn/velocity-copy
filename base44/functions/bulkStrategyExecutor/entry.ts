import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * BULK STRATEGY EXECUTOR v1.0
 * Autonomously executes a strategy by:
 * 1. Creating N identities
 * 2. Generating in-platform emails for each
 * 3. Queuing sign-up workflows across platforms
 * 4. Syncing across all hubs (Identity, Autopilot, Credentials, Execution)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const action = body.action || 'execute_strategy';

    switch (action) {
      // Execute a bulk strategy: create identities → emails → workflows
      case 'execute_strategy': {
        const { strategy_name, description, platforms, num_identities, category } = body;
        
        if (!strategy_name || !Array.isArray(platforms) || platforms.length === 0 || !num_identities || num_identities < 1) {
          return Response.json({ 
            error: 'Required: strategy_name, platforms (array), num_identities (≥1)', 
            status: 400 
          });
        }

        const results = {
          strategy_id: null,
          identities_created: 0,
          emails_generated: 0,
          workflows_queued: 0,
          total_workflows: 0,
          errors: [],
          execution_id: `exec_${Date.now()}`,
          status: 'executing'
        };

        // Step 1: Create Strategy record
        try {
          const strategyRecord = await base44.asServiceRole.entities.Strategy.create({
            title: strategy_name,
            description: description || `Bulk setup: ${num_identities} identities × ${platforms.length} platforms`,
            variant: 'fastest',
            starting_capital: 0,
            target_daily_profit: 100,
            time_to_first_dollar: 'immediate',
            status: 'active',
            categories: [category || 'account_creation'],
            steps: platforms.map((p, i) => ({
              day: `Platform ${i + 1}`,
              action: `Sign up on ${p}`,
              expected_outcome: `${num_identities} accounts created`,
              completed: false
            }))
          });
          results.strategy_id = strategyRecord.id;
        } catch (e) {
          results.errors.push(`Strategy creation failed: ${e.message}`);
        }

        // Step 2: Create identities in bulk
        const identities = [];
        for (let i = 1; i <= num_identities; i++) {
          try {
            const identity = await base44.asServiceRole.entities.AIIdentity.create({
              name: `${strategy_name} Agent ${i}`,
              role_label: 'Account Creator',
              email: user.email,
              is_active: true,
              skills: ['general', 'account_creation', 'form_filling', 'email_verification'],
              bio: `Autonomous identity for ${strategy_name} bulk setup`,
              communication_tone: 'professional',
              in_platform_emails: [],
              linked_accounts: []
            });
            identities.push(identity);
            results.identities_created++;
          } catch (e) {
            results.errors.push(`Identity ${i} creation failed: ${e.message}`);
          }
        }

        // Step 3: Generate in-platform emails for each identity
        const emailsByIdentity = {};
        for (const identity of identities) {
          emailsByIdentity[identity.id] = [];
          
          for (const platform of platforms) {
            try {
              const emailRes = await base44.asServiceRole.functions.invoke('inPlatformEmailGenerator', {
                action: 'create_email',
                identity_id: identity.id,
                identity_name: identity.name,
                platform,
                purpose: `strategy_${strategy_name}`
              });

              if (emailRes.data?.success) {
                emailsByIdentity[identity.id].push({
                  platform,
                  email_address: emailRes.data.email_address
                });
                results.emails_generated++;
              }
            } catch (e) {
              results.errors.push(`Email generation failed for ${identity.name} on ${platform}: ${e.message}`);
            }
          }
        }

        // Step 4: Queue sign-up workflows for each identity × platform combination
        for (const identity of identities) {
          const emails = emailsByIdentity[identity.id] || [];
          
          for (const emailData of emails) {
            try {
              // Initiate account creation workflow
              const workflowRes = await base44.asServiceRole.functions.invoke('accountCreationEmailWorkflow', {
                action: 'start_account_creation',
                identity_id: identity.id,
                identity_name: identity.name,
                platform: emailData.platform,
                opportunity_id: `${strategy_name}_${identity.id}_${emailData.platform}`
              });

              if (workflowRes.data?.success) {
                results.workflows_queued++;
              }
            } catch (e) {
              results.errors.push(`Workflow queue failed for ${identity.name} on ${emailData.platform}: ${e.message}`);
            }
          }
          
          results.total_workflows = identities.length * platforms.length;
        }

        // Step 5: Sync across all hubs
        try {
          await base44.asServiceRole.functions.invoke('emailSystemSyncOrchestrator', {
            action: 'sync_email_event',
            email_address: `strategy_${strategy_name}`,
            identity_id: `strategy_${strategy_name}`,
            event_type: 'strategy_bulk_setup',
            metadata: {
              identities_created: results.identities_created,
              emails_generated: results.emails_generated,
              workflows_queued: results.workflows_queued,
              platforms: platforms
            }
          });
        } catch (e) {
          results.errors.push(`Sync orchestration failed: ${e.message}`);
        }

        // Step 6: Log strategy execution
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🚀 Strategy executed: "${strategy_name}" — ${results.identities_created} identities, ${results.emails_generated} emails, ${results.workflows_queued} workflows queued`,
          severity: 'success',
          metadata: results
        }).catch(() => null);

        results.status = results.errors.length > 0 ? 'completed_with_errors' : 'completed_success';

        return Response.json({ success: true, ...results });
      }

      // Get execution status
      case 'get_status': {
        const { execution_id } = body;
        
        if (!execution_id) {
          return Response.json({ error: 'execution_id required', status: 400 });
        }

        const logs = await base44.asServiceRole.entities.ActivityLog.filter(
          { message: { $regex: execution_id } },
          '-created_date',
          1
        ).catch(() => []);

        const log = Array.isArray(logs) ? logs[0] : null;
        
        if (!log) {
          return Response.json({ error: 'Execution not found', status: 404 });
        }

        return Response.json({
          success: true,
          execution_id,
          status: log.metadata?.status || 'unknown',
          identities_created: log.metadata?.identities_created || 0,
          emails_generated: log.metadata?.emails_generated || 0,
          workflows_queued: log.metadata?.workflows_queued || 0,
          total_workflows: log.metadata?.total_workflows || 0,
          errors: log.metadata?.errors || []
        });
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }
  } catch (error) {
    console.error('[BulkStrategyExecutor]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});