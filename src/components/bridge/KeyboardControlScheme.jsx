class KeyboardControlScheme {
  constructor() {
    this.keyState = {};
    this.controlMappings = {
      escape: { action: 'unfocus', description: 'Exit focused view' },
      '1': { action: 'focus_tactical', description: 'Focus tactical station' },
      '2': { action: 'focus_comms', description: 'Focus comms station' },
      '3': { action: 'focus_log', description: 'Focus log station' },
      'c': { action: 'center', description: 'Return to center' },
      'h': { action: 'toggle_hud', description: 'Toggle HUD' },
      'm': { action: 'cycle_mode', description: 'Cycle camera mode' },
      'spacebar': { action: 'pause', description: 'Pause/Resume' },
      '+': { action: 'zoom_in', description: 'Zoom in' },
      '-': { action: 'zoom_out', description: 'Zoom out' }
    };
    this.controlCallbacks = {};
  }

  registerCallback(action, callback) {
    if (!this.controlCallbacks[action]) {
      this.controlCallbacks[action] = [];
    }
    this.controlCallbacks[action].push(callback);
  }

  handleKeyDown(event) {
    const key = event.key.toLowerCase();
    this.keyState[key] = true;

    const mapping = this.controlMappings[key];
    if (mapping && this.controlCallbacks[mapping.action]) {
      this.controlCallbacks[mapping.action].forEach(cb => cb());
    }
  }

  handleKeyUp(event) {
    const key = event.key.toLowerCase();
    this.keyState[key] = false;
  }

  isKeyPressed(key) {
    return this.keyState[key.toLowerCase()] || false;
  }

  getControlMappings() {
    return this.controlMappings;
  }
}

export default KeyboardControlScheme;