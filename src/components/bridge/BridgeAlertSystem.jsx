class BridgeAlertSystem {
  constructor(particleManager, audioEngine, onHUDUpdate) {
    this.particleManager = particleManager;
    this.audioEngine = audioEngine;
    this.onHUDUpdate = onHUDUpdate;
    this.alerts = [];
    this.alertId = 0;
  }

  handleAlert(event) {
    const alertType = this.mapEventToAlertType(event.type);
    const alert = {
      id: this.alertId++,
      type: alertType.type,
      message: event.message || this.getDefaultMessage(alertType.type),
      severity: alertType.severity,
      timestamp: Date.now(),
      duration: alertType.duration,
      station: event.station || null
    };

    // Queue alert
    this.alerts.push(alert);

    // Trigger effects
    this.triggerVisualEffects(alert, event);
    this.triggerAudio(alert);

    // Update HUD
    this.onHUDUpdate?.(this.getAlerts());

    // Auto-dismiss
    setTimeout(() => {
      this.alerts = this.alerts.filter(a => a.id !== alert.id);
      this.onHUDUpdate?.(this.getAlerts());
    }, alert.duration);
  }

  mapEventToAlertType(eventType) {
    const typeMap = {
      'task_completed': { type: 'success', severity: 'success', duration: 2000 },
      'task_failed': { type: 'warning', severity: 'warning', duration: 3000 },
      'error': { type: 'critical', severity: 'critical', duration: 4000 },
      'critical_error': { type: 'critical', severity: 'critical', duration: 4000 },
      'milestone': { type: 'success', severity: 'success', duration: 4000 },
      'balance_low': { type: 'warning', severity: 'warning', duration: 3000 },
      'opportunity_found': { type: 'info', severity: 'info', duration: 2000 },
      'info': { type: 'info', severity: 'info', duration: 2000 }
    };

    return typeMap[eventType] || { type: 'info', severity: 'info', duration: 2000 };
  }

  getDefaultMessage(alertType) {
    const messages = {
      'success': '✓ Success',
      'warning': '⚠ Warning',
      'critical': '✗ Critical Error',
      'info': 'ℹ Information'
    };
    return messages[alertType] || 'Alert';
  }

  triggerVisualEffects(alert, event) {
    // Default position (center)
    let position = { x: 0, y: 2, z: -2 };

    // Adjust position by station
    if (event.station === 'tactical') {
      position = { x: 0, y: 1, z: -2 };
    } else if (event.station === 'comms') {
      position = { x: -3, y: 1.2, z: 0 };
    } else if (event.station === 'log') {
      position = { x: 3, y: 1.3, z: 0 };
    }

    // Particle count by severity
    const particleCounts = {
      'info': 50,
      'warning': 100,
      'critical': 300,
      'success': 200
    };

    // Colors by severity
    const colors = {
      'info': 0x6699ff,      // Blue
      'warning': 0xffff00,   // Yellow
      'critical': 0xff0000,  // Red
      'success': 0x00ff00    // Green
    };

    const count = particleCounts[alert.severity];
    const color = colors[alert.severity];

    // Trigger burst
    if (this.particleManager) {
      const pos = { x: position.x, y: position.y, z: position.z };
      const lifespan = alert.severity === 'critical' ? 1000 : 800;
      this.particleManager.triggerAlertBurst(pos, color, count, lifespan);
    }
  }

  triggerAudio(alert) {
    const soundMap = {
      'info': 'chime',
      'warning': 'alert',
      'critical': 'alarm',
      'success': 'fanfare'
    };

    const sound = soundMap[alert.severity];
    if (this.audioEngine && sound) {
      this.audioEngine.play(sound);
    }
  }

  getAlerts() {
    return this.alerts.slice(0, 5); // Max 5 visible
  }

  clearAllAlerts() {
    this.alerts = [];
    this.onHUDUpdate?.(this.getAlerts());
  }

  dismissAlert(alertId) {
    this.alerts = this.alerts.filter(a => a.id !== alertId);
    this.onHUDUpdate?.(this.getAlerts());
  }

  getAlertStats() {
    return {
      total: this.alerts.length,
      critical: this.alerts.filter(a => a.severity === 'critical').length,
      warnings: this.alerts.filter(a => a.severity === 'warning').length,
      info: this.alerts.filter(a => a.severity === 'info').length,
      success: this.alerts.filter(a => a.severity === 'success').length
    };
  }
}

export default BridgeAlertSystem;