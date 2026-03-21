import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { base44 } from '@/api/base44Client';

export default function StarshipBridgeScene({ onModuleSelect }) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const [platformData, setPlatformData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initializeScene();
    subscribeToData();
  }, []);

  const initializeScene = () => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050714);
    scene.fog = new THREE.FogExp2(0x050714, 0.0008);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(0, 2, 8);
    camera.lookAt(0, 0, 0);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00e8ff, 1, 100);
    pointLight.position.set(5, 5, 5);
    pointLight.castShadow = true;
    scene.add(pointLight);

    const neonLight = new THREE.PointLight(0xff2ec4, 0.8, 80);
    neonLight.position.set(-5, 3, 5);
    scene.add(neonLight);

    // ===== COCKPIT STRUCTURE =====
    const cockpitGroup = new THREE.Group();
    scene.add(cockpitGroup);

    // Floor
    const floorGeometry = new THREE.PlaneGeometry(20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0f2a,
      metalness: 0.8,
      roughness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2;
    cockpitGroup.add(floor);

    // Control panels (left side)
    createControlPanel(cockpitGroup, { x: -6, y: 0, z: 0 }, 'left');
    
    // Control panels (right side)
    createControlPanel(cockpitGroup, { x: 6, y: 0, z: 0 }, 'right');

    // Center console
    createCenterConsole(cockpitGroup);

    // Holographic displays
    createHolographicDisplay(cockpitGroup, { x: -3, y: 2, z: 1 });
    createHolographicDisplay(cockpitGroup, { x: 3, y: 2, z: 1 });

    // ===== SPACE ENVIRONMENT =====
    const spaceGroup = new THREE.Group();
    scene.add(spaceGroup);

    // Starfield
    createStarfield(spaceGroup, 1000);

    // Interactive planets representing departments
    const planets = createDepartmentPlanets(spaceGroup);

    // Asteroids/data clusters
    createAsteroidField(spaceGroup);

    // Space stations (workflows)
    createSpaceStations(spaceGroup);

    // Animation loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate planets
      planets.forEach((planet, idx) => {
        planet.mesh.rotation.y += planet.speed;
      });

      // Pulse neon lights
      const time = Date.now() * 0.001;
      pointLight.intensity = 0.8 + Math.sin(time) * 0.3;
      neonLight.intensity = 0.6 + Math.cos(time * 1.5) * 0.2;

      renderer.render(scene, camera);
    };

    // Handle window resize
    const handleResize = () => {
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Raycasting for click interactions
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      // Check planet intersections
      const planetMeshes = planets.map((p) => p.mesh);
      const intersects = raycaster.intersectObjects(planetMeshes);

      if (intersects.length > 0) {
        const clickedPlanet = planets.find((p) => p.mesh === intersects[0].object);
        if (clickedPlanet && onModuleSelect) {
          onModuleSelect(clickedPlanet.module);
        }
      }
    };

    renderer.domElement.addEventListener('click', handleClick);
    
    const cleanup = () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('click', handleClick);
      if (containerRef.current && renderer.domElement.parentNode === containerRef.current) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };

    // Store refs
    sceneRef.current = scene;
    cameraRef.current = camera;
    rendererRef.current = renderer;

    animate();

    setLoading(false);

    return cleanup;
  };

  const createControlPanel = (parent, position, side) => {
    const panelGeometry = new THREE.BoxGeometry(3, 4, 0.5);
    const panelMaterial = new THREE.MeshStandardMaterial({
      color: side === 'left' ? 0x2a0a2a : 0x0a2a2a,
      metalness: 0.9,
      roughness: 0.2,
      emissive: side === 'left' ? 0x7c3aed : 0x0d9488,
      emissiveIntensity: 0.1,
    });
    const panel = new THREE.Mesh(panelGeometry, panelMaterial);
    panel.position.set(position.x, position.y, position.z);
    parent.add(panel);

    // Add buttons to panel
    for (let i = 0; i < 6; i++) {
      const buttonGeometry = new THREE.SphereGeometry(0.2, 32, 32);
      const buttonMaterial = new THREE.MeshStandardMaterial({
        color: side === 'left' ? 0xb537f2 : 0x0d9488,
        emissive: side === 'left' ? 0xb537f2 : 0x0d9488,
        emissiveIntensity: 0.5,
      });
      const button = new THREE.Mesh(buttonGeometry, buttonMaterial);
      button.position.set(
        position.x - 1.2 + (i % 3) * 1,
        position.y + 1 - Math.floor(i / 3) * 1.5,
        position.z + 0.3
      );
      parent.add(button);
    }
  };

  const createCenterConsole = (parent) => {
    const consoleGeometry = new THREE.BoxGeometry(4, 2, 2);
    const consoleMaterial = new THREE.MeshStandardMaterial({
      color: 0x050714,
      metalness: 0.95,
      roughness: 0.15,
      emissive: 0x00e8ff,
      emissiveIntensity: 0.15,
    });
    const console = new THREE.Mesh(consoleGeometry, consoleMaterial);
    console.position.set(0, 0, -2);
    parent.add(console);

    // Top holographic area
    const screenGeometry = new THREE.PlaneGeometry(3.5, 1.5);
    const screenMaterial = new THREE.MeshStandardMaterial({
      color: 0x00e8ff,
      emissive: 0x00e8ff,
      emissiveIntensity: 0.3,
      metalness: 0.3,
      roughness: 0.5,
    });
    const screen = new THREE.Mesh(screenGeometry, screenMaterial);
    screen.position.set(0, 0.8, -1.95);
    parent.add(screen);
  };

  const createHolographicDisplay = (parent, position) => {
    const displayGeometry = new THREE.PlaneGeometry(2, 3);
    const displayMaterial = new THREE.MeshStandardMaterial({
      color: 0xff2ec4,
      emissive: 0xff2ec4,
      emissiveIntensity: 0.2,
      metalness: 0.2,
      roughness: 0.7,
      transparent: true,
      opacity: 0.7,
    });
    const display = new THREE.Mesh(displayGeometry, displayMaterial);
    display.position.set(position.x, position.y, position.z);
    parent.add(display);

    // Border frame
    const frameGeometry = new THREE.EdgesGeometry(displayGeometry);
    const frameMaterial = new THREE.LineBasicMaterial({
      color: 0x00e8ff,
      linewidth: 2,
    });
    const frame = new THREE.LineSegments(frameGeometry, frameMaterial);
    frame.position.copy(display.position);
    parent.add(frame);
  };

  const createStarfield = (parent, count) => {
    const starsGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 400;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 400;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 400;
    }

    starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));

    const starsMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(starsGeometry, starsMaterial);
    parent.add(stars);
  };

  const createDepartmentPlanets = (parent) => {
    const departments = [
      { name: 'AutoPilot', color: 0x10b981, x: -15, y: 5, z: -20 },
      { name: 'Discovery', color: 0xf59e0b, x: 15, y: 5, z: -20 },
      { name: 'Finance', color: 0x10b981, x: -8, y: -10, z: -30 },
      { name: 'Control', color: 0xa855f7, x: 8, y: -10, z: -30 },
      { name: 'Execution', color: 0x3b82f6, x: 0, y: 15, z: -25 },
    ];

    return departments.map((dept) => {
      const geometry = new THREE.IcosahedronGeometry(2, 4);
      const material = new THREE.MeshStandardMaterial({
        color: dept.color,
        emissive: dept.color,
        emissiveIntensity: 0.3,
        metalness: 0.6,
        roughness: 0.4,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(dept.x, dept.y, dept.z);
      mesh.castShadow = true;
      parent.add(mesh);

      return {
        mesh,
        module: dept.name,
        speed: Math.random() * 0.005 + 0.002,
      };
    });
  };

  const createAsteroidField = (parent) => {
    for (let i = 0; i < 30; i++) {
      const geometry = new THREE.OctahedronGeometry(Math.random() * 0.8 + 0.3);
      const material = new THREE.MeshStandardMaterial({
        color: 0x6b7280,
        metalness: 0.7,
        roughness: 0.5,
      });
      const asteroid = new THREE.Mesh(geometry, material);
      asteroid.position.set(
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100,
        (Math.random() - 0.5) * 100 - 50
      );
      asteroid.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      );
      parent.add(asteroid);
    }
  };

  const createSpaceStations = (parent) => {
    for (let i = 0; i < 5; i++) {
      const geometry = new THREE.CylinderGeometry(1, 1, 3, 8);
      const material = new THREE.MeshStandardMaterial({
        color: 0x00e8ff,
        emissive: 0x00e8ff,
        emissiveIntensity: 0.2,
        metalness: 0.9,
        roughness: 0.1,
      });
      const station = new THREE.Mesh(geometry, material);
      station.position.set(
        (Math.random() - 0.5) * 80,
        (Math.random() - 0.5) * 60,
        (Math.random() - 0.5) * 80 - 40
      );
      parent.add(station);
    }
  };

  const subscribeToData = async () => {
    try {
      const user = await base44.auth.me();
      if (!user) return;

      // Subscribe to real-time data
      const unsubscribe = base44.entities.AITask?.subscribe?.((event) => {
        setPlatformData((prev) => ({
          ...prev,
          lastTaskUpdate: new Date(),
          taskEvent: event,
        }));
      });

      return () => unsubscribe?.();
    } catch (error) {
      console.error('Failed to subscribe to platform data:', error);
    }
  };

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-cyan-400 font-orbitron">INITIALIZING STARSHIP BRIDGE...</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="absolute inset-0 w-full h-full" />;
}