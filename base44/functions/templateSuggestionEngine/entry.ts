import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * Template Suggestion Engine
 * Analyzes user goals, skills, linked accounts, identity profiles, and
 * execution history to generate personalized workflow suggestions.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Gather all user context
    const [goals, identities, linkedAccounts, recentTasks, strategies, transactions] = await Promise.all([
      base44.entities.UserGoals.list().then(r => r[0] || {}),
      base44.entities.AIIdentity.filter({ user_email: user.email }),
      base44.entities.LinkedAccount.list('-last_used', 20),
      base44.entities.AITask.list('-created_date', 30),
      base44.entities.Strategy.list('-updated_date', 20),
      base44.entities.Transaction.list('-created_date', 50),
    ]);

    // Build rich context summary
    const platforms = [...new Set(linkedAccounts.map(a => a.platform))];
    const skills = [...new Set([
      ...(goals.skills || []),
      ...identities.flatMap(i => i.skills || []),
    ])];
    const activeIdentityRoles = identities.filter(i => i.is_active).map(i => i.role_label || 'General').join(', ');
    const totalEarned = transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (t.net_amount || t.amount || 0), 0);
    const topCategories = Object.entries(
      transactions.reduce((acc, t) => { acc[t.category || 'other'] = (acc[t.category || 'other'] || 0) + 1; return acc; }, {})
    ).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([cat]) => cat);
    const existingStrategyTitles = strategies.map(s => s.title);
    const riskTolerance = goals.risk_tolerance || 'moderate';
    const dailyTarget = goals.daily_target || 500;
    const capitalAvailable = goals.available_capital || 0;
    const preferredCategories = goals.preferred_categories || [];

    const contextPrompt = `
You are an expert workflow strategist for the VELOCITY autonomous profit engine platform.

USER PROFILE:
- Daily income target: $${dailyTarget}
- Risk tolerance: ${riskTolerance}
- Available capital: $${capitalAvailable}
- Skills: ${skills.length > 0 ? skills.join(', ') : 'Not specified'}
- Active AI identity roles: ${activeIdentityRoles || 'None configured'}
- Connected platforms: ${platforms.length > 0 ? platforms.join(', ') : 'None'}
- Preferred categories: ${preferredCategories.length > 0 ? preferredCategories.join(', ') : 'Not specified'}
- Total earned to date: $${totalEarned.toFixed(2)}
- Top performing categories: ${topCategories.join(', ') || 'None yet'}
- Already active strategies: ${existingStrategyTitles.join(', ') || 'None'}

TASK: Generate exactly 5 highly personalized workflow/strategy suggestions for this user.
Each suggestion should be immediately actionable and synced to autopilot execution.
Prioritize suggestions that fill gaps in their current strategy portfolio.
Match difficulty to their experience level (judged by totalEarned and connected platforms).

Return a JSON object with this structure:
{
  "suggestions": [
    {
      "id": "suggest_unique_id",
      "name": "Short catchy name",
      "description": "2-sentence explanation of exactly what this does and why it fits this user",
      "why_recommended": "1 sentence - specific reason based on their profile",
      "category": "freelance|arbitrage|lead_gen|grant|service|digital_flip|resale",
      "platform": "upwork|fiverr|ebay|freelancer|linkedin|multi|amazon|etsy",
      "difficulty": "beginner|intermediate|advanced",
      "icon": "single emoji",
      "color": "#hexcolor",
      "estimated_daily_profit_low": number,
      "estimated_daily_profit_high": number,
      "confidence_score": number between 60-98,
      "tags": ["tag1", "tag2", "tag3"],
      "autopilot_config": {
        "enabled": true,
        "mode": "continuous|scheduled",
        "execution_mode": "full_auto|review_required|notification_only",
        "max_concurrent_tasks": number,
        "preferred_categories": ["category1"]
      },
      "execution_rules": {
        "minimum_profit_threshold": number,
        "minimum_success_probability": number
      },
      "goals_config": {
        "risk_tolerance": "${riskTolerance}"
      },
      "setup_steps": ["Step 1", "Step 2", "Step 3"]
    }
  ],
  "analysis": {
    "profile_score": number 0-100,
    "readiness_level": "starter|intermediate|advanced",
    "top_opportunity": "brief string",
    "gaps_identified": ["gap1", "gap2"]
  }
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: contextPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          suggestions: { type: 'array' },
          analysis: { type: 'object' },
        },
      },
    });

    return Response.json({
      success: true,
      suggestions: result.suggestions || [],
      analysis: result.analysis || {},
      context: {
        platforms,
        skills: skills.slice(0, 8),
        risk_tolerance: riskTolerance,
        daily_target: dailyTarget,
        total_earned: totalEarned,
      },
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});