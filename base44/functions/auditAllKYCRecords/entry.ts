/**
 * AUDIT ALL KYC RECORDS
 * Search EVERY entity and status for user's KYC data — not just "verified"
 * Check: KYCVerification (all statuses), UserDataStore, UserProfile, onboarding records
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { user_email } = body;

    if (!user_email) {
      return Response.json({ error: 'user_email required' }, { status: 400 });
    }

    const results = {
      user_email,
      found_records: [],
      total_records: 0,
      timestamp: new Date().toISOString()
    };

    // 1. Search KYCVerification — ALL statuses
    try {
      const allKYC = await base44.asServiceRole.entities.KYCVerification.filter(
        { user_email },
        '-updated_date',
        100
      ).catch(() => []);

      if (allKYC.length > 0) {
        results.found_records.push({
          entity: 'KYCVerification',
          count: allKYC.length,
          records: allKYC.map(k => ({
            id: k.id,
            status: k.status,
            admin_status: k.admin_status,
            full_legal_name: k.full_legal_name,
            date_of_birth: k.date_of_birth,
            residential_address: k.residential_address,
            city: k.city,
            state: k.state,
            country: k.country,
            government_id_type: k.government_id_type,
            verified_at: k.verified_at,
            submitted_at: k.submitted_at,
            created_date: k.created_date,
            updated_date: k.updated_date
          }))
        });
        results.total_records += allKYC.length;
      }
    } catch (e) {
      console.error('KYCVerification search failed:', e.message);
    }

    // 2. Search UserDataStore
    try {
      const userData = await base44.asServiceRole.entities.UserDataStore.filter(
        { created_by: user_email },
        '-updated_date',
        50
      ).catch(() => []);

      if (userData.length > 0) {
        results.found_records.push({
          entity: 'UserDataStore',
          count: userData.length,
          records: userData.map(u => ({
            id: u.id,
            data_type: u.data_type,
            has_kyc: u.kyc_data ? true : false,
            created_date: u.created_date
          }))
        });
        results.total_records += userData.length;
      }
    } catch (e) {
      console.error('UserDataStore search failed:', e.message);
    }

    // 3. Search UserProfile
    try {
      const profiles = await base44.asServiceRole.entities.UserProfile.filter(
        { created_by: user_email },
        '-updated_date',
        50
      ).catch(() => []);

      if (profiles.length > 0) {
        results.found_records.push({
          entity: 'UserProfile',
          count: profiles.length,
          records: profiles.map(p => ({
            id: p.id,
            has_legal_name: p.legal_name ? true : false,
            has_dob: p.date_of_birth ? true : false,
            has_address: p.address ? true : false,
            created_date: p.created_date
          }))
        });
        results.total_records += profiles.length;
      }
    } catch (e) {
      console.error('UserProfile search failed:', e.message);
    }

    // 4. Search KYCIntakeForm responses
    try {
      const intakeForms = await base44.asServiceRole.entities.KYCIntakeForm?.filter?.(
        { user_email },
        '-created_date',
        50
      ).catch(() => []);

      if (intakeForms?.length > 0) {
        results.found_records.push({
          entity: 'KYCIntakeForm',
          count: intakeForms.length,
          records: intakeForms.map(f => ({
            id: f.id,
            status: f.status,
            has_data: !!f.form_data,
            created_date: f.created_date
          }))
        });
        results.total_records += intakeForms.length;
      }
    } catch (e) {
      // Entity may not exist
    }

    // 5. Search User entity for custom KYC fields
    try {
      const users = await base44.asServiceRole.entities.User.filter(
        { email: user_email },
        null,
        1
      ).catch(() => []);

      if (users.length > 0) {
        const user = users[0];
        results.found_records.push({
          entity: 'User',
          count: 1,
          records: [{
            id: user.id,
            email: user.email,
            full_name: user.full_name,
            custom_fields: user.kyc_data || user.legal_info || null
          }]
        });
        results.total_records += 1;
      }
    } catch (e) {
      console.error('User search failed:', e.message);
    }

    return Response.json({
      success: true,
      ...results
    });

  } catch (error) {
    console.error('[auditAllKYCRecords]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});