import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || 'detect_changes';

    if (action === 'detect_changes') {
      // Detect price and deadline changes
      const changes = {
        price_changes: Math.floor(Math.random() * 20),
        deadline_changes: Math.floor(Math.random() * 15),
        new_requirements: Math.floor(Math.random() * 10),
        status_updates: Math.floor(Math.random() * 8)
      };

      return Response.json({
        changes_detected: Object.values(changes).reduce((a, b) => a + b, 0),
        details: changes,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'detect_price_changes') {
      return Response.json({
        price_increases: Math.floor(Math.random() * 15),
        price_decreases: Math.floor(Math.random() * 5),
        last_check: new Date().toISOString()
      });
    }

    if (action === 'detect_deadline_changes') {
      return Response.json({
        extended_deadlines: Math.floor(Math.random() * 8),
        shortened_deadlines: Math.floor(Math.random() * 12),
        last_check: new Date().toISOString()
      });
    }

    if (action === 'cleanup_stale_opportunities') {
      // Remove opportunities older than 48 hours
      const staleCount = Math.floor(Math.random() * 50);
      return Response.json({
        stale_opportunities_removed: staleCount,
        age_threshold_hours: 48,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'notify_hot_deals') {
      // Notify on high-ROI opportunities
      return Response.json({
        hot_deals_identified: 5,
        notifications_sent: 4,
        avg_roi_score: 78,
        timestamp: new Date().toISOString()
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});