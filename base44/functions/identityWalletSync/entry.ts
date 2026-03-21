/**
 * Identity Wallet Sync Engine
 * Aggregates all AI agents, crypto wallets, and credentials
 * Maintains bidirectional sync with all services
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { action, wallet_id } = await req.json();

    // ACTION: Sync all credentials to unified wallet
    if (action === 'sync_wallet') {
      const identityWallet = await base44.entities.IdentityWallet.filter(
        { created_by: user.email, is_primary: true },
        '-created_date',
        1
      );

      let wallet = identityWallet.length > 0 ? identityWallet[0] : null;

      // Get primary AI identity
      const identities = await base44.entities.AIIdentity.filter(
        { created_by: user.email, is_active: true },
        '-last_used_at',
        1
      );
      const primaryIdentity = identities.length > 0 ? identities[0] : null;

      if (!primaryIdentity) {
        return Response.json({ error: 'No primary identity found' }, { status: 400 });
      }

      // Fetch all AI agents
      const agents = await base44.entities.AIIdentity.filter(
        { created_by: user.email },
        '-last_used_at',
        100
      );

      const aiAgentsData = agents.map(agent => ({
        agent_id: agent.id,
        agent_name: agent.name,
        role_label: agent.role_label,
        status: agent.is_active ? 'active' : 'inactive',
        last_active: agent.last_used_at,
        tasks_executed: agent.tasks_executed || 0,
        total_earned: agent.total_earned || 0,
        connected_accounts: agent.linked_account_ids ? agent.linked_account_ids.map(id => ({
          account_id: id,
          verified: true
        })) : []
      }));

      // Fetch all crypto wallets
      const wallets = await base44.entities.CryptoWallet.filter(
        { created_by: user.email },
        '-is_primary',
        50
      );

      const cryptoWalletsData = wallets.map(w => ({
        wallet_id: w.id,
        wallet_name: w.wallet_name,
        wallet_type: w.wallet_type,
        address: w.address,
        balance_usd: w.balance?.total_balance_usd || 0,
        status: w.status,
        last_updated: w.balance?.last_updated || new Date().toISOString(),
        is_primary: w.is_primary
      }));

      // Aggregate permission scopes
      const permissionScopes = {
        can_execute_trades: primaryIdentity.kyc_verified_data?.autopilot_clearance?.can_submit_financial_onboarding || false,
        can_access_wallets: primaryIdentity.kyc_verified_data?.autopilot_clearance?.can_attach_id_documents || false,
        can_submit_forms: primaryIdentity.kyc_verified_data?.autopilot_clearance?.can_submit_w9 || false,
        can_claim_airdrops: true,
        can_stake_tokens: primaryIdentity.kyc_verified_data?.autopilot_clearance?.can_submit_1099_forms || false,
        can_deploy_mining: true,
        can_generate_pages: true,
        can_send_emails: true,
        can_manage_identities: agents.length > 1
      };

      // Build auth tokens aggregate
      const authTokens = [];
      agents.forEach(agent => {
        if (agent.bank_vault_credential_id) {
          authTokens.push({
            service: 'vault_credentials',
            token_type: 'credential_store',
            is_valid: true,
            scopes: ['manage_credentials']
          });
        }
      });

      // Calculate credential status
      const totalCredentials = agents.length + wallets.length;
      const verifiedCount = agents.filter(a => a.is_active).length + wallets.filter(w => w.status === 'active').length;

      const credentialStatus = {
        all_verified: verifiedCount === totalCredentials,
        total_credentials: totalCredentials,
        verified_count: verifiedCount,
        expired_tokens: authTokens.filter(t => t.expires_at && new Date(t.expires_at) < new Date()).length,
        pending_verification: totalCredentials - verifiedCount,
        last_sync: new Date().toISOString()
      };

      // Create or update wallet
      if (wallet) {
        await base44.entities.IdentityWallet.update(wallet.id, {
          wallet_name: `${primaryIdentity.name} Wallet`,
          identity_id: primaryIdentity.id,
          identity_name: primaryIdentity.name,
          ai_agents: aiAgentsData,
          crypto_wallets: cryptoWalletsData,
          permission_scopes: permissionScopes,
          auth_tokens: authTokens,
          credential_status: credentialStatus,
          sync_config: {
            auto_sync_enabled: true,
            sync_interval_seconds: 60,
            bidirectional_sync: true
          }
        });
      } else {
        wallet = await base44.entities.IdentityWallet.create({
          wallet_name: `${primaryIdentity.name} Wallet`,
          is_primary: true,
          identity_id: primaryIdentity.id,
          identity_name: primaryIdentity.name,
          ai_agents: aiAgentsData,
          crypto_wallets: cryptoWalletsData,
          permission_scopes: permissionScopes,
          auth_tokens: authTokens,
          credential_status: credentialStatus,
          sync_config: {
            auto_sync_enabled: true,
            sync_interval_seconds: 60,
            bidirectional_sync: true
          },
          department_access: [
            { department: 'DigitalCommerce', access_level: 'operator', enabled: true },
            { department: 'CryptoAutomation', access_level: 'operator', enabled: true },
            { department: 'Finance', access_level: 'viewer', enabled: true },
            { department: 'Discovery', access_level: 'viewer', enabled: true },
            { department: 'Control', access_level: 'admin', enabled: true }
          ]
        });
      }

      return Response.json({
        status: 'success',
        wallet_id: wallet.id,
        agents_synced: aiAgentsData.length,
        wallets_synced: cryptoWalletsData.length,
        credentials_verified: verifiedCount,
        timestamp: new Date().toISOString()
      });
    }

    // ACTION: Update credential status in all services
    if (action === 'update_credential_status') {
      const wallet = await base44.entities.IdentityWallet.read(wallet_id);

      if (!wallet) {
        return Response.json({ error: 'Wallet not found' }, { status: 404 });
      }

      const updates = [];

      // Update AI agents in their respective services
      for (const agent of wallet.ai_agents) {
        try {
          await base44.entities.AIIdentity.update(agent.agent_id, {
            is_active: agent.status === 'active',
            last_used_at: new Date().toISOString()
          });
          updates.push({ type: 'agent', id: agent.agent_id, status: 'updated' });
        } catch (err) {
          updates.push({ type: 'agent', id: agent.agent_id, status: 'failed', error: err.message });
        }
      }

      // Update crypto wallets in their services
      for (const walletData of wallet.crypto_wallets) {
        try {
          await base44.entities.CryptoWallet.update(walletData.wallet_id, {
            balance: {
              total_balance_usd: walletData.balance_usd,
              last_updated: new Date().toISOString()
            }
          });
          updates.push({ type: 'wallet', id: walletData.wallet_id, status: 'updated' });
        } catch (err) {
          updates.push({ type: 'wallet', id: walletData.wallet_id, status: 'failed', error: err.message });
        }
      }

      // Log sync event
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Identity wallet credential sync completed`,
        metadata: {
          wallet_id,
          updates: updates.length,
          timestamp: new Date().toISOString()
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        updates_applied: updates.length,
        details: updates
      });
    }

    // ACTION: Verify all credentials
    if (action === 'verify_credentials') {
      const wallet = await base44.entities.IdentityWallet.read(wallet_id);

      if (!wallet) {
        return Response.json({ error: 'Wallet not found' }, { status: 404 });
      }

      const verificationResults = [];

      // Verify each AI agent
      for (const agent of wallet.ai_agents) {
        try {
          const agentRecord = await base44.entities.AIIdentity.read(agent.agent_id);
          verificationResults.push({
            type: 'agent',
            id: agent.agent_id,
            name: agent.agent_name,
            verified: agentRecord.is_active,
            status: agentRecord.is_active ? 'verified' : 'inactive'
          });
        } catch (err) {
          verificationResults.push({
            type: 'agent',
            id: agent.agent_id,
            name: agent.agent_name,
            verified: false,
            error: err.message
          });
        }
      }

      // Verify each wallet
      for (const walletData of wallet.crypto_wallets) {
        try {
          const walletRecord = await base44.entities.CryptoWallet.read(walletData.wallet_id);
          verificationResults.push({
            type: 'wallet',
            id: walletData.wallet_id,
            name: walletData.wallet_name,
            verified: walletRecord.status === 'active',
            balance: walletRecord.balance?.total_balance_usd || 0,
            status: walletRecord.status
          });
        } catch (err) {
          verificationResults.push({
            type: 'wallet',
            id: walletData.wallet_id,
            name: walletData.wallet_name,
            verified: false,
            error: err.message
          });
        }
      }

      const allVerified = verificationResults.every(r => r.verified);

      return Response.json({
        status: 'success',
        all_credentials_verified: allVerified,
        verified_count: verificationResults.filter(r => r.verified).length,
        total_count: verificationResults.length,
        results: verificationResults
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Identity wallet sync error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});