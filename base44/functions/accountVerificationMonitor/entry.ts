/**
 * ACCOUNT VERIFICATION MONITOR
 * Polls InPlatformEmail inboxes for accounts stuck in 'activating' status.
 * Extracts verification codes/links, auto-completes platform email verification,
 * and triggers User Intervention only if automated resolution fails.
 * 
 * Called by: scheduled automation (every 10 min) + post-account-creation hook
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, account_id } = body;

    // ── scan_pending_verifications ────────────────────────────────────────────
    // Finds all accounts in 'activating' state and checks their email inboxes
    if (action === 'scan_pending_verifications' || !action) {
      const activatingAccounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter(
        { account_status: 'activating' }
      ).catch(() => []);

      if (!activatingAccounts.length) {
        return Response.json({ success: true, message: 'No pending verifications', checked: 0 });
      }

      const results = await Promise.all(
        activatingAccounts.map(account => checkAndVerifyAccount(base44, account))
      );

      const verified = results.filter(r => r.verified).length;
      const needsIntervention = results.filter(r => r.needs_intervention).length;
      const stillPending = results.filter(r => !r.verified && !r.needs_intervention).length;

      return Response.json({
        success: true,
        total_checked: activatingAccounts.length,
        verified,
        needs_intervention: needsIntervention,
        still_pending: stillPending,
        results
      });
    }

    // ── verify_single_account ────────────────────────────────────────────────
    if (action === 'verify_single_account') {
      if (!account_id) return Response.json({ error: 'account_id required' }, { status: 400 });

      const accounts = await base44.asServiceRole.entities.LinkedAccountCreation.filter(
        { id: account_id }
      ).catch(() => []);

      if (!accounts.length) return Response.json({ error: 'Account not found' }, { status: 404 });

      const result = await checkAndVerifyAccount(base44, accounts[0]);
      return Response.json(result);
    }

    // ── get_verification_status ───────────────────────────────────────────────
    if (action === 'get_verification_status') {
      const [activating, active, failed] = await Promise.all([
        base44.asServiceRole.entities.LinkedAccountCreation.filter({ account_status: 'activating' }).catch(() => []),
        base44.asServiceRole.entities.LinkedAccountCreation.filter({ account_status: 'active' }).catch(() => []),
        base44.asServiceRole.entities.LinkedAccountCreation.filter({ account_status: 'failed' }).catch(() => [])
      ]);

      // Stale = activating for more than 2 hours
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const stale = activating.filter(a => a.creation_timestamp < twoHoursAgo);

      return Response.json({
        success: true,
        summary: {
          activating: activating.length,
          active: active.length,
          failed: failed.length,
          stale_unverified: stale.length
        },
        stale_accounts: stale.map(a => ({
          id: a.id,
          platform: a.platform,
          identity_id: a.identity_id,
          email: a.email,
          created: a.creation_timestamp
        }))
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    console.error('[AccountVerificationMonitor]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Core verification logic for a single account
 */
async function checkAndVerifyAccount(base44, account) {
  const result = {
    account_id: account.id,
    platform: account.platform,
    email: account.email,
    verified: false,
    needs_intervention: false,
    steps: []
  };

  try {
    // Step 1: Find InPlatformEmail inbox for this account's email
    result.steps.push(`Searching inbox for ${account.email}...`);
    const emailRecords = await base44.asServiceRole.entities.InPlatformEmail.filter(
      { email_address: account.email }
    ).catch(() => []);

    if (!emailRecords.length) {
      // Also try matching by linked_account_id
      const byAccountId = await base44.asServiceRole.entities.InPlatformEmail.filter(
        { linked_account_id: account.id }
      ).catch(() => []);

      if (!byAccountId.length) {
        result.steps.push('⚠️ No InPlatformEmail inbox found for this account');
        
        // Check how old the account is — if > 2 hours, trigger intervention
        const ageHours = (Date.now() - new Date(account.creation_timestamp || account.created_date).getTime()) / 3600000;
        if (ageHours > 2) {
          await triggerVerificationIntervention(base44, account, 'No email inbox found after 2+ hours');
          result.needs_intervention = true;
        }
        return result;
      }
      emailRecords.push(...byAccountId);
    }

    const inbox = emailRecords[0];
    result.steps.push(`✓ Found inbox: ${inbox.email_address}`);

    // Step 2: Check for verification messages
    const messages = inbox.messages || [];
    const verificationMsg = messages.find(m =>
      !m.processed && (
        m.verification_code ||
        m.confirmation_link ||
        (m.subject || '').toLowerCase().includes('verify') ||
        (m.subject || '').toLowerCase().includes('confirm') ||
        (m.subject || '').toLowerCase().includes('activation')
      )
    );

    if (!verificationMsg) {
      result.steps.push('⏳ No verification email received yet');

      // Check if account is stale (> 2 hours with no email)
      const ageHours = (Date.now() - new Date(account.creation_timestamp || account.created_date).getTime()) / 3600000;
      if (ageHours > 2) {
        result.steps.push(`⚠️ Account ${ageHours.toFixed(1)} hours old with no verification email`);
        await triggerVerificationIntervention(base44, account, `No verification email received after ${ageHours.toFixed(1)} hours`);
        result.needs_intervention = true;
      }
      return result;
    }

    result.steps.push(`✓ Verification message found: "${verificationMsg.subject}"`);

    // Step 3: Extract code or link
    const code = verificationMsg.verification_code;
    const link = verificationMsg.confirmation_link;

    if (code) {
      result.steps.push(`✓ Extracted verification code: ${code}`);
      result.verification_code = code;
    } else if (link) {
      result.steps.push(`✓ Extracted confirmation link`);
      result.confirmation_link = link;
    }

    // Step 4: Attempt automated verification via browser automation
    if (code || link) {
      result.steps.push('Attempting automated verification...');
      const autoVerifyResult = await base44.functions.invoke('browserAutomationReal', {
        action: 'complete_email_verification',
        platform: account.platform,
        verification_code: code || null,
        confirmation_link: link || null,
        account_email: account.email
      }).catch(e => ({ data: { success: false, error: e.message } }));

      if (autoVerifyResult.data?.success) {
        result.steps.push('✓ Email verification completed automatically');
        result.verified = true;

        // Mark account as active
        await base44.asServiceRole.entities.LinkedAccountCreation.update(account.id, {
          account_status: 'active',
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
          verification_method: code ? 'code' : 'link'
        }).catch(() => null);

        // Mark email as processed
        const updatedMessages = messages.map(m =>
          m === verificationMsg ? { ...m, processed: true, is_read: true } : m
        );
        await base44.asServiceRole.entities.InPlatformEmail.update(inbox.id, {
          messages: updatedMessages,
          verification_status: 'verified'
        }).catch(() => null);

        // Sync to identity linked accounts
        if (account.identity_id) {
          const identities = await base44.asServiceRole.entities.AIIdentity.filter(
            { id: account.identity_id }, null, 1
          ).catch(() => []);
          if (identities.length) {
            const identity = identities[0];
            const linkedIds = identity.linked_account_ids || [];
            if (!linkedIds.includes(account.id)) {
              await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
                linked_account_ids: [...linkedIds, account.id]
              }).catch(() => null);
            }
          }
        }

        // Log success
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `✅ Account verified automatically: ${account.platform} (${account.email})`,
          severity: 'success',
          metadata: { account_id: account.id, platform: account.platform, method: code ? 'code' : 'link' }
        }).catch(() => null);

      } else {
        result.steps.push(`⚠️ Auto-verification failed: ${autoVerifyResult.data?.error}`);
        result.steps.push('Triggering user intervention for manual verification...');
        await triggerVerificationIntervention(base44, account,
          `Verification ${code ? 'code' : 'link'} found but auto-submission failed. Please verify manually.`,
          { code, link }
        );
        result.needs_intervention = true;
      }
    }

    return result;

  } catch (e) {
    result.steps.push(`❌ Error: ${e.message}`);
    result.error = e.message;
    return result;
  }
}

/**
 * Create a UserIntervention for manual verification
 */
async function triggerVerificationIntervention(base44, account, reason, verificationData = {}) {
  await base44.asServiceRole.entities.UserIntervention.create({
    task_id: account.id,
    requirement_type: 'missing_data',
    required_data: `${account.platform} account verification required: ${reason}${
      verificationData.code ? ` Verification code: ${verificationData.code}` : ''
    }${verificationData.link ? ` Confirmation link available.` : ''}`,
    data_schema: {
      type: 'object',
      properties: {
        verification_code: { type: 'string', description: 'Enter the verification code from your email' },
        verified: { type: 'boolean', description: 'Confirm you have verified the account' }
      }
    },
    direct_link: verificationData.link || `https://${account.platform}.com`,
    priority: 90,
    status: 'pending',
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    created_by: account.created_by || account.user_email
  }).catch(() => null);

  // Send notification
  await base44.asServiceRole.entities.Notification.create({
    type: 'user_action_required',
    severity: 'urgent',
    title: `Verify your ${account.platform} account`,
    message: reason,
    user_email: account.created_by || account.user_email,
    related_entity_type: 'LinkedAccountCreation',
    related_entity_id: account.id,
    action_type: 'user_input_required',
    delivery_channels: ['in_app']
  }).catch(() => null);
}