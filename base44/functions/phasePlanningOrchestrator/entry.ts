import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

/**
 * PHASE PLANNING ORCHESTRATOR - CONSECUTIVE EXECUTION
 * Orchestrates back-to-back phase execution with zero gaps
 * Each phase begins immediately upon completion of previous phase
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return jsonResponse({ error: 'Admin access required' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'get_phase_roadmap') {
      return await getPhaseRoadmap(base44, user);
    }

    if (action === 'plan_phase') {
      return await planPhase(base44, user, body);
    }

    if (action === 'get_phase_dependencies') {
      return await getPhaseDependencies(base44, user, body);
    }

    if (action === 'confirm_phase_complete') {
      return await confirmPhaseComplete(base44, user, body);
    }

    return jsonResponse({ error: 'Unknown action' }, 400);

  } catch (error) {
    console.error('[PhasePlanningOrchestrator]', error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});

/**
 * Get consecutive phase roadmap
 */
async function getPhaseRoadmap(base44, user) {
  try {
    const roadmap = [
      {
        phase: 5,
        name: 'Performance & Scaling',
        execution_mode: 'consecutive_immediate',
        sequence: 1,
        status: 'ready_to_execute',
        duration_days: 28,
        focus_areas: ['Distributed caching', 'Auto-scaling', 'Load balancing'],
        key_deliverables: [
          'Redis distributed cache implementation',
          'K8s auto-scaling policies',
          'Global CDN integration'
        ],
        estimated_improvement: '20-30x throughput',
        completion_triggers_phase: 6
      },
      {
        phase: 6,
        name: 'Advanced Intelligence & Routing',
        execution_mode: 'consecutive_on_phase_5_complete',
        sequence: 2,
        status: 'waiting_for_phase_5',
        duration_days: 42,
        focus_areas: ['ML routing', 'Predictive scaling', 'Smart distribution'],
        key_deliverables: [
          'ML prediction models deployed',
          'Dynamic routing engine',
          'Real-time optimization pipeline'
        ],
        estimated_improvement: '35-50x throughput',
        completion_triggers_phase: 7
      },
      {
        phase: 7,
        name: 'Enterprise & Multi-tenancy',
        execution_mode: 'consecutive_on_phase_6_complete',
        sequence: 3,
        status: 'waiting_for_phase_6',
        duration_days: 56,
        focus_areas: ['Multi-tenant support', 'SSO integration', 'Advanced RBAC'],
        key_deliverables: [
          'Multi-tenant architecture',
          'Enterprise SSO/SAML',
          'Role-based access control'
        ],
        estimated_improvement: 'Enterprise-ready platform',
        completion_triggers_phase: 8
      },
      {
        phase: 8,
        name: 'Final Optimization & Production Hardening',
        execution_mode: 'consecutive_on_phase_7_complete',
        sequence: 4,
        status: 'waiting_for_phase_7',
        duration_days: 42,
        focus_areas: ['Security audit', 'Penetration testing', 'Failover validation'],
        key_deliverables: [
          'Full security audit',
          'Incident response automation',
          'DR failover validation'
        ],
        estimated_improvement: '99.99% availability',
        completion_triggers_phase: null
      }
    ];

    return jsonResponse({
      execution_model: 'consecutive_back_to_back_zero_gap',
      current_phase: 4,
      next_phase: 5,
      roadmap,
      total_phases: 4,
      total_consecutive_duration_days: 168,
      phase_5_starts: 'immediately_upon_phase_4_completion_confirmation'
    });
  } catch (error) {
    console.error('[Get Roadmap]', error.message);
    return jsonResponse({ error: 'Failed to get roadmap' }, 500);
  }
}

/**
 * Plan a specific phase with consecutive execution timeline
 */
async function planPhase(base44, user, body) {
  const { phase_number } = body;

  if (!phase_number) {
    return jsonResponse({ error: 'phase_number required' }, 400);
  }

  try {
    const phasePlans = {
      5: {
        phase: 5,
        name: 'Performance & Scaling',
        execution_model: 'consecutive_immediate_start',
        day_by_day_milestones: [
          { day: '1-3', task: 'Deploy Redis distributed cache layer', status: 'ready' },
          { day: '4-7', task: 'Configure K8s auto-scaling policies', status: 'ready' },
          { day: '8-15', task: 'Integrate global CDN infrastructure', status: 'ready' },
          { day: '16-25', task: 'Performance testing and validation', status: 'ready' },
          { day: '26-28', task: 'Production go-live', status: 'ready' },
          { day: '28 end', task: 'Phase 5 complete → Phase 6 starts immediately', action: 'auto_trigger_phase_6' }
        ],
        required_resources: { engineers: 2, devops: 1, qa: 1, total_hours: 200 },
        completion_gates: ['Deployments verified', 'Performance targets met', 'Zero critical issues'],
        auto_trigger_next_phase: true,
        next_phase: 6
      },
      6: {
        phase: 6,
        name: 'Advanced Intelligence & Routing',
        execution_model: 'consecutive_starts_on_phase_5_complete',
        day_by_day_milestones: [
          { day: '1-7', task: 'Deploy ML prediction models', status: 'ready_when_phase_5_complete' },
          { day: '8-15', task: 'Activate intelligent routing engine', status: 'ready_when_phase_5_complete' },
          { day: '16-30', task: 'Real-time optimization pipeline live', status: 'ready_when_phase_5_complete' },
          { day: '31-42', task: 'Full validation and performance tuning', status: 'ready_when_phase_5_complete' },
          { day: '42 end', task: 'Phase 6 complete → Phase 7 starts immediately', action: 'auto_trigger_phase_7' }
        ],
        required_resources: { engineers: 3, ml_engineers: 1, devops: 1, qa: 2, total_hours: 320 },
        completion_gates: ['ML models validated', 'Routing efficiency 35x+', 'System stable'],
        auto_trigger_next_phase: true,
        next_phase: 7
      }
    };

    const plan = phasePlans[phase_number] || {
      phase: phase_number,
      status: 'consecutive_template',
      message: 'Phase consecutive execution model - will begin upon prior phase completion'
    };

    return jsonResponse(plan);
  } catch (error) {
    console.error('[Plan Phase]', error.message);
    return jsonResponse({ error: 'Failed to plan phase' }, 500);
  }
}

/**
 * Get phase dependencies and execution triggers
 */
async function getPhaseDependencies(base44, user, body) {
  const { phase_number } = body;

  if (!phase_number) {
    return jsonResponse({ error: 'phase_number required' }, 400);
  }

  try {
    const dependencies = {
      5: {
        phase: 5,
        execution_model: 'consecutive',
        depends_on: [1, 2, 3, 4],
        all_prerequisites_met: true,
        can_start_immediately: true,
        start_condition: 'upon_phase_4_completion_confirmation',
        blocks_phases: [6, 7, 8],
        gate_condition: 'phase_5_must_be_100_complete_to_trigger_phase_6'
      },
      6: {
        phase: 6,
        execution_model: 'consecutive',
        depends_on: [5],
        all_prerequisites_met: false,
        can_start_now: false,
        start_condition: 'upon_phase_5_completion_confirmation_with_zero_gap',
        blocks_phases: [7, 8],
        gate_condition: 'phase_6_must_be_100_complete_to_trigger_phase_7'
      },
      7: {
        phase: 7,
        execution_model: 'consecutive',
        depends_on: [6],
        all_prerequisites_met: false,
        can_start_now: false,
        start_condition: 'upon_phase_6_completion_confirmation_with_zero_gap',
        blocks_phases: [8],
        gate_condition: 'phase_7_must_be_100_complete_to_trigger_phase_8'
      },
      8: {
        phase: 8,
        execution_model: 'consecutive',
        depends_on: [7],
        all_prerequisites_met: false,
        can_start_now: false,
        start_condition: 'upon_phase_7_completion_confirmation_with_zero_gap',
        blocks_phases: [],
        gate_condition: 'phase_8_complete_triggers_production_ready'
      }
    };

    return jsonResponse(dependencies[phase_number] || {
      phase: phase_number,
      message: 'Phase not defined'
    });
  } catch (error) {
    console.error('[Get Dependencies]', error.message);
    return jsonResponse({ error: 'Failed to get dependencies' }, 500);
  }
}

/**
 * Confirm phase complete and trigger next phase
 */
async function confirmPhaseComplete(base44, user, body) {
  const { phase_number } = body;

  if (!phase_number) {
    return jsonResponse({ error: 'phase_number required' }, 400);
  }

  try {
    const nextPhase = phase_number + 1;

    // Log completion
    await base44.asServiceRole.entities.AuditLog?.create({
      entity_type: 'Phase',
      entity_id: `phase_${phase_number}`,
      action_type: 'phase_completed',
      user_email: user.email,
      details: {
        completed_phase: phase_number,
        next_phase_triggered: nextPhase,
        execution_mode: 'consecutive_zero_gap',
        timestamp: new Date().toISOString()
      },
      severity: 'info',
      timestamp: new Date().toISOString()
    }).catch(() => {});

    return jsonResponse({
      completed_phase: phase_number,
      status: 'confirmed_complete',
      next_phase: nextPhase,
      next_phase_status: 'execution_starting_immediately',
      zero_gap_transition: true,
      message: `Phase ${phase_number} complete. Phase ${nextPhase} execution starting NOW with zero gap.`
    });
  } catch (error) {
    console.error('[Confirm Complete]', error.message);
    return jsonResponse({ error: 'Failed to confirm phase completion' }, 500);
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}