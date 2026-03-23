import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    if (action === 'list_users') {
      const users = await base44.asServiceRole.entities.User.list('-created_date', 1000);
      return Response.json({ users: Array.isArray(users) ? users : [] });
    }

    if (action === 'list_kycs') {
      const kycs = await base44.asServiceRole.entities.KYCVerification.list('-created_date', 1000);
      return Response.json({ kycs: Array.isArray(kycs) ? kycs : [] });
    }

    if (action === 'list_identities') {
      const identities = await base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000);
      return Response.json({ identities: Array.isArray(identities) ? identities : [] });
    }

    if (action === 'approve_kyc') {
      const { kyc_id } = body;
      await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
        status: 'approved',
        admin_status: 'approved',
        verified_at: new Date().toISOString()
      });
      return Response.json({ success: true });
    }

    if (action === 'deny_kyc') {
      const { kyc_id } = body;
      await base44.asServiceRole.entities.KYCVerification.update(kyc_id, {
        status: 'rejected',
        admin_status: 'rejected'
      });
      return Response.json({ success: true });
    }

    if (action === 'update_user_role') {
      const { user_id, role } = body;
      await base44.asServiceRole.entities.User.update(user_id, { role });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});