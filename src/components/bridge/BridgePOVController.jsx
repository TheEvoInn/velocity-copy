import * as THREE from 'three';

class BridgePOVController {
  constructor(camera, scene, renderer) {
    this.camera = camera;
    this.scene = scene;
    this.renderer = renderer;
    
    this.mode = 'standard';
    this.targetFOV = 75;
    this.currentFOV = 75;
    this.isAnimating = false;
    this.animationStart = 0;
    this.animationDuration = 1200; // ms
    
    // Store initial camera state
    this.initialPosition = new THREE.Vector3(0, 1.6, 3);
    this.initialFOV = 75;
    this.currentPosition = this.initialPosition.clone();
    this.targetPosition = this.initialPosition.clone();
    
    // DOF settings
    this.depthOfField = {
      enabled: false,
      fStop: 0,
      targetFStop: 0
    };
  }

  focusStation(station) {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    this.animationStart = Date.now();
    
    // Calculate target position (45° angle to station screen, offset from center)
    const stationPos = station.position || new THREE.Vector3(0, 1, -2);
    const screenOffset = new THREE.Vector3(0, 0.5, 1.5);
    this.targetPosition = stationPos.clone().add(screenOffset);
    
    this.targetFOV = 35;
    this.depthOfField.targetFStop = 8.0;
  }

  returnToCenter() {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    this.animationStart = Date.now();
    
    this.targetPosition = this.initialPosition.clone();
    this.targetFOV = this.initialFOV;
    this.depthOfField.targetFStop = 0;
  }

  easeInOutCubic(t) {
    return t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  update() {
    if (!this.isAnimating) return;
    
    const elapsed = Date.now() - this.animationStart;
    const progress = Math.min(elapsed / this.animationDuration, 1);
    
    // Apply easing
    const eased = this.easeInOutCubic(progress);
    
    // Interpolate FOV
    this.currentFOV = this.initialFOV + (this.targetFOV - this.initialFOV) * eased;
    this.camera.fov = this.currentFOV;
    this.camera.updateProjectionMatrix();
    
    // Interpolate position
    this.camera.position.lerp(this.targetPosition, eased);
    
    // Look towards center
    this.camera.lookAt(0, 1, -2);
    
    // Update DOF fade in/out
    if (progress < 0.1 && this.depthOfField.targetFStop > 0) {
      // Fading in
      this.depthOfField.fStop = this.depthOfField.targetFStop * (progress / 0.1);
    } else if (progress > 0.9 && this.depthOfField.targetFStop === 0) {
      // Fading out
      this.depthOfField.fStop = 8.0 * ((1 - progress) / 0.1);
    } else {
      this.depthOfField.fStop = this.depthOfField.targetFStop;
    }
    
    if (progress >= 1) {
      this.isAnimating = false;
    }
  }

  setMode(mode) {
    if (['standard', 'fullscreen', 'orbit', 'freelook'].includes(mode)) {
      this.mode = mode;
    }
  }

  getState() {
    return {
      mode: this.mode,
      isAnimating: this.isAnimating,
      currentFOV: this.currentFOV,
      position: this.camera.position.clone(),
      depthOfField: { ...this.depthOfField }
    };
  }
}

export default BridgePOVController;