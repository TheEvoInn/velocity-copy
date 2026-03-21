import { base44 } from '@/api/base44Client';
import { base44 } from '@/api/base44Client';

class NotificationService {
  // Trigger a rule execution notification
  static async notifyRuleTriggered(ruleId, ruleName, opportunityId, opportunityTitle, executionStatus) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'rule_triggered',
        rule_id: ruleId,
        rule_name: ruleName,
        opportunity_id: opportunityId,
        opportunity_title: opportunityTitle,
        execution_status: executionStatus
      });
      return res.data?.notification;
    } catch (error) {
      console.error('Failed to notify rule trigger:', error);
      throw error;
    }
  }

  // Trigger verification required notification
  static async notifyVerificationRequired(accountId, platform, verificationType, requiredSteps) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'verification_required',
        account_id: accountId,
        platform,
        verification_type: verificationType,
        required_steps: requiredSteps
      });
      return res.data?.notification;
    } catch (error) {
      console.error('Failed to notify verification required:', error);
      throw error;
    }
  }

  // Trigger onboarding error notification
  static async notifyOnboardingError(accountId, platform, stepId, errorMessage, errorType, recoveryAction) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'onboarding_error',
        account_id: accountId,
        platform,
        step_id: stepId,
        error_message: errorMessage,
        error_type: errorType,
        recovery_action: recoveryAction
      });
      return res.data?.notification;
    } catch (error) {
      console.error('Failed to notify onboarding error:', error);
      throw error;
    }
  }

  // Create custom notification
  static async createNotification(title, message, type, severity, relatedEntityType, relatedEntityId, actionType, actionData) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'create_notification',
        notification_type: type,
        title,
        message,
        severity,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        action_type: actionType,
        action_data: actionData
      });
      return res.data?.notification;
    } catch (error) {
      console.error('Failed to create notification:', error);
      throw error;
    }
  }

  // Fetch unread notifications
  static async getUnreadNotifications() {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'get_unread'
      });
      return res.data?.notifications || [];
    } catch (error) {
      console.error('Failed to fetch unread notifications:', error);
      return [];
    }
  }

  // Fetch all notifications with filters
  static async getNotifications(filterType, filterSeverity, limit = 100) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'get_notifications',
        filter_type: filterType,
        filter_severity: filterSeverity,
        limit
      });
      return res.data?.notifications || [];
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
      return [];
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'mark_read',
        notification_id: notificationId
      });
      return res.data?.notification;
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
      throw error;
    }
  }

  // Dismiss notification
  static async dismiss(notificationId) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'dismiss',
        notification_id: notificationId
      });
      return res.data?.notification;
    } catch (error) {
      console.error('Failed to dismiss notification:', error);
      throw error;
    }
  }

  // Dismiss all by type
  static async dismissAllByType(notificationType) {
    try {
      const res = await base44.functions.invoke('notificationCenter', {
        action: 'dismiss_all_by_type',
        notification_type: notificationType
      });
      return res.data?.dismissed_count || 0;
    } catch (error) {
      console.error('Failed to dismiss all notifications:', error);
      throw error;
    }
  }
}

// Export individual notification methods for convenience
export const notifyRuleTriggered = NotificationService.notifyRuleTriggered;
export const notifyVerificationRequired = NotificationService.notifyVerificationRequired;
export const notifyOnboardingError = NotificationService.notifyOnboardingError;
export const createNotification = NotificationService.createNotification;
export const getUnreadNotifications = NotificationService.getUnreadNotifications;

// Legacy exports for backward compatibility
export const notifyHighValueOpportunity = async (opportunityId, title, estimatedValue) => {
  return NotificationService.createNotification(
    `High-Value Opportunity: ${title}`,
    `Estimated value: $${estimatedValue}`,
    'opportunity_alert',
    'info',
    'Opportunity',
    opportunityId,
    'review_required',
    { estimated_value: estimatedValue }
  );
};

export const notifyTaskFailure = async (taskId, errorMessage) => {
  return NotificationService.createNotification(
    'Task Execution Failed',
    errorMessage,
    'system_alert',
    'warning',
    'AITask',
    taskId,
    'user_input_required',
    { error: errorMessage }
  );
};

export const notifyAutopilotAction = async (actionType, description) => {
  return NotificationService.createNotification(
    `Autopilot: ${actionType}`,
    description,
    'autopilot_execution',
    'info',
    null,
    null,
    'none',
    { action_type: actionType }
  );
};

export default NotificationService;