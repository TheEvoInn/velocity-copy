import { base44 } from '@/api/base44Client';

class NotificationDataBinding {
  // Notification data binding handler
  constructor(alertCallback) {
    this.alertCallback = alertCallback;
    this.subscription = null;
    this.stationMap = {
      'tactical': 0,
      'comms': -3,
      'log': 3
    };
  }

  async initialize() {
    try {
      // Subscribe to real-time notification changes
      this.subscription = base44.entities.Notification.subscribe((event) => {
        if (event.type === 'create' || event.type === 'update') {
          this.processNotification(event.data);
        }
      });
    } catch (error) {
      console.error('Failed to initialize notification binding:', error);
    }
  }

  processNotification(notification) {
    const alertEvent = {
      id: notification.id,
      type: notification.action_type || 'system',
      message: notification.message || 'System event',
      severity: this.mapSeverity(notification.severity),
      station: this.mapStationFromSeverity(notification.severity),
      timestamp: notification.created_date,
      metadata: notification.metadata || {}
    };

    this.alertCallback(alertEvent);
  }

  mapSeverity(severity) {
    const map = {
      'info': 'info',
      'success': 'success',
      'warning': 'warning',
      'critical': 'critical',
      'error': 'critical'
    };
    return map[severity] || 'info';
  }

  mapStationFromSeverity(severity) {
    const map = {
      'critical': 'tactical',
      'warning': 'comms',
      'info': null,
      'success': null
    };
    return map[severity];
  }

  dispose() {
    if (this.subscription) {
      this.subscription();
    }
  }
}

export default NotificationDataBinding;