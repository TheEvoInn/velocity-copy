/**
 * Negotiation Engine
 * Actions:
 *   analyze_message   — Analyze an incoming client message and suggest response
 *   get_active_threads — List all active negotiation threads
 *   add_message       — Add a message to a thread
 *   close_thread      — Mark a negotiation as won/lost/closed
 *   get_insights      — Get negotiation performance analytics
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    // ── analyze_message ────────────────────────────────────────────────────────
    if (action === 'analyze_message') {
      const { message_content, thread_context, platform, client_name, current_rate, identity_id } = body;

      const identities = await base44.asServiceRole.entities.AIIdentity.list();
      const identity = identity_id
        ? identities.find(i => i.id === identity_id)
        : identities.find(i => i.is_active) || identities[0];

      // Pull past negotiation successes
      const workLogs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', 100);
      const pastNegotiations = workLogs.filter(l =>
        (l.log_type === 'message_sent' || l.log_type === 'message_received') && l.revenue_associated > 0
      ).slice(0, 10);

      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'claude_sonnet_4_6',
        prompt: `You are an expert negotiation strategist for a freelance AI agent. Analyze this incoming client message and provide strategic guidance.

=== ACTIVE IDENTITY ===
Name: ${identity?.name || 'Freelancer'}
Tone: ${identity?.communication_tone || 'professional'}
Bio: ${identity?.bio || ''}
Communication Style: ${identity?.proposal_style || ''}

=== CLIENT MESSAGE ===
From: ${client_name || 'Client'}
Platform: ${platform || 'unknown'}
Current Rate: ${current_rate ? '$' + current_rate : 'not set'}

Message:
"${message_content}"

=== THREAD CONTEXT ===
${thread_context || 'No prior context'}

=== PAST SUCCESSFUL NEGOTIATIONS (for pattern reference) ===
${pastNegotiations.map(n => `Platform: ${n.platform} | Revenue: $${n.revenue_associated} | Preview: ${n.content_preview || ''}`).join('\n') || 'None yet'}

Analyze this message and provide:
1. Sentiment analysis (positive/neutral/negative/urgent)
2. Client intent (inquiry, objection, negotiation, closing, feedback, upsell opportunity)  
3. Optimal response strategy
4. Suggested response text (in identity's exact tone and voice)
5. Whether to push higher rate, hold current rate, or close now
6. Upsell/scope expansion opportunities
7. Risk flags (scope creep, lowball, ghost risk)
8. Priority level (high/medium/low)

Return JSON:
{
  "sentiment": string,
  "intent": string,
  "priority": string,
  "strategy": string,
  "suggested_response": string,
  "rate_recommendation": string,
  "upsell_opportunities": [string],
  "risk_flags": [string],
  "action": string,
  "reasoning": string,
  "follow_up_timing": string
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            sentiment: { type: 'string' },
            intent: { type: 'string' },
            priority: { type: 'string' },
            strategy: { type: 'string' },
            suggested_response: { type: 'string' },
            rate_recommendation: { type: 'string' },
            upsell_opportunities: { type: 'array', items: { type: 'string' } },
            risk_flags: { type: 'array', items: { type: 'string' } },
            action: { type: 'string' },
            reasoning: { type: 'string' },
            follow_up_timing: { type: 'string' }
          }
        }
      });

      // Log the analysis
      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: 'message_received',
        platform,
        subject: `Incoming message from ${client_name || 'client'} — ${result?.intent || 'analyzed'}`,
        content_preview: message_content?.slice(0, 300),
        sender: client_name,
        ai_decision_context: result?.reasoning,
        metadata: { analysis: result, identity_id: identity?.id }
      });

      return Response.json({ analysis: result, identity_id: identity?.id });
    }

    // ── get_active_threads ─────────────────────────────────────────────────────
    if (action === 'get_active_threads') {
      const logs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', 200);
      const threads = {};

      logs.filter(l => ['message_sent', 'message_received', 'proposal_submitted'].includes(l.log_type)).forEach(l => {
        const key = l.metadata?.thread_id || l.recipient || l.sender || l.subject || l.id;
        if (!threads[key]) {
          threads[key] = {
            id: key,
            platform: l.platform,
            client: l.recipient || l.sender || 'Unknown',
            subject: l.subject,
            last_message: l.content_preview,
            last_activity: l.created_date,
            message_count: 0,
            revenue: 0,
            status: l.metadata?.thread_status || 'active'
          };
        }
        threads[key].message_count++;
        threads[key].revenue += l.revenue_associated || 0;
        if (new Date(l.created_date) > new Date(threads[key].last_activity)) {
          threads[key].last_activity = l.created_date;
          threads[key].last_message = l.content_preview;
        }
      });

      return Response.json({ threads: Object.values(threads).sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity)) });
    }

    // ── add_message ────────────────────────────────────────────────────────────
    if (action === 'add_message') {
      const { thread_id, content, direction, platform, client_name, identity_id } = body;

      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: direction === 'outbound' ? 'message_sent' : 'message_received',
        platform,
        subject: `${direction === 'outbound' ? 'Sent to' : 'Received from'} ${client_name || 'client'}`,
        content_preview: content?.slice(0, 500),
        full_content: content,
        recipient: direction === 'outbound' ? client_name : null,
        sender: direction === 'inbound' ? client_name : null,
        status: 'sent',
        metadata: { thread_id, direction, identity_id }
      });

      return Response.json({ success: true });
    }

    // ── close_thread ───────────────────────────────────────────────────────────
    if (action === 'close_thread') {
      const { thread_id, outcome, revenue } = body;

      await base44.asServiceRole.entities.AIWorkLog.create({
        log_type: outcome === 'won' ? 'job_completed' : 'task_decision',
        subject: `Negotiation ${outcome}: ${thread_id}`,
        content_preview: `Thread closed with outcome: ${outcome}`,
        outcome,
        revenue_associated: revenue || 0,
        metadata: { thread_id, outcome, closed_at: new Date().toISOString() }
      });

      return Response.json({ success: true });
    }

    // ── get_insights ───────────────────────────────────────────────────────────
    if (action === 'get_insights') {
      const logs = await base44.asServiceRole.entities.AIWorkLog.list('-created_date', 500);
      const proposals = logs.filter(l => l.log_type === 'proposal_submitted');
      const won = proposals.filter(l => l.outcome?.toLowerCase().includes('win') || l.outcome?.toLowerCase().includes('hired'));
      const completed = logs.filter(l => l.log_type === 'job_completed');
      const totalRevenue = logs.reduce((s, l) => s + (l.revenue_associated || 0), 0);

      const platformBreakdown = {};
      logs.forEach(l => {
        if (!l.platform) return;
        if (!platformBreakdown[l.platform]) platformBreakdown[l.platform] = { proposals: 0, won: 0, revenue: 0 };
        if (l.log_type === 'proposal_submitted') platformBreakdown[l.platform].proposals++;
        if (l.log_type === 'proposal_submitted' && (l.outcome?.includes('win') || l.outcome?.includes('hired'))) platformBreakdown[l.platform].won++;
        platformBreakdown[l.platform].revenue += l.revenue_associated || 0;
      });

      return Response.json({
        total_proposals: proposals.length,
        proposals_won: won.length,
        conversion_rate: proposals.length ? ((won.length / proposals.length) * 100).toFixed(1) : 0,
        total_revenue: totalRevenue,
        jobs_completed: completed.length,
        platform_breakdown: platformBreakdown
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});