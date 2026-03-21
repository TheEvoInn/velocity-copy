import { base44 } from '@/api/base44Client';

/**
 * Centralized notification service for autopilot actions, opportunities, and errors
 * Creates Notification records that feed into the NotificationBell and dedicated dashboard
 */

const NOTIFICATION_TYPES = {
  AUTOPILOT_ACTION: 'autopilot_action',
  HIGH_VALUE_OPPORTUNITY: 'high_value_opportunity',
  TASK_FAILURE: 'task_failure',
  KYC_REQUIRED: 'kyc_required',
  LOW_BALANCE: 'low_balance',
  MILESTONE_REACHED: 'milestone_reached',
  SYSTEM_ALERT: 'system_alert',
};

const SEVERITY_LEVELS = {
  INFO: 'info',
  WARNING: 'warning',
  URGENT: 'urgent',
  CRITICAL: 'critical',
};

/**
 * Create and store a notification
 */
export async function createNotification({
  type,
  severity = SEVERITY_LEVELS.INFO,
  title,
  message,
  icon,
  relatedEntityType,
  relatedEntityId,
  actionType = 'none',
  actionData = null,
  deliveryChannels = ['in_app'],
}) {
  try {
    const notification = await base44.entities.Notification.create({
      type,
      severity,
      title,
      message,
      icon,
      related_entity_type: relatedEntityType,
      related_entity_id: relatedEntityId,
      action_type: actionType,
      action_data: actionData,
      delivery_channels: deliveryChannels,
      is_read: false,
      is_dismissed: false,
      source_module: 'autopilot',
      priority_index: getPriorityIndex(severity),
    });

    // Send browser notification if in_app is selected
    if (deliveryChannels.includes('in_app') && Notification.permission === 'granted') {
      sendBrowserNotification(title, message, icon);
    }

    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}

/**
 * Notify when autopilot performs a critical action
 */
export async function notifyAutopilotAction({
  actionName,
  actionDetails,
  templatesApplied,
  tasksCreated,
  opportunitiesProcessed,
}) {
  return createNotification({
    type: NOTIFICATION_TYPES.AUTOPILOT_ACTION,
    severity: SEVERITY_LEVELS.INFO,
    title: `⚙️ Autopilot: ${actionName}`,
    message: `${tasksCreated || 0} tasks queued, ${opportunitiesProcessed || 0} opportunities processed${
      templatesApplied ? ` using "${templatesApplied}" template` : ''
    }. ${actionDetails || ''}`,
    icon: '⚙️',
    deliveryChannels: ['in_app'],
  });
}

/**
 * Notify when a high-value opportunity is identified
 */
export async function notifyHighValueOpportunity({
  opportunityId,
  title,
  platform,
  estimatedValue,
  category,
  timeUntilDeadline,
}) {
  return createNotification({
    type: NOTIFICATION_TYPES.HIGH_VALUE_OPPORTUNITY,
    severity: estimatedValue > 500 ? SEVERITY_LEVELS.URGENT : SEVERITY_LEVELS.WARNING,
    title: `🎯 High-Value Opportunity: $${estimatedValue}`,
    message: `"${title}" on ${platform} (${category}) ${
      timeUntilDeadline ? `expires in ${timeUntilDeadline}` : 'expires soon'
    }`,
    icon: '🎯',
    relatedEntityType: 'Opportunity',
    relatedEntityId: opportunityId,
    actionType: 'review_required',
    deliveryChannels: ['in_app'],
  });
}

/**
 * Notify when a task fails and requires manual intervention
 */
export async function notifyTaskFailure({
  taskId,
  platform,
  opportunityTitle,
  errorType,
  errorMessage,
  isRetryable,
}) {
  const severity =
    errorType === 'captcha' || errorType === 'authentication'
      ? SEVERITY_LEVELS.URGENT
      : SEVERITY_LEVELS.WARNING;

  return createNotification({
    type: NOTIFICATION_TYPES.TASK_FAILURE,
    severity,
    title: `⚠️ Task Failed: ${platform}`,
    message: `"${opportunityTitle}" failed due to ${errorType}. ${
      isRetryable ? 'Will retry automatically.' : 'Manual intervention required.'
    } ${errorMessage ? `Details: ${errorMessage}` : ''}`,
    icon: '⚠️',
    relatedEntityType: 'TaskExecutionQueue',
    relatedEntityId: taskId,
    actionType: isRetryable ? 'none' : 'review_required',
    actionData: { errorType, isRetryable },
    deliveryChannels: ['in_app'],
  });
}

/**
 * Notify when KYC is required for a high-value opportunity
 */
export async function notifyKYCRequired({
  opportunityId,
  opportunityTitle,
  kycTier,
  estimatedValue,
}) {
  return createNotification({
    type: NOTIFICATION_TYPES.KYC_REQUIRED,
    severity: SEVERITY_LEVELS.URGENT,
    title: `🔐 KYC Required for Opportunity`,
    message: `"${opportunityTitle}" requires ${kycTier} KYC verification. Estimated value: $${estimatedValue}. Complete KYC to unlock.`,
    icon: '🔐',
    relatedEntityType: 'Opportunity',
    relatedEntityId: opportunityId,
    actionType: 'document_upload_required',
    deliveryChannels: ['in_app'],
  });
}

/**
 * Notify when wallet balance falls below threshold
 */
export async function notifyLowBalance({
  currentBalance,
  threshold,
  recommendation,
}) {
  return createNotification({
    type: NOTIFICATION_TYPES.LOW_BALANCE,
    severity: SEVERITY_LEVELS.WARNING,
    title: '💰 Low Wallet Balance',
    message: `Your wallet has $${currentBalance.toFixed(2)} remaining (below $${threshold} threshold). ${
      recommendation || 'Consider reducing max spend limits or adding funds.'
    }`,
    icon: '💰',
    actionType: 'none',
    deliveryChannels: ['in_app'],
  });
}

/**
 * Notify when user reaches an earnings milestone
 */
export async function notifyMilestoneReached({
  milestoneType,
  milestone,
  totalEarned,
  unlockedFeatures,
}) {
  const titles = {
    daily: `Daily Goal Reached: $${milestone}`,
    weekly: `Weekly Goal Reached: $${milestone}`,
    total: `Milestone Unlocked: $${milestone} Total Earned!`,
  };

  return createNotification({
    type: NOTIFICATION_TYPES.MILESTONE_REACHED,
    severity: SEVERITY_LEVELS.INFO,
    title: `🏆 ${titles[milestoneType] || 'Milestone Reached'}`,
    message: `Congratulations! You've earned $${totalEarned.toFixed(2)} total. ${
      unlockedFeatures ? `New features unlocked: ${unlockedFeatures.join(', ')}` : ''
    }`,
    icon: '🏆',
    deliveryChannels: ['in_app'],
  });
}

/**
 * Notify of system-level alerts (e.g., platform maintenance, API errors)
 */
export async function notifySystemAlert({
  alertTitle,
  alertMessage,
  affectedServices,
  estimatedResolution,
}) {
  return createNotification({
    type: NOTIFICATION_TYPES.SYSTEM_ALERT,
    severity: SEVERITY_LEVELS.CRITICAL,
    title: `🔧 System Alert: ${alertTitle}`,
    message: `${alertMessage} Affected: ${
      Array.isArray(affectedServices) ? affectedServices.join(', ') : affectedServices
    }. ${estimatedResolution ? `ETA: ${estimatedResolution}` : ''}`,
    icon: '🔧',
    deliveryChannels: ['in_app'],
  });
}

/**
 * Helper: Get priority index based on severity
 */
function getPriorityIndex(severity) {
  const priorities = {
    [SEVERITY_LEVELS.CRITICAL]: 100,
    [SEVERITY_LEVELS.URGENT]: 80,
    [SEVERITY_LEVELS.WARNING]: 50,
    [SEVERITY_LEVELS.INFO]: 10,
  };
  return priorities[severity] || 10;
}

/**
 * Helper: Send browser notification
 */
function sendBrowserNotification(title, message, icon = '💰') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    new Notification(title, {
      body: message,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: `profit-engine-${Date.now()}`,
    });
  } catch (e) {
    console.error('Failed to send browser notification:', e);
  }
}

export { NOTIFICATION_TYPES, SEVERITY_LEVELS };