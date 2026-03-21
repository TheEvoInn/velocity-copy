import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action, id, updates } = body;

    // Allow regular users to fetch their own KYC record
    if (action === 'get_my_kyc') {
      const userEmail = user.email;
      // First try user-scoped (works if they own the record)
      let records = [];
      try {
        records = await base44.entities.KYCVerification.list('-created_date', 10);
      } catch(_) {}
      
      // Fall back to service role list and filter
      if (!records.length) {
        try {
          const all = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
          records = all.filter(r => r.created_by === userEmail || r.email_verified === userEmail);
        } catch(_) {}
      } else {
        records = records.filter(r => r.created_by === userEmail || r.email_verified === userEmail);
      }

      console.log(`[kycAdminService] get_my_kyc for ${userEmail}: found=${records.length}`);
      return Response.json({ record: records[0] || null });
    }

    // All other actions require admin
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (action === 'list' || action === 'list_all') {
      // Try multiple approaches to get all KYC records
      let records = [];
      
      // Approach 1: asServiceRole list
      try {
        records = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
        console.log(`[kycAdminService] asServiceRole.list returned ${records.length}`);
      } catch(e) {
        console.log(`[kycAdminService] asServiceRole.list failed: ${e.message}`);
      }

      // Approach 2: regular list (will be RLS-filtered but better than nothing)
      if (!records.length) {
        try {
          records = await base44.entities.KYCVerification.list('-created_date', 500);
          console.log(`[kycAdminService] regular list returned ${records.length}`);
        } catch(e) {
          console.log(`[kycAdminService] regular list failed: ${e.message}`);
        }
      }

      console.log(`[kycAdminService] final fetched ${records.length} KYC records`);
      return Response.json({ records });
    }

    if (action === 'update' && id && updates) {
      try {
        const record = await base44.asServiceRole.entities.KYCVerification.update(id, updates);
        console.log(`[kycAdminService] update success for KYC ${id}`);
        return Response.json({ record });
      } catch (err) {
        console.error(`[kycAdminService] update failed: ${err.message}`);
        throw err;
      }
    }

    if (action === 'get_access_log' && id) {
      let record = null;
      try {
        const all = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
        record = all.find(r => r.id === id);
      } catch(_) {}
      return Response.json({ access_log: record?.access_log || [] });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});