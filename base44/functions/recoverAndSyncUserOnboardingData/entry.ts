/**
 * RECOVER AND SYNC USER ONBOARDING DATA
 * Recovers dispersed onboarding data for a user and synchronizes across all systems
 * Called when user reports data loss or to consolidate scattered submissions
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { user_email, action } = body;

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    if (action === 'audit_and_recover') {
      // Step 1: Find all scattered data for this user
      const [identities, kycRecords, userGoals, linkedAccounts] = await Promise.all([
        base44.entities.AIIdentity.filter({ user_email }),
        base44.entities.KYCVerification.filter({ user_email: user_email }),
        base44.entities.UserGoals.filter({ created_by: user_email }),
        base44.entities.LinkedAccount.filter({ created_by: user_email }),
      ]);

      // Step 2: Check each identity for hollow KYC
      const results = [];
      for (const identity of identities) {
        const isHollow = !identity.kyc_verified_data?.full_legal_name ||
                         identity.kyc_verified_data?.full_legal_name === '';

        // Find KYC records
        const identityKycs = kycRecords.filter(k => 
          k.user_email === user_email
        );

        // Check for hollow KYC (approved but empty)
        const hollowKyc = identityKycs.find(k => 
          k.status === 'approved' && 
          (!k.full_legal_name || k.full_legal_name === '')
        );

        results.push({
          identity_id: identity.id,
          identity_name: identity.name,
          is_onboarded: identity.onboarding_complete,
          is_active: identity.is_active,
          kyc_status: identity.kyc_verified_data?.kyc_tier || 'none',
          has_hollow_kyc: !!hollowKyc,
          hollow_kyc_id: hollowKyc?.id,
          linked_accounts: linkedAccounts.length,
          needs_recovery: isHollow && hollowKyc,
        });
      }

      return Response.json({
        success: true,
        user_email,
        audit_results: results,
        total_identities: identities.length,
        total_kyc_records: kycRecords.length,
        hollow_records: results.filter(r => r.has_hollow_kyc).length,
        message: 'Audit complete. Use populate_hollow_kyc action to fill hollow records with submitted data.',
      });
    }

    if (action === 'populate_hollow_kyc') {
      // Step 3: Populate hollow KYC from the onboarding data provided
      const { identity_id, kyc_data } = body;

      if (!identity_id || !kyc_data) {
        return Response.json({ error: 'identity_id and kyc_data required' }, { status: 400 });
      }

      // Find the hollow KYC record
      const kycRecords = await base44.entities.KYCVerification.filter({ user_email });
      const hollowKyc = kycRecords.find(k => 
        k.status === 'approved' && (!k.full_legal_name || k.full_legal_name === '')
      );

      if (!hollowKyc) {
        return Response.json({ error: 'No hollow KYC record found' }, { status: 404 });
      }

      // Populate with real data
      const populated = {
        full_legal_name: kyc_data.full_legal_name || kyc_data.first_name + ' ' + kyc_data.last_name,
        date_of_birth: kyc_data.date_of_birth || '',
        residential_address: kyc_data.address || '',
        city: kyc_data.city || '',
        state: kyc_data.state || '',
        postal_code: kyc_data.postal_code || '',
        country: kyc_data.country || '',
        phone_number: kyc_data.phone || '',
        government_id_type: kyc_data.government_id_type || '',
        government_id_number: kyc_data.government_id_number || '',
        government_id_expiry: kyc_data.id_expiry || '',
        tax_id: kyc_data.tax_id || '',
      };

      await base44.entities.KYCVerification.update(hollowKyc.id, populated);

      // Step 4: Sync to AIIdentity
      const identity = await base44.entities.AIIdentity.get(identity_id);
      if (identity) {
        await base44.entities.AIIdentity.update(identity_id, {
          kyc_verified_data: {
            ...identity.kyc_verified_data,
            ...populated,
            synced_at: new Date().toISOString(),
            kyc_tier: 'standard',
            full_legal_name: populated.full_legal_name,
          },
        });
      }

      // Step 5: Update UserGoals if banking data provided
      if (kyc_data.bank_name || kyc_data.account_holder_name) {
        const goals = await base44.entities.UserGoals.filter({ created_by: user_email }, '-created_date', 1);
        if (goals[0]) {
          await base44.entities.UserGoals.update(goals[0].id, {
            wallet_balance: goals[0].wallet_balance || 0,
            available_capital: kyc_data.available_capital || 0,
          });
        }
      }

      // Step 6: Trigger full platform sync
      try {
        await base44.asServiceRole.functions.invoke('identityOnboardingCompleteSync', {
          identity_id,
        });
      } catch (e) {
        console.warn('Sync invocation failed:', e.message);
      }

      return Response.json({
        success: true,
        message: 'Hollow KYC populated and synced across all modules',
        kyc_id: hollowKyc.id,
        populated_fields: Object.keys(populated).filter(k => populated[k]),
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Recovery function error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});