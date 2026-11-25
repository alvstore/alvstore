/**
 * Interactive Bright-to-Cinema 3D Architectural Home Theater Engine using Three.js.
 *
 * Renders an open-cutaway warm walnut & limestone private cinema calibrated dynamically
 * to room dimensions and seating layouts, with animated Lights On <-> Cinema Dark dimming,
 * smooth camera presets (3D Studio, Viewer Seat POV, Top Plan), non-obstructing front
 * stage geometry, directional dispersion cones, and click/hover speaker raycasting.
 */
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import type { RoomConfigId, RoomLayout } from "./room-calculator";

export type CameraPreset = "studio" | "seat" | "top";

export interface CinemaRoomOptions {
  configId: RoomConfigId;
  layout: RoomLayout;
  lightsOn: boolean;
  cameraPreset: CameraPreset;
  soundCones: boolean;
  showDimensions: boolean;
  reducedMotion: boolean;
  onSpeakerSelect?: (speakerId: string | null) => void;
}

export interface CinemaRoomHandle {
  setConfig: (configId: RoomConfigId) => void;
  setLayout: (layout: RoomLayout) => void;
  setLightsOn: (lightsOn: boolean) => void;
  setCameraPreset: (preset: CameraPreset) => void;
  setSoundCones: (show: boolean) => void;
  setShowDimensions: (show: boolean) => void;
  setHoveredSpeaker: (speakerId: string | null) => void;
  setHighlightRole: (role: string | null) => void;
  setSweetSpotFocus: (focus: boolean) => void;
  setReducedMotion: (reduced: boolean) => void;
  setPaused: (paused: boolean) => void;
  resetCamera: () => void;
  resize: () => void;
  destroy: () => void;
}

const ACTIVE_SPEAKER_IDS: Record<RoomConfigId, string[]> = {
  "5.1": ["L", "C", "R", "SUB1", "SL", "SR"],
  "5.1.2": ["L", "C", "R", "SUB1", "SL", "SR", "TML", "TMR"],
  "7.2.2": ["L", "C", "R", "SUB1", "SUB2", "SL", "SR", "SBL", "SBR", "TML", "TMR"],
  "7.2.4": ["L", "C", "R", "SUB1", "SUB2", "SL", "SR", "SBL", "SBR", "TFL", "TFR", "TRL", "TRR"],
};

const UP_VEC = new THREE.Vector3(0, 1, 0);

/** Generates a crisp atmospheric 16:9 cinema still on an offscreen canvas texture. */
function createCinemaScreenTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const off = document.createElement("canvas");
  off.width = 640;
  off.height = 360;
  const ctx = off.getContext("2d");
  if (!ctx) return null;

  // Deep golden-hour alpine / desert vista aesthetic
  const sky = ctx.createLinearGradient(0, 0, 0, off.height * 0.68);
  sky.addColorStop(0, "#121923");
  sky.addColorStop(0.42, "#2f4358");
  sky.addColorStop(0.75, "#9c6d42");
  sky.addColorStop(1, "#f4c987");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, off.width, off.height);

  // Luminous sun bloom
  const sun = ctx.createRadialGradient(off.width * 0.56, off.height * 0.48, 8, off.width * 0.56, off.height * 0.48, 180);
  sun.addColorStop(0, "rgba(255, 244, 214, 0.92)");
  sun.addColorStop(0.28, "rgba(244, 193, 118, 0.42)");
  sun.addColorStop(1, "rgba(244, 193, 118, 0)");
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, off.width, off.height);

  // Layered distant mountain silhouettes
  ctx.fillStyle = "#3a3536";
  ctx.beginPath();
  ctx.moveTo(0, 232);
  ctx.lineTo(110, 186);
  ctx.lineTo(225, 212);
  ctx.lineTo(355, 168);
  ctx.lineTo(485, 206);
  ctx.lineTo(640, 178);
  ctx.lineTo(640, 360);
  ctx.lineTo(0, 360);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#1c1c20";
  ctx.beginPath();
  ctx.moveTo(0, 266);
  ctx.lineTo(165, 224);
  ctx.lineTo(310, 248);
  ctx.lineTo(490, 220);
  ctx.lineTo(640, 250);
  ctx.lineTo(640, 360);
  ctx.lineTo(0, 360);
  ctx.closePath();
  ctx.fill();

  // Letterbox subtle matte frame
  ctx.fillStyle = "rgba(8, 9, 11, 0.72)";
  ctx.fillRect(0, 0, off.width, 22);
  ctx.fillRect(0, off.height - 22, off.width, 22);

  // Crisp subtle projection framing hairlines
  ctx.strokeStyle = "rgba(255, 235, 200, 0.16)";
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 28, off.width - 48, off.height - 56);

  const tex = new THREE.CanvasTexture(off);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Disposes geometries and non-shared materials inside a group before clearing it. */
function disposeGroupChildren(group: THREE.Group, sharedMats: Set<THREE.Material>) {
  group.traverse(node => {
    if (node instanceof THREE.Mesh || node instanceof THREE.Line) {
      node.geometry.dispose();
      const mat = node.material;
      if (Array.isArray(mat)) {
        mat.forEach(m => {
          if (!sharedMats.has(m)) m.dispose();
        });
      } else if (mat && !sharedMats.has(mat)) {
        mat.dispose();
      }
    }
  });
  group.clear();
}

export function createCinemaRoomScene(
  canvas: HTMLCanvasElement,
  options: CinemaRoomOptions,
): CinemaRoomHandle | null {
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  let currentConfig = options.configId;
  let currentLayout = options.layout;
  let targetLightsOn = options.lightsOn;
  let litProgress = options.lightsOn ? 1 : 0;
  let currentPreset: CameraPreset = options.cameraPreset;
  let soundConesEnabled = options.soundCones;
  let showDimensionsEnabled = options.showDimensions;
  let isReducedMotion = options.reducedMotion;
  let isPaused = false;
  let hoveredSpeakerId: string | null = null;
  let highlightedRole: string | null = null;
  let isSweetSpotFocused = false;
  let selectCallback = options.onSpeakerSelect;

  const scene = new THREE.Scene();
  const bgLit = new THREE.Color(0x28241f);
  const bgDark = new THREE.Color(0x0b0c0e);
  const scratchBg = new THREE.Color().copy(bgLit).lerp(bgDark, 1 - litProgress);
  scene.background = scratchBg;

  const camera = new THREE.PerspectiveCamera(44, (canvas.clientWidth || 640) / (canvas.clientHeight || 420), 0.1, 60);

  renderer.setSize(canvas.clientWidth || 640, canvas.clientHeight || 420, false);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const screenTexture = createCinemaScreenTexture();

  // Shared PBR Architectural Materials
  const mats = {
    travertine: new THREE.MeshStandardMaterial({ color: 0xbcb3a4, roughness: 0.78, metalness: 0.04 }),
    carpet: new THREE.MeshStandardMaterial({ color: 0x736b61, roughness: 0.92, metalness: 0.02 }),
    riserDeck: new THREE.MeshStandardMaterial({ color: 0x5c4738, roughness: 0.62, metalness: 0.06 }),
    plasterWall: new THREE.MeshStandardMaterial({ color: 0xe3dcd0, roughness: 0.85, metalness: 0.02 }),
    frontBaffle: new THREE.MeshStandardMaterial({ color: 0x262524, roughness: 0.88, metalness: 0.03 }),
    slatWood: new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.46, metalness: 0.06 }),
    screenFrame: new THREE.MeshStandardMaterial({ color: 0x151618, roughness: 0.6, metalness: 0.25 }),
    screenSurface: new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: screenTexture ?? undefined,
      emissiveMap: screenTexture ?? undefined,
      emissive: new THREE.Color(0xfff1dc),
      emissiveIntensity: 0.35,
      roughness: 0.5,
      metalness: 0.0,
    }),
    coveLed: new THREE.MeshStandardMaterial({
      color: 0xffe4b8,
      emissive: 0xffcf82,
      emissiveIntensity: 1.35,
      roughness: 0.2,
    }),
    stepLed: new THREE.MeshStandardMaterial({
      color: 0xffdca4,
      emissive: 0xe8b566,
      emissiveIntensity: 0.95,
      roughness: 0.3,
    }),
    speakerCabinet: new THREE.MeshStandardMaterial({ color: 0x272a2e, roughness: 0.42, metalness: 0.24 }),
    speakerWoodTrim: new THREE.MeshStandardMaterial({ color: 0x7a5236, roughness: 0.4, metalness: 0.08 }),
    brassTrim: new THREE.MeshStandardMaterial({ color: 0xc8a05e, roughness: 0.28, metalness: 0.92 }),
    driverCone: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.5, metalness: 0.36 }),
    seatLeather: new THREE.MeshStandardMaterial({ color: 0x4b4038, roughness: 0.58, metalness: 0.1 }),
    seatHeadrest: new THREE.MeshStandardMaterial({ color: 0xc69f64, roughness: 0.48, metalness: 0.18 }),
    projectorBody: new THREE.MeshStandardMaterial({ color: 0x2e3136, roughness: 0.38, metalness: 0.35 }),
    sweetSpotRing: new THREE.MeshBasicMaterial({
      color: 0xd4ad6d,
      transparent: true,
      opacity: 0.58,
      side: THREE.DoubleSide,
    }),
    projectorBeam: new THREE.MeshBasicMaterial({
      color: 0xffecd0,
      transparent: true,
      opacity: 0.025,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  };

  const sharedMatsSet = new Set<THREE.Material>(Object.values(mats));

  // Studio & Theater Lighting Rig
  const hemiLight = new THREE.HemisphereLight(0xfff6e8, 0x877867, 1.35);
  scene.add(hemiLight);

  const keyLight = new THREE.DirectionalLight(0xfff5e6, 1.55);
  keyLight.position.set(4.5, 8.5, 5.5);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(1024, 1024);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far = 26;
  keyLight.shadow.camera.left = -8;
  keyLight.shadow.camera.right = 8;
  keyLight.shadow.camera.top = 8;
  keyLight.shadow.camera.bottom = -8;
  keyLight.shadow.bias = -0.0005;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xeef4ff, 0.55);
  fillLight.position.set(-5.0, 6.0, -4.0);
  scene.add(fillLight);

  const screenBounce = new THREE.PointLight(0xffdfb4, 1.2, 9.5, 1.5);
  scene.add(screenBounce);

  // Scene Groups
  const roomShellGroup = new THREE.Group();
  const speakersGroup = new THREE.Group();
  const conesGroup = new THREE.Group();
  const raysGroup = new THREE.Group();
  const dimensionsGroup = new THREE.Group();
  scene.add(roomShellGroup, speakersGroup, conesGroup, raysGroup, dimensionsGroup);

  type SpeakerRuntime = {
    id: string;
    role: string;
    group: THREE.Group;
    cone?: THREE.Mesh;
    coneMat?: THREE.MeshBasicMaterial;
    woofer?: THREE.Mesh;
    hoverRing?: THREE.Mesh;
    centerPos: THREE.Vector3;
  };
  const speakerRuntime = new Map<string, SpeakerRuntime>();

  // Helper to tag raycastable speaker sub-meshes
  function tagSpeakerHierarchy(root: THREE.Object3D, speakerId: string) {
    root.userData.speakerId = speakerId;
    root.traverse(obj => {
      obj.userData.speakerId = speakerId;
    });
  }

  function buildFloorstandingSpeaker(group: THREE.Group) {
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.38, 1.2, 0.42, 3, 0.025), mats.speakerCabinet);
    body.position.y = 0.62;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    // Warm walnut side accent cheek
    const cheek = new THREE.Mesh(new RoundedBoxGeometry(0.4, 1.06, 0.28, 2, 0.015), mats.speakerWoodTrim);
    cheek.position.set(0, 0.62, -0.04);
    group.add(cheek);

    // Brass isolation feet
    [-0.15, 0.15].forEach(x => {
      [-0.17, 0.17].forEach(z => {
        const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.05, 10), mats.brassTrim);
        foot.position.set(x, 0.025, z);
        group.add(foot);
      });
    });

    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.02, 20), mats.brassTrim);
    tweeter.rotation.x = Math.PI / 2;
    tweeter.position.set(0, 1.06, 0.21);
    group.add(tweeter);

    const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 20), mats.driverCone);
    mid.rotation.x = Math.PI / 2;
    mid.position.set(0, 0.84, 0.21);
    group.add(mid);

    [0.54, 0.3].forEach(y => {
      const bass = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 22), mats.driverCone);
      bass.rotation.x = Math.PI / 2;
      bass.position.set(0, y, 0.21);
      group.add(bass);
    });
  }

  function buildHorizontalCenterSpeaker(group: THREE.Group) {
    // Low travertine plinth
    const stand = new THREE.Mesh(new RoundedBoxGeometry(0.84, 0.12, 0.36, 2, 0.015), mats.travertine);
    stand.position.y = -0.18;
    stand.receiveShadow = true;
    group.add(stand);

    const enclosure = new THREE.Mesh(new RoundedBoxGeometry(0.76, 0.22, 0.32, 3, 0.025), mats.speakerCabinet);
    enclosure.castShadow = true;
    enclosure.rotation.x = -0.08;
    group.add(enclosure);

    [-0.22, 0.22].forEach(x => {
      const mid = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.02, 20), mats.driverCone);
      mid.rotation.x = Math.PI / 2 - 0.08;
      mid.position.set(x, 0.01, 0.16);
      group.add(mid);
    });

    const tweeter = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 18), mats.brassTrim);
    tweeter.rotation.x = Math.PI / 2 - 0.08;
    tweeter.position.set(0, 0.01, 0.16);
    group.add(tweeter);
  }

  function buildSubwoofer(group: THREE.Group): THREE.Mesh {
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.62, 3, 0.03), mats.speakerCabinet);
    box.position.y = 0.31;
    box.castShadow = true;
    box.receiveShadow = true;
    group.add(box);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.022, 14, 28), mats.brassTrim);
    ring.position.set(0, 0.31, 0.31);
    group.add(ring);

    const woofer = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.06, 0.055, 28), mats.driverCone);
    woofer.rotation.x = Math.PI / 2;
    woofer.position.set(0, 0.31, 0.3);
    group.add(woofer);
    return woofer;
  }

  function buildSurroundSpeaker(group: THREE.Group) {
    const box = new THREE.Mesh(new RoundedBoxGeometry(0.28, 0.44, 0.16, 2, 0.015), mats.speakerCabinet);
    box.castShadow = true;
    group.add(box);
    const driver = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 20), mats.brassTrim);
    driver.rotation.x = Math.PI / 2;
    driver.position.z = 0.085;
    group.add(driver);
  }

  function buildCeilingAtmos(group: THREE.Group) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.022, 14, 28), mats.brassTrim);
    group.add(ring);
    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), mats.speakerCabinet);
    grille.position.z = 0.01;
    group.add(grille);
  }

  function buildSeatMesh(x: number, y: number, z: number) {
    const seat = new THREE.Group();
    seat.position.set(x, y, z);

    const base = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.36, 0.78, 3, 0.04), mats.seatLeather);
    base.position.y = 0.18;
    base.castShadow = true;
    base.receiveShadow = true;
    seat.add(base);

    const back = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.74, 0.2, 3, 0.03), mats.seatLeather);
    back.position.set(0, 0.62, 0.28);
    back.rotation.x = -0.14;
    back.castShadow = true;
    seat.add(back);

    const head = new THREE.Mesh(new RoundedBoxGeometry(0.42, 0.19, 0.14, 2, 0.02), mats.seatHeadrest);
    head.position.set(0, 1.0, 0.34);
    seat.add(head);

    [-0.36, 0.36].forEach(ax => {
      const arm = new THREE.Mesh(new RoundedBoxGeometry(0.12, 0.46, 0.74, 2, 0.025), mats.seatLeather);
      arm.position.set(ax, 0.3, 0.02);
      arm.castShadow = true;
      seat.add(arm);
    });

    roomShellGroup.add(seat);
  }

  function rebuildRoomFromLayout(layout: RoomLayout) {
    currentLayout = layout;
    disposeGroupChildren(roomShellGroup, sharedMatsSet);
    disposeGroupChildren(speakersGroup, sharedMatsSet);
    disposeGroupChildren(conesGroup, sharedMatsSet);
    disposeGroupChildren(dimensionsGroup, sharedMatsSet);
    speakerRuntime.clear();

    const { widthM: w, lengthM: l, screenWidthM, screenHeightM, screenCenterY, frontZ, primarySeatZ, projectorZ, riserZStartM, riserHeightM } = layout;
    // Open architectural cutaway wall height so 3D studio never obscures seats/equipment
    const cutawayWallH = Math.min(layout.ceilingM * 0.84, 2.48);

    // 1. Travertine Outer Base & Warm Carpet Inlay
    const floor = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.12, l + 0.5), mats.travertine);
    floor.position.set(0, -0.06, 0);
    floor.receiveShadow = true;
    roomShellGroup.add(floor);

    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(1.2, w - 0.75), Math.max(2, l - 1.1)), mats.carpet);
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.005, 0.18);
    carpet.receiveShadow = true;
    roomShellGroup.add(carpet);

    // 2. Front Baffle Acoustic Wall (dark slate textile frame for rich screen contrast)
    const frontWall = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, layout.ceilingM, 0.24), mats.frontBaffle);
    frontWall.position.set(0, layout.ceilingM / 2, -l / 2 - 0.06);
    frontWall.receiveShadow = true;
    roomShellGroup.add(frontWall);

    // 3. Asymmetric Architectural Cutaway Walls:
    // Full height left sidewall (-X) with tall walnut acoustic slats & cove LEDs;
    // low open wainscot curbs along near right (+X) and rear (+Z) edges so seating,
    // risers, front R speaker, and dispersion cones remain completely unobstructed in 3D view.
    const wallThickness = 0.16;
    const leftSideWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, cutawayWallH, l + 0.2), mats.plasterWall);
    leftSideWall.position.set(-w / 2 - wallThickness / 2, cutawayWallH / 2, 0);
    leftSideWall.castShadow = true;
    leftSideWall.receiveShadow = true;
    roomShellGroup.add(leftSideWall);

    const leftSoffit = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, l), mats.slatWood);
    leftSoffit.position.set(-w / 2 + 0.12, cutawayWallH - 0.08, 0);
    roomShellGroup.add(leftSoffit);

    const leftLed = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, l - 0.5), mats.coveLed);
    leftLed.position.set(-w / 2 + 0.2, cutawayWallH - 0.12, 0);
    roomShellGroup.add(leftLed);

    const rightCurbH = 0.52;
    const rightCurbWall = new THREE.Mesh(new THREE.BoxGeometry(wallThickness, rightCurbH, l + 0.2), mats.plasterWall);
    rightCurbWall.position.set(w / 2 + wallThickness / 2, rightCurbH / 2, 0);
    rightCurbWall.castShadow = true;
    rightCurbWall.receiveShadow = true;
    roomShellGroup.add(rightCurbWall);

    const rightCap = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, l + 0.2), mats.slatWood);
    rightCap.position.set(w / 2 + wallThickness / 2, rightCurbH + 0.025, 0);
    roomShellGroup.add(rightCap);

    // Cutaway Rear Low Wainscot Curb
    const rearCurbH = 0.58;
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(w + 0.24, rearCurbH, wallThickness), mats.plasterWall);
    rearWall.position.set(0, rearCurbH / 2, l / 2 + wallThickness / 2);
    rearWall.receiveShadow = true;
    roomShellGroup.add(rearWall);

    const rearCap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.26, 0.05, 0.2), mats.slatWood);
    rearCap.position.set(0, rearCurbH + 0.025, l / 2 + wallThickness / 2);
    roomShellGroup.add(rearCap);

    // Sculpted Walnut Acoustic Slats along the full-height left architectural wall
    const slatCount = Math.max(5, Math.floor((l - 1.2) / 0.52));
    for (let i = 0; i < slatCount; i++) {
      const z = -l / 2 + 0.8 + ((l - 1.6) * i) / Math.max(1, slatCount - 1);
      const slat = new THREE.Mesh(new RoundedBoxGeometry(0.055, cutawayWallH - 0.48, 0.075, 2, 0.01), mats.slatWood);
      slat.position.set(-w / 2 + 0.035, (cutawayWallH - 0.48) / 2 + 0.18, z);
      slat.castShadow = true;
      roomShellGroup.add(slat);
    }

    // 4. Tiered Rear Seating Riser Platform (when 2 rows active)
    if (layout.cadRiserY !== null) {
      const riserLen = Math.max(0.85, l / 2 - riserZStartM - 0.08);
      const riserCenterZ = riserZStartM + riserLen / 2;
      const riser = new THREE.Mesh(
        new RoundedBoxGeometry(Math.max(1.4, w - 0.9), riserHeightM, riserLen, 2, 0.02),
        mats.riserDeck,
      );
      riser.position.set(0, riserHeightM / 2, riserCenterZ);
      riser.receiveShadow = true;
      riser.castShadow = true;
      roomShellGroup.add(riser);

      const stepTrim = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1.4, w - 0.92), 0.02, 0.03), mats.stepLed);
      stepTrim.position.set(0, riserHeightM - 0.015, riserZStartM + 0.01);
      roomShellGroup.add(stepTrim);
    }

    // 5. Dynamic Theater Seating Rows
    layout.seats.forEach(s => buildSeatMesh(s.xMeters, s.riserHeightM, s.zMeters));

    // Primary Sweet Spot Target Ring
    const sweetSpotRing = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.62, 42), mats.sweetSpotRing);
    sweetSpotRing.rotation.x = -Math.PI / 2;
    sweetSpotRing.position.set(0, 0.012, primarySeatZ);
    roomShellGroup.add(sweetSpotRing);

    // 6. 16:9 Projection Screen + Volumetric Beam + Rear Projector
    const screenGroup = new THREE.Group();
    screenGroup.position.set(0, screenCenterY, frontZ);
    roomShellGroup.add(screenGroup);

    const frame = new THREE.Mesh(
      new RoundedBoxGeometry(screenWidthM + 0.16, screenHeightM + 0.16, 0.07, 2, 0.02),
      mats.screenFrame,
    );
    frame.castShadow = true;
    screenGroup.add(frame);

    const surface = new THREE.Mesh(new THREE.PlaneGeometry(screenWidthM, screenHeightM), mats.screenSurface);
    surface.position.z = 0.04;
    screenGroup.add(surface);

    screenBounce.position.set(0, screenCenterY, frontZ + 0.55);

    // Rear ceiling/shelf projector housing + volumetric throw beam
    const projY = Math.min(layout.ceilingM - 0.25, screenCenterY + 0.92);
    const projectorBox = new THREE.Mesh(new RoundedBoxGeometry(0.46, 0.22, 0.42, 2, 0.02), mats.projectorBody);
    projectorBox.position.set(0, projY, projectorZ);
    projectorBox.castShadow = true;
    roomShellGroup.add(projectorBox);

    const projOrigin = new THREE.Vector3(0, projY - 0.04, projectorZ - 0.18);
    const projTarget = new THREE.Vector3(0, screenCenterY, frontZ + 0.05);
    const beamDist = projOrigin.distanceTo(projTarget);
    const beamGeo = new THREE.CylinderGeometry(0.06, Math.min(screenWidthM, screenHeightM) * 0.46, beamDist, 28, 1, true);
    const beamMesh = new THREE.Mesh(beamGeo, mats.projectorBeam);
    beamMesh.position.copy(projOrigin).lerp(projTarget, 0.5);
    beamMesh.quaternion.setFromUnitVectors(UP_VEC, new THREE.Vector3().subVectors(projOrigin, projTarget).normalize());
    roomShellGroup.add(beamMesh);

    // 7. Build Speaker Nodes + Directional Acoustic Dispersion Cones
    const listenerTarget = new THREE.Vector3(...layout.listenerHead3d);
    Object.values(layout.speakers).forEach(node => {
      const group = new THREE.Group();
      group.position.set(...node.pos3d);
      group.rotation.set(...node.rot3d);

      let woofer: THREE.Mesh | undefined;
      if (node.id === "C") {
        buildHorizontalCenterSpeaker(group);
      } else if (node.role === "screen") {
        buildFloorstandingSpeaker(group);
      } else if (node.role === "subwoofer") {
        woofer = buildSubwoofer(group);
      } else if (node.role === "surround") {
        buildSurroundSpeaker(group);
        if (node.id === "SL") {
          // Horizontal brass mounting arm tying SL cleanly into the full-height left wall
          const arm = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.03, 0.03), mats.brassTrim);
          arm.position.set(0, 0, -0.14);
          group.add(arm);
        } else {
          // Grounded slim brushed-brass pedestal stanchion above low cutaway wainscot curb
          const postH = Math.max(0.2, node.pos3d[1] - 0.22);
          const post = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, postH, 10), mats.brassTrim);
          post.position.set(0, -postH / 2 - 0.22, -0.02);
          group.add(post);
        }
      } else if (node.role === "height") {
        buildCeilingAtmos(group);
      }

      // Highlight halo ring at speaker base/center
      const hoverRingMat = new THREE.MeshBasicMaterial({
        color: 0xe6be79,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
      });
      const hoverRing = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.36, 28), hoverRingMat);
      hoverRing.rotation.x = -Math.PI / 2;
      hoverRing.position.y = node.role === "height" ? -0.1 : node.id === "C" ? -0.22 : 0.025;
      group.add(hoverRing);

      tagSpeakerHierarchy(group, node.id);
      speakersGroup.add(group);

      // Directional dispersion cone pointing cleanly from transducer center toward Listener Sweet Spot
      const acousticCenter = new THREE.Vector3(
        node.pos3d[0],
        node.pos3d[1] + (node.role === "screen" && node.id !== "C" ? 0.85 : node.role === "subwoofer" ? 0.31 : 0),
        node.pos3d[2],
      );
      const dir = new THREE.Vector3().subVectors(listenerTarget, acousticCenter);
      const coneLen = Math.max(0.9, Math.min(2.6, dir.length() * 0.62));
      dir.normalize();

      const coneMat = new THREE.MeshBasicMaterial({
        color: node.role === "height" ? 0xf3d59b : 0xdcb472,
        transparent: true,
        opacity: 0.06,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const coneGeo = new THREE.ConeGeometry(node.role === "subwoofer" ? 0.62 : 0.44, coneLen, 20, 1, true);
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.copy(acousticCenter).addScaledVector(dir, coneLen * 0.5);
      // Cone tip points at +Y -> align -Y (open base) toward listener by inverting vector
      coneMesh.quaternion.setFromUnitVectors(UP_VEC, dir.clone().negate());
      conesGroup.add(coneMesh);

      speakerRuntime.set(node.id, {
        id: node.id,
        role: node.role,
        group,
        cone: coneMesh,
        coneMat,
        woofer,
        hoverRing,
        centerPos: acousticCenter,
      });
    });

    // 8. Architectural Floor Dimension Guides (Perimeter width, depth & projector throw)
    const lineMat = new THREE.LineDashedMaterial({ color: 0xd9b272, dashSize: 0.16, gapSize: 0.1, transparent: true, opacity: 0.85 });
    const yDim = 0.03;
    const widthPts = [new THREE.Vector3(-w / 2 + 0.1, yDim, -l / 2 + 0.18), new THREE.Vector3(w / 2 - 0.1, yDim, -l / 2 + 0.18)];
    const depthPts = [new THREE.Vector3(w / 2 - 0.18, yDim, -l / 2 + 0.1), new THREE.Vector3(w / 2 - 0.18, yDim, l / 2 - 0.1)];
    const throwPts = [new THREE.Vector3(0, yDim, frontZ), new THREE.Vector3(0, yDim, projectorZ)];

    [widthPts, depthPts, throwPts].forEach(pts => {
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const line = new THREE.Line(geo, lineMat);
      line.computeLineDistances();
      dimensionsGroup.add(line);
    });
    dimensionsGroup.visible = showDimensionsEnabled;

    applyActiveConfigVisibility();
  }

  function applyActiveConfigVisibility() {
    const activeIds = new Set(ACTIVE_SPEAKER_IDS[currentConfig] || []);
    speakerRuntime.forEach((item, id) => {
      const visible = activeIds.has(id);
      item.group.visible = visible;
      if (item.cone) item.cone.visible = visible && soundConesEnabled;
    });
    rebuildRayLines();
  }

  function rebuildRayLines() {
    disposeGroupChildren(raysGroup, sharedMatsSet);
    const activeIds = new Set(ACTIVE_SPEAKER_IDS[currentConfig] || []);
    const targetHead = new THREE.Vector3(...currentLayout.listenerHead3d);

    speakerRuntime.forEach((item, id) => {
      if (!activeIds.has(id)) return;
      const isDirect = hoveredSpeakerId === id || highlightedRole === item.role || isSweetSpotFocused;
      if (!isDirect) return;

      const geo = new THREE.BufferGeometry().setFromPoints([item.centerPos.clone(), targetHead.clone()]);
      const line = new THREE.Line(
        geo,
        new THREE.LineDashedMaterial({
          color: hoveredSpeakerId === id ? 0xf6dca8 : 0xdcb472,
          dashSize: 0.14,
          gapSize: 0.08,
          transparent: true,
          opacity: hoveredSpeakerId === id ? 1.0 : 0.72,
        }),
      );
      line.computeLineDistances();
      raysGroup.add(line);
    });
  }

  // Camera Orbit & Preset Interpolation State
  let dragOrbitYaw = 0;
  let dragOrbitPitch = 0;
  let pointerYaw = 0;
  let pointerPitch = 0;

  function computePresetPose(preset: CameraPreset): { pos: THREE.Vector3; target: THREE.Vector3; fov: number } {
    const w = currentLayout.widthM;
    const l = currentLayout.lengthM;
    if (preset === "seat") {
      const seatEye = new THREE.Vector3(0, 1.18, currentLayout.primarySeatZ);
      const screenLook = new THREE.Vector3(0, currentLayout.screenCenterY, currentLayout.frontZ);
      return { pos: seatEye, target: screenLook, fov: 52 };
    }
    if (preset === "top") {
      return {
        pos: new THREE.Vector3(0, Math.max(9.2, Math.max(w, l) * 1.42), 0.22),
        target: new THREE.Vector3(0, 0, -0.08),
        fov: 44,
      };
    }
    return {
      pos: new THREE.Vector3(w * 0.62 + 1.85, 3.65, l * 0.56 + 2.1),
      target: new THREE.Vector3(0, 0.88, -0.25),
      fov: 44,
    };
  }

  const initialPose = computePresetPose(currentPreset);
  const curCamPos = initialPose.pos.clone();
  const curCamTarget = initialPose.target.clone();
  let curCamFov = initialPose.fov;
  camera.position.copy(curCamPos);
  camera.fov = curCamFov;
  camera.lookAt(curCamTarget);
  camera.updateProjectionMatrix();

  // Pointer Drag + Click Raycaster
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let isDragging = false;
  let downX = 0;
  let downY = 0;
  let prevX = 0;
  let prevY = 0;

  function pickSpeakerId(clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(ndc, camera);
    const activeRoots = Array.from(speakerRuntime.values())
      .filter(r => r.group.visible)
      .map(r => r.group);
    const hits = raycaster.intersectObjects(activeRoots, true);
    return (hits[0]?.object.userData.speakerId as string | undefined) ?? null;
  }

  const onPointerDown = (e: MouseEvent | TouchEvent) => {
    isDragging = true;
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;
    downX = cx;
    downY = cy;
    prevX = cx;
    prevY = cy;
  };

  const onPointerMove = (e: MouseEvent | TouchEvent) => {
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const cy = "touches" in e ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
      const dx = cx - prevX;
      const dy = cy - prevY;
      prevX = cx;
      prevY = cy;
      dragOrbitYaw -= dx * 0.0055;
      dragOrbitPitch = Math.max(-0.42, Math.min(0.42, dragOrbitPitch - dy * 0.0045));
    } else if ("clientX" in e) {
      const rect = canvas.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
        pointerYaw = -nx * 0.09;
        pointerPitch = -ny * 0.05;
      }
      const hit = pickSpeakerId(e.clientX, e.clientY);
      canvas.style.cursor = hit ? "pointer" : "grab";
    }
  };

  const onPointerUp = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    isDragging = false;
    const cx = "changedTouches" in e ? e.changedTouches[0]?.clientX ?? downX : e.clientX;
    const cy = "changedTouches" in e ? e.changedTouches[0]?.clientY ?? downY : e.clientY;
    const distMoved = Math.hypot(cx - downX, cy - downY);
    if (distMoved < 6) {
      const hit = pickSpeakerId(cx, cy);
      if (hit) {
        selectCallback?.(hoveredSpeakerId === hit ? null : hit);
      } else if (hoveredSpeakerId) {
        selectCallback?.(null);
      }
    }
  };

  canvas.addEventListener("mousedown", onPointerDown);
  canvas.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  canvas.addEventListener("touchstart", onPointerDown, { passive: true });
  canvas.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("touchend", onPointerUp);

  rebuildRoomFromLayout(currentLayout);

  // Main Animation Loop & Scratch Vectors (zero per-frame heap churn)
  let animId = 0;
  const clock = new THREE.Clock();
  const scratchOffset = new THREE.Vector3();
  const scratchGoalPos = new THREE.Vector3();
  const scratchGoalTarget = new THREE.Vector3();
  const scratchDesiredPos = new THREE.Vector3();
  const scratchDesiredTarget = new THREE.Vector3();

  function renderFrame(delta: number) {
    const elapsed = clock.elapsedTime;

    // 1. Animate Lights On <-> Cinema Dark Mode transition (frame-rate independent)
    const desiredLit = targetLightsOn ? 1 : 0;
    const litStep = isReducedMotion ? 1 : Math.min(1, delta * 5.2);
    litProgress += (desiredLit - litProgress) * litStep;

    scratchBg.copy(bgLit).lerp(bgDark, 1 - litProgress);
    scene.background = scratchBg;
    hemiLight.intensity = 0.08 + litProgress * 1.28;
    keyLight.intensity = 0.12 + litProgress * 1.45;
    fillLight.intensity = 0.03 + litProgress * 0.5;
    mats.coveLed.emissiveIntensity = 0.22 + litProgress * 1.2;
    mats.stepLed.emissiveIntensity = 1.45 - litProgress * 0.55;
    mats.screenSurface.emissiveIntensity = 0.34 + (1 - litProgress) * 1.05;
    screenBounce.intensity = 0.55 + (1 - litProgress) * 1.95;

    const beamPulse = soundConesEnabled && !isReducedMotion ? Math.sin(elapsed * 8) * 0.008 : 0;
    mats.projectorBeam.opacity = 0.02 + (1 - litProgress) * 0.14 + beamPulse;

    // 2. Smooth Camera Glide Across Presets + Drag Orbit
    const goal = computePresetPose(currentPreset);
    scratchGoalPos.copy(goal.pos);
    scratchGoalTarget.copy(goal.target);
    scratchDesiredPos.copy(scratchGoalPos);
    scratchDesiredTarget.copy(scratchGoalTarget);

    if (currentPreset === "studio") {
      scratchOffset.copy(scratchGoalPos).sub(scratchGoalTarget);
      const radiusXZ = Math.hypot(scratchOffset.x, scratchOffset.z);
      const baseYaw = Math.atan2(scratchOffset.x, scratchOffset.z);
      const yaw = baseYaw + dragOrbitYaw + (isReducedMotion ? 0 : pointerYaw);
      const yVal = Math.max(1.2, scratchGoalPos.y + (dragOrbitPitch + (isReducedMotion ? 0 : pointerPitch)) * 2.4);
      scratchDesiredPos.set(
        scratchGoalTarget.x + Math.sin(yaw) * radiusXZ,
        yVal,
        scratchGoalTarget.z + Math.cos(yaw) * radiusXZ,
      );
    } else if (currentPreset === "seat") {
      const yawLook = (dragOrbitYaw + (isReducedMotion ? 0 : pointerYaw * 0.5)) * 1.8;
      const pitchLook = (dragOrbitPitch + (isReducedMotion ? 0 : pointerPitch * 0.5)) * 1.1;
      scratchDesiredTarget.set(yawLook, currentLayout.screenCenterY + pitchLook, currentLayout.frontZ);
    }

    const camAlpha = isReducedMotion ? 1 : Math.min(1, delta * 6.5);
    curCamPos.lerp(scratchDesiredPos, camAlpha);
    curCamTarget.lerp(scratchDesiredTarget, camAlpha);
    curCamFov += (goal.fov - curCamFov) * camAlpha;

    camera.position.copy(curCamPos);
    camera.fov = curCamFov;
    camera.lookAt(curCamTarget);
    camera.updateProjectionMatrix();

    // 3. Acoustic Dispersion Cone Breathing & Woofer Physics
    speakerRuntime.forEach((item, id) => {
      if (!item.group.visible) return;
      const isFocused = hoveredSpeakerId === id || highlightedRole === item.role;

      if (item.woofer) {
        item.woofer.position.z =
          soundConesEnabled && !isReducedMotion ? 0.3 + Math.sin(elapsed * 8.5) * 0.03 : 0.3;
      }

      if (item.cone && item.coneMat) {
        item.cone.visible = soundConesEnabled || isFocused;
        const pulse = soundConesEnabled && !isReducedMotion ? 0.5 + 0.5 * Math.sin(elapsed * 3.0) : 0.5;
        item.coneMat.opacity = isFocused ? 0.16 : 0.045 + pulse * 0.045;
      }

      if (item.hoverRing) {
        const ringMat = item.hoverRing.material as THREE.MeshBasicMaterial;
        const targetOp = isFocused ? 0.85 : 0;
        ringMat.opacity = isReducedMotion ? targetOp : ringMat.opacity + (targetOp - ringMat.opacity) * 0.18;
      }
    });

    mats.sweetSpotRing.opacity =
      soundConesEnabled && !isReducedMotion ? 0.45 + Math.sin(elapsed * 3.5) * 0.16 : 0.52;

    renderer.render(scene, camera);
  }

  function animate() {
    if (isPaused) {
      animId = 0;
      return;
    }
    animId = requestAnimationFrame(animate);
    const delta = Math.min(0.1, clock.getDelta());
    renderFrame(delta);
  }

  function wakeRenderLoop() {
    if (!isPaused && animId === 0) {
      clock.getDelta();
      animate();
    } else if (isPaused) {
      renderFrame(0.05);
    }
  }

  animate();

  return {
    setConfig(configId) {
      if (currentConfig === configId) return;
      currentConfig = configId;
      applyActiveConfigVisibility();
      wakeRenderLoop();
    },
    setLayout(layout) {
      if (currentLayout === layout) return;
      rebuildRoomFromLayout(layout);
      wakeRenderLoop();
    },
    setLightsOn(lightsOn) {
      targetLightsOn = lightsOn;
      wakeRenderLoop();
    },
    setCameraPreset(preset) {
      if (currentPreset === preset) return;
      currentPreset = preset;
      dragOrbitYaw = 0;
      dragOrbitPitch = 0;
      wakeRenderLoop();
    },
    setSoundCones(show) {
      soundConesEnabled = show;
      applyActiveConfigVisibility();
      wakeRenderLoop();
    },
    setShowDimensions(show) {
      showDimensionsEnabled = show;
      dimensionsGroup.visible = show;
      wakeRenderLoop();
    },
    setHoveredSpeaker(speakerId) {
      if (hoveredSpeakerId === speakerId) return;
      hoveredSpeakerId = speakerId;
      rebuildRayLines();
      wakeRenderLoop();
    },
    setHighlightRole(role) {
      if (highlightedRole === role) return;
      highlightedRole = role;
      rebuildRayLines();
      wakeRenderLoop();
    },
    setSweetSpotFocus(focus) {
      if (isSweetSpotFocused === focus) return;
      isSweetSpotFocused = focus;
      rebuildRayLines();
      wakeRenderLoop();
    },
    setReducedMotion(reduced) {
      isReducedMotion = reduced;
      wakeRenderLoop();
    },
    setPaused(paused) {
      if (isPaused === paused) return;
      isPaused = paused;
      if (paused && animId !== 0) {
        cancelAnimationFrame(animId);
        animId = 0;
      } else if (!paused) {
        wakeRenderLoop();
      }
    },
    resetCamera() {
      currentPreset = "studio";
      dragOrbitYaw = 0;
      dragOrbitPitch = 0;
      pointerYaw = 0;
      pointerPitch = 0;
      wakeRenderLoop();
    },
    resize() {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
      renderFrame(0.016);
    },
    destroy() {
      isPaused = true;
      cancelAnimationFrame(animId);
      animId = 0;
      canvas.removeEventListener("mousedown", onPointerDown);
      canvas.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      canvas.removeEventListener("touchstart", onPointerDown);
      canvas.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("touchend", onPointerUp);

      disposeGroupChildren(roomShellGroup, sharedMatsSet);
      disposeGroupChildren(speakersGroup, sharedMatsSet);
      disposeGroupChildren(conesGroup, sharedMatsSet);
      disposeGroupChildren(raysGroup, sharedMatsSet);
      disposeGroupChildren(dimensionsGroup, sharedMatsSet);
      sharedMatsSet.forEach(mat => mat.dispose());
      screenTexture?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      scene.clear();
    },
  };
}
