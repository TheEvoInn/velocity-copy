import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { base44 } from '@/api/base44Client';
import { X, Play, RotateCcw, AlertCircle, CheckCircle2, Clock, Zap, Loader2 } from 'lucide-react';

// ── Execution node definitions (mapped to real backend functions) ────────────
const EXECUTION_NODES = [
  { id: 'autopilot',    label: 'AUTOPILOT CYCLE',    fn: 'autopilotCycle',         color: 0x00e8ff, hex: '#00e8ff', orbit: 8,  speed: 0.003, angle: 0 },
  { id: 'discovery',   label: 'DISCOVERY SCAN',      fn: 'aiDiscoveryEngine',      color: 0xf59e0b, hex: '#f59e0b', orbit: 12, speed: 0.002, angle: 1.2 },
  { id: 'orchestrate', label: 'ORCHESTRATOR',         fn: 'unifiedOrchestrator',    color: 0xa855f7, hex: '#a855f7', orbit: 16, speed: 0.0015, angle: 2.5 },
  { id: 'identity',    label: 'IDENTITY ENGINE',      fn: 'identityEngine',         color: 0x06b6d4, hex: '#06b6d4', orbit: 20, speed: 0.001, angle: 0.8 },
  { id: 'finance',     label: 'FINANCIAL TRACKER',    fn: 'financialTracker',       color: 0x10b981, hex: '#10b981', orbit: 10, speed: 0.0025, angle: 3.8 },
  { id: 'ned',         label: 'NED CRYPTO',           fn: 'nedCryptoOrchestrator',  color: 0xf9d65c, hex: '#f9d65c', orbit: 14, speed: 0.002, angle: 5.1 },
  { id: 'vipz',        label: 'VIPZ ENGINE',          fn: 'opportunityIngestionV2', color: 0xff2ec4, hex: '#ff2ec4', orbit: 18, speed: 0.0015, angle: 4.2 },
  { id: 'webhooks',    label: 'WEBHOOK ENGINE',       fn: 'webhookEventEngine',     color: 0xec4899, hex: '#ec4899', orbit: 6,  speed: 0.004, angle: 2.0 },
];

// ── 3D Scene ─────────────────────────────────────────────────────────────────
function useOrbitScene(mountRef, onNodeClick) {
  const S = useRef({});

  const init = useCallback(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x01020e);
    scene.fog = new THREE.FogExp2(0x01020e, 0.006);

    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 500);
    camera.position.set(0, 14, 30);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    el.appendChild(renderer.domElement);

    // Lighting
    scene.add(new THREE.AmbientLight(0x050a20, 2));
    const core = new THREE.PointLight(0xffffff, 4, 50);
    core.position.set(0, 0, 0);
    scene.add(core);

    // Central star / hub
    const hubGeo = new THREE.IcosahedronGeometry(1.8, 4);
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00e8ff, emissiveIntensity: 2, metalness: 0.2, roughness: 0.4 });
    const hub = new THREE.Mesh(hubGeo, hubMat);
    scene.add(hub);

    // Hub glow
    const hubGlowMat = new THREE.MeshStandardMaterial({ color: 0x00e8ff, emissive: 0x00e8ff, emissiveIntensity: 1, transparent: true, opacity: 0.12, side: THREE.BackSide });
    scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(3, 3), hubGlowMat));

    // Starfield
    const starGeo = new THREE.BufferGeometry();
    const sp = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) { sp[i*3]=(Math.random()-0.5)*600; sp[i*3+1]=(Math.random()-0.5)*600; sp[i*3+2]=(Math.random()-0.5)*600-50; }
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true, transparent: true, opacity: 0.7 })));

    // Build orbit rings + nodes
    const nodes = EXECUTION_NODES.map((nd, idx) => {
      // Orbit ring torus
      const ringMat = new THREE.MeshStandardMaterial({
        color: nd.color, emissive: nd.color, emissiveIntensity: 0.6,
        transparent: true, opacity: 0.35, metalness: 0.5,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(nd.orbit, 0.08, 8, 120), ringMat);
      ring.rotation.x = Math.PI / 2 + (idx * 0.08);
      ring.rotation.z = idx * 0.12;
      scene.add(ring);

      // Node sphere
      const nMat = new THREE.MeshStandardMaterial({
        color: nd.color, emissive: nd.color, emissiveIntensity: 1.2,
        metalness: 0.3, roughness: 0.5,
      });
      const nMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), nMat);
      scene.add(nMesh);

      // Node glow shell
      const glowMat = new THREE.MeshStandardMaterial({
        color: nd.color, emissive: nd.color, emissiveIntensity: 0.8,
        transparent: true, opacity: 0.15, side: THREE.BackSide,
      });
      const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), glowMat);
      scene.add(glow);

      // Connection line to hub
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const lineMat = new THREE.LineBasicMaterial({ color: nd.color, transparent: true, opacity: 0.2 });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      return {
        ...nd,
        ring, nMesh, glow, line, lineMat, nMat, glowMat, ringMat,
        currentAngle: nd.angle,
        status: 'idle', // idle | running | success | error
        lastRun: null,
      };
    });

    S.current = { scene, camera, renderer, hub, hubGlowMat, nodes, clock: new THREE.Clock(), animId: null };

    // Raycaster for click
    const raycaster = new THREE.Raycaster();
    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera({ x: mx, y: my }, camera);
      const meshes = nodes.map(n => n.nMesh);
      const hits = raycaster.intersectObjects(meshes, false);
      if (hits.length) {
        const idx = meshes.indexOf(hits[0].object);
        if (idx >= 0 && onNodeClick) onNodeClick(nodes[idx]);
      }
    };
    renderer.domElement.addEventListener('click', onClick);
    renderer.domElement.style.cursor = 'default';

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera({ x: mx, y: my }, camera);
      const hits = raycaster.intersectObjects(nodes.map(n => n.nMesh), false);
      renderer.domElement.style.cursor = hits.length ? 'pointer' : 'default';
    };
    renderer.domElement.addEventListener('mousemove', onMouseMove);

    const onResize = () => {
      if (!mountRef.current) return;
      const W2 = mountRef.current.clientWidth, H2 = mountRef.current.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    };
    window.addEventListener('resize', onResize);

    // Animate
    const animate = () => {
      S.current.animId = requestAnimationFrame(animate);
      const t = S.current.clock.getElapsedTime();

      // Hub pulse
      hub.material.emissiveIntensity = 1.5 + Math.sin(t * 1.8) * 0.5;
      hubGlowMat.opacity = 0.10 + Math.sin(t * 1.2) * 0.04;

      // Node orbits
      nodes.forEach((nd, i) => {
        nd.currentAngle += nd.speed;
        const tiltX = nd.ring.rotation.x;
        const tiltZ = nd.ring.rotation.z;

        // Position on tilted orbit
        const px = Math.cos(nd.currentAngle) * nd.orbit;
        const pz = Math.sin(nd.currentAngle) * nd.orbit;
        // Apply same tilt
        const py = Math.sin(nd.currentAngle) * nd.orbit * Math.sin(tiltX - Math.PI / 2) * 0.3 + Math.cos(nd.currentAngle) * nd.orbit * Math.sin(tiltZ) * 0.15;

        nd.nMesh.position.set(px, py, pz);
        nd.glow.position.copy(nd.nMesh.position);
        nd.nMesh.rotation.y += 0.02;

        // Update connection line
        const pos = nd.line.geometry.attributes.position.array;
        pos[0] = 0; pos[1] = 0; pos[2] = 0;
        pos[3] = px; pos[4] = py; pos[5] = pz;
        nd.line.geometry.attributes.position.needsUpdate = true;

        // Status-based visuals
        if (nd.status === 'running') {
          nd.nMat.emissiveIntensity = 1.5 + Math.sin(t * 8 + i) * 0.5;
          nd.ringMat.opacity = 0.6 + Math.sin(t * 6) * 0.2;
          nd.ringMat.emissiveIntensity = 1.2;
          nd.lineMat.opacity = 0.5 + Math.sin(t * 6) * 0.2;
          nd.ring.rotation.z += 0.01;
        } else if (nd.status === 'success') {
          nd.nMat.emissiveIntensity = 2.5 + Math.sin(t * 3) * 0.5;
          nd.ringMat.opacity = 0.5;
          nd.ringMat.emissiveIntensity = 1.5;
          nd.lineMat.opacity = 0.4;
        } else if (nd.status === 'error') {
          nd.nMat.emissiveIntensity = 1.0 + Math.sin(t * 10 + i) * 1.0;
          nd.ringMat.opacity = 0.3;
          nd.ringMat.emissiveIntensity = 0.5;
          nd.lineMat.opacity = 0.15;
        } else {
          nd.nMat.emissiveIntensity = 0.8 + Math.sin(t * 1.5 + i * 0.8) * 0.2;
          nd.ringMat.opacity = 0.25 + Math.sin(t * 0.8 + i) * 0.05;
          nd.ringMat.emissiveIntensity = 0.4;
          nd.lineMat.opacity = 0.12;
        }

        nd.glowMat.opacity = nd.nMat.emissiveIntensity * 0.08;
      });

      renderer.render(scene, camera);
    };
    animate();

    S.current.cleanup = () => {
      renderer.domElement.removeEventListener('click', onClick);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
    };
  }, [mountRef, onNodeClick]);

  useEffect(() => {
    init();
    return () => {
      const s = S.current;
      cancelAnimationFrame(s.animId);
      s.cleanup?.();
      if (s.renderer && mountRef.current) {
        if (s.renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(s.renderer.domElement);
        }
        s.renderer.dispose();
      }
    };
  }, [init]);

  return S;
}

// ── Node Detail Panel ────────────────────────────────────────────────────────
function NodePanel({ node, onTrigger, onClose, loading }) {
  if (!node) return null;
  const statusIcon = {
    idle:    <Clock className="w-4 h-4 text-slate-400" />,
    running: <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    error:   <AlertCircle className="w-4 h-4 text-red-400" />,
  }[node.status] || <Clock className="w-4 h-4 text-slate-400" />;

  const statusLabel = {
    idle: 'IDLE', running: 'RUNNING', success: 'SUCCESS', error: 'ERROR',
  }[node.status] || 'IDLE';

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-72 pointer-events-auto"
      style={{ background: 'rgba(1,2,14,0.92)', border: `1px solid ${node.hex}55`, borderRadius: 12, backdropFilter: 'blur(16px)', boxShadow: `0 0 30px ${node.hex}33` }}>
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: node.hex, boxShadow: `0 0 8px ${node.hex}` }} />
            <span className="font-orbitron text-xs tracking-widest" style={{ color: node.hex }}>{node.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2 mb-3 p-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {statusIcon}
          <span className="font-orbitron text-[10px] text-slate-300 tracking-widest">{statusLabel}</span>
          {node.lastRun && (
            <span className="ml-auto font-mono text-[9px] text-slate-500">
              {new Date(node.lastRun).toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Function name */}
        <div className="mb-3 p-2 rounded font-mono text-[10px] text-slate-400" style={{ background: 'rgba(0,232,255,0.04)', border: '1px solid rgba(0,232,255,0.1)' }}>
          <span className="text-slate-600">fn: </span>
          <span className="text-cyan-400">{node.fn}</span>
        </div>

        {/* Trigger button */}
        <button
          onClick={() => onTrigger(node)}
          disabled={loading || node.status === 'running'}
          className="w-full py-2 rounded font-orbitron text-[10px] tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{
            background: node.status === 'running' ? 'rgba(0,232,255,0.1)' : `${node.hex}22`,
            border: `1px solid ${node.hex}66`,
            color: node.hex,
            boxShadow: node.status === 'running' ? 'none' : `0 0 12px ${node.hex}22`,
          }}
        >
          {node.status === 'running'
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> EXECUTING...</>
            : <><Play className="w-3.5 h-3.5" /> TRIGGER NODE</>
          }
        </button>
      </div>
    </div>
  );
}

// ── Log Stream ───────────────────────────────────────────────────────────────
function LogStream({ logs }) {
  return (
    <div className="absolute bottom-4 left-4 z-30 w-80 pointer-events-none"
      style={{ background: 'rgba(1,2,14,0.85)', border: '1px solid rgba(0,232,255,0.15)', borderRadius: 8, backdropFilter: 'blur(12px)' }}>
      <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <Zap className="w-3 h-3 text-cyan-400" />
        <span className="font-orbitron text-[9px] text-cyan-400 tracking-widest">EXECUTION LOG</span>
      </div>
      <div className="p-2 max-h-32 overflow-y-auto space-y-1">
        {logs.length === 0 && <div className="font-mono text-[9px] text-slate-600">AWAITING TRIGGERS...</div>}
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-2 font-mono text-[9px]">
            <span className="text-slate-600 flex-shrink-0">{l.time}</span>
            <span className={l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : 'text-cyan-300'}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────
export default function WorkflowOrbitView({ onClose }) {
  const mountRef = useRef(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [nodeStates, setNodeStates] = useState({});
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 30));
  };

  const handleNodeClick = useCallback((node) => {
    setSelectedNode({ ...node, status: nodeStates[node.id]?.status || 'idle', lastRun: nodeStates[node.id]?.lastRun });
  }, [nodeStates]);

  const sceneRef = useOrbitScene(mountRef, handleNodeClick);

  // Keep selected node in sync with live state
  useEffect(() => {
    if (selectedNode) {
      setSelectedNode(prev => prev ? { ...prev, ...nodeStates[prev.id] } : prev);
    }
  }, [nodeStates]);

  // Sync node statuses into 3D scene
  useEffect(() => {
    const nodes = sceneRef.current?.nodes;
    if (!nodes) return;
    nodes.forEach(n => {
      const st = nodeStates[n.id];
      if (st) n.status = st.status;
    });
  }, [nodeStates, sceneRef]);

  const triggerNode = async (node) => {
    setLoading(true);
    setNodeStates(prev => ({ ...prev, [node.id]: { status: 'running', lastRun: Date.now() } }));
    addLog(`► Triggering ${node.label}...`, 'info');

    // Also update selected panel immediately
    setSelectedNode(prev => prev ? { ...prev, status: 'running', lastRun: Date.now() } : prev);

    try {
      const res = await base44.functions.invoke(node.fn, { action: 'trigger', source: 'workflow_orbit_view' });
      const success = res?.data && !res?.data?.error;
      setNodeStates(prev => ({ ...prev, [node.id]: { status: success ? 'success' : 'error', lastRun: Date.now() } }));
      setSelectedNode(prev => prev ? { ...prev, status: success ? 'success' : 'error' } : prev);
      addLog(success ? `✓ ${node.label} completed` : `✗ ${node.label}: ${res?.data?.error || 'failed'}`, success ? 'success' : 'error');
    } catch (err) {
      setNodeStates(prev => ({ ...prev, [node.id]: { status: 'error', lastRun: Date.now() } }));
      setSelectedNode(prev => prev ? { ...prev, status: 'error' } : prev);
      addLog(`✗ ${node.label}: ${err.message || 'network error'}`, 'error');
    } finally {
      setLoading(false);
      // Auto-reset to idle after 4s
      setTimeout(() => {
        setNodeStates(prev => ({ ...prev, [node.id]: { ...prev[node.id], status: 'idle' } }));
        setSelectedNode(prev => prev?.id === node.id ? { ...prev, status: 'idle' } : prev);
      }, 4000);
    }
  };

  const resetAll = () => {
    setNodeStates({});
    setSelectedNode(null);
    setLogs([]);
    const nodes = sceneRef.current?.nodes;
    if (nodes) nodes.forEach(n => { n.status = 'idle'; });
    addLog('⟳ All nodes reset to idle', 'info');
  };

  return (
    <div className="absolute inset-0 z-40 select-none" style={{ background: 'rgba(1,2,14,0.96)' }}>
      {/* 3D Canvas */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title bar */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none">
        <div className="font-orbitron text-xs text-cyan-400 tracking-[0.3em]">◈ WORKFLOW ORBIT VIEW ◈</div>
        <div className="font-mono text-[9px] text-slate-500 mt-0.5">Click orbital nodes to trigger automation engines</div>
      </div>

      {/* Controls top-right */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
        <button onClick={resetAll} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-orbitron text-[9px] tracking-widest text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 transition-all">
          <RotateCcw className="w-3 h-3" />
          RESET
        </button>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-1.5 rounded font-orbitron text-[9px] tracking-widest text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 transition-all">
          <X className="w-3 h-3" />
          EXIT VIEW
        </button>
      </div>

      {/* Legend - bottom right */}
      <div className="absolute bottom-4 right-4 z-30 pointer-events-none space-y-1">
        {[
          { color: 'bg-slate-500', label: 'IDLE' },
          { color: 'bg-cyan-400', label: 'RUNNING' },
          { color: 'bg-emerald-400', label: 'SUCCESS' },
          { color: 'bg-red-400', label: 'ERROR' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${l.color}`} />
            <span className="font-orbitron text-[8px] text-slate-500 tracking-widest">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Node detail panel */}
      <NodePanel
        node={selectedNode}
        onTrigger={triggerNode}
        onClose={() => setSelectedNode(null)}
        loading={loading}
      />

      {/* Log stream */}
      <LogStream logs={logs} />
    </div>
  );
}