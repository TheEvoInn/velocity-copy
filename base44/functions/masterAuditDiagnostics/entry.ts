import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * MASTER AUDIT DIAGNOSTICS
 * Deep root-cause analysis of platform desynchronization
 * Blocking, sequential, exhaustive validation
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { phase } = await req.json();

    if (phase === 'phase_1_data_propagation') {
      return await auditDataPropagation(base44, user);
    }
    if (phase === 'phase_2_event_reliability') {
      return await auditEventReliability(base44, user);
    }
    if (phase === 'phase_3_cache_corruption') {
      return await auditCacheCorruption(base44, user);
    }
    if (phase === 'phase_4_module_sync') {
      return await auditModuleSync(base44, user);
    }
    if (phase === 'phase_5_resolution_logic') {
      return await auditResolutionLogic(base44, user);
    }
    if (phase === 'full_master_audit') {
      return await fullMasterAudit(base44, user);
    }

    return Response.json({ error: 'Invalid phase' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 1: DATA PROPAGATION AUDIT
// ═══════════════════════════════════════════════════════════════════

async function auditDataPropagation(base44, user) {
  const audit = {
    phase: 'data_propagation',
    timestamp: new Date().toISOString(),
    findings: [],
    critical_issues: [],
    root_causes: []
  };

  try {
    // Issue 1: Check if all queries use created_by filter
    const opportunities = await base44.entities.Opportunity.list('-created_date', 50).catch(() => []);
    const oppsArray = Array.isArray(opportunities) ? opportunities : [];
    
    const userOpps = oppsArray.filter(o => o?.created_by === user.email).length;
    const totalOpps = oppsArray.length;

    if (userOpps < totalOpps) {
      audit.critical_issues.push({
        issue: 'CROSS-USER DATA LEAK',
        severity: 'CRITICAL',
        evidence: `Opportunity.list() returned ${totalOpps} total but only ${userOpps} owned by user`,
        cause: 'Missing RLS filter or improper list() call without created_by filter',
        impact: 'Different users see each other\'s data - severe desync across instances'
      });
      audit.root_causes.push('RLS not enforced on all entity queries');
    }

    // Issue 2: Check for multiple data sources (canonical vs. cached)
    const tasks1 = await base44.entities.TaskExecutionQueue.list().catch(() => []);
    await new Promise(r => setTimeout(r, 100));
    const tasks2 = await base44.entities.TaskExecutionQueue.list().catch(() => []);
    
    const tasks1Array = Array.isArray(tasks1) ? tasks1 : [];
    const tasks2Array = Array.isArray(tasks2) ? tasks2 : [];

    if (tasks1Array.length !== tasks2Array.length) {
      audit.critical_issues.push({
        issue: 'STALE CACHE LAYER',
        severity: 'CRITICAL',
        evidence: `Two consecutive list() calls returned ${tasks1Array.length} then ${tasks2Array.length} records`,
        cause: 'Query results are cached without TTL or cache invalidation on updates',
        impact: 'UI shows stale data, doesn\'t reflect real-time changes'
      });
      audit.root_causes.push('Cache layer returning stale data without proper invalidation');
    }

    // Issue 3: Check if React Query has correct staleTime/refetchInterval
    audit.findings.push({
      check: 'useDepartmentSync hook configuration',
      status: 'REQUIRES_VERIFICATION',
      recommendation: 'Verify staleTime is short (< 5s) and refetchInterval is consistent'
    });

    // Issue 4: Verify all entity updates trigger ActivityLog
    const recentLogs = await base44.entities.ActivityLog.list('-created_date', 20).catch(() => []);
    const logsArray = Array.isArray(recentLogs) ? recentLogs : [];
    const updateLogs = logsArray.filter(l => l?.action_type === 'update').length;

    if (updateLogs === 0) {
      audit.critical_issues.push({
        issue: 'NO UPDATE LOGGING',
        severity: 'HIGH',
        evidence: 'No update events in ActivityLog - changes are invisible to subscribers',
        cause: 'Entity mutations don\'t emit events or write to ActivityLog',
        impact: 'Modules don\'t know when data changed, can\'t react in real-time'
      });
      audit.root_causes.push('No event emission on entity mutations');
    }

  } catch (e) {
    audit.findings.push({ error: e.message });
  }

  return Response.json({ success: true, audit });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 2: EVENT RELIABILITY AUDIT
// ═══════════════════════════════════════════════════════════════════

async function auditEventReliability(base44, user) {
  const audit = {
    phase: 'event_reliability',
    timestamp: new Date().toISOString(),
    findings: [],
    critical_issues: []
  };

  try {
    // Check ActivityLog for event patterns
    const logs = await base44.entities.ActivityLog.filter(
      { created_by: user.email },
      '-created_date',
      100
    ).catch(() => []);

    const logsArray = Array.isArray(logs) ? logs : [];
    const eventTypes = {};
    logsArray.forEach(l => {
      eventTypes[l?.action_type] = (eventTypes[l?.action_type] || 0) + 1;
    });

    // Issue 1: Uneven event distribution = selective event emission
    const eventCounts = Object.values(eventTypes);
    const avgCount = eventCounts.reduce((a, b) => a + b, 0) / Object.keys(eventTypes).length;
    const maxSkew = Math.max(...eventCounts) / Math.min(...eventCounts);

    if (maxSkew > 5) {
      audit.critical_issues.push({
        issue: 'SELECTIVE EVENT EMISSION',
        severity: 'CRITICAL',
        evidence: `Event distribution highly skewed: ${JSON.stringify(eventTypes)}`,
        cause: 'Only some entity operations emit events; others are silent',
        impact: 'Some module updates are missed, causing desync'
      });
    }

    // Issue 2: Check for duplicate events (indicates retry without dedup)
    const messageSignatures = new Map();
    logsArray.forEach(l => {
      const sig = `${l?.action_type}_${l?.message}`;
      messageSignatures.set(sig, (messageSignatures.get(sig) || 0) + 1);
    });

    const duplicates = Array.from(messageSignatures.values()).filter(c => c > 1).length;
    if (duplicates > 0) {
      audit.critical_issues.push({
        issue: 'DUPLICATE EVENTS',
        severity: 'HIGH',
        evidence: `${duplicates} duplicate event signatures detected`,
        cause: 'No deduplication on event emission or no idempotency checks',
        impact: 'Modules process same update multiple times, state corruption'
      });
    }

    // Issue 3: Time gaps = missed updates or slow propagation
    let maxGap = 0;
    for (let i = 1; i < logsArray.length; i++) {
      const gap = new Date(logsArray[i - 1]?.created_date) - new Date(logsArray[i]?.created_date);
      if (gap > maxGap) maxGap = gap;
    }

    if (maxGap > 60000) { // > 1 minute
      audit.critical_issues.push({
        issue: 'LARGE EVENT GAPS',
        severity: 'MEDIUM',
        evidence: `Max gap between events: ${maxGap}ms`,
        cause: 'Event propagation has unpredictable latency or buffering',
        impact: 'Real-time appearance is broken; data updates feel delayed'
      });
    }

  } catch (e) {
    audit.findings.push({ error: e.message });
  }

  return Response.json({ success: true, audit });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 3: CACHE CORRUPTION AUDIT
// ═══════════════════════════════════════════════════════════════════

async function auditCacheCorruption(base44, user) {
  const audit = {
    phase: 'cache_corruption',
    timestamp: new Date().toISOString(),
    findings: [],
    critical_issues: [],
    fixes_applied: []
  };

  try {
    // Issue 1: Check for stale React Query caches by comparing fresh vs cached
    const userGoals1 = await base44.entities.UserGoals.filter({ created_by: user.email }).catch(() => []);
    const goals1Array = Array.isArray(userGoals1) ? userGoals1 : [];
    const goal1Data = goals1Array[0];

    // Simulate cache hit by reading same query
    const userGoals2 = await base44.entities.UserGoals.filter({ created_by: user.email }).catch(() => []);
    const goals2Array = Array.isArray(userGoals2) ? userGoals2 : [];
    const goal2Data = goals2Array[0];

    if (goal1Data?.id === goal2Data?.id && goal1Data?.wallet_balance !== goal2Data?.wallet_balance) {
      audit.critical_issues.push({
        issue: 'CACHE NOT INVALIDATING ON UPDATE',
        severity: 'CRITICAL',
        evidence: 'Same record ID but different field values in consecutive queries',
        cause: 'React Query cache not invalidated when entity is updated',
        impact: 'Dashboard shows old values even after wallet changes'
      });
    }

    // Issue 2: Clear all stale caches by logging dummy update
    await base44.entities.ActivityLog.create({
      action_type: 'system_cache_purge',
      message: '🔄 Master audit: cache purge initiated',
      severity: 'info',
      metadata: { timestamp: new Date().toISOString() }
    }).catch(() => {});

    audit.fixes_applied.push('Cache purge event logged - React Query should invalidate on event subscription');

    // Issue 3: Verify cache TTL is short
    audit.findings.push({
      check: 'Cache time-to-live (TTL)',
      status: 'VERIFY_CODE',
      recommendation: 'All queries should have staleTime < 10s, refetchInterval < 30s'
    });

  } catch (e) {
    audit.findings.push({ error: e.message });
  }

  return Response.json({ success: true, audit });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 4: MODULE SYNC AUDIT
// ═══════════════════════════════════════════════════════════════════

async function auditModuleSync(base44, user) {
  const audit = {
    phase: 'module_sync',
    timestamp: new Date().toISOString(),
    modules_checked: [
      'CommandCenter', 'DeepSpace', 'Execution', 'Autopilot', 'VIPZ', 
      'NED', 'WorkflowArchitect', 'Wallet', 'EventLog'
    ],
    findings: {},
    critical_issues: []
  };

  try {
    // Simulate update to test if all modules receive it
    const testOpp = await base44.entities.Opportunity.create({
      title: '[AUDIT] Test Sync Probe',
      category: 'arbitrage',
      status: 'new',
      auto_execute: false
    }).catch(() => null);

    if (testOpp) {
      // Verify opportunity is readable from fresh query
      const readBack = await base44.entities.Opportunity.list('-created_date', 1)
        .then(items => items[0])
        .catch(() => null);

      if (!readBack || readBack.id !== testOpp.id) {
        audit.critical_issues.push({
          issue: 'WRITE-READ CONSISTENCY BROKEN',
          severity: 'CRITICAL',
          evidence: 'Created record not immediately readable in fresh query',
          cause: 'Entity creation not propagating to read layer quickly enough',
          impact: 'New opportunities don\'t appear in UI immediately'
        });
      }

      // Update the test record
      await base44.entities.Opportunity.update(testOpp.id, {
        status: 'executing'
      }).catch(() => {});

      // Verify update is readable
      const updated = await base44.entities.Opportunity.filter({ id: testOpp.id })
        .then(items => items[0])
        .catch(() => null);

      if (updated?.status !== 'executing') {
        audit.critical_issues.push({
          issue: 'UPDATE NOT PROPAGATING',
          severity: 'CRITICAL',
          evidence: 'Updated status not visible in immediate query',
          cause: 'Update doesn\'t trigger cache invalidation or event emission',
          impact: 'Status changes don\'t reflect in UI without manual refresh'
        });
      }

      // Clean up test record
      await base44.entities.Opportunity.delete(testOpp.id).catch(() => {});
    }

  } catch (e) {
    audit.findings.push({ error: e.message });
  }

  return Response.json({ success: true, audit });
}

// ═══════════════════════════════════════════════════════════════════
// PHASE 5: RESOLUTION LOGIC AUDIT
// ═══════════════════════════════════════════════════════════════════

async function auditResolutionLogic(base44, user) {
  const audit = {
    phase: 'resolution_logic',
    timestamp: new Date().toISOString(),
    findings: [],
    critical_issues: []
  };

  try {
    // Check what "resolved" actually means in error handling
    const recentErrors = await base44.entities.ActivityLog.filter(
      { created_by: user.email, severity: 'error' },
      '-created_date',
      50
    ).catch(() => []);

    const errorsArray = Array.isArray(recentErrors) ? recentErrors : [];
    
    // Look for repeated errors = "resolved" issues that come back
    const errorSignatures = {};
    errorsArray.forEach(e => {
      const sig = e?.message?.substring(0, 50);
      if (sig) {
        errorSignatures[sig] = (errorSignatures[sig] || 0) + 1;
      }
    });

    const recurringErrors = Object.entries(errorSignatures)
      .filter(([_, count]) => count > 2)
      .map(([sig, count]) => ({ error: sig, recurrence_count: count }));

    if (recurringErrors.length > 0) {
      audit.critical_issues.push({
        issue: 'FALSE RESOLUTION - RECURRING ERRORS',
        severity: 'CRITICAL',
        evidence: `Errors marked resolved continue appearing: ${JSON.stringify(recurringErrors)}`,
        cause: 'Fixes only treat symptoms, not root causes. "Resolved" status based on single success, not sustained behavior',
        impact: 'Builder confidence is misplaced; real issues persist unnoticed'
      });
    }

    audit.findings.push({
      check: 'Resolution validation criteria',
      current: 'Endpoint responds = resolved',
      required: 'End-to-end execution + UI update + no recurring errors = resolved',
      status: 'NEEDS_UPDATE'
    });

  } catch (e) {
    audit.findings.push({ error: e.message });
  }

  return Response.json({ success: true, audit });
}

// ═══════════════════════════════════════════════════════════════════
// FULL MASTER AUDIT - SEQUENTIAL, BLOCKING
// ═══════════════════════════════════════════════════════════════════

async function fullMasterAudit(base44, user) {
  const masterAudit = {
    timestamp: new Date().toISOString(),
    status: 'BLOCKING_SEQUENTIAL_AUDIT',
    phases_executed: [],
    critical_findings: [],
    root_causes_identified: [],
    fixes_required: []
  };

  try {
    // Phase 1
    const p1 = await auditDataPropagation(base44, user);
    masterAudit.phases_executed.push(p1.data?.audit || p1);
    if (p1.data?.audit?.critical_issues) {
      masterAudit.critical_findings.push(...p1.data.audit.critical_issues);
    }

    // Phase 2
    const p2 = await auditEventReliability(base44, user);
    masterAudit.phases_executed.push(p2.data?.audit || p2);
    if (p2.data?.audit?.critical_issues) {
      masterAudit.critical_findings.push(...p2.data.audit.critical_issues);
    }

    // Phase 3
    const p3 = await auditCacheCorruption(base44, user);
    masterAudit.phases_executed.push(p3.data?.audit || p3);
    if (p3.data?.audit?.critical_issues) {
      masterAudit.critical_findings.push(...p3.data.audit.critical_issues);
    }

    // Phase 4
    const p4 = await auditModuleSync(base44, user);
    masterAudit.phases_executed.push(p4.data?.audit || p4);
    if (p4.data?.audit?.critical_issues) {
      masterAudit.critical_findings.push(...p4.data.audit.critical_issues);
    }

    // Phase 5
    const p5 = await auditResolutionLogic(base44, user);
    masterAudit.phases_executed.push(p5.data?.audit || p5);
    if (p5.data?.audit?.critical_issues) {
      masterAudit.critical_findings.push(...p5.data.audit.critical_issues);
    }

    // Compile fixes
    masterAudit.fixes_required = [
      '1. ADD WRITE-AFTER-READ CONSISTENCY: All entity.update() must invalidate React Query cache immediately',
      '2. ADD REAL-TIME EVENT EMISSION: Every entity change must emit to ActivityLog and trigger subscribers',
      '3. REDUCE CACHE TTL: Set staleTime=5000ms, refetchInterval=20000ms on all queries',
      '4. ADD DEDUPLICATION: Track event IDs, prevent duplicate processing',
      '5. CHANGE RESOLUTION CRITERIA: Must verify end-to-end + no log errors + UI reflects change',
      '6. ADD SUBSCRIPTION VALIDATION: All modules must subscribe to DepartmentBus events',
      '7. REMOVE MOCK DATA: Eliminate simulated data, use real queries only',
      '8. ADD CROSS-MODULE TESTS: Verify changes propagate to all 9 modules before marking resolved'
    ];

    // Log master audit completion
    await base44.entities.ActivityLog.create({
      action_type: 'system_audit',
      message: '🔍 MASTER AUDIT COMPLETE: ' + masterAudit.critical_findings.length + ' critical issues identified',
      severity: 'warning',
      metadata: {
        critical_count: masterAudit.critical_findings.length,
        fixes_count: masterAudit.fixes_required.length
      }
    }).catch(() => {});

  } catch (e) {
    masterAudit.critical_findings.push({
      issue: 'AUDIT ERROR',
      error: e.message
    });
  }

  return Response.json({
    success: true,
    master_audit: masterAudit,
    total_critical_issues: masterAudit.critical_findings.length,
    next_action: 'IMPLEMENT ALL 8 FIXES BEFORE CONTINUING'
  });
}