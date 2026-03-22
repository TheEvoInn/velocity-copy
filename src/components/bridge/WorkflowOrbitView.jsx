import React, { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { base44 } from '@/api/base44Client';
import {
  X, Play, RotateCcw, AlertCircle, CheckCircle2, Clock, Zap,
  Loader2, GitBranch, ChevronRight, ListOrdered, StopCircle
} from 'lucide-react';

// ── Execution node definitions ────────────────────────────────────────────────
const EXECUTION_NODES = [
  { id: 'autopilot',    label: 'AUTOPILOT CYCLE',    fn: 'autopilotCycle',         color: 0x00e8ff, hex: '#00e8ff', orbit: 8,  speed: 0.003,  angle: 0 },
  { id: 'discovery',   label: 'DISCOVERY SCAN',      fn: 'aiDiscoveryEngine',      color: 0xf59e0b, hex: '#f59e0b', orbit: 12, speed: 0.002,  angle: 1.2 },
  { id: 'orchestrate', label: 'ORCHESTRATOR',         fn: 'unifiedOrchestrator',    color: 0xa855f7, hex: '#a855f7', orbit: 16, speed: 0.0015, angle: 2.5 },
  { id: 'identity',    label: 'IDENTITY ENGINE',      fn: 'identityEngine',         color: 0x06b6d4, hex: '#06b6d4', orbit: 20, speed: 0.001,  angle: 0.8 },
  { id: 'finance',     label: 'FINANCIAL TRACKER',    fn: 'financialTracker',       color: 0x10b981, hex: '#10b981', orbit: 10, speed: 0.0025, angle: 3.8 },
  { id: 'ned',         label: 'NED CRYPTO',           fn: 'nedCryptoOrchestrator',  color: 0xf9d65c, hex: '#f9d65c', orbit: 14, speed: 0.002,  angle: 5.1 },
  { id: 'vipz',        label: 'VIPZ ENGINE',          fn: 'opportunityIngestionV2', color: 0xff2ec4, hex: '#ff2ec4', orbit: 18, speed: 0.0015, angle: 4.2 },
  { id: 'webhooks',    label: 'WEBHOOK ENGINE',       fn: 'webhookEventEngine',     color: 0xec4899, hex: '#ec4899', orbit: 6,  speed: 0.004,  angle: 2.0 },
];

// ── Predefined pipeline chains (sequential execution paths) ──────────────────
const PIPELINES = [
  {
    id: 'full_cycle',
    label: 'FULL PROFIT CYCLE',
    color: '#00e8ff',
    description: 'Complete end-to-end automation cycle',
    steps: ['discovery', 'identity', 'autopilot', 'orchestrate', 'finance'],
  },
  {
    id: 'crypto_run',
    label: 'CRYPTO PIPELINE',
    color: '#f9d65c',
    description: 'Scan → NED crypto → Finance tracking',
    steps: ['discovery', 'ned', 'finance'],
  },
  {
    id: 'opportunity_hunt',
    label: 'OPPORTUNITY HUNT',
    color: '#ff2ec4',
    description: 'Discover → VIPZ inject → Orchestrate',
    steps: ['discovery', 'vipz', 'orchestrate'],
  },
  {
    id: 'identity_sweep',
    label: 'IDENTITY SWEEP',
    color: '#06b6d4',
    description: 'Identity refresh → Autopilot → Webhooks',
    steps: ['identity', 'autopilot', 'webhooks'],
  },
];

// ── Helper: get node def by id ────────────────────────────────────────────────
const getNodeDef = (id) => EXECUTION_NODES.find(n => n.id === id);

// ── 3D Scene ──────────────────────────────────────────────────────────────────
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

    scene.add(new THREE.AmbientLight(0x050a20, 2));
    const core = new THREE.PointLight(0xffffff, 4, 50);
    core.position.set(0, 0, 0);
    scene.add(core);

    // Hub
    const hubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x00e8ff, emissiveIntensity: 2, metalness: 0.2, roughness: 0.4 });
    const hub = new THREE.Mesh(new THREE.IcosahedronGeometry(1.8, 4), hubMat);
    scene.add(hub);
    const hubGlowMat = new THREE.MeshStandardMaterial({ color: 0x00e8ff, emissive: 0x00e8ff, emissiveIntensity: 1, transparent: true, opacity: 0.12, side: THREE.BackSide });
    scene.add(new THREE.Mesh(new THREE.IcosahedronGeometry(3, 3), hubGlowMat));

    // Starfield
    const sp = new Float32Array(1200 * 3);
    for (let i = 0; i < 1200; i++) { sp[i*3]=(Math.random()-0.5)*600; sp[i*3+1]=(Math.random()-0.5)*600; sp[i*3+2]=(Math.random()-0.5)*600-50; }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.3, sizeAttenuation: true, transparent: true, opacity: 0.7 })));

    // Build nodes
    const nodes = EXECUTION_NODES.map((nd, idx) => {
      const ringMat = new THREE.MeshStandardMaterial({ color: nd.color, emissive: nd.color, emissiveIntensity: 0.6, transparent: true, opacity: 0.35, metalness: 0.5 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(nd.orbit, 0.08, 8, 120), ringMat);
      ring.rotation.x = Math.PI / 2 + (idx * 0.08);
      ring.rotation.z = idx * 0.12;
      scene.add(ring);

      const nMat = new THREE.MeshStandardMaterial({ color: nd.color, emissive: nd.color, emissiveIntensity: 1.2, metalness: 0.3, roughness: 0.5 });
      const nMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 3), nMat);
      scene.add(nMesh);

      const glowMat = new THREE.MeshStandardMaterial({ color: nd.color, emissive: nd.color, emissiveIntensity: 0.8, transparent: true, opacity: 0.15, side: THREE.BackSide });
      const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 2), glowMat);
      scene.add(glow);

      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
      const lineMat = new THREE.LineBasicMaterial({ color: nd.color, transparent: true, opacity: 0.2 });
      const line = new THREE.Line(lineGeo, lineMat);
      scene.add(line);

      return { ...nd, ring, nMesh, glow, line, lineMat, nMat, glowMat, ringMat, currentAngle: nd.angle, status: 'idle', lastRun: null };
    });

    // Pipeline arc lines (node-to-node connections for active pipeline)
    const arcLines = {};
    S.current = { scene, camera, renderer, hub, hubGlowMat, nodes, clock: new THREE.Clock(), animId: null, arcLines };

    // Raycaster
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

    const animate = () => {
      S.current.animId = requestAnimationFrame(animate);
      const t = S.current.clock.getElapsedTime();
      hub.material.emissiveIntensity = 1.5 + Math.sin(t * 1.8) * 0.5;
      hubGlowMat.opacity = 0.10 + Math.sin(t * 1.2) * 0.04;

      nodes.forEach((nd, i) => {
        nd.currentAngle += nd.speed;
        const tiltX = nd.ring.rotation.x;
        const tiltZ = nd.ring.rotation.z;
        const px = Math.cos(nd.currentAngle) * nd.orbit;
        const pz = Math.sin(nd.currentAngle) * nd.orbit;
        const py = Math.sin(nd.currentAngle) * nd.orbit * Math.sin(tiltX - Math.PI / 2) * 0.3 + Math.cos(nd.currentAngle) * nd.orbit * Math.sin(tiltZ) * 0.15;

        nd.nMesh.position.set(px, py, pz);
        nd.glow.position.copy(nd.nMesh.position);
        nd.nMesh.rotation.y += 0.02;

        const pos = nd.line.geometry.attributes.position.array;
        pos[0] = 0; pos[1] = 0; pos[2] = 0;
        pos[3] = px; pos[4] = py; pos[5] = pz;
        nd.line.geometry.attributes.position.needsUpdate = true;

        if (nd.status === 'running') {
          nd.nMat.emissiveIntensity = 1.5 + Math.sin(t * 8 + i) * 0.5;
          nd.ringMat.opacity = 0.6 + Math.sin(t * 6) * 0.2;
          nd.ringMat.emissiveIntensity = 1.2;
          nd.lineMat.opacity = 0.5 + Math.sin(t * 6) * 0.2;
          nd.ring.rotation.z += 0.01;
        } else if (nd.status === 'queued') {
          nd.nMat.emissiveIntensity = 0.6 + Math.sin(t * 3 + i) * 0.4;
          nd.ringMat.opacity = 0.5 + Math.sin(t * 2) * 0.15;
          nd.ringMat.emissiveIntensity = 0.9;
          nd.lineMat.opacity = 0.3;
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

        // Update any arc line that starts at this node
        Object.values(S.current.arcLines).forEach(arc => {
          if (arc.fromId === nd.id) {
            const toNode = nodes.find(n => n.id === arc.toId);
            if (toNode) {
              const ap = arc.line.geometry.attributes.position.array;
              ap[0] = px; ap[1] = py; ap[2] = pz;
              ap[3] = toNode.nMesh.position.x; ap[4] = toNode.nMesh.position.y; ap[5] = toNode.nMesh.position.z;
              arc.line.geometry.attributes.position.needsUpdate = true;
            }
          }
        });
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
        if (s.renderer.domElement.parentNode === mountRef.current) mountRef.current.removeChild(s.renderer.domElement);
        s.renderer.dispose();
      }
    };
  }, [init]);

  return S;
}

// ── Draw / clear arc lines for a pipeline ────────────────────────────────────
function syncPipelineArcs(sceneRef, pipelineSteps) {
  const s = sceneRef.current;
  if (!s?.scene) return;

  // Remove old arcs
  Object.values(s.arcLines || {}).forEach(arc => s.scene.remove(arc.line));
  s.arcLines = {};

  if (!pipelineSteps || pipelineSteps.length < 2) return;

  for (let i = 0; i < pipelineSteps.length - 1; i++) {
    const fromId = pipelineSteps[i];
    const toId   = pipelineSteps[i + 1];
    const fromNode = getNodeDef(fromId);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const mat = new THREE.LineBasicMaterial({ color: fromNode?.color || 0xffffff, transparent: true, opacity: 0.55, linewidth: 2 });
    const line = new THREE.Line(geo, mat);
    s.scene.add(line);
    s.arcLines[`${fromId}->${toId}`] = { fromId, toId, line };
  }
}

// ── Pipeline selector panel ───────────────────────────────────────────────────
function PipelinePanel({ activePipeline, runningPipeline, onSelect, onRun, onStop }) {
  return (
    <div className="absolute left-4 top-16 z-30 w-64 pointer-events-auto"
      style={{ background: 'rgba(1,2,14,0.92)', border: '1px solid rgba(0,232,255,0.2)', borderRadius: 10, backdropFilter: 'blur(14px)' }}>
      <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
        <span className="font-orbitron text-[9px] text-cyan-400 tracking-widest">PIPELINES</span>
        <span className="ml-auto font-mono text-[8px] text-slate-600">sequential chains</span>
      </div>
      <div className="p-2 space-y-1.5">
        {PIPELINES.map(p => {
          const isActive = activePipeline?.id === p.id;
          const isRunning = runningPipeline?.id === p.id;
          return (
            <div key={p.id}
              onClick={() => !isRunning && onSelect(isActive ? null : p)}
              className="rounded p-2 cursor-pointer transition-all"
              style={{
                background: isActive ? `${p.color}12` : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isActive ? p.color + '55' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-orbitron text-[9px] tracking-widest" style={{ color: isActive ? p.color : '#94a3b8' }}>{p.label}</span>
                {isRunning && <Loader2 className="w-3 h-3 animate-spin" style={{ color: p.color }} />}
              </div>
              <div className="text-[8px] text-slate-600 mb-1.5">{p.description}</div>
              {/* Step badges */}
              <div className="flex items-center gap-1 flex-wrap">
                {p.steps.map((sid, i) => {
                  const nd = getNodeDef(sid);
                  return (
                    <React.Fragment key={sid}>
                      <span className="font-orbitron text-[7px] px-1.5 py-0.5 rounded"
                        style={{ background: nd?.hex + '22', color: nd?.hex, border: `1px solid ${nd?.hex}44` }}>
                        {nd?.label.split(' ')[0]}
                      </span>
                      {i < p.steps.length - 1 && <ChevronRight className="w-2.5 h-2.5 text-slate-700" />}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Run / Stop buttons */}
      {activePipeline && (
        <div className="px-2 pb-2">
          {runningPipeline ? (
            <button onClick={onStop}
              className="w-full py-1.5 rounded font-orbitron text-[9px] tracking-widest flex items-center justify-center gap-1.5 transition-all"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#f87171' }}>
              <StopCircle className="w-3 h-3" /> ABORT PIPELINE
            </button>
          ) : (
            <button onClick={() => onRun(activePipeline)}
              className="w-full py-1.5 rounded font-orbitron text-[9px] tracking-widest flex items-center justify-center gap-1.5 transition-all"
              style={{ background: `${activePipeline.color}18`, border: `1px solid ${activePipeline.color}55`, color: activePipeline.color, boxShadow: `0 0 12px ${activePipeline.color}22` }}>
              <Play className="w-3 h-3" /> RUN PIPELINE
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Node detail panel ─────────────────────────────────────────────────────────
function NodePanel({ node, onTrigger, onClose, loading, pipelineNext }) {
  if (!node) return null;
  const statusIcon = {
    idle:    <Clock className="w-4 h-4 text-slate-400" />,
    queued:  <GitBranch className="w-4 h-4 text-amber-400 animate-pulse" />,
    running: <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />,
    success: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    error:   <AlertCircle className="w-4 h-4 text-red-400" />,
  }[node.status] || <Clock className="w-4 h-4 text-slate-400" />;

  const statusLabel = { idle: 'IDLE', queued: 'QUEUED', running: 'RUNNING', success: 'SUCCESS', error: 'ERROR' }[node.status] || 'IDLE';
  const nextNode = pipelineNext ? getNodeDef(pipelineNext) : null;

  return (
    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 w-80 pointer-events-auto"
      style={{ background: 'rgba(1,2,14,0.92)', border: `1px solid ${node.hex}55`, borderRadius: 12, backdropFilter: 'blur(16px)', boxShadow: `0 0 30px ${node.hex}33` }}>
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: node.hex, boxShadow: `0 0 8px ${node.hex}` }} />
            <span className="font-orbitron text-xs tracking-widest" style={{ color: node.hex }}>{node.label}</span>
          </div>
          <button onClick={onClose} className="text-slate-600 hover:text-slate-300 transition-colors"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex items-center gap-2 mb-3 p-2 rounded" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {statusIcon}
          <span className="font-orbitron text-[10px] text-slate-300 tracking-widest">{statusLabel}</span>
          {node.lastRun && <span className="ml-auto font-mono text-[9px] text-slate-500">{new Date(node.lastRun).toLocaleTimeString()}</span>}
        </div>

        <div className="mb-3 p-2 rounded font-mono text-[10px] text-slate-400" style={{ background: 'rgba(0,232,255,0.04)', border: '1px solid rgba(0,232,255,0.1)' }}>
          <span className="text-slate-600">fn: </span><span className="text-cyan-400">{node.fn}</span>
        </div>

        {/* Next-in-pipeline hint */}
        {nextNode && (
          <div className="mb-3 p-2 rounded flex items-center gap-2" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <ChevronRight className="w-3 h-3 text-slate-500" />
            <span className="font-orbitron text-[8px] text-slate-500 tracking-widest">NEXT:</span>
            <span className="font-orbitron text-[8px] tracking-widest" style={{ color: nextNode.hex }}>{nextNode.label}</span>
          </div>
        )}

        <button
          onClick={() => onTrigger(node)}
          disabled={loading || node.status === 'running' || node.status === 'queued'}
          className="w-full py-2 rounded font-orbitron text-[10px] tracking-widest transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          style={{ background: node.status === 'running' ? 'rgba(0,232,255,0.1)' : `${node.hex}22`, border: `1px solid ${node.hex}66`, color: node.hex, boxShadow: node.status === 'running' ? 'none' : `0 0 12px ${node.hex}22` }}>
          {node.status === 'running'
            ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> EXECUTING...</>
            : node.status === 'queued'
            ? <><GitBranch className="w-3.5 h-3.5" /> QUEUED...</>
            : <><Play className="w-3.5 h-3.5" /> TRIGGER NODE</>}
        </button>
      </div>
    </div>
  );
}

// ── Log Stream ────────────────────────────────────────────────────────────────
function LogStream({ logs }) {
  return (
    <div className="absolute bottom-4 left-4 z-30 w-80 pointer-events-none"
      style={{ background: 'rgba(1,2,14,0.85)', border: '1px solid rgba(0,232,255,0.15)', borderRadius: 8, backdropFilter: 'blur(12px)' }}>
      <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <Zap className="w-3 h-3 text-cyan-400" />
        <span className="font-orbitron text-[9px] text-cyan-400 tracking-widest">EXECUTION LOG</span>
      </div>
      <div className="p-2 max-h-36 overflow-y-auto space-y-1">
        {logs.length === 0 && <div className="font-mono text-[9px] text-slate-600">AWAITING TRIGGERS...</div>}
        {logs.map((l, i) => (
          <div key={i} className="flex items-start gap-2 font-mono text-[9px]">
            <span className="text-slate-600 flex-shrink-0">{l.time}</span>
            <span className={l.type === 'error' ? 'text-red-400' : l.type === 'success' ? 'text-emerald-400' : l.type === 'pipeline' ? 'text-amber-400' : 'text-cyan-300'}>{l.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Pipeline progress bar ─────────────────────────────────────────────────────
function PipelineProgress({ pipeline, currentStep, stepStatuses }) {
  if (!pipeline) return null;
  return (
    <div className="absolute bottom-4 right-4 z-30 w-64 pointer-events-none"
      style={{ background: 'rgba(1,2,14,0.9)', border: `1px solid ${pipeline.color}33`, borderRadius: 8, backdropFilter: 'blur(12px)' }}>
      <div className="px-3 py-2 border-b border-slate-800 flex items-center gap-2">
        <GitBranch className="w-3 h-3" style={{ color: pipeline.color }} />
        <span className="font-orbitron text-[9px] tracking-widest" style={{ color: pipeline.color }}>{pipeline.label}</span>
      </div>
      <div className="p-2 space-y-1.5">
        {pipeline.steps.map((sid, i) => {
          const nd = getNodeDef(sid);
          const st = stepStatuses[sid] || 'idle';
          const isCurrent = currentStep === i;
          const icon = st === 'running' ? <Loader2 className="w-2.5 h-2.5 animate-spin" style={{ color: nd?.hex }} />
                     : st === 'success' ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-400" />
                     : st === 'error'   ? <AlertCircle className="w-2.5 h-2.5 text-red-400" />
                     : st === 'queued'  ? <Clock className="w-2.5 h-2.5 text-amber-400" />
                     :                    <Clock className="w-2.5 h-2.5 text-slate-600" />;
          return (
            <div key={sid} className="flex items-center gap-2 px-1 py-0.5 rounded transition-all"
              style={{ background: isCurrent ? `${nd?.hex}10` : 'transparent', border: `1px solid ${isCurrent ? nd?.hex + '33' : 'transparent'}` }}>
              {icon}
              <span className="font-orbitron text-[8px] tracking-widest flex-1"
                style={{ color: st === 'success' ? '#34d399' : st === 'error' ? '#f87171' : isCurrent ? nd?.hex : '#475569' }}>
                {nd?.label}
              </span>
              <span className="font-orbitron text-[7px] text-slate-600">{i + 1}/{pipeline.steps.length}</span>
            </div>
          );
        })}
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
  const [activePipeline, setActivePipeline] = useState(null);
  const [runningPipeline, setRunningPipeline] = useState(null);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [pipelineStepStatuses, setPipelineStepStatuses] = useState({});
  const abortRef = useRef(false);

  const addLog = (msg, type = 'info') => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [{ time, msg, type }, ...prev].slice(0, 50));
  };

  const handleNodeClick = useCallback((node) => {
    setSelectedNode({ ...node, status: nodeStates[node.id]?.status || 'idle', lastRun: nodeStates[node.id]?.lastRun });
  }, [nodeStates]);

  const sceneRef = useOrbitScene(mountRef, handleNodeClick);

  // Sync selected node with live state
  useEffect(() => {
    if (selectedNode) setSelectedNode(prev => prev ? { ...prev, ...nodeStates[prev.id] } : prev);
  }, [nodeStates]);

  // Sync node statuses into 3D scene
  useEffect(() => {
    const nodes = sceneRef.current?.nodes;
    if (!nodes) return;
    nodes.forEach(n => { const st = nodeStates[n.id]; if (st) n.status = st.status; });
  }, [nodeStates, sceneRef]);

  // Sync arc lines when pipeline changes
  useEffect(() => {
    syncPipelineArcs(sceneRef, activePipeline?.steps || null);
  }, [activePipeline, sceneRef]);

  // ── Execute a single node and return success bool ─────────────────────────
  const execNode = async (nodeId) => {
    const nd = getNodeDef(nodeId);
    if (!nd) return false;
    setNodeStates(prev => ({ ...prev, [nodeId]: { status: 'running', lastRun: Date.now() } }));
    addLog(`► [${nd.label}] executing...`, 'info');
    try {
      const res = await base44.functions.invoke(nd.fn, { action: 'trigger', source: 'workflow_orbit_view' });
      const ok = res?.data && !res?.data?.error;
      setNodeStates(prev => ({ ...prev, [nodeId]: { status: ok ? 'success' : 'error', lastRun: Date.now() } }));
      addLog(ok ? `✓ [${nd.label}] completed` : `✗ [${nd.label}]: ${res?.data?.error || 'failed'}`, ok ? 'success' : 'error');
      return ok;
    } catch (err) {
      setNodeStates(prev => ({ ...prev, [nodeId]: { status: 'error', lastRun: Date.now() } }));
      addLog(`✗ [${nd.label}]: ${err.message || 'network error'}`, 'error');
      return false;
    }
  };

  // ── Run pipeline sequentially ──────────────────────────────────────────────
  const runPipeline = async (pipeline) => {
    abortRef.current = false;
    setRunningPipeline(pipeline);
    setPipelineStep(0);
    setPipelineStepStatuses({});
    addLog(`⟹ PIPELINE START: ${pipeline.label}`, 'pipeline');

    // Mark all as queued
    const initialStatuses = {};
    pipeline.steps.forEach(id => { initialStatuses[id] = 'queued'; });
    setPipelineStepStatuses(initialStatuses);
    setNodeStates(prev => {
      const next = { ...prev };
      pipeline.steps.forEach(id => { next[id] = { status: 'queued', lastRun: prev[id]?.lastRun }; });
      return next;
    });

    for (let i = 0; i < pipeline.steps.length; i++) {
      if (abortRef.current) {
        addLog(`⊘ PIPELINE ABORTED at step ${i + 1}`, 'error');
        break;
      }
      const nodeId = pipeline.steps[i];
      setPipelineStep(i);
      setPipelineStepStatuses(prev => ({ ...prev, [nodeId]: 'running' }));

      const ok = await execNode(nodeId);
      setPipelineStepStatuses(prev => ({ ...prev, [nodeId]: ok ? 'success' : 'error' }));

      if (!ok) {
        addLog(`⊘ PIPELINE HALTED — ${getNodeDef(nodeId)?.label} failed`, 'error');
        break;
      }

      // Brief pause between steps
      if (i < pipeline.steps.length - 1 && !abortRef.current) {
        await new Promise(r => setTimeout(r, 800));
      }
    }

    if (!abortRef.current) addLog(`✦ PIPELINE COMPLETE: ${pipeline.label}`, 'pipeline');
    setRunningPipeline(null);
    setPipelineStep(0);

    // Auto-clear statuses after 6s
    setTimeout(() => {
      setNodeStates(prev => {
        const next = { ...prev };
        pipeline.steps.forEach(id => { if (next[id]?.status !== 'running') next[id] = { ...next[id], status: 'idle' }; });
        return next;
      });
      setPipelineStepStatuses({});
    }, 6000);
  };

  const stopPipeline = () => {
    abortRef.current = true;
    addLog('⊘ Abort signal sent...', 'error');
  };

  // ── Single node trigger ────────────────────────────────────────────────────
  const triggerNode = async (node) => {
    if (runningPipeline) return;
    setLoading(true);
    setSelectedNode(prev => prev ? { ...prev, status: 'running', lastRun: Date.now() } : prev);
    await execNode(node.id);
    setLoading(false);
    setTimeout(() => {
      setNodeStates(prev => ({ ...prev, [node.id]: { ...prev[node.id], status: 'idle' } }));
      setSelectedNode(prev => prev?.id === node.id ? { ...prev, status: 'idle' } : prev);
    }, 4000);
  };

  const resetAll = () => {
    abortRef.current = true;
    setNodeStates({});
    setSelectedNode(null);
    setLogs([]);
    setRunningPipeline(null);
    setPipelineStepStatuses({});
    const nodes = sceneRef.current?.nodes;
    if (nodes) nodes.forEach(n => { n.status = 'idle'; });
    addLog('⟳ All nodes reset to idle', 'info');
  };

  // Find next node in active pipeline for selected node
  const pipelineNextFor = selectedNode && activePipeline
    ? (() => {
        const idx = activePipeline.steps.indexOf(selectedNode.id);
        return idx >= 0 && idx < activePipeline.steps.length - 1 ? activePipeline.steps[idx + 1] : null;
      })()
    : null;

  return (
    <div className="absolute inset-0 z-40 select-none" style={{ background: 'rgba(1,2,14,0.96)' }}>
      <div ref={mountRef} className="absolute inset-0 w-full h-full" />

      {/* Title */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none">
        <div className="font-orbitron text-xs text-cyan-400 tracking-[0.3em]">◈ WORKFLOW ORBIT VIEW ◈</div>
        <div className="font-mono text-[9px] text-slate-500 mt-0.5">Click nodes to trigger · Select pipeline for sequential execution</div>
      </div>

      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-30 flex items-center gap-2 pointer-events-auto">
        <button onClick={resetAll}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded font-orbitron text-[9px] tracking-widest text-slate-400 hover:text-slate-200 border border-slate-700 hover:border-slate-500 transition-all">
          <RotateCcw className="w-3 h-3" /> RESET
        </button>
        <button onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded font-orbitron text-[9px] tracking-widest text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600 transition-all">
          <X className="w-3 h-3" /> EXIT VIEW
        </button>
      </div>

      {/* Pipeline selector */}
      <PipelinePanel
        activePipeline={activePipeline}
        runningPipeline={runningPipeline}
        onSelect={setActivePipeline}
        onRun={runPipeline}
        onStop={stopPipeline}
      />

      {/* Node panel */}
      <NodePanel
        node={selectedNode}
        onTrigger={triggerNode}
        onClose={() => setSelectedNode(null)}
        loading={loading}
        pipelineNext={pipelineNextFor}
      />

      {/* Pipeline progress */}
      <PipelineProgress
        pipeline={runningPipeline || activePipeline}
        currentStep={pipelineStep}
        stepStatuses={pipelineStepStatuses}
      />

      {/* Log stream */}
      <LogStream logs={logs} />
    </div>
  );
}