import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, MapPin, Zap, Radio } from 'lucide-react';

export default function SectorMapView({ onClose, activeIdentities, walletBalance, taskCount }) {
  const navigate = useNavigate();
  const containerRef = useRef(null);
  const [selectedSector, setSelectedSector] = useState(null);
  const [hoveredSector, setHoveredSector] = useState(null);

  // Sector definitions with navigation paths
  const SECTORS = [
    {
      id: 'discovery',
      name: 'Discovery Sector',
      path: '/Discovery',
      position: [-4, 2, -3],
      color: '#f59e0b',
      glow: 'rgba(245,158,11,0.5)',
      icon: '🔭',
      description: 'Scan & Analyze',
      missions: ['Opportunity Scanning', 'Market Analysis', 'Trend Detection'],
      coordinates: 'X: -4.2, Y: 2.0, Z: -3.5',
    },
    {
      id: 'execution',
      name: 'Execution Sector',
      path: '/Execution',
      position: [4, 2, -3],
      color: '#3b82f6',
      glow: 'rgba(59,130,246,0.5)',
      icon: '⚡',
      description: 'Tasks & Automation',
      missions: ['Task Queue', 'Workflow Execution', 'Autopilot Control'],
      coordinates: 'X: 4.2, Y: 2.0, Z: -3.5',
    },
    {
      id: 'finance',
      name: 'Finance Sector',
      path: '/Finance',
      position: [-3, -2, 2],
      color: '#10b981',
      glow: 'rgba(16,185,129,0.5)',
      icon: '💰',
      description: 'Wallets & Earnings',
      missions: ['Balance Monitoring', 'Transaction History', 'Withdrawal'],
      coordinates: 'X: -3.0, Y: -2.0, Z: 2.5',
    },
    {
      id: 'control',
      name: 'Control Sector',
      path: '/Control',
      position: [3, -2, 2],
      color: '#a855f7',
      glow: 'rgba(168,85,247,0.5)',
      icon: '⚙️',
      description: 'Settings & Access',
      missions: ['Configuration', 'Security', 'Permissions'],
      coordinates: 'X: 3.0, Y: -2.0, Z: 2.5',
    },
    {
      id: 'crypto',
      name: 'Crypto Sector',
      path: '/CryptoAutomation',
      position: [0, 1, -5],
      color: '#06b6d4',
      glow: 'rgba(6,182,212,0.5)',
      icon: '🚀',
      description: 'Yield & Mining',
      missions: ['Staking', 'Mining Ops', 'Arbitrage'],
      coordinates: 'X: 0.0, Y: 1.0, Z: -5.0',
    },
    {
      id: 'commerce',
      name: 'Commerce Sector',
      path: '/DigitalCommerce',
      position: [0, -1, 4],
      color: '#ec4899',
      glow: 'rgba(236,72,153,0.5)',
      icon: '🛍️',
      description: 'Digital Storefronts',
      missions: ['Store Management', 'Product Listing', 'Sales Tracking'],
      coordinates: 'X: 0.0, Y: -1.0, Z: 4.0',
    },
  ];

  // Initialize Three.js scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x050714, 0.9);
    containerRef.current.appendChild(renderer.domElement);

    camera.position.set(0, 0, 8);
    camera.lookAt(0, 0, 0);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x4a5a7a, 0.5);
    scene.add(ambientLight);

    const cyanLight = new THREE.PointLight(0x00e8ff, 1.2, 40);
    cyanLight.position.set(5, 5, 5);
    scene.add(cyanLight);

    const magentaLight = new THREE.PointLight(0xff2ec4, 0.8, 40);
    magentaLight.position.set(-5, -5, 5);
    scene.add(magentaLight);

    // Central sun/core
    const coreGeometry = new THREE.SphereGeometry(0.8, 32, 32);
    const coreMaterial = new THREE.MeshBasicMaterial({ color: 0xffd700 });
    const core = new THREE.Mesh(coreGeometry, coreMaterial);
    core.position.set(0, 0, 0);
    scene.add(core);

    // Glow for core
    const glowGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffd700,
      transparent: true,
      opacity: 0.2,
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.set(0, 0, 0);
    scene.add(glow);

    // Create sector markers
    const sectorMeshes = [];
    SECTORS.forEach((sector) => {
      const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
      const material = new THREE.MeshStandardMaterial({
        color: sector.color,
        emissive: sector.color,
        emissiveIntensity: 0.3,
        metalness: 0.7,
        roughness: 0.2,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(...sector.position);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { sectorId: sector.id };
      scene.add(mesh);
      sectorMeshes.push(mesh);

      // Connecting lines from core
      const lineGeometry = new THREE.BufferGeometry();
      lineGeometry.setFromPoints([
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(...sector.position),
      ]);
      const lineMaterial = new THREE.LineBasicMaterial({
        color: sector.color,
        opacity: 0.3,
        transparent: true,
      });
      const line = new THREE.Line(lineGeometry, lineMaterial);
      scene.add(line);
    });

    // Raycaster for mouse interaction
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleMouseMove = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(sectorMeshes);

      setHoveredSector(intersects.length > 0 ? intersects[0].object.userData.sectorId : null);
    };

    const handleClick = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObjects(sectorMeshes);

      if (intersects.length > 0) {
        setSelectedSector(intersects[0].object.userData.sectorId);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('click', handleClick);

    // Animation loop
    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Rotate core
      core.rotation.x += 0.003;
      core.rotation.y += 0.005;
      glow.rotation.x -= 0.002;
      glow.rotation.z += 0.003;

      // Rotate and pulse sector meshes
      sectorMeshes.forEach((mesh, index) => {
        mesh.rotation.x += 0.01;
        mesh.rotation.y += 0.015;
        const pulse = Math.sin(Date.now() * 0.001 + index) * 0.1 + 1;
        mesh.scale.set(pulse, pulse, pulse);

        // Highlight hovered sector
        if (mesh.userData.sectorId === hoveredSector) {
          mesh.material.emissiveIntensity = 0.8;
          mesh.scale.multiplyScalar(1.2);
        } else {
          mesh.material.emissiveIntensity = 0.3;
        }
      });

      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [hoveredSector]);

  const handleSectorJump = (sectorPath) => {
    navigate(sectorPath);
    onClose?.();
  };

  const selected = SECTORS.find((s) => s.id === selectedSector);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* 3D Canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* HUD Overlay */}
      <div className="fixed inset-0 pointer-events-none flex flex-col">
        {/* Top Header */}
        <div className="pointer-events-auto p-6 bg-gradient-to-b from-slate-900/80 to-transparent backdrop-blur-sm">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-orbitron text-2xl text-cyan-300 tracking-[0.2em]">SECTOR MAP</h1>
              <p className="text-cyan-400/60 text-xs mt-1 tracking-widest">SPATIAL NAVIGATION INTERFACE</p>
            </div>
            <button
              onClick={onClose}
              className="pointer-events-auto px-4 py-2 rounded-lg border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10 transition-all"
            >
              Close Map
            </button>
          </div>
        </div>

        {/* Status Bar */}
        <div className="absolute bottom-6 left-6 pointer-events-auto glass-card-bright p-4 w-64">
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">ACTIVE CHANNELS</span>
              <span className="text-cyan-300 font-orbitron">{activeIdentities}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">WALLET STATUS</span>
              <span className="text-emerald-300 font-orbitron">${walletBalance.toFixed(0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">TASK QUEUE</span>
              <span className="text-amber-300 font-orbitron">{taskCount}</span>
            </div>
          </div>
        </div>

        {/* Sector Details */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute top-20 right-6 pointer-events-auto glass-card-bright p-6 max-w-sm"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selected.icon}</span>
                  <div>
                    <h2 className="font-orbitron text-lg text-white">{selected.name}</h2>
                    <p className="text-cyan-400 text-xs">{selected.description}</p>
                  </div>
                </div>

                <div className="border-t border-cyan-500/20 pt-4">
                  <p className="text-slate-400 text-xs font-mono mb-2">COORDINATES</p>
                  <p className="text-cyan-300 font-mono text-xs">{selected.coordinates}</p>
                </div>

                <div className="border-t border-cyan-500/20 pt-4">
                  <p className="text-slate-400 text-xs font-mono mb-2 flex items-center gap-2">
                    <Radio className="w-3 h-3" /> ACTIVE MISSIONS
                  </p>
                  <ul className="space-y-1">
                    {selected.missions.map((mission, i) => (
                      <li key={i} className="text-cyan-400/70 text-xs flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-cyan-400" />
                        {mission}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => handleSectorJump(selected.path)}
                  className="w-full mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 border border-cyan-500/40 rounded-lg text-cyan-300 hover:border-cyan-400 hover:bg-cyan-500/30 transition-all flex items-center justify-center gap-2 font-orbitron text-sm"
                >
                  Jump to Sector <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Legend */}
        <div className="absolute bottom-6 right-6 pointer-events-auto glass-card p-4 max-w-xs">
          <p className="text-slate-400 text-xs font-orbitron tracking-widest mb-3">SECTORS</p>
          <div className="grid grid-cols-2 gap-2">
            {SECTORS.map((sector) => (
              <div
                key={sector.id}
                className={`flex items-center gap-2 text-xs cursor-pointer transition-all p-2 rounded-lg ${
                  hoveredSector === sector.id ? 'bg-white/10' : ''
                }`}
              >
                <MapPin
                  className="w-3 h-3"
                  style={{ color: sector.color }}
                />
                <span className="text-slate-300">{sector.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}