class BridgeAlertSystem {
  constructor(particleManager, audioEngine, onAlertsChange) {
    this.particleManager = particleManager;
    this.audioEngine = audioEngine;
    this.onAlertsChange = onAlertsChange;
    
    this.alerts = [];
    this.maxVisibleAlerts = 5;
    this.eventMap = {
      'notification.created': { severity: 'info', duration: 4000 },
      'notification.read': { severity: 'info', duration: 3000 },
      'rule.triggered': { severity: 'warning', duration: 5000 },
      'rule.completed': { severity: 'success', duration: 4000 },
      'rule.failed': { severity: 'critical', duration: 6000 },
      'account.verified': { severity: 'success', duration: 4000 },
      'account.failed': { severity: 'critical', duration: 6000 }
    };
  }

  handleAlert(eventData) {
    const eventType = eventData.type || 'notification.created';
    const config = this.eventMap[eventType] || { severity: 'info', duration: 4000 };
    
    const alert = {
      id: Math.random().toString(36).substr(2, 9),
      type: eventType,
      message: eventData.message || this.generateMessage(eventType),
      severity: config.severity,
      duration: config.duration,
      timestamp: Date.now(),
      station: eventData.station || 'log'
    };
    
    this.addAlert(alert);
    this.triggerVisualEffects(alert);
  }

  generateMessage(eventType) {
    const messages = {
      'notification.created': 'New notification received',
      'notification.read': 'Notification marked as read',
      'rule.triggered': 'Rule execution initiated',
      'rule.completed': 'Rule execution completed',
      'rule.failed': 'Rule execution failed',
      'account.verified': 'Account verified successfully',
      'account.failed': 'Account verification failed'
    };
    return messages[eventType] || 'System alert';
  }

  addAlert(alert) {
    this.alerts.push(alert);
    
    // Auto-expire alert
    setTimeout(() => {
      this.dismissAlert(alert.id);
    }, alert.duration);
    
    // Keep only maxVisibleAlerts
    if (this.alerts.length > this.maxVisibleAlerts) {
      this.alerts.shift();
    }
    
    this.onAlertsChange?.(this.alerts);
  }

  dismissAlert(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.onAlertsChange?.(this.alerts);
  }

  triggerVisualEffects(alert) {
    // Determine station position for particle effect
    const stationPositions = {
      tactical: { x: 0, y: 1, z: -2 },
      comms: { x: -3, y: 1.2, z: 0 },
      log: { x: 3, y: 1.3, z: 0 }
    };
    
    const position = stationPositions[alert.station] || stationPositions.log;
    
    // Color based on severity
    const severityColors = {
      critical: 0xff6b6b,
      warning: 0xffd93d,
      success: 0x6bcf7f,
      info: 0x00ccff
    };
    
    const color = severityColors[alert.severity];
    
    // Trigger particle burst
    this.particleManager.triggerAlertBurst(position, color);
    
    // Trigger audio (Phase 3)
    if (this.audioEngine) {
      this.audioEngine.playAlert(alert.severity);
    }
  }

  clearAlerts() {
    this.alerts = [];
    this.onAlertsChange?.(this.alerts);
  }

  getAlerts() {
    return [...this.alerts];
  }

  getStats() {
    return {
      totalAlerts: this.alerts.length,
      criticalCount: this.alerts.filter(a => a.severity === 'critical').length,
      warningCount: this.alerts.filter(a => a.severity === 'warning').length,
      successCount: this.alerts.filter(a => a.severity === 'success').length
    };
  }
}

export default BridgeAlertSystem;