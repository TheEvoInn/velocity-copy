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
      const records = await base44.asServiceRole.entities.KYCVerification.filter({ status: 'submitted' }, '-created_date', 200);
      console.log(`[kycAdminService] fetched ${records.length} submitted KYC records`);
      return Response.json({ records });
    }

    if (action === 'list_all') {
      const submitted = await base44.asServiceRole.entities.KYCVerification.filter({ status: 'submitted' }, '-created_date', 100);
      const approved  = await base44.asServiceRole.entities.KYCVerification.filter({ status: 'approved' }, '-created_date', 100);
      const rejected  = await base44.asServiceRole.entities.KYCVerification.filter({ status: 'rejected' }, '-created_date', 100);
      const seen = new Set();
      const records = [...submitted, ...approved, ...rejected].filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
      }).sort((a, b) => new Date(b.created_date) - new Date(a.created_date));
      console.log(`[kycAdminService] fetched ${records.length} total KYC records`);
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