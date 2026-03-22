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
    const [usersData, goalsData, identitiesData, connectionsData, kycsData, opportunitiesData, transactionsData] = 
      await Promise.all([
        base44.asServiceRole.entities.User.list('-created_date', 100).catch(() => []),
        base44.asServiceRole.entities.UserGoals.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.AIIdentity.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.PlatformConnection.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.KYCVerification.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.Opportunity.list('-created_date', 500).catch(() => []),
        base44.asServiceRole.entities.Transaction.list('-created_date', 500).catch(() => []),
      ]);

    // ─────────────────────────────────────────────────────────────────────────
    // BUILD USER PROFILES: Link all records to users by email
    // ─────────────────────────────────────────────────────────────────────────
    const userProfiles = new Map();

    // Initialize profiles from User entity
    usersData.forEach(u => {
      userProfiles.set(u.email, {
        id: u.id,
        email: u.email,
        full_name: u.full_name || '—',
        role: u.role || 'user',
        created_date: u.created_date,
        goals: [],
        identities: [],
        connections: [],
        kycs: [],
        opportunities: [],
        transactions: [],
        stats: {
          onboarded: false,
          autopilot_enabled: false,
          kyc_status: null,
          platform_count: 0,
          earned_total: 0
        }
      });
    });

    // Link UserGoals (tie to user by email)
    goalsData.forEach(g => {
      const email = g.user_email || g.created_by;
      if (email && userProfiles.has(email)) {
        userProfiles.get(email).goals.push({
          id: g.id,
          onboarded: g.onboarded,
          daily_target: g.daily_target,
          autopilot_enabled: g.autopilot_enabled
        });
        const profile = userProfiles.get(email);
        profile.stats.onboarded = g.onboarded || false;
        profile.stats.autopilot_enabled = g.autopilot_enabled || false;
      } else if (email) {
        // Create profile if not found
        userProfiles.set(email, {
          id: null,
          email: email,
          full_name: '—',
          role: 'user',
          created_date: g.created_date,
          goals: [{
            id: g.id,
            onboarded: g.onboarded,
            daily_target: g.daily_target,
            autopilot_enabled: g.autopilot_enabled
          }],
          identities: [],
          connections: [],
          kycs: [],
          opportunities: [],
          transactions: [],
          stats: {
            onboarded: g.onboarded || false,
            autopilot_enabled: g.autopilot_enabled || false,
            kyc_status: null,
            platform_count: 0,
            earned_total: 0
          }
        });
      }
    });

    // Link AIIdentities (tie to user by email)
    identitiesData.forEach(i => {
      const email = i.user_email || i.created_by;
      if (email && userProfiles.has(email)) {
        userProfiles.get(email).identities.push({
          id: i.id,
          name: i.name,
          is_active: i.is_active,
          role_label: i.role_label
        });
      } else if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: i.created_date,
            goals: [],
            identities: [],
            connections: [],
            kycs: [],
            opportunities: [],
            transactions: [],
            stats: { onboarded: false, autopilot_enabled: false, kyc_status: null, platform_count: 0, earned_total: 0 }
          });
        }
        userProfiles.get(email).identities.push({
          id: i.id,
          name: i.name,
          is_active: i.is_active,
          role_label: i.role_label
        });
      }
    });

    // Link PlatformConnections (tie to user by email)
    connectionsData.forEach(c => {
      const email = c.user_email || c.created_by;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: c.created_date,
            goals: [],
            identities: [],
            connections: [],
            kycs: [],
            opportunities: [],
            transactions: [],
            stats: { onboarded: false, autopilot_enabled: false, kyc_status: null, platform_count: 0, earned_total: 0 }
          });
        }
        userProfiles.get(email).connections.push({
          id: c.id,
          platform: c.platform,
          status: c.status,
          account_username: c.account_username
        });
        userProfiles.get(email).stats.platform_count = userProfiles.get(email).connections.length;
      }
    });

    // Link KYCVerification (tie to user by email)
    kycsData.forEach(k => {
      const email = k.user_email || k.created_by;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: k.created_date,
            goals: [],
            identities: [],
            connections: [],
            kycs: [],
            opportunities: [],
            transactions: [],
            stats: { onboarded: false, autopilot_enabled: false, kyc_status: null, platform_count: 0, earned_total: 0 }
          });
        }
        userProfiles.get(email).kycs.push({
          id: k.id,
          status: k.status,
          verified_at: k.verified_at
        });
        userProfiles.get(email).stats.kyc_status = k.status;
      }
    });

    // Link Opportunities (tie to user by email)
    opportunitiesData.forEach(o => {
      const email = o.created_by;
      if (email && userProfiles.has(email)) {
        userProfiles.get(email).opportunities.push({
          id: o.id,
          title: o.title,
          status: o.status,
          profit_estimate_high: o.profit_estimate_high
        });
      }
    });

    // Link Transactions (tie to user by email, calculate total earned)
    transactionsData.forEach(t => {
      const email = t.created_by;
      if (email && userProfiles.has(email)) {
        userProfiles.get(email).transactions.push({
          id: t.id,
          type: t.type,
          amount: t.amount,
          created_date: t.created_date
        });
        if (t.type === 'income') {
          userProfiles.get(email).stats.earned_total += t.amount || 0;
        }
      }
    });

    // Convert Map to sorted array
    const enrichedUsers = Array.from(userProfiles.values())
      .sort((a, b) => {
        // Sort by onboarded status first, then by creation date
        if (a.stats.onboarded !== b.stats.onboarded) {
          return b.stats.onboarded ? 1 : -1;
        }
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });

    // Optional: Filter by email if provided
    const filteredUsers = filter_email
      ? enrichedUsers.filter(u => u.email.toLowerCase().includes(filter_email.toLowerCase()))
      : enrichedUsers;

    return Response.json({
      success: true,
      admin: user.email,
      timestamp: new Date().toISOString(),
      data: {
        users: filteredUsers,
        // Legacy structure for backward compatibility
        goals: goalsData.filter(g => g.user_email),
        identities: identitiesData.filter(i => i.user_email),
        connections: connectionsData.filter(c => c.user_email),
        kycs: kycsData.filter(k => k.user_email),
        // Metadata for dashboard summary
        metadata: {
          total_users: usersData.length,
          users_onboarded: filteredUsers.filter(u => u.stats.onboarded).length,
          users_with_identities: filteredUsers.filter(u => u.identities.length > 0).length,
          users_with_connections: filteredUsers.filter(u => u.connections.length > 0).length,
          pending_kyc: filteredUsers.filter(u => u.stats.kyc_status && !['approved', 'verified'].includes(u.stats.kyc_status)).length,
          total_earned_across_users: filteredUsers.reduce((sum, u) => sum + (u.stats.earned_total || 0), 0)
        }
      }
    });

  } catch (error) {
    console.error('[AdminPanelSecureQuery] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});