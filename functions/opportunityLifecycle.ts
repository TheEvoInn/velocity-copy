/**
 * Opportunity Lifecycle Manager
 * Handles: completion rules, cooldowns, reactivation, expiry, duplicate detection
 * Called by: automation triggers, aiAutoPilot, autopilotApply
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action } = body;

    // ── ACTION: process_completion ────────────────────────────────────────────
    if (action === 'process_completion') {
      const { opportunity_id, completion_type, revenue_earned, task_id } = body;
      // completion_type: 'once' | 'repeatable' | 'cooldown' | 'expired'

      const opps = await base44.asServiceRole.entities.Opportunity.filter({ id: opportunity_id });
      const opp = opps[0];
      if (!opp) return Response.json({ error: 'Opportunity not found' }, { status: 404 });

      let newStatus = 'completed';
      let updates = { status: 'completed' };

      if (completion_type === 'repeatable') {
        // Reset to new after 24h - mark completed but schedule reactivation
        newStatus = 'completed';
        updates.tags = [...(opp.tags || []), 'repeatable'];
        // Will be reactivated by scheduler
      } else if (completion_type === 'cooldown') {
        newStatus = 'completed';
        updates.tags = [...(opp.tags || []), 'cooldown'];
      } else if (completion_type === 'expired') {
        newStatus = 'expired';
        updates.status = 'expired';
      }

      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, updates);

      // Log to AIWorkLog
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'job_completed',
        opportunity_id,
        task_id: task_id || null,
        subject: `Opportunity "${opp.title}" marked as ${newStatus}`,
        outcome: `Revenue: $${revenue_earned || 0}. Completion type: ${completion_type}`,
        revenue_associated: revenue_earned || 0,
        metadata: { completion_type, opportunity_id }
      });

      // If completing this opportunity spawns new ones (service → referral, etc.)
      if (revenue_earned > 0 && (opp.category === 'service' || opp.category === 'freelance')) {
        await spawnFollowOnOpportunities(base44, opp, revenue_earned);
      }

      return Response.json({ success: true, new_status: newStatus });
    }

    // ── ACTION: run_maintenance ───────────────────────────────────────────────
    // Called by scheduler: expire old opps, reactivate cooldowns, clean duplicates
    if (action === 'run_maintenance') {
      const allOpps = await base44.asServiceRole.entities.Opportunity.list('-created_date', 200);
      const now = new Date();
      let expired = 0, reactivated = 0, cleaned = 0;

      for (const opp of allOpps) {
        // Expire stale 'new' opportunities older than 7 days
        if (opp.status === 'new') {
          const age = (now - new Date(opp.created_date)) / (1000 * 60 * 60 * 24);
          if (age > 7 && opp.time_sensitivity === 'immediate') {
            await base44.asServiceRole.entities.Opportunity.update(opp.id, { status: 'expired' });
            expired++;
          } else if (age > 14) {
            await base44.asServiceRole.entities.Opportunity.update(opp.id, { status: 'expired' });
            expired++;
          }
        }

        // Reactivate repeatable completed ones after 24h
        if (opp.status === 'completed' && (opp.tags || []).includes('repeatable')) {
          const age = (now - new Date(opp.updated_date)) / (1000 * 60 * 60);
          if (age >= 24) {
            await base44.asServiceRole.entities.Opportunity.update(opp.id, {
              status: 'new',
              tags: (opp.tags || []).filter(t => t !== 'cooldown')
            });
            reactivated++;
          }
        }

        // Reactivate cooldown ones after 48h
        if (opp.status === 'completed' && (opp.tags || []).includes('cooldown')) {
          const age = (now - new Date(opp.updated_date)) / (1000 * 60 * 60);
          if (age >= 48) {
            await base44.asServiceRole.entities.Opportunity.update(opp.id, {
              status: 'new',
              tags: (opp.tags || []).filter(t => t !== 'cooldown')
            });
            reactivated++;
          }
        }
      }

      // Remove duplicate titles (keep newest)
      const titleMap = {};
      for (const opp of allOpps.filter(o => o.status === 'new')) {
        const key = opp.title?.toLowerCase().trim();
        if (titleMap[key]) {
          // Keep the one with better score
          if ((titleMap[key].overall_score || 0) >= (opp.overall_score || 0)) {
            await base44.asServiceRole.entities.Opportunity.update(opp.id, { status: 'dismissed' });
            cleaned++;
          } else {
            await base44.asServiceRole.entities.Opportunity.update(titleMap[key].id, { status: 'dismissed' });
            titleMap[key] = opp;
            cleaned++;
          }
        } else {
          titleMap[key] = opp;
        }
      }

      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `Opportunity maintenance: ${expired} expired, ${reactivated} reactivated, ${cleaned} duplicates removed`,
        severity: 'info'
      });

      return Response.json({ success: true, expired, reactivated, cleaned });
    }

    // ── ACTION: invalidate ────────────────────────────────────────────────────
    if (action === 'invalidate') {
      const { opportunity_id, reason } = body;
      await base44.asServiceRole.entities.Opportunity.update(opportunity_id, { status: 'dismissed' });
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'system',
        message: `Opportunity invalidated: ${reason}`,
        severity: 'info'
      });
      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function spawnFollowOnOpportunities(base44, completedOpp, revenue) {
  // If a service/freelance job was completed, generate follow-on opportunities
  if (revenue > 50) {
    await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `A freelance job was just completed: "${completedOpp.title}" earning $${revenue}. 
Generate 1 follow-on opportunity that naturally arises from this completion (e.g., upsell, repeat client, referral opportunity, related gig).
Return JSON: {"title": "...", "description": "...", "category": "service", "profit_estimate_low": number, "profit_estimate_high": number, "capital_required": 0, "velocity_score": 70, "risk_score": 20, "overall_score": 75, "time_sensitivity": "days", "source": "follow-on from completed job", "tags": ["follow-on"]}`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" }, description: { type: "string" }, category: { type: "string" },
          profit_estimate_low: { type: "number" }, profit_estimate_high: { type: "number" },
          capital_required: { type: "number" }, velocity_score: { type: "number" },
          risk_score: { type: "number" }, overall_score: { type: "number" },
          time_sensitivity: { type: "string" }, source: { type: "string" },
          tags: { type: "array", items: { type: "string" } }
        }
      }
    }).then(async (followOn) => {
      if (followOn?.title) {
        await base44.asServiceRole.entities.Opportunity.create({ ...followOn, status: 'new' });
      }
    }).catch(() => {});
  }
}