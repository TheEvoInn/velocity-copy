/**
 * AUTOPILOT ACCOUNT PREPARATION
 * Ensures all required accounts exist before task execution
 * Automatically creates missing accounts via autonomous engine
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Check if user has an account on the target platform
 */
async function userHasAccountOnPlatform(base44, userEmail, platform) {
  try {
    const accounts = await base44.asServiceRole.entities.LinkedAccount.filter(
      { created_by: userEmail, platform },
      null,
      1
    ).catch(() => []);

    return accounts.length > 0 ? { has_account: true, account: accounts[0] } : { has_account: false };
  } catch (e) {
    return { has_account: false, error: e.message };
  }
}

/**
 * Prepare accounts before task execution
 * Creates missing accounts if platform supports auto-creation
 */
async function prepareAccountsForTask(base44, userEmail, identityId, opportunity) {
  const result = {
    timestamp: new Date().toISOString(),
    platform: opportunity.platform,
    account_prepared: false,
    steps: []
  };

  try {
    // Step 1: Check if account exists
    result.steps.push(`Checking for existing ${opportunity.platform} account...`);
    const accountCheck = await userHasAccountOnPlatform(base44, userEmail, opportunity.platform);
    
    if (accountCheck.has_account) {
      result.steps.push('✓ Account already exists');
      result.account_prepared = true;
      result.account_id = accountCheck.account.id;
      return { success: true, result };
    }

    result.steps.push('⚠️ No existing account found');

    // Step 2: Check if platform supports auto-creation
    result.steps.push('Checking if platform supports automatic account creation...');
    const supportCheck = await base44.functions.invoke('autonomousAccountCreationEngine', {
      action: 'check_auto_creation_support',
      opportunity
    }).catch(e => ({ data: { supported: false, error: e.message } }));

    if (!supportCheck.data?.supported) {
      result.steps.push(`⚠️ ${opportunity.platform} requires manual setup`);
      result.account_prepared = false;
      return { success: false, result, requires_manual_setup: true };
    }

    result.steps.push('✓ Platform supports auto-creation');

    // Step 3: Execute autonomous account creation
    result.steps.push('Initiating autonomous account creation...');
    const creationResult = await base44.functions.invoke('autonomousAccountCreationEngine', {
      action: 'auto_create_account',
      identityId,
      opportunity
    }).catch(e => ({ data: { success: false, error: e.message } }));

    if (!creationResult.data?.success) {
      result.steps.push(`❌ Account creation failed: ${creationResult.data?.error || 'Unknown error'}`);
      result.account_prepared = false;
      return { success: false, result };
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

/**
 * Prepare all required accounts for batch task execution
 */
async function prepareBatchAccounts(base44, userEmail, identityId, opportunities) {
  const results = {
    timestamp: new Date().toISOString(),
    total_opportunities: opportunities.length,
    prepared: 0,
    failed: 0,
    requires_manual: 0,
    preparations: []
  };

  for (const opp of opportunities) {
    const prepResult = await prepareAccountsForTask(base44, userEmail, identityId, opp);
    
    if (prepResult.success && prepResult.result.account_prepared) {
      results.prepared++;
    } else if (prepResult.requires_manual_setup) {
      results.requires_manual++;
    } else {
      results.failed++;
    }

    results.preparations.push({
      opportunity_id: opp.id,
      platform: opp.platform,
      prepared: prepResult.result.account_prepared,
      steps: prepResult.result.steps
    });
  }

  return { success: results.failed === 0, results };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, identityId, opportunity, opportunities } = body;

    // ─── Prepare single opportunity ────────────────────────────────
    if (action === 'prepare_account') {
      if (!identityId || !opportunity) {
        return Response.json({ error: 'Identity and opportunity required' }, { status: 400 });
      }

      const result = await prepareAccountsForTask(base44, user.email, identityId, opportunity);
      return Response.json(result);
    }

    // ─── Prepare batch of opportunities ────────────────────────────
    if (action === 'prepare_batch_accounts') {
      if (!identityId || !opportunities || !Array.isArray(opportunities)) {
        return Response.json({ error: 'Identity and opportunities array required' }, { status: 400 });
      }

      const result = await prepareBatchAccounts(base44, user.email, identityId, opportunities);
      return Response.json(result);
    }

    // ─── Check account existence ───────────────────────────────────
    if (action === 'check_account_existence') {
      if (!opportunity) {
        return Response.json({ error: 'Opportunity required' }, { status: 400 });
      }

      const check = await userHasAccountOnPlatform(base44, user.email, opportunity.platform);
      return Response.json(check);
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[AutopilotAccountPreparation] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});