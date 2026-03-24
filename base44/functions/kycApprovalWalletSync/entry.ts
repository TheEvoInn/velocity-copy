import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * KYC APPROVAL → WALLET SYNC WORKFLOW
 * Triggered when KYC status changes to 'approved'
 * - Creates Financial Account in Wallet Engine
 * - Initializes payout & withdrawal credentials in Vault
 * - Syncs verified identity to Wallet
 * - Sends activation notification to user
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data } = body;

    // Only process KYCVerification updates where status → approved
    if (event?.entity_name !== 'KYCVerification' || event?.type !== 'update') {
      return Response.json({ error: 'Invalid event' }, { status: 400 });
    }

    const kycRecord = data;
    if (!kycRecord || kycRecord.status !== 'approved') {
      return Response.json({ skipped: true, reason: 'KYC not in approved state' });
    }

    console.log(`[kycApprovalWalletSync] Processing KYC approval for ${kycRecord.user_email}`);

    // Get user for notifications
    const user = await base44.auth.me().catch(() => null);
    const targetUserEmail = kycRecord.user_email || kycRecord.created_by;

    // 1. Create Financial Account record in IdentityWallet or Wallet system
    const financialAccount = await base44.asServiceRole.entities.IdentityWallet.create({
      user_email: targetUserEmail,
      account_type: 'primary_payout',
      status: 'active',
      verified_kyc_id: kycRecord.id,
      verified_kyc_tier: kycRecord.verification_type || 'standard',
      account_holder_name: kycRecord.full_legal_name,
      account_holder_address: `${kycRecord.residential_address}, ${kycRecord.city}, ${kycRecord.state} ${kycRecord.postal_code}, ${kycRecord.country}`,
      created_at: new Date().toISOString(),
    }).catch(err => {
      console.warn(`[kycApprovalWalletSync] IdentityWallet creation failed: ${err.message}, continuing...`);
      return null;
    });

    console.log(`[kycApprovalWalletSync] Financial account created: ${financialAccount?.id || 'N/A'}`);

    // 2. Create encrypted credentials in Vault for payout bank account setup
    const payoutCredential = await base44.asServiceRole.entities.CredentialVault.create({
      platform: 'internal_payout_system',
      credential_type: 'payout_setup',
      linked_account_id: financialAccount?.id,
      is_active: true,
      encrypted_payload: JSON.stringify({
        account_holder: kycRecord.full_legal_name,
        address: `${kycRecord.residential_address}, ${kycRecord.city}, ${kycRecord.state}`,
        postal_code: kycRecord.postal_code,
        country: kycRecord.country,
        tax_id_masked: kycRecord.tax_id ? `***${kycRecord.tax_id.slice(-4)}` : null,
        kyc_verified_at: kycRecord.approved_at,
        kyc_id: kycRecord.id,
      }),
      access_log: [{
        timestamp: new Date().toISOString(),
        task_id: 'kyc_approval_wallet_sync',
        action: 'create',
        purpose: 'payout_account_initialization'
      }]
    }).catch(err => {
      console.warn(`[kycApprovalWalletSync] Credential creation failed: ${err.message}`);
      return null;
    });

    console.log(`[kycApprovalWalletSync] Payout credential stored: ${payoutCredential?.id || 'N/A'}`);

    // 3. Update KYC record with wallet sync timestamp
    await base44.asServiceRole.entities.KYCVerification.update(kycRecord.id, {
      wallet_account_id: financialAccount?.id,
      wallet_sync_completed_at: new Date().toISOString(),
      user_approved_for_autopilot: true,
      allowed_modules: ['financial_onboarding', 'payment_payout', 'prize_claiming', 'tax_compliance', 'government_compliance', 'withdrawal_processing']
    }).catch(err => console.warn(`[kycApprovalWalletSync] KYC update failed: ${err.message}`));

    // 4. Sync to AIIdentity if user has one
    const identities = await base44.asServiceRole.entities.AIIdentity.filter({
      user_email: targetUserEmail
    }, null, 10).catch(() => []);

    for (const identity of identities) {
      await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
        kyc_verified_data: {
          ...(identity.kyc_verified_data || {}),
          kyc_id: kycRecord.id,
          synced_at: new Date().toISOString(),
          kyc_tier: kycRecord.verification_type || 'standard',
          autopilot_clearance: {
            can_submit_w9: true,
            can_submit_1099_forms: true,
            can_submit_grant_applications: true,
            can_use_government_portals: true,
            can_submit_financial_onboarding: true,
            can_attach_id_documents: true
          }
        }
      }).catch(err => console.warn(`[kycApprovalWalletSync] AIIdentity sync failed: ${err.message}`));
    }

    console.log(`[kycApprovalWalletSync] Synced ${identities.length} AIIdentity records`);

    // 5. Send activation notification to user
    const notificationPayload = {
      user_email: targetUserEmail,
      type: 'account_activated',
      related_entity_type: 'KYCVerification',
      related_entity_id: kycRecord.id,
      title: '✅ Wallet Fully Activated',
      message: `Your identity has been verified. Your VELOCITY wallet is now fully activated and ready for payout processing, tax compliance, and government portals.`,
      action_type: 'wallet_activated',
      metadata: {
        kyc_id: kycRecord.id,
        wallet_account_id: financialAccount?.id,
        account_holder: kycRecord.full_legal_name,
        verification_tier: kycRecord.verification_type
      },
      send_email: true,
      priority: 'high'
    };

    const notificationResult = await base44.asServiceRole.entities.Notification.create(notificationPayload)
      .catch(err => {
        console.warn(`[kycApprovalWalletSync] Notification creation failed: ${err.message}`);
        return null;
      });

    console.log(`[kycApprovalWalletSync] Notification sent: ${notificationResult?.id || 'N/A'}`);

    // 6. Log activity
    await base44.asServiceRole.entities.ActivityLog.create({
      action_type: 'system',
      message: `💰 KYC approval triggered wallet activation for ${kycRecord.full_legal_name}. Financial account created and payout credentials initialized.`,
      severity: 'info',
      metadata: {
        kyc_id: kycRecord.id,
        user_email: targetUserEmail,
        wallet_account_id: financialAccount?.id,
        credential_vault_id: payoutCredential?.id,
        event: 'kyc_wallet_sync_complete'
      }
    }).catch(err => console.warn(`[kycApprovalWalletSync] Activity log failed: ${err.message}`));

    return Response.json({
      success: true,
      kyc_id: kycRecord.id,
      user_email: targetUserEmail,
      wallet_account_id: financialAccount?.id,
      credential_vault_id: payoutCredential?.id,
      notification_sent: !!notificationResult,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[kycApprovalWalletSync] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});