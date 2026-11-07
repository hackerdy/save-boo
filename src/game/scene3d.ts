// 3D night graveyard for Save Boo, built on three.js (imported from npm).
// createScene(canvas) returns a SceneApi that React drives (progress, mood, mouths,
// camera, finale). If WebGL is not available it returns a no-op API with ok = false
// and App.tsx renders the DOM/emoji FallbackStage instead.
import * as THREE from 'three';
import type { Who } from '../types';

type Mood = 'happy' | 'angry' | 'neutral';
interface GhostOpts { scale: number; color: number; emissive: number; glowColor: number; boo: boolean }
interface Ghost {
  root: THREE.Group;
  body: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  mouth: THREE.Mesh;
  eyes: THREE.Mesh[];
  arms: THREE.Mesh[];
  glow: THREE.Sprite;
  light: THREE.PointLight;
  brows: THREE.Mesh[];
}

export interface SceneApi {
  ok: boolean;
  setProgress(p: number): void;
  mood(m: Mood): void;
  shake(): void;
  mouth(who: Who, v: number): void;
  cam(i: number): void;
  punch(): void;
  pass(): void;
  finale(): void;
  /** No shake, camera sway or parallax. */
  setReducedMotion(on: boolean): void;
  /** Cap pixel ratio and hide most particles. Also switched on automatically on slow frames. */
  setLowPower(on: boolean): void;
  reset(): void;
  dispose(): void;
}

export function createScene(canvas: HTMLCanvasElement): SceneApi {
  const api: SceneApi = {
    ok: false,
    setProgress() {}, mood() {}, shake() {}, mouth() {}, cam() {}, punch() {}, pass() {}, finale() {}, setReducedMotion() {}, setLowPower() {}, reset() {}, dispose() {},
  };
  let renderer: THREE.WebGLRenderer;
  try {
    const probe = document.createElement('canvas');
    if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) return api;
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  } catch (e) { return api; }

  const small = window.matchMedia && window.matchMedia('(max-width: 700px)').matches;
  let MAXDPR = small ? 1.5 : 2;
  let reducedMotion = false;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAXDPR));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.85;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0820);
  scene.fog = new THREE.FogExp2(0x120d2e, 0.045);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 80);
  const clock = new THREE.Clock();
  const rnd = (a: number, b: number) => Math.random() * (b - a) + a;

  /* ---------- textures ---------- */
  function radialTex(inner: string, outer: string) {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, inner); gr.addColorStop(1, outer);
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }
  const glowTex = radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
  const mistTex = radialTex('rgba(200,210,255,.35)', 'rgba(200,210,255,0)');

  /* ---------- lights ---------- */
  scene.add(new THREE.HemisphereLight(0x6a6ad0, 0x1a1030, 0.7));
  const moonLight = new THREE.DirectionalLight(0xa9b8ff, 1.0);
  moonLight.position.set(-6, 10, 4);
  scene.add(moonLight);
  const rim = new THREE.PointLight(0xff7a1a, 0.8, 18);
  rim.position.set(3, 1.5, 3);
  scene.add(rim);

  /* ---------- moon + stars ---------- */
  const moon = new THREE.Mesh(new THREE.SphereGeometry(2.2, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff3d6, fog: false }));
  moon.position.set(-9, 9, -26);
  scene.add(moon);
  const moonGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true, opacity: 0.7 }));
  moonGlow.scale.set(14, 14, 1); moonGlow.position.copy(moon.position);
  scene.add(moonGlow);

  {
    const n = 260, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const th = rnd(0, Math.PI * 2), r = rnd(30, 45);
      pos[i * 3] = Math.cos(th) * r; pos[i * 3 + 1] = rnd(4, 30); pos[i * 3 + 2] = -Math.abs(Math.sin(th)) * r - 8;
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, fog: false, transparent: true, opacity: 0.8 })));
  }

  /* ---------- ground + graveyard ---------- */
  const ground = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: 0x0f1a16, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x6b6b85, roughness: 0.9 });
  function gravestone(x: number, z: number, s: number, ry: number) {
    const g = new THREE.Group();
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.1, 0.25), stoneMat);
    base.position.y = 0.55;
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.25, 14, 1, false, 0, Math.PI), stoneMat);
    top.rotation.set(Math.PI / 2, 0, Math.PI / 2); top.position.y = 1.1;
    top.rotation.set(0, 0, 0); top.rotation.x = Math.PI / 2; top.rotation.order = 'YXZ';
    g.add(base, top);
    g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = ry; g.rotation.z = rnd(-0.1, 0.1);
    scene.add(g);
  }
  for (let i = 0; i < 22; i++) {
    const side = i % 2 ? 1 : -1;
    gravestone(side * rnd(3.8, 14), rnd(-14, 0.5), rnd(0.8, 1.5), rnd(-0.4, 0.4) + (side > 0 ? 0.3 : -0.3));
  }

  // dead trees
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x241a2a, roughness: 1 });
  function tree(x: number, z: number, h: number) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.35, h, 7), barkMat);
    trunk.position.y = h / 2; g.add(trunk);
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, h * 0.5, 5), barkMat);
      const a = (i / 5) * Math.PI * 2;
      b.position.set(Math.cos(a) * 0.5, h * (0.55 + 0.07 * i), Math.sin(a) * 0.5);
      b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9);
      g.add(b);
    }
    g.position.set(x, 0, z); scene.add(g);
  }
  [[-7, -8, 6], [8, -10, 7], [-12, -14, 8], [13, -6, 5.5], [0, -20, 9], [-5, -17, 7]].forEach((t) => tree(t[0], t[1], t[2]));

  // iron fence posts
  const fenceMat = new THREE.MeshStandardMaterial({ color: 0x15121f, roughness: 0.6, metalness: 0.5 });
  for (let i = -8; i <= 8; i++) {
    const p = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.4, 5), fenceMat);
    p.position.set(i * 1.1, 0.7, -3.5); p.scale.y = 1 + (i % 2) * 0.25; scene.add(p);
  }

  // jack-o-lanterns with flickering light
  const pumpkins: THREE.PointLight[] = [];
  function pumpkin(x: number, z: number, s: number) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), new THREE.MeshStandardMaterial({ color: 0xff7a1a, emissive: 0xff4a00, emissiveIntensity: 0.35, roughness: 0.7 }));
    m.scale.set(1.15, 0.9, 1.15); m.position.y = 0.45; g.add(m);
    const dark = new THREE.MeshBasicMaterial({ color: 0x2a0a00 });
    [[-0.17, 0.56], [0.17, 0.56]].forEach(([ex, ey]) => {
      const e = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.15, 3), dark); e.position.set(ex, ey, 0.5); e.rotation.x = Math.PI / 2; g.add(e);
    });
    const mo = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.05), dark); mo.position.set(0, 0.28, 0.53); g.add(mo);
    const l = new THREE.PointLight(0xff7a1a, 0.9, 5); l.position.set(0, 0.6, 0.3); g.add(l);
    g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = -x * 0.08;
    scene.add(g); pumpkins.push(l);
  }
  pumpkin(4.2, 2.2, 1); pumpkin(-4.6, 2.8, 0.8); pumpkin(6.5, -2, 1.2); pumpkin(-7, -1.5, 1);

  /* ---------- particles ---------- */
  const FF = 70;
  const ffPos = new Float32Array(FF * 3), ffSeed: Array<[number, number, number]> = [];
  for (let i = 0; i < FF; i++) {
    ffPos.set([rnd(-9, 9), rnd(0.3, 4), rnd(-9, 4)], i * 3);
    ffSeed.push([rnd(0, 6.28), rnd(0.3, 1), rnd(0.3, 1)]);
  }
  const ffGeo = new THREE.BufferGeometry(); ffGeo.setAttribute('position', new THREE.BufferAttribute(ffPos, 3));
  const fireflies = new THREE.Points(ffGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xcfff7a, size: 0.35, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(fireflies);

  const mists: THREE.Sprite[] = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: rnd(0.35, 0.7) }));
    s.scale.set(rnd(6, 10), rnd(1.5, 2.5), 1); s.position.set(rnd(-10, 10), rnd(0.3, 1), rnd(-10, 3));
    scene.add(s); mists.push(s);
  }

  /* ---------- ghosts ---------- */
  function ghostBody(w: number, h: number, color: number, emissive: number) {
    const geo = new THREE.SphereGeometry(1, 28, 20);
    const p = (geo.attributes.position as THREE.BufferAttribute);
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (y < 0) {
        const a = Math.atan2(z, x);
        y = y * 1.7 - (y < -0.2 ? Math.sin(a * 6) * 0.1 * -y : 0);
        const k = 1 + (-p.getY(i)) * 0.1; x *= k; z *= k;
      }
      p.setXYZ(i, x * w, y * h, z * w);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: 0.35, roughness: 0.55, transparent: true, opacity: 0.96 });
    return new THREE.Mesh(geo, mat);
  }

  function makeGhost({ scale, color, emissive, glowColor, boo }: GhostOpts): Ghost {
    const root = new THREE.Group();
    const body = ghostBody(boo ? 1.05 : 0.9, boo ? 0.95 : 1, color, emissive);
    root.add(body);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0c0a14 });
    const eyes: THREE.Mesh[] = [];
    const ex = boo ? 0.36 : 0.3, ey = boo ? 0.12 : 0.28, er = boo ? 0.17 : 0.1;
    [-1, 1].forEach((s) => {
      const e = new THREE.Mesh(new THREE.SphereGeometry(er, 12, 10), eyeMat);
      e.position.set(s * ex, ey, boo ? 0.88 : 0.8); root.add(e); eyes.push(e);
      if (boo) {
        const sh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        sh.position.set(s * ex + 0.04, ey + 0.06, 1.03); root.add(sh);
        const ch = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8fb1, transparent: true, opacity: 0.55 }));
        ch.scale.z = 0.3; ch.position.set(s * 0.62, -0.12, 0.74); ch.lookAt(s * 2, -0.1, 3); root.add(ch);
      }
    });
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshBasicMaterial({ color: 0x120810 }));
    mouth.position.set(0, boo ? -0.18 : -0.22, boo ? 0.95 : 0.8);
    const mw = boo ? 0.1 : 0.17;
    mouth.userData = { w: mw, base: boo ? 0.05 : 0.04 };
    mouth.scale.set(mw, mouth.userData.base, 0.05);
    root.add(mouth);

    // arms
    const armGeo = new THREE.SphereGeometry(boo ? 0.2 : 0.17, 10, 8);
    const arms = [-1, 1].map((s) => {
      const a = new THREE.Mesh(armGeo, body.material); a.scale.set(0.8, 1.5, 0.8);
      a.position.set(s * (boo ? 1.0 : 0.88), -0.35, 0.2); a.rotation.z = s * 0.7; root.add(a); return a;
    });

    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: glowColor, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.3 }));
    glow.scale.set(boo ? 5 : 4.5, boo ? 5 : 4.5, 1); glow.position.set(0, 0, -0.2); root.add(glow);
    const light = new THREE.PointLight(glowColor, 0.5, 9); light.position.set(0, 0.3, 1.8); root.add(light);

    root.scale.setScalar(scale);
    scene.add(root);
    return { root, body, mouth, eyes, arms, glow, light, brows: [] };
  }

  const boo = makeGhost({ scale: 0.8, color: 0xffffff, emissive: 0xffa0c8, glowColor: 0xff9ac4, boo: true });
  const mort = makeGhost({ scale: 1.5, color: 0xdfe1f4, emissive: 0x5a5fa0, glowColor: 0x8aa0ff, boo: false });

  // Mortimer extras: glasses, brows, mustache, wispy hair
  {
    const gm = new THREE.MeshStandardMaterial({ color: 0x2a2a35, metalness: 0.7, roughness: 0.3 });
    [-1, 1].forEach((s) => {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 22), gm);
      r.position.set(s * 0.3, 0.28, 0.82); mort.root.add(r);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.21, 20), new THREE.MeshBasicMaterial({ color: 0x9fb4ff, transparent: true, opacity: 0.22 }));
      lens.position.set(s * 0.3, 0.28, 0.83); mort.root.add(lens);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.06), new THREE.MeshStandardMaterial({ color: 0xb9b9c9 }));
      b.position.set(s * 0.3, 0.6, 0.78); mort.root.add(b); mort.brows.push(b);
    });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), gm); bridge.position.set(0, 0.3, 0.84); mort.root.add(bridge);
    const must = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.05, 8, 14, Math.PI), new THREE.MeshStandardMaterial({ color: 0xd5d5e6 }));
    must.position.set(0, -0.08, 0.82); must.rotation.z = Math.PI; mort.root.add(must);
    for (let i = 0; i < 5; i++) {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.02, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0xcfcfe0 }));
      w.position.set((i - 2) * 0.16, 1.0, 0.1); w.rotation.z = (i - 2) * 0.35; mort.root.add(w);
    }
  }

  const BOO_POS = new THREE.Vector3(-2.1, 1.1, 1.0);
  const MORT_POS = new THREE.Vector3(2.0, 1.9, -0.5);
  boo.root.position.copy(BOO_POS); mort.root.position.copy(MORT_POS);

  /* ---------- finale burst ---------- */
  const BN = 220;
  const bPos = new Float32Array(BN * 3), bVel: THREE.Vector3[] = [];
  for (let i = 0; i < BN; i++) bVel.push(new THREE.Vector3());
  const bGeo = new THREE.BufferGeometry(); bGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
  const bMat = new THREE.PointsMaterial({ map: glowTex, color: 0xffd0e6, size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 });
  const burst = new THREE.Points(bGeo, bMat); burst.frustumCulled = false; scene.add(burst);
  let burstT = -1;
  const flash = new THREE.PointLight(0xffe0f0, 0, 30); flash.position.set(-2, 2, 3); scene.add(flash);

  /* ---------- state ---------- */
  const st = {
    progress: 0, target: 0, mood: 'neutral' as Mood, shake: 0, punch: 0, pass: 0, finale: 0,
    mouth: { grand: 0, boo: 0 } as Record<Who, number>, angry: 0, camIdx: 0, hop: 0,
  };
  const CAMS: Array<[[number, number, number], [number, number, number]]> = [
    // pos, look
    [[0, 2.6, 9.5], [0, 1.2, 0]],      // intro
    [[2.2, 2.8, 7.2], [1.2, 1.9, 0]],  // 1 checkbox: focus Mortimer
    [[-0.5, 3.2, 8], [0, 1.3, 0]],     // 2 grid
    [[1.8, 2.4, 6.4], [1.4, 1.9, 0]],  // 3 text: close on Mortimer
    [[-2.8, 2.0, 7], [-1.8, 1.2, 0.5]], // 4 breathe: look at Boo
    [[-1.0, 1.8, 6.5], [-1.3, 1.2, 0.5]], // 5 heartbeat
    [[0.5, 2.4, 5.8], [1.4, 1.9, 0]],  // 6 confess: tight on Mortimer
    [[-1.2, 2.2, 6.2], [-2.0, 1.5, 0.8]], // finale: Boo
  ];
  const camPos = new THREE.Vector3(...CAMS[0][0]), camLook = new THREE.Vector3(...CAMS[0][1]);
  const wantPos = new THREE.Vector3(), wantLook = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();

  function applyLowPower(on: boolean) {
    MAXDPR = on ? 1 : small ? 1.5 : 2;
    ffGeo.setDrawRange(0, on ? 18 : FF);
    mists.forEach((m, i) => { m.visible = !on || i % 3 === 0; });
    resize();
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAXDPR));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 68 : 50;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize();

  // Gentle pointer parallax (works for mouse and touch drag)
  let px = 0, py = 0;
  const onPointer = (e: PointerEvent) => {
    px = (e.clientX / window.innerWidth - 0.5) * 2;
    py = (e.clientY / window.innerHeight - 0.5) * 2;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  /* ---------- loop ---------- */
  let running = true, disposed = false, raf = 0;
  let autoLow = false, slowN = 0, slowSum = 0;
  const onVisibility = () => { running = !document.hidden; if (running) clock.getDelta(); };
  document.addEventListener('visibilitychange', onVisibility);

  function frame() {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const rawDt = clock.getDelta();
    const dt = Math.min(rawDt, 0.05), t = clock.elapsedTime;
    // Auto low-power: if 90 frames average slower than ~24fps, drop resolution and particles once.
    if (!autoLow) {
      slowN++; slowSum += rawDt;
      if (slowN >= 90) { if (slowSum / slowN > 0.042) { autoLow = true; applyLowPower(true); } slowN = 0; slowSum = 0; }
    }
    const mot = reducedMotion ? 0 : 1;

    st.progress += (st.target - st.progress) * Math.min(1, dt * 2);
    st.shake *= Math.pow(0.02, dt); st.punch *= Math.pow(0.003, dt);
    st.pass *= Math.pow(0.1, dt); st.angry *= Math.pow(0.2, dt); st.hop *= Math.pow(0.05, dt);

    // Boo: dims at the start, glows as progress rises
    const p = st.progress;
    boo.body.material.opacity = 0.2 + 0.78 * p + st.finale * 0.02;
    boo.body.material.emissiveIntensity = 0.1 + p * 0.5 + st.pass * 0.4;
    boo.glow.material.opacity = 0.05 + p * 0.55 + st.pass * 0.5;
    boo.light.intensity = 0.15 + p * 1.2 + st.pass * 1.2 + st.finale * 1;
    const booScale = 0.8 + p * 0.1 + st.finale * 0.15;
    boo.root.scale.setScalar(booScale + Math.sin(t * 6) * 0.01 * st.finale);
    boo.root.position.set(BOO_POS.x, BOO_POS.y + Math.sin(t * 1.6) * 0.12 + st.hop * 0.6 + Math.abs(Math.sin(t * 5)) * 0.35 * st.finale, BOO_POS.z);
    boo.root.rotation.y = 0.35 + Math.sin(t * 0.8) * 0.1;
    boo.root.rotation.z = (1 - p) * 0.25 * Math.sin(t * 0.7) - (1 - p) * 0.1;
    boo.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.7 + Math.sin(t * 8 + i) * 0.4 * st.finale); });
    // closed sleepy eyes when weak
    boo.eyes.forEach((e) => { e.scale.y = 0.25 + 0.75 * Math.min(1, p * 1.4 + st.finale); });

    // Mortimer
    const angry = st.angry, happy = st.mood === 'happy' ? 1 : 0;
    const sx = Math.sin(t * 60) * st.shake * 0.25 * mot;
    mort.root.position.set(MORT_POS.x + sx, MORT_POS.y + Math.sin(t * 1.2) * 0.18 + happy * Math.abs(Math.sin(t * 3)) * 0.1, MORT_POS.z);
    mort.root.rotation.y = -0.4 + Math.sin(t * 0.6) * 0.08;
    mort.root.rotation.z = Math.sin(t * 70) * st.shake * 0.08 * mot;
    const mscale = 1.5 * (1 + angry * 0.15);
    mort.root.scale.setScalar(mscale);
    mort.body.material.emissive.setHex(angry > 0.15 ? 0xa02030 : 0x5a5fa0);
    mort.body.material.emissiveIntensity = 0.35 + angry * 0.8 + st.pass * 0.2;
    mort.glow.material.color.setHex(angry > 0.15 ? 0xff4050 : (happy ? 0xffe2a0 : 0x8aa0ff));
    mort.glow.material.opacity = 0.3 + angry * 0.4 + happy * 0.15;
    mort.brows.forEach((b, i) => {
      const s = i ? 1 : -1;
      b.rotation.z = s * (angry > 0.15 ? -0.5 : (happy ? 0.25 : 0.1));
      b.position.y = 0.6 + (happy ? 0.06 : 0) - (angry > 0.15 ? 0.04 : 0);
    });
    mort.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.7 + (happy ? 0.8 : 0) + angry * 0.5 + Math.sin(t * 2 + i) * 0.1); });

    // mouths (open amount from voice, plus mood shape when silent)
    ([[mort, 'grand'], [boo, 'boo']] as Array<[Ghost, Who]>).forEach(([g, who]) => {
      const m = g.mouth, o = st.mouth[who];
      const mood = who === 'grand' ? (happy ? 0.05 : 0) : 0.02 + st.finale * 0.06;
      m.scale.set(m.userData.w * (1 + o * 0.25), m.userData.base + mood + o * (who === 'boo' ? 0.16 : 0.2), 0.05);
    });

    // fireflies
    const fp = (ffGeo.attributes.position as THREE.BufferAttribute);
    for (let i = 0; i < FF; i++) {
      const s = ffSeed[i];
      fp.setXYZ(i, fp.getX(i) + Math.sin(t * s[1] + s[0]) * dt * 0.4, fp.getY(i) + Math.cos(t * s[2] + s[0]) * dt * 0.25, fp.getZ(i) + Math.sin(t * 0.5 + s[0]) * dt * 0.3);
    }
    fp.needsUpdate = true;
    fireflies.material.size = 0.3 + Math.sin(t * 3) * 0.05;
    mists.forEach((m, i) => { m.position.x += Math.sin(t * 0.1 + i) * dt * 0.3; });
    pumpkins.forEach((l, i) => { l.intensity = 0.8 + Math.sin(t * 9 + i * 2) * 0.2 + Math.sin(t * 23 + i) * 0.1; });
    moonGlow.material.opacity = 0.65 + Math.sin(t * 0.5) * 0.05;
    rim.intensity = 0.7 + st.pass * 1.2;

    // finale burst
    if (burstT >= 0) {
      burstT += dt;
      const bp = (bGeo.attributes.position as THREE.BufferAttribute);
      for (let i = 0; i < BN; i++) {
        bp.setXYZ(i, bp.getX(i) + bVel[i].x * dt, bp.getY(i) + bVel[i].y * dt, bp.getZ(i) + bVel[i].z * dt);
        bVel[i].y -= dt * 1.2; bVel[i].multiplyScalar(1 - dt * 0.4);
      }
      bp.needsUpdate = true;
      bMat.opacity = Math.max(0, 1 - burstT / 4);
      flash.intensity = Math.max(0, 5 * Math.exp(-burstT * 2.2));
      (scene.background as THREE.Color).setRGB(0.04 + 0.06 * Math.exp(-burstT * 1.5), 0.03 + 0.02 * Math.exp(-burstT * 1.5), 0.13 + 0.06 * Math.exp(-burstT * 1.5));
      if (burstT > 4.5) burstT = -1;
    }

    // camera: eased move toward the current preset, plus drift, punch, and parallax
    const [cp, cl] = CAMS[st.camIdx];
    const narrow = camera.aspect < 0.8 ? (0.8 - camera.aspect) * 9 : 0;
    wantPos.set(cp[0], cp[1], cp[2] + 2 + narrow);
    wantLook.set(cl[0], cl[1] - (camera.aspect < 0.8 ? 1.2 : 1.1), cl[2]); // push ghosts into the upper area, above the UI
    const k = 1 - Math.pow(0.12, dt);
    camPos.lerp(wantPos, k); camLook.lerp(wantLook, k);
    camera.position.set(
      camPos.x + mot * (Math.sin(t * 0.25) * 0.35 + px * 0.35 + (Math.random() - 0.5) * st.punch * 0.3),
      camPos.y + mot * (Math.sin(t * 0.33) * 0.15 - py * 0.15 + (Math.random() - 0.5) * st.punch * 0.3),
      camPos.z - mot * st.punch * 0.9,
    );
    tmpLook.copy(camLook);
    camera.lookAt(tmpLook);

    renderer.render(scene, camera);
  }
  raf = requestAnimationFrame(frame);

  /* ---------- API ---------- */
  Object.assign(api, {
    ok: true,
    setProgress(p: number) { st.target = Math.max(0, Math.min(1, p)); },
    mood(m: Mood) { st.mood = m; if (m === 'angry') st.angry = 1; },
    shake() { st.shake = 1; st.punch = Math.max(st.punch, 0.8); st.angry = Math.max(st.angry, 0.6); },
    mouth(who: Who, v: number) { st.mouth[who] = v; },
    cam(i: number) { st.camIdx = Math.max(0, Math.min(CAMS.length - 1, i)); },
    punch() { st.punch = 1; },
    setReducedMotion(on: boolean) { reducedMotion = on; canvas.dataset.reduced = on ? '1' : '0'; },
    setLowPower(on: boolean) { if (!autoLow) applyLowPower(on); },
    pass() { st.pass = 1; st.hop = 1; },
    reset() { st.finale = 0; st.camIdx = 0; st.target = 0; burstT = -1; flash.intensity = 0; bMat.opacity = 0; (scene.background as THREE.Color).setRGB(0.04, 0.03, 0.13); },
    finale() {
      st.finale = 1; st.camIdx = 7; st.target = 1; st.pass = 1; burstT = 0;
      const o = boo.root.position;
      for (let i = 0; i < BN; i++) {
        bPos.set([o.x, o.y + 0.3, o.z], i * 3);
        bVel[i].set(rnd(-1, 1), rnd(-0.3, 1), rnd(-1, 1)).normalize().multiplyScalar(rnd(2, 7));
      }
      (bGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    },
  });
  api.dispose = () => {
    running = false; disposed = true;
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', resize);
    window.removeEventListener('pointermove', onPointer);
    document.removeEventListener('visibilitychange', onVisibility);
    cancelAnimationFrame(raf);
    // Free GPU resources: geometries, materials and their textures.
    const mats = new Set<THREE.Material>();
    scene.traverse((o) => {
      const obj = o as THREE.Object3D & { geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] };
      obj.geometry?.dispose();
      if (obj.material) (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach((m) => mats.add(m));
    });
    mats.forEach((m) => m.dispose());
    glowTex.dispose(); mistTex.dispose();
    renderer.dispose();
  };
  canvas.dataset.ready = '1';
  return api;
}
