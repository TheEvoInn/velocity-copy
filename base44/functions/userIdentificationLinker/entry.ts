/**
 * User Identification & Data Linking Engine
 * Ensures users created via OAuth, email signup, 3rd party logins are properly identified
 * and all their data (goals, identities, connections, etc.) are linked to their email
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { action, user_email, search_term } = await req.json().catch(() => ({}));

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: SEARCH USERS BY EMAIL OR NAME
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'search_users') {
      if (!search_term) {
        return Response.json({ error: 'search_term required' }, { status: 400 });
      }

      // Parallel search: users by email, name, or partial matches
      const [emailMatches, nameMatches] = await Promise.all([
        base44.asServiceRole.entities.User.filter(
          { email: { $regex: search_term, $options: 'i' } },
          '-created_date',
          20
        ).catch(() => []),
        base44.asServiceRole.entities.User.filter(
          { full_name: { $regex: search_term, $options: 'i' } },
          '-created_date',
          20
        ).catch(() => [])
      ]);

      // Deduplicate by ID
      const allUsers = [...emailMatches, ...nameMatches];
      const uniqueUsers = Array.from(
        new Map(allUsers.map(u => [u.id, u])).values()
      );

      return Response.json({
        success: true,
        search_term,
        results: uniqueUsers.map(u => ({
          id: u.id,
          email: u.email,
          full_name: u.full_name,
          role: u.role,
          created_date: u.created_date
        })),
        count: uniqueUsers.length
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: IDENTIFY USER DATA (Find all records linked to a user)
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'identify_user_data') {
      if (!user_email) {
        return Response.json({ error: 'user_email required' }, { status: 400 });
      }

      // Parallel fetch all user-related records
      const [goals, identities, connections, kycs, opportunities, transactions, workflows] = 
        await Promise.all([
          base44.asServiceRole.entities.UserGoals.filter(
            { $or: [{ created_by: user_email }, { user_email }] },
            null,
            1
          ).catch(() => []),
          base44.asServiceRole.entities.AIIdentity.filter(
            { $or: [{ created_by: user_email }, { user_email }] },
            null,
            10
          ).catch(() => []),
          base44.asServiceRole.entities.PlatformConnection.filter(
            { $or: [{ created_by: user_email }, { user_email }] },
            null,
            10
          ).catch(() => []),
          base44.asServiceRole.entities.KYCVerification.filter(
            { $or: [{ created_by: user_email }, { user_email }] },
            null,
            1
          ).catch(() => []),
          base44.asServiceRole.entities.Opportunity.filter(
            { created_by: user_email },
            null,
            5
          ).catch(() => []),
          base44.asServiceRole.entities.Transaction.filter(
            { created_by: user_email },
            null,
            5
          ).catch(() => []),
          base44.asServiceRole.entities.UserWorkflow.filter(
            { $or: [{ created_by: user_email }, { user_email }] },
            null,
            5
          ).catch(() => [])
        ]);

      const userDataProfile = {
        user_email,
        identified_by: [],
        data_summary: {
          goals: goals.length,
          identities: identities.length,
          platform_connections: connections.length,
          kyc_records: kycs.length,
          opportunities: opportunities.length,
          transactions: transactions.length,
          workflows: workflows.length,
          total_records: 
            goals.length + identities.length + connections.length + kycs.length +
            opportunities.length + transactions.length + workflows.length
        },
        records: {
          goals: goals.map(g => ({ id: g.id, onboarded: g.onboarded })),
          identities: identities.map(i => ({ id: i.id, name: i.name, is_active: i.is_active })),
          connections: connections.map(c => ({ id: c.id, platform: c.platform, status: c.status })),
          kycs: kycs.map(k => ({ id: k.id, status: k.status })),
          opportunities: opportunities.length > 0 ? 'exists' : null,
          transactions: transactions.length > 0 ? 'exists' : null,
          workflows: workflows.length > 0 ? 'exists' : null,
        }
      };

      // Identify by which field we found the user
      if (goals.length > 0 || identities.length > 0) {
        userDataProfile.identified_by.push('user_email');
      }
      if (goals.some(g => g.created_by === user_email)) {
        userDataProfile.identified_by.push('created_by (goals)');
      }

      return Response.json({
        success: true,
        profile: userDataProfile
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ACTION: REPAIR USER DATA LINKS
    // ─────────────────────────────────────────────────────────────────────────
    if (action === 'repair_user_links') {
      if (!user_email) {
        return Response.json({ error: 'user_email required' }, { status: 400 });
      }

      const repairs = {
        timestamp: new Date().toISOString(),
        user_email,
        operations: []
      };

      // Fetch all records by created_by and ensure user_email is set
      const [goalsNeedRepair, identitiesNeedRepair, connectionsNeedRepair, kycsNeedRepair] = 
        await Promise.all([
          base44.asServiceRole.entities.UserGoals.filter(
            { created_by: user_email },
            null,
            10
          ).catch(() => []),
          base44.asServiceRole.entities.AIIdentity.filter(
            { created_by: user_email },
            null,
            10
          ).catch(() => []),
          base44.asServiceRole.entities.PlatformConnection.filter(
            { created_by: user_email },
            null,
            10
          ).catch(() => []),
          base44.asServiceRole.entities.KYCVerification.filter(
            { created_by: user_email },
            null,
            10
          ).catch(() => [])
        ]);

      // Repair goals
      for (const goal of goalsNeedRepair) {
        if (!goal.user_email) {
          try {
            await base44.asServiceRole.entities.UserGoals.update(goal.id, {
              user_email: user_email
            });
            repairs.operations.push({
              entity: 'UserGoals',
              id: goal.id,
              action: 'set_user_email',
              status: 'success'
            });
          } catch (e) {
            repairs.operations.push({
              entity: 'UserGoals',
              id: goal.id,
              action: 'set_user_email',
              status: 'failed',
              error: e.message
            });
          }
        }
      }

      // Repair identities
      for (const identity of identitiesNeedRepair) {
        if (!identity.user_email) {
          try {
            await base44.asServiceRole.entities.AIIdentity.update(identity.id, {
              user_email: user_email
            });
            repairs.operations.push({
              entity: 'AIIdentity',
              id: identity.id,
              action: 'set_user_email',
              status: 'success'
            });
          } catch (e) {
            repairs.operations.push({
              entity: 'AIIdentity',
              id: identity.id,
              action: 'set_user_email',
              status: 'failed',
              error: e.message
            });
          }
        }
      }

      // Repair connections
      for (const conn of connectionsNeedRepair) {
        if (!conn.user_email) {
          try {
            await base44.asServiceRole.entities.PlatformConnection.update(conn.id, {
              user_email: user_email
            });
            repairs.operations.push({
              entity: 'PlatformConnection',
              id: conn.id,
              action: 'set_user_email',
              status: 'success'
            });
          } catch (e) {
            repairs.operations.push({
              entity: 'PlatformConnection',
              id: conn.id,
              action: 'set_user_email',
              status: 'failed',
              error: e.message
            });
          }
        }
      }

      // Repair KYCs
      for (const kyc of kycsNeedRepair) {
        if (!kyc.user_email) {
          try {
            await base44.asServiceRole.entities.KYCVerification.update(kyc.id, {
              user_email: user_email
            });
            repairs.operations.push({
              entity: 'KYCVerification',
              id: kyc.id,
              action: 'set_user_email',
              status: 'success'
            });
          } catch (e) {
            repairs.operations.push({
              entity: 'KYCVerification',
              id: kyc.id,
              action: 'set_user_email',
              status: 'failed',
              error: e.message
            });
          }
        }
      }

      const successCount = repairs.operations.filter(op => op.status === 'success').length;
      const failureCount = repairs.operations.filter(op => op.status === 'failed').length;

      return Response.json({
        success: true,
        repairs: {
          ...repairs,
          summary: {
            total_operations: repairs.operations.length,
            successful: successCount,
            failed: failureCount
          }
        }
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('[UserIdentificationLinker] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});