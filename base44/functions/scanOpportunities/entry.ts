/**
 * scanOpportunities — delegates to discoveryEngine v3
 * Kept for backward compatibility with autopilot cycles
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action = 'scan', filters = {}, user_email } = body;

    // Delegate to discoveryEngine
    const res = await base44.asServiceRole.functions.invoke('discoveryEngine', {
      action: 'full_scan',
      user_email: user.email,
      filters,
    });

    return Response.json({
      success: true,
      scan: {
        found: res.data?.found || 0,
        created: res.data?.created || 0,
        ai_compatible: res.data?.ai_compatible || 0,
        categories: res.data?.categories || {},
        opportunities: res.data?.top_opportunities || [],
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});