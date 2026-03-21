import * as THREE from 'three';

class CockpitEnvironment {
  constructor(scene) {
    this.scene = scene;
    this.cockpitMeshes = [];
    this.spaceMeshes = [];
    this.controlPanels = [];
  }

  buildCockpit() {
    // Cockpit floor
    const floorGeom = new THREE.PlaneGeometry(20, 15);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      metalness: 0.7,
      roughness: 0.3
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.cockpitMeshes.push(floor);

    // Cockpit walls
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f1f3f,
      metalness: 0.5,
      roughness: 0.5,
      emissive: 0x0a1a2a,
      emissiveIntensity: 0.3
    });

    // Left wall
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(15, 8), wallMat);
    leftWall.position.set(-10, 4, 0);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.receiveShadow = true;
    this.scene.add(leftWall);
    this.cockpitMeshes.push(leftWall);

    // Right wall
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(15, 8), wallMat);
    rightWall.position.set(10, 4, 0);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.receiveShadow = true;
    this.scene.add(rightWall);
    this.cockpitMeshes.push(rightWall);

    // Forward viewport frame
    const frameGeom = new THREE.BoxGeometry(18, 10, 0.3);
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x0066ff,
      emissiveIntensity: 0.4,
      metalness: 0.9,
      roughness: 0.1
    });
    const frame = new THREE.Mesh(frameGeom, frameMat);
    frame.position.set(0, 5, -8);
    frame.castShadow = true;
    this.scene.add(frame);
    this.cockpitMeshes.push(frame);

    // Viewport glass
    const glassGeom = new THREE.PlaneGeometry(17, 9);
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x001a33,
      transparent: true,
      opacity: 0.1,
      metalness: 0.3,
      roughness: 0.1
    });
    const glass = new THREE.Mesh(glassGeom, glassMat);
    glass.position.set(0, 5, -7.8);
    this.scene.add(glass);
    this.cockpitMeshes.push(glass);

    // Control panel bases
    this.buildControlPanels();

    // Ceiling with energy core
    this.buildEnergyCore();
  }

  buildControlPanels() {
    // Left console
    const leftConsole = new THREE.Group();
    
    const leftBase = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0x1a3a4a,
        metalness: 0.6,
        roughness: 0.4,
        emissive: 0x0a2a3a,
        emissiveIntensity: 0.2
      })
    );
    leftBase.position.set(-8, 1, -4);
    leftBase.castShadow = true;
    leftConsole.add(leftBase);

    // Panel screen area
    const screenMat = new THREE.MeshStandardMaterial({
      color: 0x001a2a,
      emissive: 0x00aa33,
      emissiveIntensity: 0.3,
      metalness: 0.3
    });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.2), screenMat);
    screen.position.set(-8, 1.5, -3.2);
    leftConsole.add(screen);

    leftConsole.userData = { panelType: 'autopilot' };
    this.scene.add(leftConsole);
    this.controlPanels.push(leftConsole);

    // Right console
    const rightConsole = new THREE.Group();
    const rightBase = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 1.5),
      new THREE.MeshStandardMaterial({
        color: 0x3a1a2a,
        metalness: 0.6,
        roughness: 0.4,
        emissive: 0x2a0a1a,
        emissiveIntensity: 0.2
      })
    );
    rightBase.position.set(8, 1, -4);
    rightBase.castShadow = true;
    rightConsole.add(rightBase);

    const rightScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.2), 
      new THREE.MeshStandardMaterial({
        color: 0x2a001a,
        emissive: 0xaa0033,
        emissiveIntensity: 0.3,
        metalness: 0.3
      })
    );
    rightScreen.position.set(8, 1.5, -3.2);
    rightConsole.add(rightScreen);

    rightConsole.userData = { panelType: 'wallet' };
    this.scene.add(rightConsole);
    this.controlPanels.push(rightConsole);

    // Center console
    const centerConsole = new THREE.Group();
    const centerBase = new THREE.Mesh(
      new THREE.BoxGeometry(4, 2, 2),
      new THREE.MeshStandardMaterial({
        color: 0x2a2a1a,
        metalness: 0.6,
        roughness: 0.4,
        emissive: 0x1a1a0a,
        emissiveIntensity: 0.2
      })
    );
    centerBase.position.set(0, 0.8, 0);
    centerBase.castShadow = true;
    centerConsole.add(centerBase);

    const centerScreen = new THREE.Mesh(new THREE.PlaneGeometry(3.5, 1.2),
      new THREE.MeshStandardMaterial({
        color: 0x1a1a00,
        emissive: 0xaaaa00,
        emissiveIntensity: 0.3,
        metalness: 0.3
      })
    );
    centerScreen.position.set(0, 1.3, 1.2);
    centerConsole.add(centerScreen);

    centerConsole.userData = { panelType: 'navigation' };
    this.scene.add(centerConsole);
    this.controlPanels.push(centerConsole);
  }

  buildEnergyCore() {
    const core = new THREE.Group();

    // Core sphere
    const coreGeom = new THREE.SphereGeometry(1.5, 32, 32);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.8,
      metalness: 0.2,
      roughness: 0.1
    });
    const sphere = new THREE.Mesh(coreGeom, coreMat);
    sphere.position.y = 7;
    core.add(sphere);

    // Energy rings
    for (let i = 0; i < 3; i++) {
      const ringGeom = new THREE.TorusGeometry(2 + i * 0.8, 0.2, 16, 100);
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0xff2ec4,
        emissive: 0xff2ec4,
        emissiveIntensity: 0.5
      });
      const ring = new THREE.Mesh(ringGeom, ringMat);
      ring.position.y = 7;
      ring.rotation.x = Math.PI / 2 + (i * 0.3);
      core.add(ring);
    }

    core.userData = { energyCore: true };
    this.scene.add(core);
    this.cockpitMeshes.push(core);

    return core;
  }

  buildSpaceEnvironment() {
    // Far space background
    const spaceGeom = new THREE.SphereGeometry(500, 64, 64);
    const spaceMat = new THREE.MeshBasicMaterial({
      color: 0x000507,
      side: THREE.BackSide
    });
    const spaceSphere = new THREE.Mesh(spaceGeom, spaceMat);
    this.scene.add(spaceSphere);
    this.spaceMeshes.push(spaceSphere);

    // Stars field
    const starsGeom = new THREE.BufferGeometry();
    const starCount = 1000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 1000;
      positions[i + 1] = (Math.random() - 0.5) * 1000;
      positions[i + 2] = (Math.random() - 0.5) * 1000;
    }

    starsGeom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starsMat = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 2,
      sizeAttenuation: true,
      opacity: 0.8,
      transparent: true
    });
    const stars = new THREE.Points(starsGeom, starsMat);
    this.scene.add(stars);
    this.spaceMeshes.push(stars);
  }

  createDepartmentObject(name, type, position) {
    const group = new THREE.Group();
    
    const colors = {
      autopilot: 0x00ff00,
      ned: 0xff6600,
      vipz: 0xff0099,
      wallet: 0xffff00,
      identity: 0x00ffff,
      discovery: 0xff6b6b
    };

    const color = colors[type] || 0x00ccff;

    // Main body
    const bodyGeom = new THREE.SphereGeometry(1.5, 32, 32);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.4,
      metalness: 0.6,
      roughness: 0.2
    });
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    group.add(body);

    // Orbital ring
    const ringGeom = new THREE.TorusGeometry(2.2, 0.15, 16, 100);
    const ringMat = new THREE.MeshStandardMaterial({
      color: color,
      emissive: color,
      emissiveIntensity: 0.3
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.random() * Math.PI;
    group.add(ring);

    group.position.copy(position);
    group.userData = {
      type: 'department',
      department: type,
      name: name,
      interactive: true
    };

    this.scene.add(group);
    this.spaceMeshes.push(group);

    return group;
  }

  getControlPanels() {
    return this.controlPanels;
  }

  dispose() {
    this.cockpitMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
    this.spaceMeshes.forEach(mesh => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
    });
  }
}

export default CockpitEnvironment;