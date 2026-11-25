/**
 * The listening-room gallery: a plaster studio with three exhibits on plinths.
 * Scroll progress walks a camera down the room; the copy lives in the DOM.
 *
 * This module is deliberately React-free: `GalleryCanvas` owns lifecycle.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

export type GalleryKey = {
  p: number;
  pos: [number, number, number];
  look: [number, number, number];
  fov: number;
};

/** Camera beats along the exhibition. p is progress across the exhibit zone. */
export const CAMERA_KEYS: GalleryKey[] = [
  // establishing view: the whole room held to the left of the headline column
  { p: 0.0, pos: [7.4, 3.1, 15.2], look: [2.2, 1.32, -1.2], fov: 36 },
  // near-static hold: the opening statement clears before the room starts moving
  { p: 0.05, pos: [7.0, 3.05, 14.9], look: [2.35, 1.32, -1.2], fov: 35.6 },
  // approach the tower
  { p: 0.12, pos: [0.5, 2.3, 10.6], look: [-2.6, 1.45, 0], fov: 33 },
  // tower framed (its label is up from 0.10 to 0.34); the camera stands just off
  // the tower's right shoulder so the screen falls outside the frustum
  { p: 0.22, pos: [-1.35, 1.95, 9.2], look: [-3.75, 1.15, 0.1], fov: 29 },
  { p: 0.30, pos: [-1.45, 1.9, 8.6], look: [-3.8, 1.1, 0.1], fov: 29 },
  // walk to the screening room
  { p: 0.36, pos: [-1.4, 1.9, 7.8], look: [-1.0, 1.4, -0.6], fov: 31 },
  { p: 0.46, pos: [-1.7, 1.9, 8.4], look: [-0.9, 1.35, -1.0], fov: 32 },
  // screen framed (label 0.46 – 0.68)
  { p: 0.58, pos: [-1.7, 1.86, 8.2], look: [-0.95, 1.36, -1.0], fov: 31 },
  { p: 0.66, pos: [-1.3, 1.82, 7.2], look: [-0.6, 1.4, -1.1], fov: 30 },
  // walk to the everyday room
  { p: 0.74, pos: [0.6, 1.9, 8.6], look: [1.6, 1.0, 0], fov: 31 },
  { p: 0.80, pos: [2.6, 1.95, 8.4], look: [2.6, 0.75, 0], fov: 30 },
  // source framed (label 0.82 – 0.99): a lower, close study of the puck and
  // its plinth; the screen stays as a soft corner behind it
  { p: 0.86, pos: [4.55, 1.98, 5.3], look: [3.2, 0.74, 0], fov: 30 },
  { p: 0.93, pos: [4.3, 1.94, 4.8], look: [3.2, 0.72, 0], fov: 30 },
  // pull back: the whole room again, now that it has been walked
  { p: 1.0, pos: [-1.2, 2.35, 9.8], look: [-2.2, 1.25, -0.4], fov: 34 },
];

/**
 * Portrait stages are tall and narrow, and the wall label owns the lower half,
 * so the walk is composed separately: the camera centres each object and keeps
 * its distance under the fog line (16m), rather than backing off the landscape
 * keys. Same p beats, so the placard spans still line up.
 */
export const CAMERA_KEYS_PORTRAIT: GalleryKey[] = [
  { p: 0.0, pos: [0.2, 2.75, 14.8], look: [0.05, 1.35, -0.9], fov: 39 },
  { p: 0.05, pos: [0.05, 2.7, 14.6], look: [0.1, 1.35, -0.9], fov: 38.5 },
  { p: 0.12, pos: [-0.9, 2.1, 11.6], look: [-3.2, 1.35, 0], fov: 30 },
  // tower framed (label 0.10 – 0.34), centred above the sheet
  { p: 0.22, pos: [-1.9, 1.9, 11.8], look: [-3.2, 1.32, 0], fov: 29 },
  { p: 0.30, pos: [-1.975, 1.88, 11.2], look: [-3.2, 1.33, 0], fov: 29 },
  { p: 0.36, pos: [-1.2, 1.9, 11.0], look: [-1.4, 1.5, -0.5], fov: 30 },
  { p: 0.46, pos: [-0.4, 1.92, 11.6], look: [0, 1.58, -1.2], fov: 31 },
  // screen framed (label 0.46 – 0.68)
  { p: 0.58, pos: [-0.25, 1.9, 10.6], look: [0, 1.6, -1.2], fov: 30 },
  { p: 0.66, pos: [0.05, 1.88, 10.0], look: [0, 1.6, -1.2], fov: 30 },
  { p: 0.74, pos: [1.0, 1.8, 9.4], look: [2.2, 1.0, 0], fov: 30 },
  { p: 0.8, pos: [1.9, 1.72, 8.8], look: [3.2, 0.95, 0], fov: 29 },
  // source framed (label 0.82 – 0.99)
  { p: 0.86, pos: [2.45, 1.68, 7.9], look: [3.2, 0.95, 0], fov: 28 },
  { p: 0.93, pos: [2.9, 1.64, 7.2], look: [3.2, 0.95, 0], fov: 27 },
  { p: 1.0, pos: [0.9, 2.4, 16.0], look: [0.4, 1.3, -1.0], fov: 33 },
];

const PLASTER = 0xeae7dd;
const FLOOR = 0xefede5;

const smooth = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

function sampleCamera(p: number, keys: GalleryKey[]): { pos: THREE.Vector3; look: THREE.Vector3; fov: number } {
  const t = clamp01(p);
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i].p && t <= keys[i + 1].p) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const span = b.p - a.p;
  const e = span > 0 ? smooth(clamp01((t - a.p) / span)) : 0;
  const mix = (u: [number, number, number], v: [number, number, number]) =>
    new THREE.Vector3(u[0] + (v[0] - u[0]) * e, u[1] + (v[1] - u[1]) * e, u[2] + (v[2] - u[2]) * e);
  return { pos: mix(a.pos, b.pos), look: mix(a.look, b.look), fov: a.fov + (b.fov - a.fov) * e };
}

/* ── materials ─────────────────────────────────────────────── */
function materials() {
  return {
    plaster: new THREE.MeshStandardMaterial({ color: 0xf0ece2, roughness: 0.9, metalness: 0 }),
    plasterDeep: new THREE.MeshStandardMaterial({ color: 0xe3dfd3, roughness: 1, metalness: 0 }),
    floor: new THREE.MeshStandardMaterial({ color: FLOOR, roughness: 0.86, metalness: 0 }),
    graphite: new THREE.MeshStandardMaterial({ color: 0x1c1e1f, roughness: 0.5, metalness: 0.22 }),
    baffle: new THREE.MeshStandardMaterial({ color: 0x141516, roughness: 0.72, metalness: 0.05 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x0d0e0e, roughness: 0.88, metalness: 0 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xb28a4f, roughness: 0.34, metalness: 1 }),
    alu: new THREE.MeshStandardMaterial({ color: 0xc9ccce, roughness: 0.3, metalness: 0.94 }),
    aluDark: new THREE.MeshStandardMaterial({ color: 0x8f9497, roughness: 0.4, metalness: 0.9 }),
  };
}
type Mats = ReturnType<typeof materials>;

/* ── contact shadow decal ──────────────────────────────────── */
function contactShadow(size: number, opacity = 0.3): THREE.Mesh {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 128;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
  g.addColorStop(0, `rgba(20,18,12,${opacity})`);
  g.addColorStop(0.55, `rgba(20,18,12,${opacity * 0.45})`);
  g.addColorStop(1, "rgba(20,18,12,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(size, size),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.004;
  mesh.renderOrder = 1;
  return mesh;
}

function plinth(mats: Mats, w: number, h: number, d: number): THREE.Group {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, 0.012), mats.plaster);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  const shadow = contactShadow(Math.max(w, d) * 2.1, 0.34);
  group.add(shadow);
  return group;
}

/* ── exhibit 1: the tower ──────────────────────────────────── */
function driver(mats: Mats, radius: number, type: "woofer" | "mid" | "tweeter"): THREE.Group {
  const g = new THREE.Group();

  if (type === "tweeter") {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.05, radius * 0.09, 14, 48), mats.brass);
    ring.position.z = 0.012;
    g.add(ring);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.72, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), mats.rubber);
    dome.rotation.x = Math.PI / 2;
    dome.position.z = 0.01;
    g.add(dome);
    return g;
  }

  // rim (brass or graphite) + concave cone + dust cap
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * 0.075, 16, 64), type === "mid" ? mats.brass : mats.graphite);
  rim.position.z = 0.014;
  g.add(rim);

  const surround = new THREE.Mesh(new THREE.TorusGeometry(radius * 0.9, radius * 0.09, 14, 48), mats.rubber);
  surround.position.z = 0.012;
  g.add(surround);

  const profile: THREE.Vector2[] = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    profile.push(new THREE.Vector2(radius * 0.16 + radius * 0.82 * u, 0.012 - 0.055 * Math.sin(u * Math.PI * 0.72)));
  }
  const cone = new THREE.Mesh(new THREE.LatheGeometry(profile, 48), type === "mid" ? mats.baffle : mats.rubber);
  cone.rotation.x = -Math.PI / 2;
  g.add(cone);

  const cap = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), mats.graphite);
  cap.rotation.x = Math.PI / 2;
  cap.position.z = 0.012;
  g.add(cap);
  return g;
}

function buildSpeaker(mats: Mats): { group: THREE.Group; turntable: THREE.Group } {
  const group = new THREE.Group();
  group.add(plinth(mats, 0.98, 0.72, 0.98));

  const turntable = new THREE.Group();
  turntable.position.y = 0.72;
  group.add(turntable);

  const W = 0.46, H = 1.62, D = 0.36;
  const cabinet = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 5, 0.016), mats.graphite);
  cabinet.position.y = H / 2 + 0.055;
  cabinet.castShadow = true;
  cabinet.receiveShadow = true;
  turntable.add(cabinet);

  // baffle sits a hair proud of the cabinet
  const baffle = new THREE.Mesh(new RoundedBoxGeometry(W - 0.02, H - 0.03, 0.014, 4, 0.008), mats.baffle);
  baffle.position.set(0, H / 2 + 0.055, D / 2 + 0.002);
  turntable.add(baffle);

  const face = D / 2 + 0.012;
  const tweeter = driver(mats, 0.035, "tweeter");
  tweeter.position.set(0, H - 0.2, face);
  turntable.add(tweeter);

  const mid = driver(mats, 0.082, "mid");
  mid.position.set(0, H - 0.55, face);
  turntable.add(mid);

  const wooferTop = driver(mats, 0.105, "woofer");
  wooferTop.position.set(0, H - 0.92, face);
  turntable.add(wooferTop);

  const wooferLow = driver(mats, 0.105, "woofer");
  wooferLow.position.set(0, H - 1.3, face);
  turntable.add(wooferLow);

  // brass maker's plate
  const plate = new THREE.Mesh(new RoundedBoxGeometry(0.14, 0.032, 0.004, 2, 0.002), mats.brass);
  plate.position.set(0, 0.11, D / 2 + 0.006);
  turntable.add(plate);

  // four feet
  for (const [x, z] of [[-0.14, 0.12], [0.14, 0.12], [-0.14, -0.12], [0.14, -0.12]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.06, 20), mats.brass);
    foot.position.set(x, 0.03, z);
    foot.castShadow = true;
    turntable.add(foot);
  }
  return { group, turntable };
}

/* ── exhibit 2: the screen ─────────────────────────────────── */
function screenTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 288;
  const ctx = canvas.getContext("2d")!;
  // a quiet projected field: low horizon, warm haze, cool ground
  const sky = ctx.createLinearGradient(0, 0, 0, 288);
  sky.addColorStop(0, "#5c6a70");
  sky.addColorStop(0.48, "#9aa39f");
  sky.addColorStop(0.52, "#3d4646");
  sky.addColorStop(1, "#121415");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 512, 288);
  const haze = ctx.createRadialGradient(300, 150, 10, 300, 150, 240);
  haze.addColorStop(0, "rgba(232,214,182,0.55)");
  haze.addColorStop(0.6, "rgba(232,214,182,0.08)");
  haze.addColorStop(1, "rgba(232,214,182,0)");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, 512, 288);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function buildScreen(mats: Mats): { group: THREE.Group; screenMat: THREE.MeshStandardMaterial } {
  const group = new THREE.Group();
  group.add(plinth(mats, 3.0, 0.2, 1.0));

  const tex = screenTexture();
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x0b0c0d,
    roughness: 0.94,
    metalness: 0,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.02,
  });

  const W = 2.76, H = 1.55, bezel = 0.055;
  const frame = new THREE.Mesh(new RoundedBoxGeometry(W + bezel * 2, H + bezel * 2, 0.07, 4, 0.008), mats.graphite);
  frame.position.y = 1.66;
  frame.castShadow = true;
  frame.receiveShadow = true;
  group.add(frame);

  const screen = new THREE.Mesh(new THREE.PlaneGeometry(W, H), screenMat);
  screen.position.set(0, 1.66, 0.036);
  group.add(screen);

  // thin brass seam along the bottom of the frame
  const seam = new THREE.Mesh(new THREE.BoxGeometry(W + bezel * 2, 0.006, 0.074), mats.brass);
  seam.position.y = 1.66 - (H + bezel * 2) / 2 + 0.006;
  group.add(seam);

  // stand: two blades and a base bar
  const legH = 0.86;
  for (const x of [-0.78, 0.78]) {
    const leg = new THREE.Mesh(new RoundedBoxGeometry(0.055, legH, 0.06, 3, 0.008), mats.graphite);
    leg.position.set(x, 0.2 + legH / 2, 0);
    leg.castShadow = true;
    group.add(leg);
  }
  const bar = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.035, 0.42, 3, 0.012), mats.graphite);
  bar.position.set(0, 0.21, 0);
  bar.castShadow = true;
  group.add(bar);

  return { group, screenMat };
}

/* ── exhibit 2: 4K Laser Cinema Projector ─────────────────── */
function buildProjector(mats: Mats): { group: THREE.Group; beamMat: THREE.MeshBasicMaterial; body: THREE.Group } {
  const group = new THREE.Group();
  group.add(plinth(mats, 1.12, 0.38, 0.84));

  const body = new THREE.Group();
  body.position.y = 0.38;
  group.add(body);

  // Main chassis: sculptured high-mass dark graphite enclosure (Sony / JVC laser cinema style)
  const W = 0.54, H = 0.19, D = 0.48;
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(W, H, D, 4, 0.018), mats.graphite);
  chassis.position.y = H / 2 + 0.016;
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  body.add(chassis);

  // Beveled top hood in brushed dark aluminum
  const topCover = new THREE.Mesh(new RoundedBoxGeometry(W - 0.04, 0.014, D - 0.04, 3, 0.008), mats.aluDark);
  topCover.position.set(0, H + 0.022, 0);
  topCover.castShadow = true;
  body.add(topCover);

  // Central large cinema optical lens barrel (points toward screen along -Z)
  const lensBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.074, 0.042, 48), mats.aluDark);
  lensBarrel.rotation.x = Math.PI / 2;
  lensBarrel.position.set(0, H / 2 + 0.02, -D / 2 - 0.018);
  lensBarrel.castShadow = true;
  body.add(lensBarrel);

  // Precision knurled zoom / focus ring in brushed brass
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.0042, 12, 48), mats.brass);
  lensRing.position.set(0, H / 2 + 0.02, -D / 2 - 0.024);
  body.add(lensRing);

  // Recessed optical glass front element with deep reflective cinema coating
  const lensGlassMat = new THREE.MeshStandardMaterial({
    color: 0x071318,
    roughness: 0.1,
    metalness: 0.9,
    emissive: 0x142b36,
    emissiveIntensity: 0.35,
  });
  const lensGlass = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.060, 0.012, 48), lensGlassMat);
  lensGlass.rotation.x = Math.PI / 2;
  lensGlass.position.set(0, H / 2 + 0.02, -D / 2 - 0.032);
  body.add(lensGlass);

  // Dual front intake cooling louvers on either side of the lens
  for (const sx of [-0.175, 0.175]) {
    for (let l = -2; l <= 2; l++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.004, 0.012), mats.rubber);
      slat.position.set(sx, H / 2 + 0.02 + l * 0.022, -D / 2 - 0.002);
      body.add(slat);
    }
  }

  // Laser Status indicator LED (warm amber dot)
  const led = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 16), mats.brass);
  led.rotation.x = Math.PI / 2;
  led.position.set(0.20, H - 0.02, -D / 2 - 0.002);
  body.add(led);

  // Maker's brass emblem on top
  const badge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.002, 0.022), mats.brass);
  badge.position.set(0.16, H + 0.03, -0.14);
  body.add(badge);

  // Four isolation footers with rubber damping
  for (const [fx, fz] of [[-0.21, -0.17], [0.21, -0.17], [-0.21, 0.17], [0.21, 0.17]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.025, 0.016, 24), mats.brass);
    foot.position.set(fx, 0.008, fz);
    foot.castShadow = true;
    body.add(foot);
  }

  // Volumetric Cinema Laser Light Beam (expands from lens toward the screen at -Z)
  const beamMat = new THREE.MeshBasicMaterial({
    color: 0xf5ecd7,
    transparent: true,
    opacity: 0.045,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const beamLength = 1.95;
  const beamGeom = new THREE.CylinderGeometry(0.07, 1.25, beamLength, 32, 1, true);
  beamGeom.rotateX(Math.PI / 2);
  beamGeom.translate(0, 0, -beamLength / 2);

  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.position.set(0, H / 2 + 0.02, -D / 2 - 0.035);
  body.add(beam);

  return { group, beamMat, body };
}

/* ── exhibit 3: the source (Denon & Marantz Reference Flagship Amplification) ── */
function buildSource(mats: Mats): { group: THREE.Group; puck: THREE.Group } {
  const group = new THREE.Group();
  group.add(plinth(mats, 0.95, 0.66, 0.95));

  const puck = new THREE.Group();
  // Align amplifier center with camera focus (plinth height 0.66 + foot 0.018 + half chassis 0.082)
  puck.position.y = 0.66 + 0.10;
  group.add(puck);

  // Main high-mass anodized aluminum chassis
  const chassis = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.164, 0.38, 4, 0.012), mats.graphite);
  chassis.castShadow = true;
  chassis.receiveShadow = true;
  puck.add(chassis);

  // Recessed center faceplate (Marantz & Denon brushed aluminium front)
  const faceplate = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.152, 0.014, 3, 0.003), mats.aluDark);
  faceplate.position.set(0, 0, 0.192);
  faceplate.castShadow = true;
  faceplate.receiveShadow = true;
  puck.add(faceplate);

  // Signature curved architectural side wings (hallmark of Marantz Cinema series)
  const wingLeft = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.155, 0.018, 3, 0.004), mats.graphite);
  wingLeft.position.set(-0.245, 0, 0.188);
  wingLeft.rotation.y = 0.06;
  wingLeft.castShadow = true;
  puck.add(wingLeft);

  const wingRight = new THREE.Mesh(new RoundedBoxGeometry(0.075, 0.155, 0.018, 3, 0.004), mats.graphite);
  wingRight.position.set(0.245, 0, 0.188);
  wingRight.rotation.y = -0.06;
  wingRight.castShadow = true;
  puck.add(wingRight);

  // Marantz signature porthole display with warm champagne brass bezel
  const portholeBezel = new THREE.Mesh(new THREE.TorusGeometry(0.038, 0.0032, 12, 48), mats.brass);
  portholeBezel.position.set(0, 0.024, 0.201);
  puck.add(portholeBezel);

  const displayLens = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.004, 48), mats.baffle);
  displayLens.rotation.x = Math.PI / 2;
  displayLens.position.set(0, 0.024, 0.200);
  puck.add(displayLens);

  // Porthole subtle warm indicator dot
  const portholeDot = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.002, 16), mats.brass);
  portholeDot.rotation.x = Math.PI / 2;
  portholeDot.position.set(0, 0.024, 0.202);
  puck.add(portholeDot);

  // Precision knurled rotary control knobs (Input selector on left, Master Volume on right)
  const knobLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.037, 0.022, 48), mats.aluDark);
  knobLeft.rotation.x = Math.PI / 2;
  knobLeft.position.set(-0.142, 0.018, 0.203);
  knobLeft.castShadow = true;
  puck.add(knobLeft);

  const knobLeftRing = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.0022, 8, 48), mats.brass);
  knobLeftRing.position.set(-0.142, 0.018, 0.214);
  puck.add(knobLeftRing);

  const knobRight = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.040, 0.024, 48), mats.aluDark);
  knobRight.rotation.x = Math.PI / 2;
  knobRight.position.set(0.142, 0.018, 0.203);
  knobRight.castShadow = true;
  puck.add(knobRight);

  const knobRightRing = new THREE.Mesh(new THREE.TorusGeometry(0.039, 0.0024, 8, 48), mats.brass);
  knobRightRing.position.set(0.142, 0.018, 0.215);
  puck.add(knobRightRing);

  // Lower access door seam
  const seam = new THREE.Mesh(new THREE.BoxGeometry(0.39, 0.002, 0.004), mats.rubber);
  seam.position.set(0, -0.026, 0.200);
  puck.add(seam);

  // Gold-plated 6.35mm headphone output jack
  const hpJack = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.007, 0.004, 24), mats.brass);
  hpJack.rotation.x = Math.PI / 2;
  hpJack.position.set(-0.155, -0.048, 0.201);
  puck.add(hpJack);

  // Pure Direct / Power button
  const powerBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.004, 24), mats.alu);
  powerBtn.rotation.x = Math.PI / 2;
  powerBtn.position.set(-0.24, -0.048, 0.201);
  puck.add(powerBtn);

  // Top ventilation cooling louvers (essential for high-power class A/B toroidal stages)
  const ventPanel = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.002, 0.25, 2, 0.002), mats.baffle);
  ventPanel.position.set(0, 0.083, -0.02);
  puck.add(ventPanel);

  for (let z = -0.10; z <= 0.06; z += 0.04) {
    const ventSlot = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.002, 0.008), mats.rubber);
    ventSlot.position.set(0, 0.084, z);
    puck.add(ventSlot);
  }

  // Four solid machined isolation feet with rubber damping pads
  for (const [fx, fz] of [[-0.24, -0.14], [0.24, -0.14], [-0.24, 0.14], [0.24, 0.14]]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.026, 0.016, 32), mats.brass);
    foot.position.set(fx, -0.082 - 0.008, fz);
    foot.castShadow = true;
    puck.add(foot);

    const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.020, 0.020, 0.004, 32), mats.rubber);
    pad.position.set(fx, -0.082 - 0.016, fz);
    puck.add(pad);
  }

  // Heavy multi-zone aluminum remote resting on the plinth beside the amplifier
  const remote = new THREE.Mesh(new RoundedBoxGeometry(0.052, 0.014, 0.18, 4, 0.005), mats.graphite);
  remote.position.set(0.33, -0.082 + 0.007, 0.18);
  remote.rotation.y = -0.44;
  remote.castShadow = true;
  puck.add(remote);

  for (const z of [-0.05, -0.01, 0.03, 0.07]) {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 16), mats.brass);
    btn.position.set(0.33 + Math.sin(0.44) * z, -0.082 + 0.016, 0.18 + Math.cos(0.44) * z);
    puck.add(btn);
  }

  return { group, puck };
}

/* ── gallery ───────────────────────────────────────────────── */
export type Gallery = {
  setProgress: (p: number) => void;
  setReduced: (reduced: boolean) => void;
  setPaused: (paused: boolean) => void;
  resize: () => void;
  dispose: () => void;
};

export function createGallery(canvas: HTMLCanvasElement, initial: { reduced: boolean }): Gallery | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
  } catch {
    return null;
  }
  if (!renderer.getContext()) return null;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.02;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(PLASTER);
  scene.fog = new THREE.Fog(PLASTER, 16, 34);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.42;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(...CAMERA_KEYS[0].pos);

  const mats = materials();

  // floor + far wall: a plaster cyclorama
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 44), mats.floor);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, -6);
  floor.receiveShadow = true;
  scene.add(floor);

  const wall = new THREE.Mesh(new THREE.PlaneGeometry(80, 20), mats.plasterDeep);
  wall.position.set(0, 10, -8.4);
  wall.receiveShadow = true;
  scene.add(wall);

  // a low bench, for depth in wide shots
  const bench = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.42, 0.72, 4, 0.014), mats.plaster);
  bench.position.set(1.7, 0.21, -4.6);
  bench.castShadow = true;
  bench.receiveShadow = true;
  scene.add(bench);
  const benchShadow = contactShadow(3.6, 0.26);
  benchShadow.position.set(1.7, 0.004, -4.6);
  scene.add(benchShadow);

  // lights
  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d1c0, 0.55));
  const key = new THREE.DirectionalLight(0xfff4e4, 2.1);
  key.position.set(-4.5, 7.5, 5.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 26;
  key.shadow.camera.left = -9;
  key.shadow.camera.right = 9;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -4;
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.02;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdde6ea, 0.55);
  fill.position.set(6.5, 4.5, 4);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xffffff, 0.65);
  rim.position.set(1.5, 5.5, -6);
  scene.add(rim);

  const wash = new THREE.SpotLight(0xfff1dc, 18, 14, 0.62, 0.85, 1.6);
  wash.position.set(-2.2, 5.2, 3.4);
  wash.target.position.set(-3.2, 1.1, 0);
  scene.add(wash, wash.target);

  // exhibits
  const speaker = buildSpeaker(mats);
  speaker.group.position.set(-3.2, 0, 0);
  scene.add(speaker.group);

  const screenObj = buildScreen(mats);
  screenObj.group.position.set(0, 0, -1.2);
  scene.add(screenObj.group);

  const projector = buildProjector(mats);
  projector.group.position.set(0, 0, 0.85);
  scene.add(projector.group);

  const source = buildSource(mats);
  source.group.position.set(3.2, 0, 0);
  scene.add(source.group);

  /* state */
  const state = {
    target: 0,
    current: 0,
    reduced: initial.reduced,
    paused: false,
    boot: initial.reduced ? 1 : 0,
    width: 1,
    height: 1,
    aspect: 1,
  };

  function resize() {
    const parent = canvas.parentElement;
    state.width = parent?.clientWidth || window.innerWidth;
    state.height = parent?.clientHeight || window.innerHeight;
    // the canvas fills the fixed shell; use the window if the shell is 0 (hidden)
    if (state.width < 2 || state.height < 2) {
      state.width = window.innerWidth;
      state.height = window.innerHeight;
    }
    state.aspect = state.width / state.height;
    renderer.setSize(state.width, state.height, false);
    camera.aspect = state.aspect;
    camera.updateProjectionMatrix();
  }

  function placeCamera(p: number) {
    // The portrait key set is already composed for a narrow, tall stage; the
    // landscape set adapts for compact aspect ratios and shifts the hero trio left
    // whenever the headline occupies the right column (md+ or compact phone landscape).
    const portrait = state.aspect < 0.95;
    const { pos, look, fov } = sampleCamera(p, portrait ? CAMERA_KEYS_PORTRAIT : CAMERA_KEYS);
    const heroBlend = 1 - smooth(clamp01((p - 0.04) / 0.08));
    const rightColHero = state.width >= 900 || (!portrait && state.height <= 480 && state.width >= 600);

    let effectiveFov = fov;
    let xShiftFrac = 0;

    if (portrait) {
      if (state.aspect < 0.72 && heroBlend > 0) {
        const pull = 1 + (0.72 / Math.max(0.42, state.aspect) - 1) * 0.5 * heroBlend;
        pos.sub(look).multiplyScalar(pull).add(look);
        effectiveFov += 8 * heroBlend * clamp01((0.72 - state.aspect) / 0.28);
      }
    } else {
      if (state.aspect < 1.55) {
        const baseScale = state.aspect < 1.2 ? 1.16 : 1 + (1.55 - state.aspect) * 0.2;
        pos.sub(look).multiplyScalar(baseScale).add(look);
      }
      if (heroBlend > 0 && rightColHero) {
        const heroPull = 1 + (state.aspect < 1.45 ? 0.14 : 0.08) * heroBlend;
        pos.sub(look).multiplyScalar(heroPull).add(look);
        xShiftFrac = (state.aspect < 1.4 ? 0.115 : 0.13) * heroBlend;
      }
    }

    camera.position.copy(pos);
    camera.fov = effectiveFov;
    camera.lookAt(look);
    camera.updateProjectionMatrix();
    // Compose for the page, not the canvas: the placard owns the lower third on
    // mobile/portrait, and on side-split hero frames we shift the trio leftward.
    const lift = portrait ? 0.21 : state.height <= 480 ? 0.06 : state.aspect < 1.25 ? 0.14 : 0.115;
    camera.setViewOffset(
      state.width,
      state.height,
      state.width * xShiftFrac,
      state.height * lift,
      state.width,
      state.height,
    );
  }

  function applyScene(p: number) {
    // turntable on the tower during exhibit one
    const t1 = clamp01((p - 0.08) / 0.36);
    speaker.turntable.rotation.y = -0.34 + 0.62 * smooth(t1);

    // the source turns a little as you reach it
    const t3 = clamp01((p - 0.76) / 0.2);
    source.puck.rotation.y = -0.28 + 0.44 * smooth(t3);

    // the screen and projector beam wake as the camera arrives
    const lit = clamp01((p - 0.44) / 0.16);
    screenObj.screenMat.emissiveIntensity = 0.02 + lit * 0.85;
    projector.beamMat.opacity = 0.035 + lit * 0.12;
  }

  function render() {
    renderer.render(scene, camera);
  }

  function applyReduced() {
    placeCamera(state.current);
    applyScene(state.current);
    render();
  }

  const clock = new THREE.Clock();
  let raf = 0;
  let disposed = false;

  function frame() {
    if (disposed) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    state.current += (state.target - state.current) * (1 - Math.exp(-dt * 5.5));

    if (state.boot < 1) state.boot = Math.min(1, state.boot + dt / 1.5);
    const easeBoot = 1 - Math.pow(1 - state.boot, 3);

    placeCamera(state.current);
    applyScene(state.current);

    // breathing: barely-there parallax so the room feels alive
    const drift = state.reduced ? 0 : 1;
    camera.position.x += Math.sin(t * 0.21) * 0.012 * drift;
    camera.position.y += Math.sin(t * 0.16 + 1.4) * 0.008 * drift;
    camera.position.z += (1 - easeBoot) * 1.9;

    render();
    raf = requestAnimationFrame(frame);
  }

  resize();
  applyReduced();
  if (!state.reduced) raf = requestAnimationFrame(frame);

  function start() {
    if (disposed || state.paused || state.reduced || raf) return;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  const onResize = () => {
    resize();
    if (state.reduced) applyReduced();
    else render();
  };
  window.addEventListener("resize", onResize);

  return {
    setProgress(p: number) {
      state.target = clamp01(p);
      if (state.reduced) {
        state.current = state.target;
        applyReduced();
      }
    },
    setReduced(reduced: boolean) {
      state.reduced = reduced;
      if (reduced) {
        stop();
        state.current = state.target;
        applyReduced();
      } else {
        start();
      }
    },
    setPaused(paused: boolean) {
      state.paused = paused;
      if (paused) stop();
      else start();
    },
    resize: onResize,
    dispose() {
      disposed = true;
      stop();
      window.removeEventListener("resize", onResize);
      scene.traverse(object => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(material)) material.forEach(m => m.dispose());
        else material?.dispose();
      });
      scene.environment?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}