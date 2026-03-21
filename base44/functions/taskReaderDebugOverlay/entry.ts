/**
 * Task Reader Debug Overlay
 * Generates and injects visual debugging layer into analyzed pages
 * Shows form fields, DOM elements, validation rules, and decision paths
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.email) {
      return Response.json({ error: 'User not authenticated' }, { status: 401 });
    }

    const { action, payload } = await req.json();

    // ACTION: Generate debug overlay script
    if (action === 'generate_overlay_script') {
      const { understanding, actions, analysis_id } = payload;

      const overlayScript = generateOverlayInjectionScript(
        understanding,
        actions,
        analysis_id,
        user.email
      );

      return Response.json({
        status: 'success',
        overlay_script: overlayScript,
        ready_for_injection: true
      });
    }

    // ACTION: Inject overlay into page
    if (action === 'inject_overlay') {
      const { url, understanding, actions } = payload;

      // In production, this would use Browserbase to inject overlay
      const injectionPayload = {
        url,
        script: generateOverlayInjectionScript(understanding, actions, 'session', user.email),
        injection_method: 'browserbase',
        auto_activate: true
      };

      return Response.json({
        status: 'success',
        injected: true,
        injection_payload: injectionPayload
      });
    }

    // ACTION: Capture overlay analytics
    if (action === 'capture_overlay_analytics') {
      const { analysis_id, overlay_events } = payload;

      // Log overlay interactions
      await base44.entities.ActivityLog.create({
        action_type: 'system',
        message: `Overlay Debug Session: ${overlay_events.length} interactions recorded`,
        metadata: {
          analysis_id,
          events_count: overlay_events.length,
          elements_highlighted: overlay_events.filter(e => e.type === 'highlight').length,
          validations_triggered: overlay_events.filter(e => e.type === 'validation').length,
          user_actions: overlay_events.filter(e => e.type === 'user_action').length,
          timestamp: new Date().toISOString()
        },
        severity: 'info'
      });

      return Response.json({
        status: 'success',
        analytics_captured: true,
        event_count: overlay_events.length
      });
    }

    // ACTION: Get overlay configuration
    if (action === 'get_overlay_config') {
      const config = {
        colors: {
          form_field: '#10b981',
          form_field_required: '#ef4444',
          validation_pass: '#06b6d4',
          validation_fail: '#f59e0b',
          button: '#8b5cf6',
          hidden_field: '#64748b',
          dependent_field: '#ec4899',
          error_state: '#dc2626'
        },
        opacity: {
          overlay: 0.15,
          highlight: 0.25,
          tooltip: 0.95
        },
        display: {
          show_field_labels: true,
          show_validation_rules: true,
          show_dependencies: true,
          show_action_flow: true,
          show_decision_tree: true,
          auto_hide_delay_ms: 0
        },
        interaction: {
          enable_hover_details: true,
          enable_click_inspection: true,
          enable_keyboard_shortcuts: true
        }
      };

      return Response.json({
        status: 'success',
        config
      });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    console.error('Debug overlay error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

/**
 * Generate the overlay injection script
 * This script will be injected into the analyzed page
 */
function generateOverlayInjectionScript(understanding, actions, analysisId, userEmail) {
  return `
(function() {
  // VELOCITY Task Reader Debug Overlay
  // Injected for page analysis and Autopilot decision monitoring
  
  const OVERLAY_CONFIG = {
    colors: {
      form_field: '#10b981',
      form_field_required: '#ef4444',
      validation_pass: '#06b6d4',
      validation_fail: '#f59e0b',
      button: '#8b5cf6',
      hidden_field: '#64748b',
      dependent_field: '#ec4899',
      error_state: '#dc2626',
      text: '#ffffff',
      bg: 'rgba(5, 7, 20, 0.9)'
    },
    analysisId: '${analysisId}',
    timestamp: new Date().toISOString()
  };

  const formFields = ${JSON.stringify(understanding?.form_fields || [])};
  const actions = ${JSON.stringify(actions || [])};
  const understanding = ${JSON.stringify(understanding || {})};

  // Track all events for analytics
  const overlayEvents = [];

  // Create debug panel
  function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'velocity-debug-panel';
    panel.style.cssText = \`
      position: fixed;
      top: 10px;
      right: 10px;
      z-index: 999999;
      width: 300px;
      max-height: 600px;
      background: \${OVERLAY_CONFIG.colors.bg};
      border: 2px solid #7c3aed;
      border-radius: 8px;
      padding: 12px;
      font-family: monospace;
      font-size: 11px;
      color: \${OVERLAY_CONFIG.colors.text};
      box-shadow: 0 0 20px rgba(124, 58, 237, 0.5);
      overflow-y: auto;
    \`;

    const header = document.createElement('div');
    header.style.cssText = 'font-weight: bold; margin-bottom: 8px; border-bottom: 1px solid #64748b; padding-bottom: 6px;';
    header.textContent = '🔍 VELOCITY Debug';

    const stats = document.createElement('div');
    stats.style.cssText = 'margin-bottom: 8px; font-size: 10px; color: #94a3b8;';
    stats.innerHTML = \`
      <div>Fields: <span style="color: #06b6d4;">\${formFields.length}</span></div>
      <div>Actions: <span style="color: #06b6d4;">\${actions.length}</span></div>
      <div>Confidence: <span style="color: #06b6d4;">\${Math.round(understanding.confidence * 100)}%</span></div>
      <div style="margin-top: 4px; color: #64748b;">Type: \${understanding.page_type || 'generic'}</div>
    \`;

    const legend = document.createElement('div');
    legend.style.cssText = 'margin-bottom: 8px; padding: 8px; background: rgba(0,0,0,0.3); border-radius: 4px;';
    legend.innerHTML = \`
      <div style="margin-bottom: 4px; font-weight: bold; color: #a78bfa;">Legend:</div>
      <div><span style="color: \${OVERLAY_CONFIG.colors.form_field};">■</span> Form Field</div>
      <div><span style="color: \${OVERLAY_CONFIG.colors.form_field_required};">■</span> Required</div>
      <div><span style="color: \${OVERLAY_CONFIG.colors.validation_pass};">■</span> Valid</div>
      <div><span style="color: \${OVERLAY_CONFIG.colors.dependent_field};">■</span> Dependent</div>
      <div><span style="color: \${OVERLAY_CONFIG.colors.button};">■</span> Action</div>
    \`;

    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = '△';
    toggleBtn.style.cssText = \`
      position: absolute;
      top: 4px;
      right: 4px;
      background: #7c3aed;
      border: none;
      color: white;
      width: 24px;
      height: 24px;
      cursor: pointer;
      border-radius: 4px;
      font-weight: bold;
    \`;

    let minimized = false;
    toggleBtn.onclick = () => {
      minimized = !minimized;
      stats.style.display = minimized ? 'none' : 'block';
      legend.style.display = minimized ? 'none' : 'block';
      toggleBtn.textContent = minimized ? '▽' : '△';
    };

    panel.appendChild(toggleBtn);
    panel.appendChild(header);
    panel.appendChild(stats);
    panel.appendChild(legend);

    document.body.appendChild(panel);
    return panel;
  }

  // Highlight form fields
  function highlightFormFields() {
    formFields.forEach((field, idx) => {
      const selector = \`[name="\${field.name}"], [id="\${field.name}"]\`;
      const elements = document.querySelectorAll(selector);

      elements.forEach(el => {
        // Create highlight overlay
        const overlay = document.createElement('div');
        overlay.className = 'velocity-field-highlight';
        overlay.style.cssText = \`
          position: absolute;
          pointer-events: none;
          border: 2px solid \${field.required ? OVERLAY_CONFIG.colors.form_field_required : OVERLAY_CONFIG.colors.form_field};
          background: \${field.required ? OVERLAY_CONFIG.colors.form_field_required : OVERLAY_CONFIG.colors.form_field}22;
          border-radius: 4px;
          box-shadow: 0 0 8px \${field.required ? OVERLAY_CONFIG.colors.form_field_required : OVERLAY_CONFIG.colors.form_field}66;
          z-index: 999998;
        \`;

        // Create label
        const label = document.createElement('div');
        label.style.cssText = \`
          position: absolute;
          top: -20px;
          left: 0;
          background: \${OVERLAY_CONFIG.colors.bg};
          color: \${field.required ? OVERLAY_CONFIG.colors.form_field_required : OVERLAY_CONFIG.colors.form_field};
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          border: 1px solid currentColor;
          white-space: nowrap;
        \`;
        label.textContent = (field.required ? '* ' : '') + field.name;

        // Position and attach
        const rect = el.getBoundingClientRect();
        overlay.style.left = rect.left + window.scrollX + 'px';
        overlay.style.top = rect.top + window.scrollY + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';

        overlay.appendChild(label);
        document.body.appendChild(overlay);

        // Add hover effect
        el.addEventListener('mouseenter', () => {
          overlay.style.opacity = '1';
          overlay.style.boxShadow = \`0 0 16px \${field.required ? OVERLAY_CONFIG.colors.form_field_required : OVERLAY_CONFIG.colors.form_field}88\`;
        });

        el.addEventListener('mouseleave', () => {
          overlay.style.opacity = '0.6';
          overlay.style.boxShadow = \`0 0 8px \${field.required ? OVERLAY_CONFIG.colors.form_field_required : OVERLAY_CONFIG.colors.form_field}66\`;
        });

        // Log event
        overlayEvents.push({
          type: 'highlight',
          field: field.name,
          timestamp: new Date().toISOString(),
          required: field.required
        });
      });
    });
  }

  // Highlight action buttons
  function highlightActionButtons() {
    const submitActions = actions.filter(a => a.type === 'submit' || a.type === 'click');

    submitActions.forEach(action => {
      const selector = action.selector || 'button[type="submit"], [role="button"]';
      const elements = document.querySelectorAll(selector);

      elements.forEach(el => {
        const overlay = document.createElement('div');
        overlay.className = 'velocity-action-highlight';
        overlay.style.cssText = \`
          position: absolute;
          pointer-events: none;
          border: 2px dashed \${OVERLAY_CONFIG.colors.button};
          background: \${OVERLAY_CONFIG.colors.button}22;
          border-radius: 4px;
          box-shadow: 0 0 12px \${OVERLAY_CONFIG.colors.button}66;
          z-index: 999998;
        \`;

        const label = document.createElement('div');
        label.style.cssText = \`
          position: absolute;
          bottom: -20px;
          left: 0;
          background: \${OVERLAY_CONFIG.colors.bg};
          color: \${OVERLAY_CONFIG.colors.button};
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
          border: 1px dashed currentColor;
        \`;
        label.textContent = '→ ' + (action.type || 'submit');

        const rect = el.getBoundingClientRect();
        overlay.style.left = rect.left + window.scrollX + 'px';
        overlay.style.top = rect.top + window.scrollY + 'px';
        overlay.style.width = rect.width + 'px';
        overlay.style.height = rect.height + 'px';

        overlay.appendChild(label);
        document.body.appendChild(overlay);

        overlayEvents.push({
          type: 'action_highlight',
          action: action.type,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  // Show validation rules
  function showValidationRules() {
    formFields.forEach(field => {
      if (field.validation) {
        const selector = \`[name="\${field.name}"]\`;
        const element = document.querySelector(selector);

        if (element) {
          element.addEventListener('change', () => {
            const isValid = validateField(element, field.validation);
            overlayEvents.push({
              type: 'validation',
              field: field.name,
              valid: isValid,
              timestamp: new Date().toISOString()
            });

            // Visual feedback
            const highlight = document.querySelector(\`.velocity-field-highlight\`) || element;
            highlight.style.borderColor = isValid ? OVERLAY_CONFIG.colors.validation_pass : OVERLAY_CONFIG.colors.validation_fail;
          });
        }
      }
    });
  }

  // Validate field
  function validateField(element, rules) {
    const value = element.value;
    if (rules.required && !value) return false;
    if (rules.pattern && !new RegExp(rules.pattern).test(value)) return false;
    if (rules.min && value.length < rules.min) return false;
    if (rules.max && value.length > rules.max) return false;
    return true;
  }

  // Show action flow
  function showActionFlow() {
    let actionCounter = 1;
    const flowOverlay = document.createElement('div');
    flowOverlay.id = 'velocity-action-flow';
    flowOverlay.style.cssText = \`
      position: fixed;
      bottom: 10px;
      left: 10px;
      background: \${OVERLAY_CONFIG.colors.bg};
      border: 2px solid #a78bfa;
      border-radius: 8px;
      padding: 10px;
      z-index: 999997;
      max-width: 400px;
      font-size: 10px;
      color: \${OVERLAY_CONFIG.colors.text};
    \`;

    const title = document.createElement('div');
    title.textContent = '⚡ Action Flow';
    title.style.cssText = 'font-weight: bold; margin-bottom: 6px; color: #a78bfa;';
    flowOverlay.appendChild(title);

    actions.forEach((action, idx) => {
      const actionItem = document.createElement('div');
      actionItem.style.cssText = 'margin: 4px 0; padding: 4px; background: rgba(0,0,0,0.2); border-radius: 3px; border-left: 2px solid #8b5cf6;';
      actionItem.innerHTML = \`<span style="color: #a78bfa;">[\${idx + 1}]</span> \${action.type}: \${action.target || action.selector || 'system'}\`;
      flowOverlay.appendChild(actionItem);
    });

    document.body.appendChild(flowOverlay);
  }

  // Initialize
  window.VELOCITY_DEBUG = {
    events: overlayEvents,
    config: OVERLAY_CONFIG,
    getEvents: () => overlayEvents,
    exportAnalytics: () => ({
      analysisId: OVERLAY_CONFIG.analysisId,
      timestamp: OVERLAY_CONFIG.timestamp,
      events: overlayEvents,
      fieldCount: formFields.length,
      actionCount: actions.length
    })
  };

  // Inject and activate
  window.addEventListener('load', () => {
    createDebugPanel();
    highlightFormFields();
    highlightActionButtons();
    showValidationRules();
    showActionFlow();

    console.log('✓ VELOCITY Debug Overlay Active');
    console.log('Events:', overlayEvents);
  });
})();
  `;
}