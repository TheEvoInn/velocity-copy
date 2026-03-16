/**
 * Account Rotation Engine
 * Selects the optimal LinkedAccount for a given job/task using AI scoring.
 * Tracks usage, enforces limits, handles cooldowns, updates health status.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { action } = body;

    // ── ACTION: select — choose best account for a job ────────────────────────
    if (action === 'select') {
      const { job_category, required_skills = [], platform_preference, risk_level = 'medium', task_id } = body;

      const accounts = await base44.asServiceRole.entities.LinkedAccount.list('-performance_score', 50);
      const available = accounts.filter(a => {
        if (!a.ai_can_use) return false;
        if (a.health_status === 'suspended') return false;
        if (a.health_status === 'cooldown' && a.cooldown_until && new Date(a.cooldown_until) > new Date()) return false;
        if ((a.applications_today || 0) >= (a.daily_application_limit || 10)) return false;
        return true;
      });

      if (available.length === 0) {
        return Response.json({ error: 'No available accounts. All accounts are on cooldown or at limit.', accounts_checked: accounts.length }, { status: 200 });
      }

      // If only one available, return it
      if (available.length === 1) {
        await recordAccountUse(base44, available[0].id, task_id);
        return Response.json({ selected: available[0], reason: 'Only available account' });
      }

      // Use LLM to pick best account
      const accountSummaries = available.map(a => ({
        id: a.id,
        platform: a.platform,
        label: a.label,
        specialization: a.specialization,
        skills: a.skills || [],
        rating: a.rating,
        jobs_completed: a.jobs_completed,
        success_rate: a.success_rate,
        health_status: a.health_status,
        applications_today: a.applications_today || 0,
        performance_score: a.performance_score || 50,
        total_earned: a.total_earned || 0
      }));

      const selection = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an account rotation AI. Select the BEST account for this job.

JOB REQUIREMENTS:
- Category: ${job_category}
- Required Skills: ${required_skills.join(', ') || 'general'}
- Platform Preference: ${platform_preference || 'any'}
- Risk Level: ${risk_level}

AVAILABLE ACCOUNTS:
${JSON.stringify(accountSummaries, null, 2)}

SELECTION CRITERIA (in order of priority):
1. Skill match with job requirements
2. Platform match (if preference specified)
3. Account health (prefer healthy > warning)
4. Performance score (higher is better)
5. Success rate
6. Low applications_today (fresher account preferred)
7. Account specialization alignment

Return JSON: {"selected_id": "account_id", "reason": "why this account", "confidence": 0-100}`,
        response_json_schema: {
          type: "object",
          properties: {
            selected_id: { type: "string" },
            reason: { type: "string" },
            confidence: { type: "number" }
          }
        }
      });

      const selectedId = selection?.selected_id;
      const selected = available.find(a => a.id === selectedId) || available[0];

      await recordAccountUse(base44, selected.id, task_id);

      return Response.json({ selected, reason: selection?.reason || 'Best match by AI scoring', confidence: selection?.confidence });
    }

    // ── ACTION: update_health ─────────────────────────────────────────────────
    if (action === 'update_health') {
      const { account_id, health_status, cooldown_hours, notes } = body;
      const updates = { health_status };
      if (cooldown_hours) {
        const cooldown_until = new Date(Date.now() + cooldown_hours * 3600000).toISOString();
        updates.cooldown_until = cooldown_until;
      }
      if (notes) updates.notes = notes;
      await base44.asServiceRole.entities.LinkedAccount.update(account_id, updates);
      return Response.json({ success: true });
    }

    // ── ACTION: reset_daily_limits ────────────────────────────────────────────
    if (action === 'reset_daily_limits') {
      const accounts = await base44.asServiceRole.entities.LinkedAccount.list();
      for (const a of accounts) {
        if ((a.applications_today || 0) > 0) {
          await base44.asServiceRole.entities.LinkedAccount.update(a.id, { applications_today: 0 });
        }
        // Auto-clear expired cooldowns
        if (a.health_status === 'cooldown' && a.cooldown_until && new Date(a.cooldown_until) < new Date()) {
          await base44.asServiceRole.entities.LinkedAccount.update(a.id, { health_status: 'healthy', cooldown_until: null });
        }
      }
      return Response.json({ success: true, reset_count: accounts.length });
    }

    // ── ACTION: score_accounts ────────────────────────────────────────────────
    if (action === 'score_accounts') {
      const accounts = await base44.asServiceRole.entities.LinkedAccount.list();
      for (const a of accounts) {
        const score = calculatePerformanceScore(a);
        await base44.asServiceRole.entities.LinkedAccount.update(a.id, { performance_score: score });
      }
      return Response.json({ success: true, scored: accounts.length });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function recordAccountUse(base44, accountId, taskId) {
  const accounts = await base44.asServiceRole.entities.LinkedAccount.filter({ id: accountId });
  const account = accounts[0];
  if (!account) return;
  await base44.asServiceRole.entities.LinkedAccount.update(accountId, {
    applications_today: (account.applications_today || 0) + 1,
    last_used: new Date().toISOString()
  });
}

function calculatePerformanceScore(account) {
  let score = 50;
  // Rating contribution (0-5 scale → 0-30 points)
  if (account.rating) score += (account.rating / 5) * 30;
  // Success rate contribution (0-100% → 0-25 points)
  if (account.success_rate) score += (account.success_rate / 100) * 25;
  // Jobs completed (log scale, max 20 points)
  if (account.jobs_completed) score += Math.min(20, Math.log10(account.jobs_completed + 1) * 10);
  // Health penalties
  if (account.health_status === 'warning') score -= 10;
  if (account.health_status === 'cooldown') score -= 25;
  if (account.health_status === 'suspended') score = 0;
  return Math.max(0, Math.min(100, Math.round(score)));
}