import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Autopilot Cycle — Scheduled entry point
 * Inlined execution to avoid cross-function auth context loss.
 * Runs every 15 minutes via scheduled automation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const states = await base44.asServiceRole.entities.PlatformState.list().catch(() => []);
    const ps = states[0];

    if (ps?.emergency_stop_engaged) {
      return Response.json({ success: false, message: 'Emergency stop engaged — cycle skipped' });
    }

    // Get all users with autopilot enabled via service-role filtered query
    const enabledGoals = await base44.asServiceRole.entities.UserGoals.filter({ autopilot_enabled: true }, '-created_date', 100).catch(() => []);

    if (!enabledGoals || enabledGoals.length === 0) {
      return Response.json({ success: false, message: 'No users have autopilot enabled — cycle skipped' });
    }

    // Run cycle for each enabled user
    const results = [];
    for (const goals of enabledGoals) {
      const userEmail = goals.created_by;
      if (!userEmail) continue;

      try {
        // Execute full cycle inline: scan → identity → queue → execute
        const cycleLog = [];
        const addLog = (step, status, details) => {
          cycleLog.push({ timestamp: new Date().toISOString(), step, status, details });
          console.log(`[AutopilotCycle] ${step}: ${details}`);
        };

        addLog('scan', 'running', `Scanning opportunities for ${userEmail}`);
        // Invoke discoveryEngine with user_email — service-role will handle it
        const scanRes = await base44.asServiceRole.functions.invoke('discoveryEngine', {
          action: 'full_scan',
          user_email: userEmail,
          filters: { ai_only: true }
        }).catch(e => ({ data: { success: false, error: e.message, opportunities_found: 0 } }));
        
        const scanFound = scanRes?.data?.found || 0;
        const scanCreated = scanRes?.data?.created || 0;
        addLog('scan', scanRes?.data?.success ? 'success' : 'warning', `Scan: ${scanFound} found, ${scanCreated} created`);

        // Queue + execute top AI-compatible opportunities
        addLog('execute', 'running', 'Executing queued opportunities');
        const queuedOpps = await base44.asServiceRole.entities.WorkOpportunity.filter(
          { user_email: userEmail, autopilot_queued: true, status: 'evaluating' }, '-score', 5
        ).catch(() => []);
        
        let executed = 0;
        const queuedArray = Array.isArray(queuedOpps) ? queuedOpps : [];
        for (const opp of queuedArray) {
          if (!opp?.id) continue;
          try {
            // Mark as active (indicating it's been picked up by autopilot)
            await base44.asServiceRole.entities.WorkOpportunity.update(opp.id, {
              status: 'active',
              autopilot_queued: false
            }).catch(() => null);
            executed++;
          } catch (e) {
            console.error(`Failed to execute ${opp.title}:`, e.message);
          }
        }
        addLog('execute', 'success', `Executed ${executed}/${queuedArray.length} queued tasks`);

        // Log activity
        await base44.asServiceRole.entities.ActivityLog.create({
          action_type: 'system',
          message: `🤖 Autopilot cycle for ${userEmail}: ${scanCreated} discovered, ${executed} executed`,
          severity: 'success',
          metadata: { user: userEmail, discovered: scanCreated, executed }
        }).catch(() => {});

        results.push({ user: userEmail, success: true, discovered: scanCreated, executed, log: cycleLog });
      } catch (e) {
        console.error(`Cycle failed for ${userEmail}:`, e.message);
        results.push({ user: userEmail, success: false, error: e.message });
      }
    }

    return Response.json({
      success: true,
      source: 'autopilotCycle (scheduled)',
      users_processed: enabledGoals.length,
      results,
    });

  } catch (error) {
    console.error('[autopilotCycle] Error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});