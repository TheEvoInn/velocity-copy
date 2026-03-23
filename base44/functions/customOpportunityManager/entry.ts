import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'upload_custom_opportunity';

    if (action === 'upload_custom_opportunity') {
      const opportunity = body.opportunity || {};
      
      // Validate opportunity schema
      if (!opportunity.title || !opportunity.description) {
        return Response.json({ error: 'Missing required fields' }, { status: 400 });
      }

      const validated = {
        ...opportunity,
        id: `custom_${Date.now()}`,
        created_by: user.email,
        source: 'user_upload',
        status: 'pending_review',
        created_at: new Date().toISOString()
      };

      return Response.json({ success: true, opportunity: validated });
    }

    if (action === 'validate_opportunity') {
      const opp = body.opportunity || {};
      const errors = [];
      
      if (!opp.title) errors.push('Missing title');
      if (!opp.description) errors.push('Missing description');
      if (!opp.category) errors.push('Missing category');

      return Response.json({
        valid: errors.length === 0,
        errors,
        validated_at: new Date().toISOString()
      });
    }

    if (action === 'share_to_community') {
      const oppId = body.opportunity_id;
      return Response.json({
        shared: true,
        opportunity_id: oppId,
        community_url: `https://app.local/community/${oppId}`,
        shared_at: new Date().toISOString()
      });
    }

    if (action === 'rate_opportunity') {
      const rating = body.rating || 0;
      return Response.json({
        rating_recorded: true,
        rating,
        user: user.email,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});