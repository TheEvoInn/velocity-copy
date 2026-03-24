/**
 * AUTOPILOT ACCOUNT PREPARATION
 * Ensures all required accounts exist before task execution.
 * Automatically creates missing accounts via autonomous engine.
 * On failure: triggers UserIntervention as backup path.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

async function userHasAccountOnPlatform(base44, userEmail, platform) {
  try {
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { created_by: userEmail, platform }, null, 1
    ).catch(() => []);
    return accounts.length > 0 ? { has_account: true, account: accounts[0] } : { has_account: false };
  } catch (e) {
    return { has_account: false, error: e.message };
  }
}

async function prepareAccountsForTask(base44, userEmail, identityId, opportunity) {
  const result = {
    timestamp: new Date().toISOString(),
    platform: opportunity.platform,
    account_prepared: false,
    steps: []
  };

  try {
    // Step 1: Check existing account
    result.steps.push(`Checking for existing ${opportunity.platform} account...`);
    const accountCheck = await userHasAccountOnPlatform(base44, userEmail, opportunity.platform);

    if (accountCheck.has_account) {
      result.steps.push('✓ Account already exists');
      result.account_prepared = true;
      result.account_id = accountCheck.account.id;
      return { success: true, result };
    }

    result.steps.push('⚠️ No existing account found');

    // Step 2: Check platform support
    result.steps.push('Checking if platform supports automatic account creation...');
    const supportCheck = await base44.functions.invoke('autonomousAccountCreationEngine', {
      action: 'check_auto_creation_support',
      opportunity
    }).catch(e => ({ data: { supported: false, error: e.message } }));

    if (!supportCheck.data?.supported) {
      result.steps.push(`⚠️ ${opportunity.platform} requires manual setup`);

      // Trigger intervention
      await base44.asServiceRole.entities.UserIntervention.create({
        task_id: opportunity.task_id || opportunity.id || 'unknown',
        requirement_type: 'missing_data',
        required_data: `Autopilot needs a ${opportunity.platform} account to execute this opportunity. Please create one manually or provide your existing credentials.`,
        data_schema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Your existing username' },
            email: { type: 'string', description: 'Account email' },
            password: { type: 'string', description: 'Account password' }
          }
        },
        direct_link: opportunity.url || `https://${opportunity.platform}.com/signup`,
        priority: 80,
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: userEmail
      }).catch(() => null);

      result.account_prepared = false;
      return { success: false, result, requires_manual_setup: true, intervention_triggered: true };
    }

    result.steps.push('✓ Platform supports auto-creation');

    // Step 3: Auto-create
    result.steps.push('Initiating autonomous account creation...');
    const creationResult = await base44.functions.invoke('autonomousAccountCreationEngine', {
      action: 'auto_create_account',
      identityId,
      opportunity
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!creationResult.data?.success) {
      const errMsg = creationResult.data?.error || 'Unknown error';
      result.steps.push(`❌ Account creation failed: ${errMsg}`);
      result.account_prepared = false;

      // Trigger intervention as fallback
      await base44.asServiceRole.entities.UserIntervention.create({
        task_id: opportunity.task_id || opportunity.id || 'unknown',
        requirement_type: 'missing_data',
        required_data: `Autopilot could not automatically create a ${opportunity.platform} account. Reason: ${errMsg}. Please manually create the account or provide your credentials.`,
        data_schema: {
          type: 'object',
          properties: {
            username: { type: 'string', description: 'Your existing username' },
            email: { type: 'string', description: 'Account email' },
            password: { type: 'string', description: 'Account password' }
          }
        },
        direct_link: opportunity.url || `https://${opportunity.platform}.com/signup`,
        priority: 80,
        status: 'pending',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        created_by: userEmail
      }).catch(() => null);

      return { success: false, result, intervention_triggered: true };
    }

    result.steps.push('✓ Account created autonomously');
    result.account_prepared = true;
    result.account_id = creationResult.data?.account_id;
    result.account = creationResult.data?.account;
    return { success: true, result };

  } catch (e) {
    result.steps.push(`❌ Fatal error: ${e.message}`);
    return { success: false, result, error: e.message };
  }
}

async function prepareBatchAccounts(base44, userEmail, identityId, opportunities) {
  const results = {
    timestamp: new Date().toISOString(),
    total_opportunities: opportunities.length,
    prepared: 0,
    failed: 0,
    requires_manual: 0,
    preparations: []
  };

  // Run all preparations in PARALLEL for speed
  const prepResults = await Promise.all(
    opportunities.map(opp => prepareAccountsForTask(base44, userEmail, identityId, opp))
  );

  for (const prepResult of prepResults) {

    if (prepResult.success && prepResult.result.account_prepared) {
      results.prepared++;
    } else if (prepResult.requires_manual_setup) {
      results.requires_manual++;
    } else {
      results.failed++;
    }

    results.preparations.push({
      opportunity_id: prepResult.result?.opportunity_id,
      platform: prepResult.result?.platform,
      prepared: prepResult.result?.account_prepared,
      intervention_triggered: prepResult.intervention_triggered || false,
      steps: prepResult.result?.steps
    });
  }

  return { success: results.failed === 0, results };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, identityId, opportunity, opportunities } = body;

    if (action === 'prepare_account') {
      if (!identityId || !opportunity) {
        return Response.json({ error: 'Identity and opportunity required' }, { status: 400 });
      }
      const result = await prepareAccountsForTask(base44, user.email, identityId, opportunity);
      return Response.json(result);
    }

    if (action === 'prepare_batch_accounts') {
      if (!identityId || !Array.isArray(opportunities)) {
        return Response.json({ error: 'Identity and opportunities array required' }, { status: 400 });
      }
      const result = await prepareBatchAccounts(base44, user.email, identityId, opportunities);
      return Response.json(result);
    }

    if (action === 'check_account_existence') {
      if (!opportunity) return Response.json({ error: 'Opportunity required' }, { status: 400 });
      const check = await userHasAccountOnPlatform(base44, user.email, opportunity.platform);
      return Response.json(check);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[AutopilotAccountPreparation] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});