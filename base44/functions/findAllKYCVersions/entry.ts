/**
 * FIND ALL KYC VERSIONS
 * Get EVERY KYC record for user, including superseded/old versions
 * No filtering — retrieve raw from database
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

    // Fetch ALL KYC records — no filters
    const allRecords = await base44.asServiceRole.entities.KYCVerification.list(
      '-created_date',
      1000
    ).catch(() => []);

    // Filter to user manually
    const userRecords = allRecords.filter(r => r.user_email === user_email);

    console.log(`[findAllKYCVersions] Found ${userRecords.length} total KYC records for ${user_email}`);

    // Return ALL details including form_data, submission data, audit trail
    const detailed = userRecords.map(r => ({
      id: r.id,
      status: r.status,
      admin_status: r.admin_status,
      created_date: r.created_date,
      updated_date: r.updated_date,
      verified_at: r.verified_at,
      submitted_at: r.submitted_at,
      approved_at: r.approved_at,
      form_submission: {
        full_legal_name: r.full_legal_name,
        date_of_birth: r.date_of_birth,
        residential_address: r.residential_address,
        city: r.city,
        state: r.state,
        postal_code: r.postal_code,
        country: r.country,
        phone_number: r.phone_number,
        government_id_type: r.government_id_type,
        government_id_number: r.government_id_number ? '***ENCRYPTED***' : null,
        government_id_expiry: r.government_id_expiry,
        tax_id: r.tax_id ? '***ENCRYPTED***' : null
      },
      documents: {
        id_front: r.id_document_front_url ? 'present' : 'missing',
        id_back: r.id_document_back_url ? 'present' : 'missing',
        selfie: r.selfie_url ? 'present' : 'missing'
      },
      doc_approvals: r.doc_approvals,
      admin_notes: r.admin_notes,
      fraud_flags: r.fraud_flags,
      notes: r.notes
    }));

    return Response.json({
      success: true,
      user_email,
      total_found: userRecords.length,
      records: detailed
    });

  } catch (error) {
    console.error('[findAllKYCVersions]', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});