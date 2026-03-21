import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Verify the caller is an admin
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action, id, updates } = body;

    if (action === 'list') {
      // Use filter({}) with service role to bypass RLS — list() does not work under service role
      const records = await base44.asServiceRole.entities.KYCVerification.filter({}, '-created_date', 200);
      console.log(`[kycAdminService] filter returned ${records?.length} records`);
      return Response.json({ records: records || [] });
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