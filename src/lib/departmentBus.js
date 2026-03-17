/**
 * Inter-Department Event Bus
 * Provides real-time communication between all four departments.
 * Any department can emit events, any department can subscribe.
 */

const listeners = {};

export const DeptBus = {
  emit(event, data) {
    (listeners[event] || []).forEach(fn => fn(data));
    (listeners['*'] || []).forEach(fn => fn({ event, data }));
  },
  on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
  },
  off(event, fn) {
    if (listeners[event]) listeners[event] = listeners[event].filter(f => f !== fn);
  },
};

// Department event constants
export const DEPT_EVENTS = {
  // Discovery → all
  OPPORTUNITY_FOUND:      'discovery:opportunity_found',
  SCAN_STARTED:           'discovery:scan_started',
  SCAN_COMPLETE:          'discovery:scan_complete',

  // Execution → all
  TASK_QUEUED:            'execution:task_queued',
  TASK_STARTED:           'execution:task_started',
  TASK_COMPLETED:         'execution:task_completed',
  TASK_FAILED:            'execution:task_failed',

  // Finance → all
  TRANSACTION_RECORDED:   'finance:transaction_recorded',
  WALLET_UPDATED:         'finance:wallet_updated',
  KYC_STATUS_CHANGED:     'finance:kyc_status_changed',

  // UX/Control → all
  USER_SETTINGS_CHANGED:  'ux:user_settings_changed',
  AUTOPILOT_TOGGLED:      'ux:autopilot_toggled',
  IDENTITY_SWITCHED:      'ux:identity_switched',
};