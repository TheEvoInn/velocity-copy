/**
 * StarshipBridgeScene
 * 
 * 3D first-person starship bridge environment using Three.js
 * - Parallax 3D cockpit background
 * - Interactive workstations with click-to-focus camera animation
 * - Cosmic particle effects
 * - Fixed HUD overlays
 * - Real-time data synchronization
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';

export default function StarshipBridgeScene({
  walletBalance = 0,
  activeIdentities = [],
  recentTasks = [],
  todayEarned = 0,
  onStationFocus = null,
  onOpenSectorMap = null,
}) {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const stationsRef = useRef({});
  const particlesRef = useRef(null);
  const [focusedStation, setFocusedStation] = useState(null);
  const [cameraAnimating, setCameraAnimating] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;

    // ─── Scene Setup ────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050714);
    sceneRef.current = scene;

    // ─── Camera Setup ────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1.6, 3);
    camera.lookAt(0, 1.6, 0);
    cameraRef.current = camera;

    // ─── Renderer Setup ──────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      logarithmicDepthBuffer: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // ─── Lighting ────────────────────────────────────────────────────────
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0x4a5a7a, 0.6);
    scene.add(ambientLight);

    // Cyan accent light
    const cyanLight = new THREE.PointLight(0x00e8ff, 1.5, 30);
    cyanLight.position.set(5, 2, 5);
    scene.add(cyanLight);

    // Magenta accent light
    const magentaLight = new THREE.PointLight(0xff2ec4, 1, 30);
    magentaLight.position.set(-5, 2, 5);
    scene.add(magentaLight);

    // ─── Background Nebula (Skybox substitute) ───────────────────────────
    const nebulaGeom = new THREE.SphereGeometry(100, 32, 32);
    const nebulaMat = new THREE.MeshBasicMaterial({
      color: 0x0a0f2a,
      side: THREE.BackSide,
    });
    const nebulaSphere = new THREE.Mesh(nebulaGeom, nebulaMat);
    scene.add(nebulaSphere);

    // Gradient texture for nebula effect
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(256, 256, 0, 256, 256, 512);
    gradient.addColorStop(0, '#3a1a5f');
    gradient.addColorStop(0.5, '#0a0f2a');
    gradient.addColorStop(1, '#050714');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 512, 512);
    const nebulaTexture = new THREE.CanvasTexture(canvas);
    nebulaMat.map = nebulaTexture;
    nebulaMat.needsUpdate = true;

    // ─── Bridge Platform (floor) ─────────────────────────────────────────
    const floorGeom = new THREE.PlaneGeometry(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      metalness: 0.8,
      roughness: 0.3,
    });
    const floor = new THREE.Mesh(floorGeom, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0;
    floor.receiveShadow = true;
    scene.add(floor);

    // ─── Cosmic Particles ────────────────────────────────────────────────
    const particleCount = 100;
    const particleGeom = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 50;
      particlePositions[i + 1] = Math.random() * 30;
      particlePositions[i + 2] = (Math.random() - 0.5) * 50 - 10;
    }
    particleGeom.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.1,
      color: 0x00e8ff,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.6,
    });
    const particles = new THREE.Points(particleGeom, particleMat);
    scene.add(particles);
    particlesRef.current = particles;

    // ─── Workstation 1: Tactical Holo-Table (Center) ─────────────────────
    const tacticalGeom = new THREE.CylinderGeometry(1, 1, 0.5, 32);
    const tacticalMat = new THREE.MeshStandardMaterial({
      color: 0x1a3a4a,
      metalness: 0.9,
      roughness: 0.1,
      emissive: 0x00e8ff,
      emissiveIntensity: 0.3,
    });
    const tactical = new THREE.Mesh(tacticalGeom, tacticalMat);
    tactical.position.set(0, 1, -2);
    tactical.castShadow = true;
    tactical.receiveShadow = true;
    tactical.userData = {
      name: 'tactical',
      label: 'Tactical Holo-Table',
      data: { balance: walletBalance, earned: todayEarned },
    };
    scene.add(tactical);
    stationsRef.current.tactical = tactical;

    // Screen for tactical
    const tacticalScreenGeom = new THREE.PlaneGeometry(1.5, 1.5);
    const tacticalScreenMat = new THREE.MeshBasicMaterial({ color: 0x00e8ff });
    const tacticalScreen = new THREE.Mesh(tacticalScreenGeom, tacticalScreenMat);
    tacticalScreen.position.set(0, 1.3, -1.9);
    tacticalScreen.scale.z = 0.1;
    scene.add(tacticalScreen);

    // ─── Workstation 2: Comms Array (Left) ──────────────────────────────
    const commsGeom = new THREE.BoxGeometry(1.2, 1.5, 0.5);
    const commsMat = new THREE.MeshStandardMaterial({
      color: 0x2a1a3a,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0xff2ec4,
      emissiveIntensity: 0.2,
    });
    const comms = new THREE.Mesh(commsGeom, commsMat);
    comms.position.set(-3, 1.2, 0);
    comms.castShadow = true;
    comms.receiveShadow = true;
    comms.userData = {
      name: 'comms',
      label: 'Comms Array',
      data: { identities: activeIdentities.length },
    };
    scene.add(comms);
    stationsRef.current.comms = comms;

    // ─── Workstation 3: Log Terminal (Right) ────────────────────────────
    const logGeom = new THREE.BoxGeometry(1.2, 2, 0.5);
    const logMat = new THREE.MeshStandardMaterial({
      color: 0x1a2a3a,
      metalness: 0.7,
      roughness: 0.3,
      emissive: 0xf9d65c,
      emissiveIntensity: 0.15,
    });
    const logTerminal = new THREE.Mesh(logGeom, logMat);
    logTerminal.position.set(3, 1.3, 0);
    logTerminal.castShadow = true;
    logTerminal.receiveShadow = true;
    logTerminal.userData = {
      name: 'log',
      label: 'Log Terminal',
      data: { taskCount: recentTasks.length },
    };
    scene.add(logTerminal);
    stationsRef.current.log = logTerminal;

    // ─── Raycaster for click-to-focus ───────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const onStationClick = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const stations = Object.values(stationsRef.current);
      const intersects = raycaster.intersectObjects(stations);

      if (intersects.length > 0) {
        const clickedStation = intersects[0].object;
        animateCameraToStation(clickedStation);
      }
    };

    // ─── Camera Animation to Station ─────────────────────────────────────
    const animateCameraToStation = (station) => {
      setCameraAnimating(true);
      setFocusedStation(station.userData.name);

      const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      const targetOffset = new THREE.Vector3(0, 0.5, 1.5);
      const targetPos = station.position.clone().add(targetOffset);

      let startTime = Date.now();
      const duration = 800; // 0.8 second animation

      const animateFrame = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Easing function (cubic ease-in-out)
        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        camera.position.x = startPos.x + (targetPos.x - startPos.x) * easeProgress;
        camera.position.y = startPos.y + (targetPos.y - startPos.y) * easeProgress;
        camera.position.z = startPos.z + (targetPos.z - startPos.z) * easeProgress;

        camera.lookAt(station.position.x, station.position.y + 0.5, station.position.z);

        if (progress < 1) {
          requestAnimationFrame(animateFrame);
        } else {
          setCameraAnimating(false);
          if (onStationFocus) onStationFocus(station.userData.name, station.userData.data);
        }
      };

      animateFrame();
    };

    // Return to center
    const returnToCenter = () => {
      setCameraAnimating(true);
      const startPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
      const targetPos = { x: 0, y: 1.6, z: 3 };

      let startTime = Date.now();
      const duration = 800;

      const animateFrame = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeProgress = progress < 0.5
          ? 4 * progress * progress * progress
          : 1 - Math.pow(-2 * progress + 2, 3) / 2;

        camera.position.x = startPos.x + (targetPos.x - startPos.x) * easeProgress;
        camera.position.y = startPos.y + (targetPos.y - startPos.y) * easeProgress;
        camera.position.z = startPos.z + (targetPos.z - startPos.z) * easeProgress;

        camera.lookAt(0, 1.6, 0);

        if (progress < 1) {
          requestAnimationFrame(animateFrame);
        } else {
          setFocusedStation(null);
          setCameraAnimating(false);
        }
      };

      animateFrame();
    };

    // ─── Event Listeners ─────────────────────────────────────────────────
    window.addEventListener('click', onStationClick);
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ─── Animation Loop ──────────────────────────────────────────────────
    const animate = () => {
      requestAnimationFrame(animate);

      // Rotate stations
      stationsRef.current.tactical.rotation.y += 0.003;
      stationsRef.current.comms.rotation.y += 0.002;
      stationsRef.current.log.rotation.y += 0.002;

      // Animate particles
      if (particlesRef.current) {
        particlesRef.current.rotation.x += 0.0001;
        particlesRef.current.rotation.y += 0.0003;
      }

      // Gentle nebula movement
      nebulaSphere.rotation.y += 0.0002;

      renderer.render(scene, camera);
    };

    animate();

    // Store return function for cleanup
    const bridgeControls = { returnToCenter };

    // ─── Cleanup ─────────────────────────────────────────────────────────
    return () => {
      window.removeEventListener('click', onStationClick);
      window.removeEventListener('resize', () => {});
      if (mountRef.current && renderer.domElement.parentNode === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
      tacticalGeom.dispose();
      tacticalMat.dispose();
      commsGeom.dispose();
      commsMat.dispose();
      logGeom.dispose();
      logMat.dispose();
      particleGeom.dispose();
      particleMat.dispose();
      nebulaGeom.dispose();
      nebulaMat.dispose();
      floorGeom.dispose();
      floorMat.dispose();
    };
  }, [walletBalance, activeIdentities, recentTasks, todayEarned, onStationFocus]);

  return (
    <div className="relative w-full h-screen overflow-hidden bg-black">
      {/* 3D Canvas */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Fixed HUD Overlay */}
      <AnimatePresence>
        {!focusedStation ? (
          <motion.div
            key="hud"
            className="fixed inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Top Status Bar */}
            <div className="absolute top-0 left-0 right-0 h-16 glass-nav pointer-events-auto flex items-center justify-between px-6 z-50">
              <div className="flex items-center gap-3">
                <span className="font-orbitron text-xl font-bold text-cyan-300">VELOCITY BRIDGE</span>
                <span className="text-xs text-slate-400">OPERATIONAL</span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <p className="text-cyan-300 font-mono">${walletBalance.toFixed(0)}</p>
                  <p className="text-[10px] text-slate-500">Tactical Balance</p>
                </div>
                <div className="text-right">
                  <p className="text-magenta-300 font-mono">{activeIdentities.length}</p>
                  <p className="text-[10px] text-slate-500">Active Identities</p>
                </div>
                <div className="text-right">
                  <p className="text-amber-300 font-mono">${todayEarned.toFixed(0)}</p>
                  <p className="text-[10px] text-slate-500">Today Earned</p>
                </div>
              </div>
            </div>

            {/* Station Indicators (bottom) */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 pointer-events-auto">
              <motion.button
                onClick={() => { /* focus tactical */ }}
                className="px-4 py-2 rounded-lg glass-card text-xs font-mono text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-500/10 transition-all"
                whileHover={{ scale: 1.05 }}
              >
                [TAC] Holo-Table
              </motion.button>
              <motion.button
                onClick={() => { /* focus comms */ }}
                className="px-4 py-2 rounded-lg glass-card text-xs font-mono text-magenta-300 border border-magenta-500/30 hover:border-magenta-400/60 hover:bg-magenta-500/10 transition-all"
                whileHover={{ scale: 1.05 }}
              >
                [COM] Comms Array
              </motion.button>
              <motion.button
                onClick={() => { /* focus log */ }}
                className="px-4 py-2 rounded-lg glass-card text-xs font-mono text-amber-300 border border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-500/10 transition-all"
                whileHover={{ scale: 1.05 }}
              >
                [LOG] Terminal
              </motion.button>
            </div>

            {/* Crosshair */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
              <div className="w-8 h-8 border-2 border-cyan-400/30 rounded-full" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1 h-1 bg-cyan-400 rounded-full" />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="focused"
            className="fixed inset-0 pointer-events-auto z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setFocusedStation(null);
              }
            }}
          >
            <div className="w-full h-full bg-black/80 backdrop-blur-sm flex items-center justify-center">
              <motion.div
                className="glass-card-bright rounded-2xl p-8 max-w-2xl w-full mx-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
              >
                <button
                  onClick={() => setFocusedStation(null)}
                  className="ml-auto block text-slate-400 hover:text-white mb-4"
                >
                  ✕
                </button>
                <h2 className="font-orbitron text-2xl text-cyan-300 mb-6">
                  {focusedStation === 'tactical' && '⚙️ TACTICAL HOL-TABLE'}
                  {focusedStation === 'comms' && '📡 COMMS ARRAY'}
                  {focusedStation === 'log' && '📋 LOG TERMINAL'}
                </h2>
                <div className="text-slate-300 space-y-3">
                  {focusedStation === 'tactical' && (
                    <>
                      <p><strong>Balance:</strong> ${walletBalance.toFixed(2)}</p>
                      <p><strong>Today Earned:</strong> ${todayEarned.toFixed(2)}</p>
                    </>
                  )}
                  {focusedStation === 'comms' && (
                    <>
                      <p><strong>Active Identities:</strong> {activeIdentities.length}</p>
                      <div className="text-sm text-slate-500 mt-3 space-y-1">
                        {activeIdentities.slice(0, 5).map((id) => (
                          <p key={id.id}>• {id.name}</p>
                        ))}
                      </div>
                    </>
                  )}
                  {focusedStation === 'log' && (
                    <>
                      <p><strong>Recent Tasks:</strong> {recentTasks.length}</p>
                      <div className="text-sm text-slate-500 mt-3 space-y-1">
                        {recentTasks.slice(0, 5).map((task, i) => (
                          <p key={i}>• {task.opportunity_type || 'Task'}</p>
                        ))}
                      </div>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setFocusedStation(null)}
                  className="mt-6 px-4 py-2 btn-cosmic text-white text-sm rounded-lg"
                >
                  Return to Bridge
                </button>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}