class AudioUIFeedback {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
  }

  onStationFocus(stationName) {
    this.audioEngine.playStationFeedback(stationName);
  }

  onStationUnfocus() {
    // Slight descending tone on unfocus
    const now = this.audioEngine.audioContext.currentTime;
    const osc = this.audioEngine.audioContext.createOscillator();
    const gain = this.audioEngine.audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(400, now);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.15);
    
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    
    osc.connect(gain);
    gain.connect(this.audioEngine.masterGain);
    
    osc.start(now);
    osc.stop(now + 0.15);
  }

  onAlert(severity, station) {
    this.audioEngine.playAlertSound(severity, station);
  }

  onSystemReady() {
    // Ascending startup tone
    const now = this.audioEngine.audioContext.currentTime;
    const durations = [0.1, 0.1, 0.15];
    const freqs = [330, 440, 550];
    
    freqs.forEach((freq, idx) => {
      const startTime = now + durations.slice(0, idx).reduce((a, b) => a + b, 0);
      const osc = this.audioEngine.audioContext.createOscillator();
      const gain = this.audioEngine.audioContext.createGain();
      
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.6, startTime);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + durations[idx]);
      
      osc.connect(gain);
      gain.connect(this.audioEngine.masterGain);
      
      osc.start(startTime);
      osc.stop(startTime + durations[idx]);
    });
  }
}

export default AudioUIFeedback;