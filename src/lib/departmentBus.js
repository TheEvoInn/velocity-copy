/**
 * Inter-Department Event Bus
 * Provides real-time communication between all four departments.
 * Any department can emit events, any department can subscribe.
 */

export const DEPT_EVENTS = {
  OPPORTUNITY_FOUND: 'OPPORTUNITY_FOUND',
  SCAN_STARTED: 'SCAN_STARTED',
  SCAN_COMPLETE: 'SCAN_COMPLETE',
  TASK_QUEUED: 'TASK_QUEUED',
  TASK_STARTED: 'TASK_STARTED',
  TASK_COMPLETED: 'TASK_COMPLETED',
  TASK_FAILED: 'TASK_FAILED',
  TRANSACTION_RECORDED: 'TRANSACTION_RECORDED',
  WALLET_UPDATED: 'WALLET_UPDATED',
  KYC_STATUS_CHANGED: 'KYC_STATUS_CHANGED',
  USER_SETTINGS_CHANGED: 'USER_SETTINGS_CHANGED',
  AUTOPILOT_TOGGLED: 'AUTOPILOT_TOGGLED',
  IDENTITY_SWITCHED: 'IDENTITY_SWITCHED',
};

export const DeptBus = {
  emit: () => {},
  on: () => {},
  off: () => {},
