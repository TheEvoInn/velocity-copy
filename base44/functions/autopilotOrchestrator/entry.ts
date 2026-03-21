import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

const GEMINI_API_KEY = Deno.env.get('GOOGLE_AI_API_KEY');

async function geminiScore(title, category, platform, capital = 0) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`;
  const prompt = `Score this opportunity (JSON only, no markdown):
Title: "${title}", Category: ${category}, Platform: ${platform || 'unknown'}, Capital: $${capital}
Return: {"velocity_score":number,"risk_score":number,"overall_score":number,"reasoning":string}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 256 } })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  try { return JSON.parse(text.replace(/```json|```/g, '').trim()); } catch { return null; }
}

// Orchestrate autonomous profit generation across all modules
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action } = await req.json();

    // ── pre_flight_check ────────────────────────────────────────────────────────
    if (action === 'pre_flight_check') {
      const checks = {
        identities: false,
        active_identity: false,
        accounts: false,
        credentials: false,
        vault: false,
        ready_to_autopilot: false,
        issues: []
      };

      try {
        // Check identities
        const identities = (await base44.asServiceRole.entities.AIIdentity.list().catch(() => [])) || [];
        const safeIds = Array.isArray(identities) ? identities : [];
        checks.identities = safeIds.length > 0;
        if (!checks.identities) checks.issues.push('No identities created');

        // Check active identity
        const activeIdentity = safeIds.find(i => i && i.is_active);
        checks.active_identity = !!activeIdentity;
        if (!checks.active_identity) checks.issues.push('No active identity selected');

        // Check accounts
        const accounts = (await base44.asServiceRole.entities.LinkedAccountCreation.list().catch(() => [])) || [];
        const safeAccounts = Array.isArray(accounts) ? accounts : [];
        checks.accounts = safeAccounts.length > 0;
        if (!checks.accounts) checks.issues.push('No accounts linked. Will auto-create on demand.');

        // Check credentials
        const creds = (await base44.asServiceRole.entities.CredentialVault.filter({ is_active: true }).catch(() => [])) || [];
        const safeCreds = Array.isArray(creds) ? creds : [];
        checks.credentials = safeCreds.length > 0;
        if (!checks.credentials) checks.issues.push('No credentials stored. Will generate on account creation.');

        // Determine readiness
        checks.ready_to_autopilot = checks.identities && checks.active_identity;
      } catch (e) {
        checks.issues.push(`Pre-flight check error: ${e.message}`);
      }

      return Response.json({
        success: true,
        checks,
        readiness_score: `${Math.round((Object.values(checks).filter(v => typeof v === 'boolean' && v).length / 5) * 100)}%`
      });
    }

    // ── ensure_identity ─────────────────────────────────────────────────────────
    if (action === 'ensure_identity') {
      let activeIdentity = null;

      try {
        // Try to get active identity
        const identities = (await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }).catch(() => [])) || [];
        const safeIds = Array.isArray(identities) ? identities : [];
        if (safeIds.length > 0 && safeIds[0]) {
          activeIdentity = safeIds[0];
        } else {
          // No active identity, find first or create default
          const allIdentities = (await base44.asServiceRole.entities.AIIdentity.list().catch(() => [])) || [];
          const safeAllIds = Array.isArray(allIdentities) ? allIdentities : [];
          if (safeAllIds.length > 0 && safeAllIds[0]) {
            activeIdentity = await base44.asServiceRole.entities.AIIdentity.update(safeAllIds[0].id, { is_active: true }).catch(() => safeAllIds[0]);
          } else {
            // Create default identity
            activeIdentity = await base44.asServiceRole.entities.AIIdentity.create({
              name: 'Default Autopilot',
              role_label: 'Freelancer',
              email: user?.email || 'autopilot@system',
              is_active: true,
              skills: ['general', 'problem-solving', 'communication'],
              bio: 'Autonomous agent optimized for profit generation',
              tagline: 'Delivering results 24/7',
              communication_tone: 'professional'
            }).catch(() => null);

            if (activeIdentity && activeIdentity.id) {
              await base44.asServiceRole.entities.ActivityLog.create({
                action_type: 'system',
                message: '🤖 Default identity auto-created for Autopilot',
                severity: 'info',
                metadata: { identity_id: activeIdentity.id }
              }).catch(() => {});
            }
          }
        }
      } catch (e) {
        console.error('Error ensuring identity:', e.message);
        return Response.json({ error: `Identity setup failed: ${e.message}` }, { status: 500 });
      }

      return Response.json({
        success: true,
        identity: activeIdentity,
        message: activeIdentity.is_active ? 'Ready' : 'Activated'
      });
    }

    // ── ensure_account ──────────────────────────────────────────────────────────
    if (action === 'ensure_account') {
      try {
        const body = await req.json().catch(() => ({}));
        const { platform, for_identity_id } = body;

        if (!platform) {
          return Response.json({ error: 'platform required' }, { status: 400 });
        }

        // Get identity
        let identityId = for_identity_id;
        if (!identityId) {
          const active = (await base44.asServiceRole.entities.AIIdentity.filter({ is_active: true }).catch(() => [])) || [];
          const safeActive = Array.isArray(active) ? active : [];
          identityId = safeActive.length > 0 && safeActive[0] ? safeActive[0].id : null;
        }

        if (!identityId) {
          return Response.json({
            success: false,
            error: 'No active identity. Run ensure_identity first.'
          });
        }

        // Check if account exists
        const existing = (await base44.asServiceRole.entities.LinkedAccountCreation.filter({
          platform,
          identity_id: identityId,
          account_status: { $ne: 'banned' }
        }).catch(() => [])) || [];

        const safeExisting = Array.isArray(existing) ? existing : [];
        if (safeExisting.length > 0 && safeExisting[0] && safeExisting[0].onboarding_completed) {
          return Response.json({
            success: true,
            account: safeExisting[0],
            exists: true
          });
        }

        // Auto-create account
        const result = await base44.asServiceRole.functions.invoke('accountCreationEngine', {
          action: 'check_and_create_account',
          platform,
          identity_id: identityId,
          on_demand: true
        }).catch(e => ({ data: { success: false, error: e.message } }));

      return Response.json({
        success: result?.data?.success || false,
        account: result?.data?.account || null,
        created: result?.data?.created || false,
        message: result?.data?.message || 'Account creation attempt completed'
      });
      } catch (e) {
      console.error('Error ensuring account:', e.message);
      return Response.json({ error: `Account setup failed: ${e.message}` }, { status: 500 });
      }
      }

    // ── full_autopilot_cycle ────────────────────────────────────────────────────
    if (action === 'full_autopilot_cycle') {
      const cycleResults = {
        timestamp: new Date().toISOString(),
        preflight: null,
        identity_ready: null,
        opportunities_found: 0,
        accounts_ensured: 0,
        tasks_executed: 0,
        earnings_generated: 0,
        errors: []
      };

      try {
        // 1. Pre-flight check
        const preflightRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
          action: 'pre_flight_check'
        });
        cycleResults.preflight = preflightRes.data;

        if (!cycleResults.preflight.ready_to_autopilot) {
          // 2. Ensure identity
          const identityRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
            action: 'ensure_identity'
          });
          cycleResults.identity_ready = identityRes.data?.identity;
        }

        // 3. Run opportunity scanning
        const scanRes = await base44.asServiceRole.functions.invoke('scanOpportunities', {
          action: 'scan',
          max_results: 10
        });
        cycleResults.opportunities_found = scanRes.data?.opportunities?.length || 0;

        // 4. Gemini-score new opportunities
        const opportunities = Array.isArray(scanRes.data?.opportunities) ? scanRes.data.opportunities : [];
        for (const opp of opportunities.slice(0, 5)) {
          if (opp && !opp.overall_score && opp.id) {
            try {
              const scores = await geminiScore(opp.title || '', opp.category || '', opp.platform || '', typeof opp.capital_required === 'number' ? opp.capital_required : 0);
              if (scores && typeof scores.overall_score === 'number') {
                await base44.asServiceRole.entities.Opportunity.update(opp.id, {
                  velocity_score: typeof scores.velocity_score === 'number' ? scores.velocity_score : 50,
                  risk_score: typeof scores.risk_score === 'number' ? scores.risk_score : 50,
                  overall_score: scores.overall_score,
                }).catch(e => console.error(`Failed to score opp ${opp.id}:`, e.message));
              }
            } catch (e) {
              console.error(`Gemini scoring error for ${opp?.id}:`, e.message);
            }
          }
        }

        // 4b. Ensure accounts for discovered opportunities
        const platformsNeeded = [...new Set(opportunities.map(o => o && o.platform ? o.platform : 'upwork').filter(Boolean))];

        for (const platform of platformsNeeded) {
          if (!platform) continue;
          try {
            const accountRes = await base44.asServiceRole.functions.invoke('autopilotOrchestrator', {
              action: 'ensure_account',
              platform
            }).catch(e => ({ data: { success: false, error: e.message } }));
            if (accountRes?.data?.success) {
              cycleResults.accounts_ensured++;
            }
          } catch (e) {
            console.error(`Error ensuring account for ${platform}:`, e.message);
          }
        }

        // 5. Run monitoring cycle
        const monitorRes = await base44.asServiceRole.functions.invoke('automatedPrizeMonitoring', {
          action: 'run_monitoring_cycle'
        });
        if (monitorRes.data?.cycle_completed) {
          cycleResults.earnings_generated += monitorRes.data?.results?.auto_claims_executed || 0;
        }

        // 6. Run account health check
        await base44.asServiceRole.functions.invoke('accountHealthMonitor', {
          action: 'check_all_account_health'
        });

      } catch (error) {
        cycleResults.errors.push(error.message);
      }

      // Log cycle
      await base44.asServiceRole.entities.ActivityLog.create({
        action_type: 'scan',
        message: `🤖 Autopilot cycle: ${cycleResults.opportunities_found} opportunities, ${cycleResults.accounts_ensured} accounts ensured, ${cycleResults.earnings_generated} actions completed`,
        severity: cycleResults.errors.length > 0 ? 'warning' : 'success',
        metadata: cycleResults
      });

      return Response.json({
        success: true,
        cycle: cycleResults
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});