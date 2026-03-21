import * as THREE from 'three';

class BridgeParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.layers = {};
    this.auraActive = false;
    this.initLayers();
  }

  initLayers() {
    // Layer 1: Cosmic Dust (200 particles, slow drift)
    const dustGeom = new THREE.BufferGeometry();
    const dustPositions = new Float32Array(200 * 3);
    const dustVelocities = [];
    
    for (let i = 0; i < 200; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 50;
      dustPositions[i * 3 + 1] = Math.random() * 30;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 50 - 10;
      
      dustVelocities.push(
        (Math.random() - 0.5) * 0.05,
        (Math.random() - 0.5) * 0.03,
        (Math.random() - 0.5) * 0.05
      );
    }
    
    dustGeom.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dustMat = new THREE.PointsMaterial({
      size: 0.5,
      color: 0xcccccc,
      opacity: 0.2,
      transparent: true,
      sizeAttenuation: true
    });
    
    this.layers.dust = {
      points: new THREE.Points(dustGeom, dustMat),
      positions: dustPositions,
      velocities: dustVelocities,
      lifespan: Infinity
    };
    this.scene.add(this.layers.dust.points);

    // Layer 2: Energy Particles (500 particles, medium speed)
    const energyGeom = new THREE.BufferGeometry();
    const energyPositions = new Float32Array(500 * 3);
    const energyVelocities = [];
    const energyColors = new Float32Array(500 * 3);
    
    for (let i = 0; i < 500; i++) {
      energyPositions[i * 3] = (Math.random() - 0.5) * 40;
      energyPositions[i * 3 + 1] = Math.random() * 20;
      energyPositions[i * 3 + 2] = (Math.random() - 0.5) * 40 - 5;
      
      energyVelocities.push(
        (Math.random() - 0.5) * 2.0,
        (Math.random() - 0.5) * 1.0,
        (Math.random() - 0.5) * 2.0
      );
      
      // Alternate cyan/magenta
      if (i % 2 === 0) {
        energyColors[i * 3] = 0;
        energyColors[i * 3 + 1] = 0.92;
        energyColors[i * 3 + 2] = 1.0; // cyan
      } else {
        energyColors[i * 3] = 1.0;
        energyColors[i * 3 + 1] = 0;
        energyColors[i * 3 + 2] = 0.77; // magenta
      }
    }
    
    energyGeom.setAttribute('position', new THREE.BufferAttribute(energyPositions, 3));
    energyGeom.setAttribute('color', new THREE.BufferAttribute(energyColors, 3));
    
    const energyMat = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      opacity: 0.8,
      transparent: true,
      sizeAttenuation: true
    });
    
    this.layers.energy = {
      points: new THREE.Points(energyGeom, energyMat),
      positions: energyPositions,
      velocities: energyVelocities,
      lifespan: Infinity
    };
    this.scene.add(this.layers.energy.points);

    // Layer 3: Station Aura (spawned on focus, 50 particles orbiting)
    // Initialized empty, created on demand

    // Layer 4: Alert Burst (spawned on demand)
    // Initialized empty, created on demand
  }

  update() {
    // Update dust
    this.updateLayer('dust');
    
    // Update energy
    this.updateLayer('energy');
    
    // Update aura if active
    if (this.layers.aura && this.auraActive) {
      this.updateAuraOrbit();
    }
    
    // Update and age burst
    if (this.layers.burst) {
      this.updateLayer('burst');
      
      this.layers.burst.age += 16; // ~16ms per frame
      if (this.layers.burst.age > this.layers.burst.lifespan) {
        this.scene.remove(this.layers.burst.points);
        delete this.layers.burst;
      } else {
        // Fade out as it ages
        const fadeStart = this.layers.burst.lifespan * 0.8;
        if (this.layers.burst.age > fadeStart) {
          const fadeProgress = (this.layers.burst.age - fadeStart) / (this.layers.burst.lifespan - fadeStart);
          this.layers.burst.points.material.opacity = 0.8 * (1 - fadeProgress);
        }
      }
    }
  }

  updateLayer(name) {
    const layer = this.layers[name];
    if (!layer) return;
    
    const positions = layer.positions;
    const velocities = layer.velocities;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i];
      positions[i + 1] += velocities[i + 1];
      positions[i + 2] += velocities[i + 2];
    }
    
    layer.points.geometry.attributes.position.needsUpdate = true;
  }

  updateAuraOrbit() {
    if (!this.layers.aura) return;
    
    const positions = this.layers.aura.positions;
    const time = Date.now() / 1000; // seconds
    
    // Create orbiting pattern around station
    for (let i = 0; i < 50; i++) {
      const angle = (i / 50) * Math.PI * 2 + time * 0.5;
      const radius = 2;
      
      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = 1 + Math.sin(angle * 0.5) * 0.5;
      positions[i * 3 + 2] = -2 + Math.sin(angle) * radius;
    }
    
    this.layers.aura.points.geometry.attributes.position.needsUpdate = true;
  }

  focusStation(station, stationColor = 0x00ff00) {
    if (this.auraActive) return;
    
    const auraGeom = new THREE.BufferGeometry();
    const auraPositions = new Float32Array(50 * 3);
    
    // Initialize positions
    for (let i = 0; i < 50; i++) {
      auraPositions[i * 3] = 0;
      auraPositions[i * 3 + 1] = 1;
      auraPositions[i * 3 + 2] = -2;
    }
    
    auraGeom.setAttribute('position', new THREE.BufferAttribute(auraPositions, 3));
    
    const auraMat = new THREE.PointsMaterial({
      size: 0.2,
      color: stationColor,
      opacity: 0.6,
      transparent: true,
      sizeAttenuation: true
    });
    
    this.layers.aura = {
      points: new THREE.Points(auraGeom, auraMat),
      positions: auraPositions,
      lifespan: Infinity
    };
    
    this.scene.add(this.layers.aura.points);
    this.auraActive = true;
  }

  unfocusStation() {
    if (!this.auraActive) return;
    
    // Fade out aura
    if (this.layers.aura) {
      let opacity = this.layers.aura.points.material.opacity;
      const fadeInterval = setInterval(() => {
        opacity -= 0.1;
        if (opacity <= 0) {
          this.scene.remove(this.layers.aura.points);
          delete this.layers.aura;
          this.auraActive = false;
          clearInterval(fadeInterval);
        } else {
          this.layers.aura.points.material.opacity = opacity;
        }
      }, 50);
    }
  }

  triggerAlertBurst(position, color = 0xff0000, count = 100, lifespan = 800) {
    // Remove old burst if exists
    if (this.layers.burst) {
      this.scene.remove(this.layers.burst.points);
    }
    
    const burstGeom = new THREE.BufferGeometry();
    const burstPositions = new Float32Array(count * 3);
    const burstVelocities = [];
    
    // Radial explosion pattern
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const speed = 1 + Math.random() * 4;
      
      burstPositions[i * 3] = position.x + Math.random() * 0.5;
      burstPositions[i * 3 + 1] = position.y + Math.random() * 0.5;
      burstPositions[i * 3 + 2] = position.z + Math.random() * 0.5;
      
      burstVelocities.push(
        Math.sin(phi) * Math.cos(theta) * speed,
        Math.cos(phi) * speed,
        Math.sin(phi) * Math.sin(theta) * speed
      );
    }
    
    burstGeom.setAttribute('position', new THREE.BufferAttribute(burstPositions, 3));
    
    const burstMat = new THREE.PointsMaterial({
      size: 0.3,
      color: color,
      opacity: 0.8,
      transparent: true,
      sizeAttenuation: true
    });
    
    this.layers.burst = {
      points: new THREE.Points(burstGeom, burstMat),
      positions: burstPositions,
      velocities: burstVelocities,
      age: 0,
      lifespan: lifespan
    };
    
    this.scene.add(this.layers.burst.points);
  }

  getParticleCount() {
    let count = 200 + 500; // dust + energy
    if (this.auraActive) count += 50;
    if (this.layers.burst) count += this.layers.burst.positions.length / 3;
    return count;
  }
}

export default BridgeParticleManager;