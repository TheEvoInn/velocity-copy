import React, { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';

// Department planet definitions
export const DEPARTMENTS = [
  { name: 'AutoPilot',          route: '/AutoPilot',          color: 0x00e8ff, glow: 0x00e8ff, x: -22, y:  8, z: -45, r: 3.5 },
  { name: 'VIPZ',               route: '/VIPZ',               color: 0xff2ec4, glow: 0xff2ec4, x:  18, y:  6, z: -42, r: 2.8 },
  { name: 'NED',                route: '/NED',                color: 0xf9d65c, glow: 0xf9d65c, x: -10, y: -8, z: -50, r: 3.2 },
  { name: 'Finance',            route: '/Finance',            color: 0x10b981, glow: 0x10b981, x:  12, y: -6, z: -38, r: 2.6 },
  { name: 'Discovery',          route: '/Discovery',          color: 0xf59e0b, glow: 0xf59e0b, x:   0, y: 14, z: -55, r: 4.0 },
  { name: 'Control',            route: '/Control',            color: 0xa855f7, glow: 0xa855f7, x: -18, y: -2, z: -35, r: 2.4 },
  { name: 'IdentityManager',    route: '/IdentityManager',    color: 0x06b6d4, glow: 0x06b6d4, x:  26, y: -4, z: -48, r: 2.2 },
  { name: 'WorkflowArchitect',  route: '/WorkflowArchitect',  color: 0xec4899, glow: 0xec4899, x:  -5, y: 10, z: -30, r: 2.0 },
];

const STATIONS = [
  { name: 'Webhooks',   route: '/WebhookEngine',        x: -30, y:  5, z: -60, color: 0x00e8ff },
  { name: 'EventLogs',  route: '/CentralEventLog',      x:  30, y: -8, z: -55, color: 0xff2ec4 },
  { name: 'Settings',   route: '/AccountManager',       x:  -2, y: -14, z:-40, color: 0xf9d65c },
];

export default function CockpitScene({ onModuleSelect, onHover, activityLevels = {} }) {
  const mountRef = useRef(null);
  const stateRef = useRef({
    scene: null, camera: null, renderer: null,
    planets: [], stations: [], animId: null,
    clock: new THREE.Clock(), hoveredObj: null,
  });

  const buildScene = useCallback(() => {
    const el = mountRef.current;
    if (!el) return;
    const W = el.clientWidth, H = el.clientHeight;
    const S = stateRef.current;

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020510);
    scene.fog = new THREE.FogExp2(0x020510, 0.004);
    S.scene = scene;

    // ── Camera ────────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(70, W / H, 0.1, 2000);
    camera.position.set(0, 1.8, 10);
    camera.lookAt(0, 0, -20);
    S.camera = camera;

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    el.appendChild(renderer.domElement);
    S.renderer = renderer;

    // ── Lighting ──────────────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x0a1030, 1.5));

    const cyanKey = new THREE.PointLight(0x00e8ff, 3, 60);
    cyanKey.position.set(-8, 6, 5);
    scene.add(cyanKey);

    const magentaFill = new THREE.PointLight(0xff2ec4, 2, 50);
    magentaFill.position.set(8, 4, 4);
    scene.add(magentaFill);

    const goldRim = new THREE.PointLight(0xf9d65c, 1.5, 40);
    goldRim.position.set(0, -3, 6);
    scene.add(goldRim);
    S.lights = { cyanKey, magentaFill, goldRim };

    // ── Starfield ─────────────────────────────────────────────────────────
    buildStarfield(scene, 2500);

    // ── Nebula layers ─────────────────────────────────────────────────────
    buildNebula(scene);

    // ── Cockpit interior ──────────────────────────────────────────────────
    const cockpit = buildCockpitInterior(scene);
    S.cockpit = cockpit;

    // ── Department Planets ────────────────────────────────────────────────
    S.planets = DEPARTMENTS.map(dept => buildPlanet(scene, dept, activityLevels[dept.name] || 0));

    // ── Space Stations ────────────────────────────────────────────────────
    S.stations = STATIONS.map(st => buildStation(scene, st));

    // ── Wormholes ─────────────────────────────────────────────────────────
    buildWormholes(scene);

    // ── Particle trails ───────────────────────────────────────────────────
    S.particles = buildParticleTrails(scene);

    // ── Raycaster ─────────────────────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2(-999, -999);
    S.raycaster = raycaster;
    S.mouse = mouse;

    const allInteractable = [...S.planets.map(p => p.mesh), ...S.stations.map(s => s.mesh)];
    const allData = [...S.planets.map(p => ({ mesh: p.mesh, route: p.route, name: p.name })),
                     ...S.stations.map(s => ({ mesh: s.mesh, route: s.route, name: s.name }))];

    const onMouseMove = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onClick = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const my = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera({ x: mx, y: my }, camera);
      const hits = raycaster.intersectObjects(allInteractable, true);
      if (hits.length) {
        const hit = allData.find(d => {
          const obj = hits[0].object;
          return d.mesh === obj || d.mesh.children?.includes(obj);
        });
        if (hit && onModuleSelect) onModuleSelect(hit.route, hit.name);
      }
    };

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('click', onClick);
    S.cleanup = () => {
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('click', onClick);
    };

    // ── Resize ────────────────────────────────────────────────────────────
    const onResize = () => {
      if (!mountRef.current) return;
      const W2 = mountRef.current.clientWidth, H2 = mountRef.current.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    };
    window.addEventListener('resize', onResize);
    S.onResize = onResize;

    // ── Animate ───────────────────────────────────────────────────────────
    const animate = () => {
      S.animId = requestAnimationFrame(animate);
      const t = S.clock.getElapsedTime();

      // Pulsing lights
      cyanKey.intensity = 3 + Math.sin(t * 1.2) * 0.8;
      magentaFill.intensity = 2 + Math.cos(t * 0.9) * 0.6;

      // Rotate/float planets
      S.planets.forEach((p, i) => {
        p.mesh.rotation.y += p.rotSpeed;
        if (p.ring) p.ring.rotation.z += 0.003 + i * 0.001;
        if (p.orbitGroup) p.orbitGroup.rotation.y += 0.008 + i * 0.002;
        // Glow pulse based on activity
        if (p.glowMat) {
          p.glowMat.opacity = 0.18 + Math.sin(t * 1.5 + i) * 0.08 + (activityLevels[p.name] || 0) * 0.2;
        }
      });

      // Rotate stations
      S.stations.forEach((s, i) => {
        s.mesh.rotation.y += 0.005;
        if (s.ring1) s.ring1.rotation.x += 0.01;
        if (s.ring2) s.ring2.rotation.z += 0.008;
      });

      // Animate particle trails
      if (S.particles) {
        const pos = S.particles.geometry.attributes.position.array;
        for (let i = 0; i < pos.length; i += 3) {
          pos[i + 2] += 0.05;
          if (pos[i + 2] > 5) pos[i + 2] = -200;
        }
        S.particles.geometry.attributes.position.needsUpdate = true;
      }

      // Cockpit interior animations
      if (S.cockpit) {
        S.cockpit.screens?.forEach((s, i) => {
          if (s.material) s.material.emissiveIntensity = 0.3 + Math.sin(t * 2 + i * 1.3) * 0.15;
        });
        S.cockpit.buttons?.forEach((b, i) => {
          if (b.material) b.material.emissiveIntensity = 0.5 + Math.sin(t * 3 + i * 0.7) * 0.3;
        });

      }

      // Raycaster hover
      raycaster.setFromCamera(mouse, camera);
      const allMeshes = [...S.planets.map(p => p.mesh), ...S.stations.map(s => s.mesh)];
      const hits = raycaster.intersectObjects(allMeshes, true);
      const hovered = hits.length ? hits[0].object : null;

      if (hovered !== S.hoveredObj) {
        S.hoveredObj = hovered;
        const hitData = allData.find(d => d.mesh === hovered || d.mesh.children?.includes(hovered));
        if (onHover) onHover(hitData ? hitData.name : null);
        renderer.domElement.style.cursor = hovered ? 'pointer' : 'default';
      }

      renderer.render(scene, camera);
    };
    animate();
  }, [onModuleSelect, onHover]);

  useEffect(() => {
    buildScene();
    const S = stateRef.current;
    return () => {
      cancelAnimationFrame(S.animId);
      window.removeEventListener('resize', S.onResize);
      S.cleanup?.();
      if (S.renderer && mountRef.current) {
        if (S.renderer.domElement.parentNode === mountRef.current) {
          mountRef.current.removeChild(S.renderer.domElement);
        }
        S.renderer.dispose();
      }
    };
  }, [buildScene]);

  return <div ref={mountRef} className="absolute inset-0 w-full h-full" />;
}

// ── Builder helpers ──────────────────────────────────────────────────────────

function buildStarfield(scene, count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const starColors = [[1,1,1],[0,0.9,1],[1,0.18,0.77],[0.98,0.84,0.36]];
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-0.5)*800;
    pos[i*3+1] = (Math.random()-0.5)*800;
    pos[i*3+2] = (Math.random()-0.5)*800 - 100;
    const c = starColors[Math.floor(Math.random()*starColors.length)];
    col[i*3]=c[0]; col[i*3+1]=c[1]; col[i*3+2]=c[2];
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 0.4, vertexColors: true, sizeAttenuation: true });
  scene.add(new THREE.Points(geo, mat));
}

function buildNebula(scene) {
  const nebulaColors = [0x3a1a5f, 0x00e8ff, 0xff2ec4];
  nebulaColors.forEach((col, i) => {
    const geo = new THREE.BufferGeometry();
    const count = 600;
    const pos = new Float32Array(count * 3);
    for (let j = 0; j < count; j++) {
      pos[j*3]   = (Math.random()-0.5)*300 + (i-1)*80;
      pos[j*3+1] = (Math.random()-0.5)*150 + i*20;
      pos[j*3+2] = (Math.random()-0.5)*200 - 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({ color: col, size: 1.2, transparent: true, opacity: 0.25, sizeAttenuation: true });
    scene.add(new THREE.Points(geo, mat));
  });
}

function buildCockpitInterior(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // Cockpit sits at the very bottom of the view — well below the planet horizon.
  // Camera is at z=10 looking toward z=-20. Y=-6 pushes everything below the viewport center.

  // Main dashboard slab (bottom strip)
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x050a1a, metalness: 0.85, roughness: 0.2 });
  const dash = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 1.2), dashMat);
  dash.position.set(0, -6.5, 6); dash.rotation.x = -0.5; group.add(dash);

  // Left console — angled inward, low and to the side
  const leftConsole = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 1), new THREE.MeshStandardMaterial({ color: 0x0a0a1e, metalness: 0.9, roughness: 0.15, emissive: 0xa855f7, emissiveIntensity: 0.08 }));
  leftConsole.position.set(-9, -6.2, 6.5); leftConsole.rotation.y = 0.45; group.add(leftConsole);

  // Right console
  const rightConsole = new THREE.Mesh(new THREE.BoxGeometry(3.5, 2.5, 1), new THREE.MeshStandardMaterial({ color: 0x0a0a1e, metalness: 0.9, roughness: 0.15, emissive: 0x00e8ff, emissiveIntensity: 0.08 }));
  rightConsole.position.set(9, -6.2, 6.5); rightConsole.rotation.y = -0.45; group.add(rightConsole);

  // Small angled screens — tilted steeply down so they don't block the sky
  const screens = [];
  const screenData = [
    { x: -7, y: -5.5, z: 6.8, rx: -1.1, ry: 0.3, color: 0xa855f7, w: 2.5, h: 1.5 },
    { x:  0, y: -5.2, z: 6.2, rx: -1.0, ry: 0,   color: 0x00e8ff, w: 3.5, h: 1.8 },
    { x:  7, y: -5.5, z: 6.8, rx: -1.1, ry:-0.3, color: 0x10b981, w: 2.5, h: 1.5 },
  ];
  screenData.forEach((sd) => {
    const mat = new THREE.MeshStandardMaterial({ color: sd.color, emissive: sd.color, emissiveIntensity: 0.5, transparent: true, opacity: 0.9 });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sd.w, sd.h), mat);
    mesh.position.set(sd.x, sd.y, sd.z);
    mesh.rotation.set(sd.rx, sd.ry, 0);
    group.add(mesh);
    screens.push(mesh);

    const edges = new THREE.EdgesGeometry(new THREE.PlaneGeometry(sd.w, sd.h));
    const border = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: sd.color, transparent: true, opacity: 0.7 }));
    border.position.copy(mesh.position);
    border.rotation.copy(mesh.rotation);
    group.add(border);
  });

  // Control buttons along the dash
  const buttons = [];
  const buttonColors = [0x00e8ff, 0xff2ec4, 0xf9d65c, 0x10b981, 0xa855f7, 0x3b82f6];
  for (let i = 0; i < 12; i++) {
    const col = buttonColors[i % buttonColors.length];
    const btn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12),
      new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.8, metalness: 0.5 })
    );
    btn.position.set(-3.5 + (i % 6) * 1.4, -5.8, 7.2 - Math.floor(i/6)*0.3);
    group.add(btn);
    buttons.push(btn);
  }

  // Gauge rings on dash corners
  [-5, 5].forEach((x, i) => {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.45, 0.04, 8, 48),
      new THREE.MeshStandardMaterial({ color: i === 0 ? 0xa855f7 : 0x00e8ff, emissive: i === 0 ? 0xa855f7 : 0x00e8ff, emissiveIntensity: 1.2 })
    );
    ring.position.set(x, -5.7, 7.3); ring.rotation.x = -0.5;
    group.add(ring);
  });

  return { screens, buttons, scanLine: null };
}

function buildPlanet(scene, dept, activity = 0) {
  const group = new THREE.Group();
  scene.add(group);
  group.position.set(dept.x, dept.y, dept.z);

  // Core planet
  const geo = new THREE.IcosahedronGeometry(dept.r, 5);
  const mat = new THREE.MeshStandardMaterial({
    color: dept.color, emissive: dept.color, emissiveIntensity: 0.25 + activity * 0.3,
    metalness: 0.3, roughness: 0.6,
  });
  const mesh = new THREE.Mesh(geo, mat);
  group.add(mesh);

  // Atmosphere glow shell
  const glowMat = new THREE.MeshStandardMaterial({
    color: dept.glow, emissive: dept.glow, emissiveIntensity: 0.5,
    transparent: true, opacity: 0.18, side: THREE.BackSide,
  });
  const glow = new THREE.Mesh(new THREE.IcosahedronGeometry(dept.r * 1.25, 4), glowMat);
  group.add(glow);

  // Orbital ring
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(dept.r * 1.6, 0.07, 6, 48),
    new THREE.MeshStandardMaterial({ color: dept.color, emissive: dept.color, emissiveIntensity: 0.8, transparent: true, opacity: 0.5 })
  );
  ring.rotation.x = Math.PI / 2 + Math.random() * 0.4;
  group.add(ring);

  // Orbiting satellite dots
  const orbitGroup = new THREE.Group();
  group.add(orbitGroup);
  const satCount = Math.max(1, Math.round(1 + activity * 3));
  for (let s = 0; s < satCount; s++) {
    const sat = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: dept.glow, emissiveIntensity: 2 })
    );
    const angle = (s / satCount) * Math.PI * 2;
    sat.position.set(Math.cos(angle) * dept.r * 1.9, 0, Math.sin(angle) * dept.r * 1.9);
    orbitGroup.add(sat);
  }

  return { mesh, ring, orbitGroup, glowMat, rotSpeed: 0.003 + Math.random() * 0.004, route: dept.route, name: dept.name };
}

function buildStation(scene, st) {
  const group = new THREE.Group();
  group.position.set(st.x, st.y, st.z);
  scene.add(group);

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 0.8, 4, 8),
    new THREE.MeshStandardMaterial({ color: st.color, emissive: st.color, emissiveIntensity: 0.3, metalness: 0.9, roughness: 0.1 })
  );
  group.add(body);

  const r1 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.1, 6, 32), new THREE.MeshStandardMaterial({ color: st.color, emissive: st.color, emissiveIntensity: 1 }));
  r1.rotation.x = Math.PI / 2; group.add(r1);
  const r2 = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.06, 6, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.5 }));
  r2.rotation.z = Math.PI / 2; group.add(r2);

  return { mesh: group, ring1: r1, ring2: r2, route: st.route, name: st.name };
}

function buildWormholes(scene) {
  [{ x: -35, y: 0, z: -70 }, { x: 35, y: 5, z: -65 }].forEach((pos, i) => {
    const geo = new THREE.TorusGeometry(4, 0.3, 12, 64);
    const mat = new THREE.MeshStandardMaterial({
      color: i === 0 ? 0xa855f7 : 0x00ffd9,
      emissive: i === 0 ? 0xa855f7 : 0x00ffd9,
      emissiveIntensity: 1.5, transparent: true, opacity: 0.8,
    });
    const wh = new THREE.Mesh(geo, mat);
    wh.position.set(pos.x, pos.y, pos.z);
    wh.rotation.y = Math.PI / 4;
    scene.add(wh);

    // Inner vortex
    const inner = new THREE.Mesh(
      new THREE.CircleGeometry(3.5, 32),
      new THREE.MeshStandardMaterial({ color: i === 0 ? 0x3a1a5f : 0x00ffd9, emissive: i === 0 ? 0x3a1a5f : 0x00ffd9, emissiveIntensity: 0.4, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
    );
    inner.position.set(pos.x, pos.y, pos.z);
    inner.rotation.y = Math.PI / 4;
    scene.add(inner);
  });
}

function buildParticleTrails(scene) {
  const count = 800;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i*3]   = (Math.random()-0.5)*60;
    pos[i*3+1] = (Math.random()-0.5)*40;
    pos[i*3+2] = Math.random()*-200;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0x00e8ff, size: 0.15, transparent: true, opacity: 0.5 });
  const pts = new THREE.Points(geo, mat);
  scene.add(pts);
  return pts;
}