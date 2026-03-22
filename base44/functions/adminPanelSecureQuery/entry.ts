/**
 * Secure Admin Panel Query Function
 * Verifies admin role and returns filtered user data with proper user_email isolation
 * Called by Admin User Management dashboard to fetch all user onboarding/KYC/identity data
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // CRITICAL: Verify admin role before returning ANY data
    if (!user || user.role !== 'admin') {
      return Response.json(
        { error: 'Forbidden: Admin access required' },
        { status: 403 }
      );
    }

    const { action, filter_email } = await req.json().catch(() => ({}));

    // ─────────────────────────────────────────────────────────────────────────
    // PARALLEL FETCH: All admin-visible data in one request
    // ─────────────────────────────────────────────────────────────────────────
    const [usersData, goalsData, identitiesData, connectionsData, kycsData] = 
      await Promise.all([
        base44.asServiceRole.entities.User.list('-created_date', 100).catch(() => []),
        base44.asServiceRole.entities.UserGoals.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.AIIdentity.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.PlatformConnection.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.KYCVerification.list('-created_date', 500).catch(() => []),
      ]);

    // ─────────────────────────────────────────────────────────────────────────
    // SECURITY FILTERING: Ensure all records have user_email for proper isolation
    // ─────────────────────────────────────────────────────────────────────────
    const safeGoals = goalsData.filter(g => g.user_email);
    const safeIdentities = identitiesData.filter(i => i.user_email);
    const safeConnections = connectionsData.filter(c => c.user_email);
    const safeKycs = kycsData.filter(k => k.user_email);

    return Response.json({
      success: true,
      admin: user.email,
      timestamp: new Date().toISOString(),
      data: {
        users: usersData,
        goals: safeGoals,
        identities: safeIdentities,
        connections: safeConnections,
        kycs: safeKycs,
        // Metadata for dashboard summary
        metadata: {
          total_users: usersData.length,
          users_onboarded: safeGoals.filter(g => g.onboarded).length,
          users_with_identities: safeIdentities.length,
          users_with_connections: safeConnections.length,
          pending_kyc: safeKycs.filter(k => !['approved', 'verified'].includes(k.status)).length,
        }
      }
    });

  } catch (error) {
    console.error('[AdminPanelSecureQuery] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});