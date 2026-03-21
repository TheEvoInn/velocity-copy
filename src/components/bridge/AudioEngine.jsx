import * as THREE from 'three';

class AudioEngine {
  constructor(camera) {
    this.camera = camera;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    
    this.audioLoader = new THREE.AudioLoader();
    this.sounds = {};
    this.ambientSounds = [];
    
    // Audio context
    this.audioContext = this.listener.context;
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
    
    // Volume levels
    this.volumeLevels = {
      master: 0.7,
      ambient: 0.3,
      alerts: 0.8,
      ui: 0.6
    };
  }

  createAudio(name, volumeCategory = 'ui', spatial = false) {
    if (spatial) {
      const audio = new THREE.PositionalAudio(this.listener);
      audio.setRefDistance(5);
      audio.setMaxDistance(50);
      audio.setVolume(this.volumeLevels[volumeCategory] || 0.5);
      this.sounds[name] = audio;
      return audio;
    } else {
      const audio = new THREE.Audio(this.listener);
      audio.setVolume(this.volumeLevels[volumeCategory] || 0.5);
      this.sounds[name] = audio;
      return audio;
    }
  }

  loadSound(name, audioData, volumeCategory = 'ui', spatial = false) {
    return new Promise((resolve) => {
      const audio = this.createAudio(name, volumeCategory, spatial);
      audio.setBuffer(audioData);
      resolve(audio);
    });
  }

  playSound(name, loop = false) {
    if (this.sounds[name]) {
      this.sounds[name].loop = loop;
      this.sounds[name].play();
    }
  }

  stopSound(name) {
    if (this.sounds[name]) {
      this.sounds[name].stop();
    }
  }

  setSoundVolume(name, volume) {
    if (this.sounds[name]) {
      this.sounds[name].setVolume(volume);
    }
  }

  createAmbientSynth() {
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(130, now + 4);
    
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.05, now + 4);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + 4);
  }

  startAmbientLoop() {
    // Generate ambient drone every 4 seconds
    this.ambientInterval = setInterval(() => {
      this.createAmbientSynth();
    }, 4000);
  }

  stopAmbientLoop() {
    if (this.ambientInterval) {
      clearInterval(this.ambientInterval);
    }
  }

  playAlertSound(severity = 'warning', station = null) {
    const frequencies = {
      critical: 880,
      warning: 660,
      success: 523.25,
      info: 440
    };
    
    const frequency = frequencies[severity] || 440;
    const duration = severity === 'critical' ? 0.3 : 0.2;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'square';
    osc.frequency.setValueAtTime(frequency, now);
    
    gain.gain.setValueAtTime(this.volumeLevels.alerts, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  playStationFeedback(stationName) {
    const frequencies = {
      tactical: 784,
      comms: 659.25,
      log: 587.33
    };
    
    const frequency = frequencies[stationName] || 440;
    const duration = 0.15;
    
    const now = this.audioContext.currentTime;
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(frequency, now);
    
    gain.gain.setValueAtTime(this.volumeLevels.ui, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gain);
    gain.connect(this.masterGain);
    
    osc.start(now);
    osc.stop(now + duration);
  }

  setMasterVolume(volume) {
    this.volumeLevels.master = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setTargetAtTime(this.volumeLevels.master, this.audioContext.currentTime, 0.1);
  }

  setCategoryVolume(category, volume) {
    if (category in this.volumeLevels) {
      this.volumeLevels[category] = Math.max(0, Math.min(1, volume));
    }
  }

  dispose() {
    this.stopAmbientLoop();
    Object.values(this.sounds).forEach(sound => {
      sound.stop();
    });
  }
}

export default AudioEngine;