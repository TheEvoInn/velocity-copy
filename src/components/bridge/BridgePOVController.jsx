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

    // Station Inspection mode
    this.inspectionMode = false;
    this.inspectionStation = null;
    this.orbitCenter = new THREE.Vector3();
    this.orbitRadius = 2.5;
    this.orbitHeight = 1.2;
    this.orbitTime = 0;
    this.orbitDuration = 8000; // 8 second full orbit
  }

  focusStation(stationMesh) {
    if (this.isAnimating) return;
    
    this.isAnimating = true;
    this.animationStart = Date.now();
    
    // Calculate target position (45° angle to station screen, offset from center)
    const stationPos = stationMesh.position || new THREE.Vector3(0, 1, -2);
    const screenOffset = new THREE.Vector3(0, 0.5, 1.5);
    this.targetPosition = stationPos.clone().add(screenOffset);
    
    this.targetFOV = 35;
    this.depthOfField.targetFStop = 8.0;
  }

  startInspectionMode(stationMesh) {
    if (this.isAnimating || this.inspectionMode) return;
    
    this.inspectionMode = true;
    this.inspectionStation = stationMesh;
    this.orbitCenter = stationMesh.position.clone();
    this.orbitTime = 0;
    this.targetFOV = 45;
    this.depthOfField.targetFStop = 6.0;
    
    // Initial zoom to station
    this.isAnimating = true;
    this.animationStart = Date.now();
    this.targetPosition = this.orbitCenter.clone().add(new THREE.Vector3(this.orbitRadius, this.orbitHeight, 0));
  }

  exitInspectionMode() {
    if (!this.inspectionMode) return;
    
    this.inspectionMode = false;
    this.inspectionStation = null;
    this.returnToCenter();
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
    // Station Inspection orbit mode
    if (this.inspectionMode && this.inspectionStation) {
      this.orbitTime = (this.orbitTime + 16) % this.orbitDuration;
      const orbitProgress = this.orbitTime / this.orbitDuration;
      const angle = orbitProgress * Math.PI * 2;

      // Circular orbit around station
      const orbitX = Math.cos(angle) * this.orbitRadius;
      const orbitZ = Math.sin(angle) * this.orbitRadius;
      
      this.camera.position.x = this.orbitCenter.x + orbitX;
      this.camera.position.y = this.orbitCenter.y + this.orbitHeight;
      this.camera.position.z = this.orbitCenter.z + orbitZ;

      // Look at station center with slight upward bias for screen visibility
      const lookTarget = this.orbitCenter.clone().add(new THREE.Vector3(0, 0.3, 0));
      this.camera.lookAt(lookTarget);

      this.currentFOV = this.targetFOV;
      this.camera.fov = this.currentFOV;
      this.camera.updateProjectionMatrix();
      this.depthOfField.fStop = this.depthOfField.targetFStop;
      return;
    }

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
      depthOfField: { ...this.depthOfField },
      inspectionMode: this.inspectionMode,
      inspectionStation: this.inspectionStation?.name || null
    };
  }

}

export default BridgePOVController;