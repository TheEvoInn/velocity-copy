import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import BridgePOVController from './BridgePOVController';
import BridgeParticleManager from './BridgeParticleManager';
import BridgeAlertSystem from './BridgeAlertSystem';
import PostProcessingComposer from './PostProcessingComposer';
import StationScreenRenderer from './StationScreenRenderer';
import { useBridgeAlerts } from '@/hooks/useBridgeAlerts';
import EnhancedBridgeHUD from './EnhancedBridgeHUD.jsx';
import AudioEngine from './AudioEngine';
import AudioUIFeedback from './AudioUIFeedback';
import BridgeAudioIntegration from './BridgeAudioIntegration';

export default function StarshipBridgeScene() {
  const canvasRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const povControllerRef = useRef(null);
  const particleManagerRef = useRef(null);
  const alertSystemRef = useRef(null);
  
  const postProcessingRef = useRef(null);
  const stationScreensRef = useRef(null);
  const audioEngineRef = useRef(null);
  const audioUIFeedbackRef = useRef(null);
  const audioIntegrationRef = useRef(null);
  
  const [focusedStation, setFocusedStation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [particleCount, setParticleCount] = useState(700);
  
  // Subscribe to backend alerts
  useBridgeAlerts((alertEvent) => {
    alertSystemRef.current?.handleAlert(alertEvent);
  });

  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x001a33);
    scene.fog = new THREE.Fog(0x001a33, 30, 100);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 3);
    camera.lookAt(0, 1, -2);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: false
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 7);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x6699ff, 0.5);
    pointLight.position.set(-5, 2, 2);
    scene.add(pointLight);

    // Create bridge environment
    createBridgeEnvironment(scene);

    // Initialize controllers
    povControllerRef.current = new BridgePOVController(camera, scene, renderer);
    particleManagerRef.current = new BridgeParticleManager(scene);
    // Initialize audio first (needed by alert system)
    audioEngineRef.current = new AudioEngine(camera);
    audioUIFeedbackRef.current = new AudioUIFeedback(audioEngineRef.current);
    
    alertSystemRef.current = new BridgeAlertSystem(
      particleManagerRef.current,
      audioEngineRef.current,
      setAlerts
    );
    
    // Initialize post-processing
    postProcessingRef.current = new PostProcessingComposer(renderer, camera, scene);
    
    // Initialize station screens
    stationScreensRef.current = new StationScreenRenderer(scene);
    
    // Initialize bridge audio integration
    audioIntegrationRef.current = new BridgeAudioIntegration(
      audioEngineRef.current,
      audioUIFeedbackRef.current,
      alertSystemRef.current
    );
    audioIntegrationRef.current.systemReady();

    // Create interactive stations
    const stations = createStations(scene);
    
    // Add screens to stations
    stations.forEach(station => {
      stationScreensRef.current.createStationScreen(
        station.name,
        new THREE.Vector3(station.position.x, station.position.y + 0.8, station.position.z)
      );
    });
    
    // Raycaster for click detection
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onMouseClick = (event) => {
      if (povControllerRef.current.isAnimating) return;

      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(stations.map(s => s.mesh));

      if (intersects.length > 0) {
        const clickedMesh = intersects[0].object;
        const station = stations.find(s => s.mesh === clickedMesh);
        
        if (station) {
          setFocusedStation(station.name);
          povControllerRef.current.focusStation(station.mesh);
          particleManagerRef.current.focusStation(station.mesh, station.color);
          stationScreensRef.current.focusScreen(station.name);
          audioIntegrationRef.current.focusStation(station.name);
        }
      } else {
        // Clicked background - return to center
        if (focusedStation) {
          setFocusedStation(null);
          povControllerRef.current.returnToCenter();
          particleManagerRef.current.unfocusStation();
          stationScreensRef.current.unfocusScreen();
          audioIntegrationRef.current.unfocusStation();
        }
      }
    };

    // Keyboard handler
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && focusedStation) {
        setFocusedStation(null);
        povControllerRef.current.returnToCenter();
        particleManagerRef.current.unfocusStation();
        stationScreensRef.current.unfocusScreen();
        audioIntegrationRef.current.unfocusStation();
      }
    };

    window.addEventListener('click', onMouseClick);
    window.addEventListener('keydown', onKeyDown);

    // Handle window resize
    const onWindowResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
      postProcessingRef.current.onWindowResize(width, height);
    };

    window.addEventListener('resize', onWindowResize);

    // Animation loop
    let frameCount = 0;
    let fpsTime = 0;
    let fps = 60;

    const animate = () => {
      requestAnimationFrame(animate);

      // Update controllers
      povControllerRef.current.update();
      particleManagerRef.current.update();
      
      // Update particle count display
      setParticleCount(particleManagerRef.current.getParticleCount());

      // FPS monitoring (rough)
      frameCount++;
      const now = performance.now();
      if (now - fpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        fpsTime = now;
      }

      // Render with post-processing
      postProcessingRef.current.render();
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('click', onMouseClick);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onWindowResize);
      postProcessingRef.current.dispose();
      stationScreensRef.current.dispose();
      audioIntegrationRef.current.dispose();
      renderer.dispose();
    };
  }, [focusedStation]);

  return (
    <div className="relative w-full h-screen">
      <canvas ref={canvasRef} className="w-full h-full" />
      <EnhancedBridgeHUD 
        alerts={alerts}
        focusedStation={focusedStation}
        particleCount={particleCount}
      />
    </div>
  );
}

// Create the bridge environment (floor, walls, glow effects)
function createBridgeEnvironment(scene) {
  // Floor
  const floorGeom = new THREE.PlaneGeometry(30, 30);
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x0a2540,
    roughness: 0.8,
    metalness: 0.2
  });
  const floor = new THREE.Mesh(floorGeom, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  // Nebula background sphere
  const nebulaGeom = new THREE.SphereGeometry(100, 64, 64);
  const nebulaMat = new THREE.MeshBasicMaterial({
    color: 0x1a0033,
    side: THREE.BackSide
  });
  const nebula = new THREE.Mesh(nebulaGeom, nebulaMat);
  scene.add(nebula);

  // Accent light pillars
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    const x = Math.cos(angle) * 8;
    const z = Math.sin(angle) * 8;
    
    const pillarGeom = new THREE.CylinderGeometry(0.3, 0.3, 4, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x00ccff,
      emissive: 0x0066ff,
      emissiveIntensity: 0.5
    });
    const pillar = new THREE.Mesh(pillarGeom, pillarMat);
    pillar.position.set(x, 2, z);
    pillar.castShadow = true;
    scene.add(pillar);
  }
}

// Create interactive station meshes
function createStations(scene) {
  const stations = [
    {
      name: 'tactical',
      position: { x: 0, y: 1, z: -2 },
      color: 0xff6b6b,
      label: 'TAC'
    },
    {
      name: 'comms',
      position: { x: -3, y: 1.2, z: 0 },
      color: 0x6bcf7f,
      label: 'COM'
    },
    {
      name: 'log',
      position: { x: 3, y: 1.3, z: 0 },
      color: 0xffd93d,
      label: 'LOG'
    }
  ];

  return stations.map(station => {
    const geom = new THREE.BoxGeometry(1.5, 1.5, 0.5);
    const mat = new THREE.MeshStandardMaterial({
      color: station.color,
      emissive: station.color,
      emissiveIntensity: 0.3,
      roughness: 0.2,
      metalness: 0.8
    });
    
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.copy(station.position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    return {
      ...station,
      mesh
    };
  });
}