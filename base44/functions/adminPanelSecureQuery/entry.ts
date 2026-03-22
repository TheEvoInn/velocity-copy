import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    // Security: Only admins can access this
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const requestBody = await req.json().catch(() => ({}));
    const filter_email = requestBody.filter_email;

    // Fetch all data in parallel
    const [usersData, goalsData, identitiesData, connectionsData, kycsData, opportunitiesData, transactionsData] = 
      await Promise.all([
        base44.asServiceRole.entities.User.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.UserGoals.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.AIIdentity.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.PlatformConnection.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.KYCVerification.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.Opportunity.list('-created_date', 1000).catch(() => []),
        base44.asServiceRole.entities.Transaction.list('-created_date', 1000).catch(() => []),
      ]);

    // Build enriched user profiles by email
    const userProfiles = new Map();

    // Initialize from User entity (built-in)
    usersData.forEach(u => {
      userProfiles.set(u.email, {
        id: u.id,
        email: u.email,
        full_name: u.full_name || '—',
        role: u.role || 'user',
        created_date: u.created_date,
        updated_date: u.updated_date,
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
          earned_total: 0,
          total_opportunities: 0
        }
      });
    });

    // Link UserGoals by user_email
    goalsData.forEach(g => {
      const email = g.user_email;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: g.created_date,
            updated_date: g.updated_date,
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
              earned_total: 0,
              total_opportunities: 0
            }
          });
        }
        const profile = userProfiles.get(email);
        profile.goals.push({
          id: g.id,
          onboarded: g.onboarded,
          daily_target: g.daily_target,
          autopilot_enabled: g.autopilot_enabled,
          risk_level: g.risk_level
        });
        profile.stats.onboarded = g.onboarded || false;
        profile.stats.autopilot_enabled = g.autopilot_enabled || false;
      }
    });

    // Link AIIdentities by user_email
    identitiesData.forEach(i => {
      const email = i.user_email;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: i.created_date,
            updated_date: i.updated_date,
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
              earned_total: 0,
              total_opportunities: 0
            }
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

    // Link PlatformConnections by user_email
    connectionsData.forEach(c => {
      const email = c.user_email;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: c.created_date,
            updated_date: c.updated_date,
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
              earned_total: 0,
              total_opportunities: 0
            }
          });
        }
        userProfiles.get(email).connections.push({
          id: c.id,
          platform: c.platform,
          status: c.status,
          account_username: c.account_username,
          last_verified_at: c.last_verified_at
        });
        userProfiles.get(email).stats.platform_count = userProfiles.get(email).connections.length;
      }
    });

    // Link KYCVerification by user_email
    kycsData.forEach(k => {
      const email = k.user_email;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: k.created_date,
            updated_date: k.updated_date,
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
              earned_total: 0,
              total_opportunities: 0
            }
          });
        }
        userProfiles.get(email).kycs.push({
          id: k.id,
          status: k.status,
          verified_at: k.verified_at,
          admin_status: k.admin_status
        });
        userProfiles.get(email).stats.kyc_status = k.status;
      }
    });

    // Link Opportunities by created_by (user email)
    opportunitiesData.forEach(o => {
      const email = o.created_by;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: o.created_date,
            updated_date: o.updated_date,
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
              earned_total: 0,
              total_opportunities: 0
            }
          });
        }
        userProfiles.get(email).opportunities.push({
          id: o.id,
          title: o.title,
          status: o.status,
          profit_estimate_high: o.profit_estimate_high
        });
        userProfiles.get(email).stats.total_opportunities = userProfiles.get(email).opportunities.length;
      }
    });

    // Link Transactions by created_by (user email)
    transactionsData.forEach(t => {
      const email = t.created_by;
      if (email) {
        if (!userProfiles.has(email)) {
          userProfiles.set(email, {
            id: null,
            email: email,
            full_name: '—',
            role: 'user',
            created_date: t.created_date,
            updated_date: t.updated_date,
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
              earned_total: 0,
              total_opportunities: 0
            }
          });
        }
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

    // Convert to array and sort
    let enrichedUsers = Array.from(userProfiles.values())
      .sort((a, b) => {
        if (a.stats.onboarded !== b.stats.onboarded) {
          return b.stats.onboarded ? 1 : -1;
        }
        return new Date(b.created_date || 0) - new Date(a.created_date || 0);
      });

    // Filter by email if provided
    if (filter_email) {
      enrichedUsers = enrichedUsers.filter(u => 
        u.email.toLowerCase().includes(filter_email.toLowerCase())
      );
    }

    return Response.json({
      success: true,
      admin: user.email,
      timestamp: new Date().toISOString(),
      data: {
        users: enrichedUsers,
        metadata: {
          total_users: enrichedUsers.length,
          users_onboarded: enrichedUsers.filter(u => u.stats.onboarded).length,
          users_with_identities: enrichedUsers.filter(u => u.identities.length > 0).length,
          users_with_connections: enrichedUsers.filter(u => u.connections.length > 0).length,
          pending_kyc: enrichedUsers.filter(u => u.stats.kyc_status && !['approved', 'verified'].includes(u.stats.kyc_status)).length,
          total_earned_across_users: enrichedUsers.reduce((sum, u) => sum + (u.stats.earned_total || 0), 0)
        }
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});