import * as THREE from 'three';

class BridgeParticleManager {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.particleSystems = {};
    this.focusedStationId = null;
    
    this.initializeParticleLayers();
  }

  initializeParticleLayers() {
    // Layer 1: Cosmic dust background
    this.particleSystems.dust = this.createDustLayer(200);
    
    // Layer 2: Energy particles
    this.particleSystems.energy = this.createEnergyLayer(150);
    
    // Layer 3: Station aura (transient)
    this.particleSystems.aura = { particles: [], mesh: null };
    
    // Layer 4: Alert burst (transient)
    this.particleSystems.burst = { particles: [], mesh: null };
  }

  createDustLayer(count) {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 40;
      
      velocities[i * 3] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.01;
    }
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color: 0x00ccff,
      size: 0.05,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.4
    });
    
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    
    return {
      mesh: points,
      positions,
      velocities,
      particles: Array.from({ length: count }, (_, i) => ({ id: i }))
    };
  }

  createEnergyLayer(count) {
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 25;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
    }
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color: 0xff2ec4,
      size: 0.08,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.3
    });
    
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    
    return {
      mesh: points,
      positions,
      particles: Array.from({ length: count }, (_, i) => ({ id: i }))
    };
  }

  focusStation(stationMesh, color = 0x00ccff) {
    this.focusedStationId = stationMesh.uuid;
    this.createStationAura(stationMesh.position, color);
  }

  unfocusStation() {
    this.focusedStationId = null;
    this.clearAura();
  }

  createStationAura(position, color) {
    this.clearAura();
    
    const count = 150;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const radius = Math.random() * 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      positions[i * 3] = position.x + Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = position.y + Math.cos(phi) * radius;
      positions[i * 3 + 2] = position.z + Math.sin(phi) * Math.sin(theta) * radius;
    }
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.1,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6
    });
    
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    
    this.particleSystems.aura = {
      mesh: points,
      positions,
      stationPos: position.clone(),
      particles: Array.from({ length: count }, (_, i) => ({ id: i }))
    };
  }

  clearAura() {
    if (this.particleSystems.aura.mesh) {
      this.scene.remove(this.particleSystems.aura.mesh);
      this.particleSystems.aura.mesh.geometry.dispose();
      this.particleSystems.aura.mesh.material.dispose();
    }
    this.particleSystems.aura = { particles: [], mesh: null };
  }

  triggerAlertBurst(position, color = 0xff6b6b) {
    const count = 100;
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      const vel = (Math.random() + 0.5) * 0.1;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      
      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * vel;
      velocities[i * 3 + 1] = Math.cos(phi) * vel;
      velocities[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * vel;
    }
    
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const mat = new THREE.PointsMaterial({
      color,
      size: 0.15,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.8
    });
    
    const points = new THREE.Points(geom, mat);
    this.scene.add(points);
    
    this.particleSystems.burst = {
      mesh: points,
      positions,
      velocities,
      age: 0,
      lifetime: 2000, // 2 seconds
      particles: Array.from({ length: count }, (_, i) => ({ id: i }))
    };
  }

  update() {
    // Update dust layer
    this.updateLayer(this.particleSystems.dust, true);
    
    // Update energy layer
    this.updateLayer(this.particleSystems.energy, false);
    
    // Update station aura
    if (this.particleSystems.aura.mesh) {
      this.updateAura();
    }
    
    // Update alert burst
    if (this.particleSystems.burst.mesh) {
      this.updateBurst();
    }
  }

  updateLayer(layer, wrap) {
    if (!layer.mesh) return;
    
    const positions = layer.positions;
    const velocities = layer.velocities;
    
    for (let i = 0; i < positions.length; i += 3) {
      if (velocities) {
        positions[i] += velocities[i];
        positions[i + 1] += velocities[i + 1];
        positions[i + 2] += velocities[i + 2];
      }
      
      if (wrap) {
        if (Math.abs(positions[i]) > 20) positions[i] *= -1;
        if (Math.abs(positions[i + 1]) > 15) positions[i + 1] *= -1;
        if (Math.abs(positions[i + 2]) > 20) positions[i + 2] *= -1;
      }
    }
    
    layer.mesh.geometry.attributes.position.needsUpdate = true;
  }

  updateAura() {
    const aura = this.particleSystems.aura;
    if (!aura.mesh) return;
    
    const positions = aura.positions;
    const stationPos = aura.stationPos;
    
    for (let i = 0; i < positions.length; i += 3) {
      const angle = Date.now() * 0.001 + i * 0.1;
      const radius = 2.5 + Math.sin(angle) * 0.5;
      const phi = Math.random() * Math.PI;
      const theta = angle;
      
      positions[i] = stationPos.x + Math.sin(phi) * Math.cos(theta) * radius;
      positions[i + 1] = stationPos.y + Math.cos(phi) * radius;
      positions[i + 2] = stationPos.z + Math.sin(phi) * Math.sin(theta) * radius;
    }
    
    aura.mesh.geometry.attributes.position.needsUpdate = true;
  }

  updateBurst() {
    const burst = this.particleSystems.burst;
    if (!burst.mesh) return;
    
    burst.age += 16; // ~60fps
    const progress = burst.age / burst.lifetime;
    
    if (progress >= 1) {
      this.scene.remove(burst.mesh);
      burst.mesh.geometry.dispose();
      burst.mesh.material.dispose();
      this.particleSystems.burst = { particles: [], mesh: null };
      return;
    }
    
    const positions = burst.positions;
    const velocities = burst.velocities;
    
    for (let i = 0; i < positions.length; i += 3) {
      positions[i] += velocities[i];
      positions[i + 1] += velocities[i + 1];
      positions[i + 2] += velocities[i + 2];
      
      velocities[i] *= 0.98;
      velocities[i + 1] *= 0.98;
      velocities[i + 2] *= 0.98;
    }
    
    burst.mesh.material.opacity = 0.8 * (1 - progress);
    burst.mesh.geometry.attributes.position.needsUpdate = true;
  }

  getParticleCount() {
    let count = 0;
    Object.values(this.particleSystems).forEach(system => {
      if (system.particles) count += system.particles.length;
    });
    return count;
  }
}

export default BridgeParticleManager;