class BridgeAudioIntegration {
  constructor(audioEngine, audioUIFeedback, alertSystem) {
    this.audioEngine = audioEngine;
    this.audioUIFeedback = audioUIFeedback;
    this.alertSystem = alertSystem;
    
    this.setupAudioCallbacks();
  }

  setupAudioCallbacks() {
    // Subscribe to alert system events
    if (this.alertSystem) {
      this.originalHandleAlert = this.alertSystem.handleAlert.bind(this.alertSystem);
      
      this.alertSystem.handleAlert = (alertEvent) => {
        // Original alert handling
        this.originalHandleAlert(alertEvent);
        
        // Play audio feedback
        if (alertEvent.severity && alertEvent.station) {
          this.audioUIFeedback.onAlert(alertEvent.severity, alertEvent.station);
        }
      };
    }
  }

  focusStation(stationName) {
    this.audioUIFeedback.onStationFocus(stationName);
  }

  unfocusStation() {
    this.audioUIFeedback.onStationUnfocus();
  }

  systemReady() {
    this.audioUIFeedback.onSystemReady();
    this.audioEngine.startAmbientLoop();
  }

  dispose() {
    this.audioEngine.dispose();
  }
}

export default BridgeAudioIntegration;