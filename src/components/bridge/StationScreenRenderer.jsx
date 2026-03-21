import * as THREE from 'three';

class StationScreenRenderer {
  constructor(scene) {
    this.scene = scene;
    this.screenMeshes = {};
    this.canvases = {};
    this.textures = {};
  }

  createStationScreen(stationName, position, size = { w: 2, h: 1.2 }) {
    // Create canvas for data rendering
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 307;
    const ctx = canvas.getContext('2d');
    
    this.renderScreenContent(ctx, stationName);
    this.canvases[stationName] = canvas;
    
    // Create texture from canvas
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearFilter;
    this.textures[stationName] = texture;
    
    // Create screen mesh
    const geometry = new THREE.PlaneGeometry(size.w, size.h);
    const material = new THREE.MeshStandardMaterial({
      map: texture,
      emissiveMap: texture,
      emissive: 0x00ccff,
      emissiveIntensity: 0.4,
      roughness: 0.3,
      metalness: 0.7
    });
    
    const screen = new THREE.Mesh(geometry, material);
    screen.position.copy(position);
    screen.position.z -= 0.3; // Slight offset in front of station
    screen.castShadow = true;
    screen.receiveShadow = true;
    
    this.scene.add(screen);
    this.screenMeshes[stationName] = { mesh: screen, material, geometry, canvas };
    
    return screen;
  }

  renderScreenContent(ctx, stationName) {
    // Dark background with grid
    ctx.fillStyle = '#001a33';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    
    // Grid pattern
    ctx.strokeStyle = 'rgba(0, 204, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < ctx.canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ctx.canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < ctx.canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(ctx.canvas.width, y);
      ctx.stroke();
    }
    
    // Station-specific content
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`[ ${stationName.toUpperCase()} ]`, 20, 40);
    
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(0, 204, 255, 0.8)';
    
    const data = this.getStationData(stationName);
    let y = 80;
    
    data.forEach(line => {
      ctx.fillText(line, 20, y);
      y += 25;
    });
    
    // Status indicator
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(460, 270, 10, 10);
    ctx.fillStyle = 'rgba(0, 255, 0, 0.5)';
    ctx.fillRect(458, 268, 14, 14);
  }

  getStationData(stationName) {
    const data = {
      tactical: [
        '> THREAT_ASSESSMENT: NOMINAL',
        '> SCAN_RANGE: 50.2 AU',
        '> TARGET_LOCK: DISABLED',
        '> SHIELDS: 94%',
        '> WEAPONS: STANDBY'
      ],
      comms: [
        '> SIGNAL_STRENGTH: 98.5%',
        '> CHANNELS_ACTIVE: 7',
        '> BANDWIDTH: 2.4 TB/s',
        '> ENCRYPTION: AES-256',
        '> UPTIME: 99.97%'
      ],
      log: [
        '> EVENT_LOG_V2.1.4',
        '> LAST_UPDATE: 14:32:18',
        '> BUFFER_SIZE: 892 MB',
        '> SYSTEM_TEMP: 38°C',
        '> MEMORY: 76% USED'
      ]
    };
    
    return data[stationName] || [];
  }

  updateStationScreen(stationName, customData = null) {
    if (!this.canvases[stationName]) return;
    
    const canvas = this.canvases[stationName];
    const ctx = canvas.getContext('2d');
    
    ctx.fillStyle = '#001a33';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Redraw grid
    ctx.strokeStyle = 'rgba(0, 204, 255, 0.2)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    // Title
    ctx.fillStyle = '#00ccff';
    ctx.font = 'bold 24px Arial';
    ctx.fillText(`[ ${stationName.toUpperCase()} ]`, 20, 40);
    
    // Data display
    ctx.font = '14px monospace';
    ctx.fillStyle = 'rgba(0, 204, 255, 0.8)';
    
    const lines = customData || this.getStationData(stationName);
    let y = 80;
    
    lines.forEach(line => {
      ctx.fillText(line, 20, y);
      y += 25;
    });
    
    // Update texture
    this.textures[stationName].needsUpdate = true;
  }

  focusScreen(stationName) {
    Object.values(this.screenMeshes).forEach(screen => {
      screen.material.emissiveIntensity = 0.2;
    });
    
    if (this.screenMeshes[stationName]) {
      this.screenMeshes[stationName].material.emissiveIntensity = 0.6;
    }
  }

  unfocusScreen() {
    Object.values(this.screenMeshes).forEach(screen => {
      screen.material.emissiveIntensity = 0.2;
    });
  }

  dispose() {
    Object.entries(this.screenMeshes).forEach(([name, screen]) => {
      screen.geometry.dispose();
      screen.material.dispose();
      this.textures[name].dispose();
      this.scene.remove(screen.mesh);
    });
    
    this.screenMeshes = {};
    this.textures = {};
    this.canvases = {};
  }
}

export default StationScreenRenderer;