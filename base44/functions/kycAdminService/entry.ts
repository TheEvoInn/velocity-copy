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
      let records = await base44.asServiceRole.entities.KYCVerification.filter({ created_by: userEmail }, '-created_date', 1);
      if (!records.length) {
        records = await base44.asServiceRole.entities.KYCVerification.filter({ email_verified: userEmail }, '-created_date', 1);
      }
      console.log(`[kycAdminService] get_my_kyc for ${userEmail}: ${records.length} record(s)`);
      return Response.json({ record: records[0] || null });
    }

    // All other actions require admin
    if (user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    if (action === 'list' || action === 'list_all') {
      // Use asServiceRole to bypass RLS and fetch ALL users' KYC records
      const records = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 500);
      console.log(`[kycAdminService] fetched ${records.length} KYC records`);
      return Response.json({ records });
    }

    if (action === 'update' && id && updates) {
      const record = await base44.asServiceRole.entities.KYCVerification.update(id, updates);
      return Response.json({ record });
    }

    if (action === 'get_access_log' && id) {
      const records = await base44.asServiceRole.entities.KYCVerification.filter({ id });
      return Response.json({ access_log: records[0]?.access_log || [] });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});