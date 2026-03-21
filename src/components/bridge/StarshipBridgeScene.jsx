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
import BridgeSystemRefinements from './BridgeSystemRefinements';
import BridgePerformanceMonitor from './BridgePerformanceMonitor';
import StationInteractionController from './StationInteractionController';
import NotificationDataBinding from './NotificationDataBinding';
import BridgePerformanceTracker from './BridgePerformanceTracker';
import KeyboardControlScheme from './KeyboardControlScheme';
import CockpitEnvironment from './CockpitEnvironment';
import CockpitDataBinding from './CockpitDataBinding';
import HolographicCommsHub from './HolographicCommsHub';

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
  
  const interactionControllerRef = useRef(null);
  const notificationBindingRef = useRef(null);
  const performanceTrackerRef = useRef(null);
  const keyboardSchemeRef = useRef(null);
  const cockpitEnvironmentRef = useRef(null);
  const cockpitDataBindingRef = useRef(null);
  
  const [focusedStation, setFocusedStation] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [particleCount, setParticleCount] = useState(700);
  const [performanceStats, setPerformanceStats] = useState({});
  const [cockpitData, setCockpitData] = useState({});
  
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
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(20, 15, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0x00ffff, 0.8);
    pointLight.position.set(-15, 8, 10);
    scene.add(pointLight);

    const accentLight = new THREE.PointLight(0xff2ec4, 0.6);
    accentLight.position.set(15, 6, -10);
    scene.add(accentLight);

    // Build full cockpit environment
    cockpitEnvironmentRef.current = new CockpitEnvironment(scene);
    cockpitEnvironmentRef.current.buildCockpit();
    cockpitEnvironmentRef.current.buildSpaceEnvironment();

    // Create platform department objects in space
    const departments = [
      { name: 'Autopilot Command', type: 'autopilot', pos: new THREE.Vector3(-30, 20, -50) },
      { name: 'NED Mining', type: 'ned', pos: new THREE.Vector3(35, 15, -45) },
      { name: 'VIPZ Prime', type: 'vipz', pos: new THREE.Vector3(-25, 30, 60) },
      { name: 'Wallet Core', type: 'wallet', pos: new THREE.Vector3(40, 25, 50) },
      { name: 'Identity', type: 'identity', pos: new THREE.Vector3(0, 35, -80) },
      { name: 'Discovery', type: 'discovery', pos: new THREE.Vector3(-45, 10, 40) }
    ];

    departments.forEach(dept => {
      const obj = cockpitEnvironmentRef.current.createDepartmentObject(dept.name, dept.type, dept.pos);
      cockpitDataBindingRef.current = new CockpitDataBinding(scene, povControllerRef.current);
      cockpitDataBindingRef.current.registerDepartmentObject(dept.type, obj);
    });

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
    
    // Start ambient audio loop
    audioEngineRef.current.startAmbientLoop();

    // Create interactive stations
    const stations = createStations(scene);
    
    // Initialize Phase 4 systems
    performanceTrackerRef.current = new BridgePerformanceTracker();
    interactionControllerRef.current = new StationInteractionController(stations, camera, renderer);
    interactionControllerRef.current.setPOVController(povControllerRef.current);
    keyboardSchemeRef.current = new KeyboardControlScheme();
    
    // Setup interaction callbacks
    interactionControllerRef.current.registerCallback('station:focused', (data) => {
      setFocusedStation(data.station);
      povControllerRef.current?.focusStation(data.mesh);
      particleManagerRef.current?.focusStation(data.mesh, data.color);
      stationScreensRef.current?.focusScreen(data.station);
      audioIntegrationRef.current?.focusStation(data.station);
    });
    
    interactionControllerRef.current.registerCallback('station:unfocused', () => {
      setFocusedStation(null);
      povControllerRef.current?.returnToCenter();
      particleManagerRef.current?.unfocusStation();
      stationScreensRef.current?.unfocusScreen();
      audioIntegrationRef.current?.unfocusStation();
    });
    
    // Setup keyboard controls
    keyboardSchemeRef.current.registerCallback('unfocus', () => {
      interactionControllerRef.current.unfocusStation();
    });
    keyboardSchemeRef.current.registerCallback('center', () => {
      interactionControllerRef.current.unfocusStation();
    });
    
    // Initialize notification binding
    notificationBindingRef.current = new NotificationDataBinding((alertEvent) => {
      alertSystemRef.current?.handleAlert(alertEvent);
    });
    notificationBindingRef.current.initialize();

    // Initialize cockpit data binding
    cockpitDataBindingRef.current = new CockpitDataBinding(scene, povControllerRef.current);
    cockpitDataBindingRef.current.initialize().catch(err => console.error('Cockpit binding failed:', err));
    
    // Add screens to stations
    stations.forEach(station => {
      stationScreensRef.current.createStationScreen(
        station.name,
        new THREE.Vector3(station.position.x, station.position.y + 0.8, station.position.z)
      );
    });
    
    // Event handlers delegated to controllers
    const onMouseClick = (event) => {
      if (povControllerRef.current?.isAnimating) return;
      interactionControllerRef.current.handleClick(event);
    };

    const onMouseMove = (event) => {
      interactionControllerRef.current.handleMouseMove(event);
    };

    const onKeyDown = (event) => {
      keyboardSchemeRef.current.handleKeyDown(event);
    };

    const onKeyUp = (event) => {
      keyboardSchemeRef.current.handleKeyUp(event);
    };

    window.addEventListener('click', onMouseClick);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

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

      // Track performance
      performanceTrackerRef.current.recordFrame();
      if (frameCount % 60 === 0) {
        setPerformanceStats(performanceTrackerRef.current.getStats());
      }

      // Update controllers
      povControllerRef.current?.update();
      particleManagerRef.current?.update();
      
      // Update particle count display
      setParticleCount(particleManagerRef.current?.getParticleCount() || 0);

      frameCount++;
      const now = performance.now();
      if (now - fpsTime >= 1000) {
        fps = frameCount;
        frameCount = 0;
        fpsTime = now;
      }

      // Render with post-processing
      postProcessingRef.current?.render();
    };

    animate();

    // Cleanup
    return () => {
      window.removeEventListener('click', onMouseClick);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('resize', onWindowResize);
      
      // Cleanup cockpit systems
      if (cockpitDataBindingRef.current) {
        cockpitDataBindingRef.current.dispose();
      }
      if (cockpitEnvironmentRef.current) {
        cockpitEnvironmentRef.current.dispose();
      }
      
      // Cleanup Phase 4 systems
      if (notificationBindingRef.current) {
        notificationBindingRef.current.dispose();
      }
      
      // Cleanup audio systems
      if (audioIntegrationRef.current) {
        audioIntegrationRef.current.dispose();
      }
      if (audioEngineRef.current) {
        audioEngineRef.current.stopAmbientLoop();
        audioEngineRef.current.dispose();
      }
      
      // Cleanup visual systems
      if (stationScreensRef.current) {
        stationScreensRef.current.dispose();
      }
      if (postProcessingRef.current) {
        postProcessingRef.current.dispose();
      }
      if (povControllerRef.current) {
        povControllerRef.current.dispose?.();
      }
      if (particleManagerRef.current) {
        particleManagerRef.current.dispose?.();
      }
      
      // Cleanup renderer
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
        performanceStats={performanceStats}
      />
      <HolographicCommsHub />
      <BridgeSystemRefinements 
        audioEngine={audioEngineRef.current}
        postProcessing={postProcessingRef.current}
      />
      <BridgePerformanceMonitor 
        audioEngine={audioEngineRef.current}
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